---
name: unis-ticket-reporting
description: Generate consistent Unis Ticket user/department reports from a minimal end-to-end flow.
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "requires": { "bins": ["curl"], "env": ["UNIS_TICKET_TOKEN"] },
        "primaryEnv": "UNIS_TICKET_TOKEN",
      },
  }
---

# Unis Ticket Reporting (Minimal Complete Flow)

## Goal

1. Resolve `staffId` and `departmentIds` (memory first, API fallback)
2. Pull all matching tickets
3. Compute stable KPIs and prioritized action queue
4. Return a deterministic user-facing summary

## Required headers

- `x-tickets-token: $env:UNIS_TICKET_TOKEN`
- `X-Tenant-Id: 1` (Unisco default unless your tenant differs)
- `User-Agent: ItemClaw-TicketSkill/1.0`
- `Content-Type: application/json` (POST)
- `x-tickets-timezone: America/Los_Angeles` on `/auth/current`

## Token refresh + env sync

- If authentication fails (401/403 or token-invalid response), stop and ask for a fresh sign-in in the ClawX Skills UI.
- Re-authentication in ClawX refreshes the token and updates `UNIS_TICKET_TOKEN` for both `unis-ticket` and `unis-ticket-reporting`.
- Always use `$env:UNIS_TICKET_TOKEN` as the single source of truth for auth headers.

Base URL: `https://unisticket.item.com/api/item-tickets/v1/staff`

Runner script: `run-report.ps1`

Example commands:
- `powershell -NoProfile -ExecutionPolicy Bypass -File ~/.openclaw/skills/unis-ticket-reporting/run-report.ps1 -Mode assigned-daily`
- `powershell -NoProfile -ExecutionPolicy Bypass -File ~/.openclaw/skills/unis-ticket-reporting/run-report.ps1 -Mode open-daily -Date 03/20/2026`
- `powershell -NoProfile -ExecutionPolicy Bypass -File ~/.openclaw/skills/unis-ticket-reporting/run-report.ps1 -Mode dept-open-daily -DepartmentIdsCsv "4,316285263552864256"`

## Flow

1. `GET /auth/current` for identity context
2. Build `input` filters (use direct `staffId`/`staffIds` for assigned-user mode; default to `dateField=3` with `updateTimeStart`/`updateTimeEnd`)
3. `POST /tickets/page` using a **hard stop-gap cap**:
   - request only `page=1`, `size=100`
   - do not fetch additional pages in stop-gap mode
   - enforce `MAX_TICKETS = 100` in code even if request params change
4. For assigned-user reports, apply direct API assignee filtering:
   - `input.staffId = auth/current.data.id`
   - `input.staffIds = [auth/current.data.id]`
5. Compute from returned records:
   - total, open, closed, overdue, SLA-breached
   - by status / priority / department
   - action queue priority: SLA-breached > overdue > open > newest update
6. For any ticket-level analysis (summary, escalation notes, suggested reply), pull timeline via `POST /tickets/{ticketId}/timeline` before finalizing output.

## Request payload templates (stop-gap, max 100)

Use `input` object filters. Keep `size=100` and `page=1` for stop-gap mode.

### 1) Daily assigned-to-current-user (recommended default)

```json
{
  "size": 100,
  "page": 1,
  "input": {
    "staffId": 354064922684817408,
    "staffIds": [354064922684817408],
    "dateField": 3,
    "updateTimeStart": "MM/DD/YYYY 00:00:00",
    "updateTimeEnd": "MM/DD/YYYY 23:59:59",
    "displayStatusSystemStatus": [10, 20]
  }
}
```

### 2) Daily all open tickets

```json
{
  "size": 100,
  "page": 1,
  "input": {
    "dateField": 3,
    "updateTimeStart": "MM/DD/YYYY 00:00:00",
    "updateTimeEnd": "MM/DD/YYYY 23:59:59",
    "displayStatusSystemStatus": [10]
  }
}
```

### 3) Daily department-scoped open tickets

```json
{
  "size": 100,
  "page": 1,
  "input": {
    "departmentIds": [4, 316285263552864256],
    "dateField": 3,
    "updateTimeStart": "MM/DD/YYYY 00:00:00",
    "updateTimeEnd": "MM/DD/YYYY 23:59:59",
    "displayStatusSystemStatus": [10]
  }
}
```

## Guardrails (required)

- Never exceed `MAX_TICKETS = 100`.
- Stop-gap mode should not paginate beyond page 1.
- If `response.data.total > 100`, record that in notes but only process returned records.
- Prefer direct API assignee filters (`staffId` + `staffIds`) for assigned-user correctness.

## Ticket timeline drill-down (required for ticket-level insights)

Use timeline for per-ticket narrative context instead of guessing from the list row.

- Endpoint: `POST /tickets/{ticketId}/timeline`
- Body shape:

```json
{
  "page": 1,
  "size": 20,
  "input": {}
}
```

- Optional `input` filters: `type`, `types`, `sourceChannel`, `excludeMessageId`, `withReplyMessage`, `createTimeStart`, `createTimeEnd`, `updateTimeStart`, `updateTimeEnd`
- Message type enum: `1` MESSAGE, `2` SYSTEM, `3` INTERNAL_NOTE, `4` SIDE_CONVERSATION, `5` REPLY, `6` ESCALATION
- All timeline timestamps are UTC `MM/dd/yyyy HH:mm:ss`; convert to user timezone for display

## Deterministic output format

Use this section order exactly:

```text
Ticket KPIs (Assigned to current authenticated user)
Total tickets: <number>
Open tickets: <number>
Closed tickets: <number>
Overdue tickets: <number>
SLA-breached tickets: <number>

Breakdowns
By status:
- <statusName> (<count>)
By priority:
- <priorityName> (<count>)
By department:
- <departmentName> (<count>)

Action Queue (Open tickets prioritized)
<one ticket per line>
```

If there are zero tickets, still print all KPI lines and include explicit `none` entries in each breakdown.
