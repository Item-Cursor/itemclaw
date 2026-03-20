param(
  [ValidateSet('assigned-daily','open-daily','dept-open-daily')]
  [string]$Mode = 'assigned-daily',
  [string]$Date,
  [string]$DepartmentIdsCsv
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$MAX_TICKETS = 100
$BASE = 'https://unisticket.item.com/api/item-tickets/v1/staff'
$TOKEN = $env:UNIS_TICKET_TOKEN
if (-not $TOKEN) { throw 'UNIS_TICKET_TOKEN is not set' }

if (-not $Date) { $Date = (Get-Date).ToString('MM/dd/yyyy') }
$createStart = "$Date 00:00:00"
$createEnd = "$Date 23:59:59"

$hAuth = @{
  'x-tickets-token'    = $TOKEN
  'User-Agent'         = 'ItemClaw-TicketSkill/1.0'
  'x-tickets-timezone' = 'America/Los_Angeles'
}
$hPost = @{
  'x-tickets-token' = $TOKEN
  'User-Agent'      = 'ItemClaw-TicketSkill/1.0'
  'Content-Type'    = 'application/json'
}

$auth = Invoke-RestMethod -Method Get -Uri "$BASE/auth/current" -Headers $hAuth -TimeoutSec 25

# Build input filter per mode
$input = @{}
switch ($Mode) {
  'assigned-daily' {
    # Direct API filtering for current authenticated user
    $input.staffId = [int64]$auth.data.id
    $input.staffIds = @([int64]$auth.data.id)
    $input.dateField = 1
    $input.createTimeStart = $createStart
    $input.createTimeEnd = $createEnd
    $input.displayStatusSystemStatus = @(10,20)
  }
  'open-daily' {
    $input.dateField = 1
    $input.createTimeStart = $createStart
    $input.createTimeEnd = $createEnd
    $input.displayStatusSystemStatus = @(10)
  }
  'dept-open-daily' {
    $deptIds = @()
    if ($DepartmentIdsCsv) {
      $deptIds = $DepartmentIdsCsv.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    } else {
      $deptIds = @($auth.data.accessibleDepartmentIds)
    }
    $input.departmentIds = $deptIds
    $input.dateField = 1
    $input.createTimeStart = $createStart
    $input.createTimeEnd = $createEnd
    $input.displayStatusSystemStatus = @(10)
  }
}

# Hard stop-gap cap: one page only, max 100
$bodyObj = @{
  size = $MAX_TICKETS
  page = 1
  input = $input
}
$body = $bodyObj | ConvertTo-Json -Depth 10
$resp = Invoke-RestMethod -Method Post -Uri "$BASE/tickets/page" -Headers $hPost -Body $body -TimeoutSec 45
$apiRecords = @($resp.data.records)
if ($apiRecords.Count -gt $MAX_TICKETS) { $apiRecords = $apiRecords | Select-Object -First $MAX_TICKETS }

# Direct API filtering is the source of truth in assigned-daily mode.
$records = $apiRecords
$authStaffId = [string]$auth.data.id

function Get-StatusName($t) {
  if ($t.displayStatusName) { return [string]$t.displayStatusName }
  if ($t.statusName) { return [string]$t.statusName }
  if ($t.status) { return [string]$t.status }
  return 'Unknown'
}
function Get-PriorityName($t) {
  if ($t.priorityName) { return [string]$t.priorityName }
  if ($t.priority) { return [string]$t.priority }
  return 'Unknown'
}
function Get-DepartmentName($t) {
  if ($t.departmentName) { return [string]$t.departmentName }
  if ($t.department.name) { return [string]$t.department.name }
  return 'Unknown'
}
function Is-Closed($statusName) {
  $s = $statusName.ToLower()
  return ($s -match 'closed|done|resolved|completed|solved|已关闭|已解决|完成')
}
function Is-Overdue($t) {
  if ($t.isOverdue -ne $null) { return [bool]$t.isOverdue }
  return $false
}
function Is-SlaBreached($t) {
  if ($t.isSlaBreached -ne $null) { return [bool]$t.isSlaBreached }
  foreach($k in 'slaBreached','isTimeout','timeout','isViolateSla') {
    if ($t.$k -ne $null) { return [bool]$t.$k }
  }
  return $false
}
function Get-UpdatedTs($t) {
  foreach($k in 'updateTime','updatedAt','gmtModified','lastUpdateTime','modifiedAt','createTime','createdAt') {
    $v = $t.$k
    if ($null -ne $v) {
      if ($v -is [int64] -or $v -is [int] -or $v -is [double]) { return [int64]$v }
      try { return [DateTimeOffset]::Parse([string]$v).ToUnixTimeMilliseconds() } catch {}
    }
  }
  return 0
}
function Get-TicketId($t){
  foreach($k in 'ticketNumber','ticketId','id','code','sn','ticketNo','number') { if ($t.$k) { return [string]$t.$k } }
  return 'unknown-id'
}
function Get-TicketTitle($t){
  foreach($k in 'title','subject','name','summary') { if ($t.$k) { return [string]$t.$k } }
  return '(no title)'
}

$total = $records.Count
$open = 0; $closed = 0; $overdue = 0; $sla = 0
$statusMap = @{}; $prioMap = @{}; $deptMap = @{}
$queue = @()

foreach($t in $records){
  $status = Get-StatusName $t
  $prio = Get-PriorityName $t
  $dept = Get-DepartmentName $t
  $isClosed = Is-Closed $status
  $isOver = Is-Overdue $t
  $isSla = Is-SlaBreached $t

  if ($isClosed) { $closed++ } else { $open++ }
  if ($isOver) { $overdue++ }
  if ($isSla) { $sla++ }

  if (-not $statusMap.ContainsKey($status)) { $statusMap[$status] = 0 }; $statusMap[$status]++
  if (-not $prioMap.ContainsKey($prio)) { $prioMap[$prio] = 0 }; $prioMap[$prio]++
  if (-not $deptMap.ContainsKey($dept)) { $deptMap[$dept] = 0 }; $deptMap[$dept]++

  if (-not $isClosed) {
    $rank = if ($isSla) { 0 } elseif ($isOver) { 1 } else { 2 }
    $queue += [PSCustomObject]@{
      rank = $rank
      updated = (Get-UpdatedTs $t)
      id = (Get-TicketId $t)
      title = (Get-TicketTitle $t)
      status = $status
      priority = $prio
      dept = $dept
    }
  }
}

$queue = $queue | Sort-Object @{Expression='rank';Ascending=$true}, @{Expression='updated';Ascending=$false}

Write-Output 'Ticket KPIs (Assigned to current authenticated user)'
Write-Output "Total tickets: $total"
Write-Output "Open tickets: $open"
Write-Output "Closed tickets: $closed"
Write-Output "Overdue tickets: $overdue"
Write-Output "SLA-breached tickets: $sla"
Write-Output ''
Write-Output 'Breakdowns'
Write-Output 'By status:'
if ($statusMap.Count -eq 0) { Write-Output '- none (0)' } else { $statusMap.Keys | Sort-Object | ForEach-Object { Write-Output "- $_ ($($statusMap[$_]))" } }
Write-Output 'By priority:'
if ($prioMap.Count -eq 0) { Write-Output '- none (0)' } else { $prioMap.Keys | Sort-Object | ForEach-Object { Write-Output "- $_ ($($prioMap[$_]))" } }
Write-Output 'By department:'
if ($deptMap.Count -eq 0) { Write-Output '- none (0)' } else { $deptMap.Keys | Sort-Object | ForEach-Object { Write-Output "- $_ ($($deptMap[$_]))" } }
Write-Output ''
Write-Output 'Action Queue (Open tickets prioritized)'
if ($queue.Count -eq 0) { Write-Output 'none' } else {
  foreach($q in $queue){ Write-Output ("- [{0}] {1} | {2} | {3} | {4}" -f $q.id,$q.title,$q.status,$q.priority,$q.dept) }
}

Write-Output ''
if ($Mode -eq 'assigned-daily') {
  Write-Output ("Note: Direct API assignee filter applied with staffId={0}; API returned {1} records (total={2})." -f $authStaffId, $records.Count, [int]$resp.data.total)
} elseif ([int]$resp.data.total -gt $MAX_TICKETS) {
  Write-Output ("Note: API total was {0}, capped processing to first {1} tickets (stop-gap mode)." -f [int]$resp.data.total, $MAX_TICKETS)
}
