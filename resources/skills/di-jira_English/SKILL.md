---
name: di-jira
description: Jira operations specialist for the DTS (Linker) workflow in the Logistics Team Jira. Use when the user needs to create tickets, review issues, search work items, check sprint progress, change statuses, follow up on PO review, add comments, assign work, log hours, or mentions Jira-specific terms such as "Jira", "ticket", "issue", "sprint", or "DTS-" keys. Do not use for coding, debugging, code review, or other non-Jira tasks.
metadata:
  {
    "openclaw":
      {
        "emoji": "🎯",
        "requires": { "bins": ["curl"], "env": ["JIRA_USER", "JIRA_PASS"] },
        "primaryEnv": "JIRA_USER",
      },
  }
---

# Jira Workflow Agent

Use this skill for consistent Jira operations in the DTS (Linker) project. Work directly through the Jira REST API. Understand the project's custom fields, workflow states, and team conventions before making changes.

## Read references only when needed

- Read `references/field-mapping.md` when you need custom field IDs or payload formats.
- Read `references/jql-templates.md` when you need common JQL patterns.
- Read `references/team-workflow.md` when you need role-specific guidance or team process details.

## 1. Authentication

Use Basic Auth. Read credentials from the environment variables `JIRA_USER` and `JIRA_PASS`.

If the variables are missing, stop and ask the user to configure them before proceeding.

- **Base URL:** `https://jira.logisticsteam.com`
- **REST API:** `/rest/api/2`
- **Agile API:** `/rest/agile/1.0`

### Special-character safety

Passwords may contain characters such as `!`, `$`, or `` ` `` that shell expansion can corrupt. Do not use `curl -u`. Build the Authorization header through an inline Python heredoc instead:

```bash
curl -s -H "Authorization: Basic $(python3 << 'PYEOF'
import base64, os
u = os.environ['JIRA_USER']
p = os.environ['JIRA_PASS']
print(base64.b64encode(f'{u}:{p}'.encode()).decode())
PYEOF
)" "https://jira.logisticsteam.com/rest/api/2/myself"
```

The single-quoted heredoc keeps the password unchanged.

## 2. API operations

### 2.1 Inspect an issue with full analysis

When the user asks to review an issue, do more than print raw fields. Run the full analysis flow: fetch the issue, inspect comments, inspect relevant attachments, and summarize the current state clearly.

```bash
curl -s -H "Authorization: Basic $(python3 << 'PYEOF'
import base64, os
u = os.environ['JIRA_USER']
p = os.environ['JIRA_PASS']
print(base64.b64encode(f'{u}:{p}'.encode()).decode())
PYEOF
)" "https://jira.logisticsteam.com/rest/api/2/issue/{issueKey}?expand=names,changelog"
```

Recommended analysis flow:
1. Parse the key fields, including status, ownership, story points, sprint, and any project-specific fields. See `references/field-mapping.md`.
2. Review `fields.comment.comments[]` and extract the important point from each comment.
3. Review `fields.attachment[]`. For image attachments, download them, inspect them with the Read tool, summarize what they show, then clean up temporary files.
4. Return a structured summary: basic info, ownership, problem summary, timeline, comment summary, attachment findings, current status, and likely next steps.

### 2.2 Create an issue

```bash
# POST /rest/api/2/issue
# Required: project.key, summary, issuetype.name
# Recommended: priority.name, assignee, description, customfield_11103 (Developer), customfield_11102 (QA)
```

### 2.3 Create a sub-task

Use the same pattern as issue creation, but also include `parent.key` and set `issuetype.name` to `Sub-task`.

### 2.4 Update issue fields

```bash
# PUT /rest/api/2/issue/{issueKey}
# body: {"fields": {fieldName: value}}
```

### 2.5 Assign an issue

```bash
# PUT /rest/api/2/issue/{issueKey}/assignee
# body: {"name": "username"}
```

### 2.6 Transition an issue

Transition IDs are not the same as status IDs. Always query available transitions before trying to move an issue.

```bash
# Query available transitions
GET /rest/api/2/issue/{issueKey}/transitions

# Execute transition
POST /rest/api/2/issue/{issueKey}/transitions
# body: {"transition":{"id":"xxx"}}
```

If the target status is not directly available, use a stepwise transition workflow:

1. Tell the user the target status cannot be reached directly.
2. Show the currently available transitions.
3. After confirmation, repeat:
   - query current transitions
   - choose the transition that moves closest to the target
   - execute it
4. After each move, report progress briefly, for example: `New -> Planned for Sprint ✓ -> In Dev ✓`
5. Re-query the issue at the end and confirm the final status.

Do not assume a fixed workflow path. Decide each step from the live transition list.

### 2.7 Add a comment

```bash
# POST /rest/api/2/issue/{issueKey}/comment
# body: {"body": "comment text"}
```

### 2.8 JQL search

```bash
# GET /rest/api/2/search?jql={encodedJQL}&fields=summary,status,assignee,priority&maxResults=50
```

Use `references/jql-templates.md` for common starting points.

### 2.9 Check sprint information

```bash
# GET /rest/agile/1.0/board/{boardId}/sprint?state=active
# BA board: boardId=127
# PM board: boardId=101
```

### 2.10 Log work

```bash
# POST /rest/api/2/issue/{issueKey}/worklog
# body: {"timeSpent":"2h","comment":"xxx"}
```

### 2.11 Calculate developer work-hour totals

Use this flow when the user asks about "my hours", "developer hours", or "current sprint hours".

Key rules:
- Query by the **Developer** field, `cf[11103]`, not `assignee`, because assignee may be QA or BA.
- Use an **exact sprint ID**, not `openSprints()`, because multiple active sprints can pollute the result set.
- Exclude legacy carryover items by keeping only issues where `customfield_10005` contains exactly one sprint.
- Avoid double counting parent and sub-task work. If both appear, keep the sub-task and drop the parent.

Preferred workflow, executed as a single Python script:

```bash
python3 << 'PYEOF'
import json, urllib.request, urllib.parse, base64, os

user = os.environ['JIRA_USER']
pwd  = os.environ['JIRA_PASS']
auth = base64.b64encode(f'{user}:{pwd}'.encode()).decode()
headers = {'Authorization': f'Basic {auth}', 'Content-Type': 'application/json'}
BASE = 'https://jira.logisticsteam.com'

# Step 1: get the current active DI sprint from board 127
req = urllib.request.Request(f'{BASE}/rest/agile/1.0/board/127/sprint?state=active', headers=headers)
sprints = json.load(urllib.request.urlopen(req))['values']
di_sprint = [s for s in sprints if 'DI' in s['name']][-1]
sprint_id, sprint_name = di_sprint['id'], di_sprint['name']

# Step 2: query by Developer field and exact sprint ID
jql = f'cf[11103]={user} AND sprint={sprint_id} AND project=DTS'
fields = 'summary,status,issuetype,parent,customfield_10002,customfield_11602,customfield_12617,customfield_10005'
url = f'{BASE}/rest/api/2/search?jql={urllib.parse.quote(jql)}&fields={fields}&maxResults=50'
req = urllib.request.Request(url, headers=headers)
issues = json.load(urllib.request.urlopen(req))['issues']

# Step 3: filter out legacy items that span multiple sprints
current = [i for i in issues if len(i['fields'].get('customfield_10005') or []) == 1]

# Step 4: remove parent items when matching sub-tasks are present
sub_parents = {i['fields']['parent']['key'] for i in current if i['fields'].get('parent')}
current = [i for i in current if i['key'] not in sub_parents]

# Output results
total_sp, total_hours = 0, 0
for i in current:
    f = i['fields']
    sp = f.get('customfield_10002') or 0
    dh = f.get('customfield_11602') or 0
    coding = f.get('customfield_12617') or '-'
    itype = 'Sub' if f['issuetype'].get('subtask') else f['issuetype']['name']
    total_sp += sp
    total_hours += dh
    print(f"{i['key']} | {itype} | {f['summary']} | SP:{sp} | DevH:{dh} | Coding:{coding} | {f['status']['name']}")
print(f'--- {sprint_name} | Total: SP={total_sp}, Dev Hours={total_hours}, Issues={len(current)} ---')
PYEOF
```

### 2.12 Search users

```bash
# GET /rest/api/2/user/search?username={keyword}&maxResults=5
```

Search strategy:
- try an exact match first
- if needed, split the name and retry with a surname or partial match
- cache successful lookups during the task

## 3. Issue types

| Name | ID | Sub-task |
|------|----|----------|
| Story | 10001 | No |
| Bug | 1 | No |
| Task | 3 | No |
| Epic | 10000 | No |
| Sub-task | 5 | Yes |

## 4. Priority mapping

| Jira name | User shorthand | Meaning |
|-----------|----------------|---------|
| Blocker | Blocker | Blocks operations, fix immediately |
| Urgent | Urgent | Must be fixed today |
| Critical | Critical | Release as soon as ready |
| Major | P0/P1 | Target the next sprint |
| Normal | P2 | Next available sprint |
| Minor | Low | Workaround exists |
| Trivial | Lowest | Cosmetic issue |

## 5. Status flow

```
New -> Planned for Sprint -> In Dev -> Dev Completed -> Released to Staging
-> QA Testing -> Ready for PO Review -> PO Review Pass -> Released -> Closed
```

Exception paths:
- `Test Failed -> In Dev`
- `PO Review Failed -> In Dev`

For non-direct paths, follow the stepwise transition workflow in section 2.6.

## 6. Execution rules

### Operation classes

Execute these directly:
- view an issue
- run JQL searches
- check sprint progress
- inspect attachments

Preview before executing these writes unless the user explicitly says to proceed immediately:
- create
- update
- assign
- transition
- comment
- log work

### Write-operation workflow

1. Build the request and fill sensible defaults when appropriate. Default project is `DTS`, default priority is `Normal`, and default issue type is `Story` unless the user specifies otherwise.
2. Show a concise preview.
3. Wait for confirmation unless the user clearly requested direct execution.
4. Execute the API call.
5. Verify the result. For creates, fetch and summarize the new issue. For updates, show the effective change.

### Error handling

| Status code | Response |
|-------------|----------|
| 401 | Tell the user to check Jira credentials |
| 403 | Tell the user they do not have permission |
| 404 | Tell the user to verify the issue key or route |
| 400 | Re-check field names, payload shape, and value formats |
