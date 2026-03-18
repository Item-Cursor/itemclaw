---
name: unis-ticket-reporting
description: Generate consistent UniTicket user/department reports from a minimal end-to-end flow. Use when user asks for daily ticket reports, KPI summaries, SLA/overdue analysis, action queues, or full ticket-number extraction for the authenticated user or a department.
---

# UniTicket Reporting (Minimal Complete Flow)

## Goal

Produce a consistent report by:

1. Resolving **staffId** and **departmentIds** (memory first, API fallback)
2. Pulling **all matching tickets** from the page endpoint
3. Computing stable KPIs and a prioritized action queue
4. Returning a clear, user-facing summary with ticket numbers

---

## Required Auth / Headers

Use:

- `x-tickets-token: $env:UNIS_TICKET_TOKEN`
- `User-Agent: ItemClaw-TicketSkill/1.0`
- `Content-Type: application/json` (POST)
- `x-tickets-timezone: America/Los_Angeles` (required on `/auth/current`)

Base URL:

- `https://unisticket.item.com/api/item-tickets/v1/staff`

---

## Step 1 — Resolve Identity Context (Memory First)

### 1A) Try memory first

If prior run data is available in memory/workspace, reuse:

- `staffId`
- `departmentIds`
- `timezone`
- Optional canonical scope (for example: `my tickets`, `department`)

### 1B) Fallback to API when missing or uncertain

Call:

- `GET /auth/current`

Extract and cache:

- `data.id` → `staffId`
- `data.departments[].id` → `departmentIds`
- `data.timezone`
- `data.name`, `data.username`, `data.email` (for report header)

Rule:

- If memory and API disagree, trust API and refresh cached values.

---

## Step 2 — Define Report Scope

Support these standard scopes:

### 2.1 My tickets (default)

- Filter: `staffId`

### 2.2 Department tickets

- Filter: `departmentIds` (single or multiple)

### 2.3 Status filter (optional)

- Open: `displayStatusSystemStatus: [10]`
- Closed: `displayStatusSystemStatus: [20]`
- All: omit field

### 2.4 Date range filter (optional)

- `createTimeStart`, `createTimeEnd`
- Format: `MM/dd/yyyy HH:mm:ss`

---

## Step 3 — Pull All Tickets via Page Endpoint

Endpoint:

- `POST /tickets/page`

Pagination contract:

- Start with `page=1`, `size=100`
- Read `data.total`
- Continue pages until collected count >= `total`

Minimal request body template:

```json
{
  "page": 1,
  "size": 100,
  "input": {
    "staffId": 354064922684817408,
    "departmentIds": [4],
    "displayStatusSystemStatus": [10, 20],
    "createTimeStart": "03/17/2026 00:00:00",
    "createTimeEnd": "03/17/2026 23:59:59"
  }
}
```

Notes:

- Include only filters relevant to the requested scope.
- If user asks for count only, use `size=1` and read `data.total`.

---

## Step 4 — Extract Ticket Numbers + Stable Metrics

From full collected list:

### Required extraction

- `ticketNumber` for every ticket (dedupe if needed)

### Required KPIs

- `totalTickets`
- `openTickets` (system status `10`)
- `closedTickets` (system status `20`)
- `overdueTickets` (`ticketIsOverdue == true` or `isOverdue == true`)
- `slaBreachedTickets` (`isSlaBreached == true`)

### Required breakdowns

- By `displayStatusName`
- By `departmentName`
- By `priorityName` (if present)

### Action queue ordering (for consistency)

Sort with highest priority first:

1. SLA breached
2. Overdue
3. Open tickets
4. Most recently updated first (`updateTime` desc)

Include at least:

- `ticketNumber`
- `title`
- `displayStatusName`
- `departmentName`
- `priorityName`
- `updateTime`
- Overdue/SLA flags

---

## Step 5 — Deterministic Final Output Format (Required)

When reporting **assigned tickets for the current authenticated user**, render this exact section structure and label order:

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
- <statusName> (<count>)
By priority:
- <priorityName> (<count>)
- <priorityName> (<count>)
By department:
- <departmentName> (<count>)
- <departmentName> (<count>)

Action Queue (Open tickets prioritized)
<one ticket per line>
```

Deterministic rendering rules:

- Keep section names and line order exactly as written.
- Print each KPI on its own line exactly as shown (never combine multiple KPI values on one line).
- Always print all KPI lines, even when values are zero.
- If no assigned tickets exist, use exact fallback text:
  - `By status:`
  - `- none (no assigned tickets)`
  - `By priority:`
  - `- none (no assigned tickets)`
  - `By department:`
  - `- none (no assigned tickets)`
  - `No open tickets found for this user.`
- If tickets exist, print each breakdown item on its own line under the correct heading (never inline multiple values on one line).

Output rule:

- Do **not** include a JSON payload in the user-facing response.

---

## Consistency Rules

- Reuse the exact deterministic output block labels every run.
- Reuse the same KPI names every run.
- Reuse the same action-queue sort order every run.
- Explicitly state when totals are zero; do not omit sections.
- For zero-ticket cases, use the exact fallback phrases from Step 5.
- If any endpoint fails, report what succeeded, what failed, and what can be retried.
- Never fabricate IDs or ticket numbers.

---

## Minimal Execution Checklist

- [ ] Resolve `staffId` / `departmentIds` from memory or `/auth/current`
- [ ] Build filters for requested scope
- [ ] Page through `/tickets/page` until all records are retrieved
- [ ] Extract all `ticketNumber` values
- [ ] Compute KPIs + breakdowns + prioritized action queue
- [ ] Return only the deterministic human-readable report
