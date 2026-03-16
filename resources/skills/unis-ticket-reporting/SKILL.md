---
name: unis-ticket-reporting
description: Generate standardized daily UniTicket department reports with per-agent KPIs, executive summary, and prioritized action queue. Use when the user asks for ticket reporting, daily support metrics, SLA/overdue analysis, or department-level ticket summaries.
metadata:
  openclaw:
    emoji: "📊"
    requires:
      bins: ["curl"]
      env: ["UNIS_TICKET_API_KEY", "UNIS_TICKET_USER_AGENT"]
    primaryEnv: "UNIS_TICKET_API_KEY"
---

# UNIS Ticket Reporting - Core Execution Skill (v1.1)

## 1) Execution Goal
Standardize the generation of daily ticket reports for any specified department using the UniTicket API and local staff mapping.

## 2) Primary API Contract
**Endpoint:** `POST https://unisticket.item.com/api/item-tickets/v1/iam/tickets/page`

**Headers:**
- `x-api-key: <UNIS_TICKET_API_KEY>`
- `user-agent: <UNIS_TICKET_USER_AGENT>`
- `content-type: application/json`
- `accept: application/json`

**Request Body Template:**
```json
{
  "size": 100,
  "page": 1,
  "input": {
    "staffId": 0,
    "dateField": 1,
    "createTimeStart": "MM/DD/YYYY 00:00:00",
    "createTimeEnd": "MM/DD/YYYY 23:59:59",
    "displayStatusSystemStatus": [10, 20]
  }
}
```

Normalize numeric IDs to integer values before sending the request.

## 3) Local Staff Mapping
Use a local mapping source to resolve `staffId` values for the target department before calling the API.

Minimum mapping fields:
- `departmentId` or `departmentName`
- `staffId`
- `staffName`

## 4) Daily Run Procedure
1. Define report window (recommended: previous day in business timezone).
2. For each staff ID:
   - Call page API with `size=100`, `page=1`.
   - Read `data.total` and fetch remaining pages until all records are collected.
3. Compute per-agent KPIs:
   - Total tickets
   - Open (system status `10`)
   - Closed (system status `20`)
   - Overdue count (`isOverdue = true`)
   - SLA breached count (`isSlaBreached = true`)
   - Breakdown by `displayStatusName`
4. Produce two outputs:
   - **Executive summary** (counts and trends)
   - **Action queue** (open/overdue/SLA-breached tickets first)
5. Deliver report to the team channel and archive JSON/CSV snapshot.

## 5) Pagination Rules
- Always treat `data.total` as source of truth.
- Compute total pages as `ceil(total / size)`.
- Stop only after all pages are fetched or an explicit API error occurs.

## 6) Output Templates
### Executive Summary (template)
```markdown
# Daily UniTicket Report - <Department> - <YYYY-MM-DD>

- Report window: <start> to <end> (<timezone>)
- Agents covered: <count>
- Total tickets: <count>
- Open: <count>
- Closed: <count>
- Overdue: <count>
- SLA breached: <count>
- Trend vs prior period: <highlights>
```

### Action Queue (template)
```markdown
## Action Queue (Priority: Open + Overdue + SLA Breached)

| Priority | TicketNumber | Staff | DisplayStatus | Overdue | SLA Breached | Created Time |
|---|---|---|---|---|---|---|
| P1 | TK-00001 | <agent> | <status> | true | true | <timestamp> |
```

## 7) Status Code Reference
- `10` = open
- `20` = closed
- `30` = archived
- `40` = deleted

## 8) Operational Notes
- Use `curl.exe` on Windows to avoid PowerShell alias behavior.
- Retry transient failures (429/5xx) with short backoff.
- Keep raw JSON payload snapshots for audit and CSV exports for sharing.
