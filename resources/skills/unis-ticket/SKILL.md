---
name: unis-ticket
description: Query, search, and manage tickets in the Unis Ticket system via the REST API.
metadata:
  {
    "openclaw":
      {
        "emoji": "🎫",
        "requires": { "bins": ["curl"], "env": ["UNIS_TICKET_TOKEN", "IAM_CLIENT_CREDENTIAL_TOKEN"] },
        "primaryEnv": "UNIS_TICKET_TOKEN",
      },
  }
---

# unis-ticket

Query and manage tickets in the Unis Ticket system using the REST API.

## Authentication

The `UNIS_TICKET_TOKEN` environment variable is injected automatically when configured through the desktop app. Pass it as the `x-tickets-token` header in all API calls.

For endpoints that expect IAM credential authorization, use `IAM_CLIENT_CREDENTIAL_TOKEN` with an `Authorization` header.

### Token refresh + env sync

- If authentication fails (401/403 or token-invalid response), stop and ask for a fresh sign-in in the ClawX Skills UI.
- Re-authentication in ClawX refreshes the token and updates `UNIS_TICKET_TOKEN` for both `unis-ticket` and `unis-ticket-reporting`.
- Always read the latest token from `$env:UNIS_TICKET_TOKEN` and do not hardcode cached token values.

Always use:

```bash
curl.exe -s -X <METHOD> "https://unisticket.item.com/api/item-tickets/v1/staff/..." \
  -H "x-tickets-token: $env:UNIS_TICKET_TOKEN" \
  -H "Authorization: Bearer $env:IAM_CLIENT_CREDENTIAL_TOKEN" \
  -H "User-Agent: ItemClaw-TicketSkill/1.0" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"
```

## API Base URL

`https://unisticket.item.com/api/item-tickets`

## Common endpoints

- `GET /v1/staff/auth/current` (requires `x-tickets-timezone`)
- `POST /v1/staff/tickets/page` (paged ticket listing with filters)
- `POST /v1/staff/tickets/search` (keyword search)
- `GET /v1/staff/tickets/{id}` and `GET /v1/staff/tickets/number/{code}`
- `POST /v1/staff/tickets/{id}/timeline`
- `POST /v1/staff/tickets/{id}/reply`
- `PUT /v1/staff/tickets/{id}`
- `POST /v1/staff/tickets` (create)

## Ticket list example

```bash
curl.exe -s -X POST "https://unisticket.item.com/api/item-tickets/v1/staff/tickets/page" \
  -H "x-tickets-token: $env:UNIS_TICKET_TOKEN" \
  -H "Authorization: Bearer $env:IAM_CLIENT_CREDENTIAL_TOKEN" \
  -H "User-Agent: ItemClaw-TicketSkill/1.0" \
  -H "Content-Type: application/json" \
  -d '{"page": 1, "size": 20, "input": {"displayStatusSystemStatus": [10]}}'
```

## Notes

- Source channel `4` means API-generated action.
- Status system codes: `10` open, `20` closed, `30` archived, `40` deleted.
- Use date format `MM/dd/yyyy HH:mm:ss`.
