---
name: unis-ticket-reporting
description: Generate consistent UniTicket user/department reports from a minimal end-to-end flow.
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "requires": { "bins": ["curl"], "env": ["UNIS_TICKET_TOKEN", "IAM_CLIENT_CREDENTIAL_TOKEN"] },
        "primaryEnv": "UNIS_TICKET_TOKEN",
      },
  }
---

# UniTicket Reporting (Minimal Complete Flow)

## Goal

1. Resolve `staffId` and `departmentIds` (memory first, API fallback)
2. Pull all matching tickets
3. Compute stable KPIs and prioritized action queue
4. Return a deterministic user-facing summary

## Required headers

- `x-tickets-token: $env:UNIS_TICKET_TOKEN`
- `Authorization: Bearer $env:IAM_CLIENT_CREDENTIAL_TOKEN` (for IAM credential-token endpoints)
- `User-Agent: ItemClaw-TicketSkill/1.0`
- `Content-Type: application/json` (POST)
- `x-tickets-timezone: America/Los_Angeles` on `/auth/current`

## Token refresh + env sync

- If authentication fails (401/403 or token-invalid response), stop and ask for a fresh sign-in in the ClawX Skills UI.
- Re-authentication in ClawX refreshes the token and updates `UNIS_TICKET_TOKEN` for both `unis-ticket` and `unis-ticket-reporting`.
- Always use `$env:UNIS_TICKET_TOKEN` as the single source of truth for auth headers.

Base URL: `https://unisticket.item.com/api/item-tickets/v1/staff`

## Flow

1. `GET /auth/current` for identity context
2. Build filters (`staffId`, `departmentIds`, optional status/date)
3. `POST /tickets/page` with pagination (`page=1`, `size=100`) until all records retrieved
4. Compute:
   - total, open, closed, overdue, SLA-breached
   - by status / priority / department
   - action queue priority: SLA-breached > overdue > open > newest update

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
