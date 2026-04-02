---
name: unis-ticket
description: Query, search, and manage Unis Ticket via REST—staff ticket page filters, reference data (departments, staff, ...), open enums, UTC timestamps, and ticket timeline messages.
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

Unless you have a different tenant, send `X-Tenant-Id: 1` on every request (including login). For endpoints that expect IAM credential authorization, use `IAM_CLIENT_CREDENTIAL_TOKEN` with an `Authorization` header.

### Staff password login (ClawX UI)

`POST /v1/staff/auth/login` with JSON body `emailOrUsername`, `password`, and `tenantId` (string, default `"1"` for Unisco). Use headers `Content-Type: application/json` and `X-Tenant-Id: 1`. On success the API returns `code: "200"` and `data.session.token` for `x-tickets-token`.

### Staff IAM login

ClawX can sign in via **Staff IAM** instead of email/password (no separate OAuth client registration in ItemClaw):

1. **Recommended:** In the Skills UI, use **Sign in in app window**. ClawX opens `https://unisticket.item.com/agent/login` inside an embedded window and listens for the OAuth redirect (e.g. `https://unisticket.item.com/agent/login/iam/redirect?code=…&state=…`) **before** the SPA can replace the address bar—then it completes `POST /v1/staff/auth/login/iam` automatically.
2. **Fallback:** Open login in the **system browser** (same default URL, overridable via `UNIS_IAM_LOGIN_URL` or the Skills UI). If you can copy the callback URL from the address bar, paste it into ClawX and complete sign-in manually.

`POST /v1/staff/auth/login/iam`

Request JSON body (all required by the API):

- `code` — from the `code` query parameter
- `redirectUri` — origin + path of the redirect URL (no query string), e.g. `https://unisticket.item.com/agent/login/iam/redirect`
- `scope` — from the `scope` query parameter if present; otherwise ClawX defaults to `profile email phone openid` (same as `scope=profile%20email%20phone%20openid`). Override via Skills UI “Scope” or `UNIS_IAM_SCOPE` if your IdP differs.
- `state` — from the `state` query parameter

**Legacy:** If you still receive a callback at `itemclaw://unis-iam/callback?code=…&state=…`, you can paste that URL as well; `redirectUri` is inferred from it.

Headers:

- `User-Agent: ItemClaw-TicketSkill/1.0` (or your team’s identifier)
- `Content-Type: application/json`, `Accept: application/json`
- `x-api-key` — only when your Ticket API environment requires it (e.g. some staging setups)

On success, use `data.session.token` as `x-tickets-token` (`UNIS_TICKET_TOKEN`) and `data.session.iamToken` for `IAM_CLIENT_CREDENTIAL_TOKEN` (Bearer) where applicable.

**Base URL:** production is `https://unisticket.item.com/api/item-tickets`; staging is often `https://unisticket-staging.item.com/api/item-tickets` (confirm with your environment).

### Shell variable syntax (critical)

OpenClaw runs tool commands under **bash** (on Windows: Git Bash). Use **POSIX** `$VAR` in curl header lines—not PowerShell `$env:VAR`. The latter does not expand in bash and will send a wrong or empty `x-tickets-token`, which surfaces as **401 Unauthorized** from the API.

- Correct (bash / Git Bash): `"x-tickets-token: $UNIS_TICKET_TOKEN"`
- Wrong here: `"x-tickets-token: $env:UNIS_TICKET_TOKEN"`
- If you run curl yourself in PowerShell: `-H "x-tickets-token: $env:UNIS_TICKET_TOKEN"`

### Token refresh + env sync

- If authentication fails (401/403 or token-invalid response), stop and ask for a fresh sign-in in the ClawX Skills UI.
- Re-authentication in ClawX refreshes the token and updates `UNIS_TICKET_TOKEN` for both `unis-ticket` and `unis-ticket-reporting`.
- Always read the latest token from the environment and do not hardcode cached token values.

Always use (bash / agent shell):

```bash
curl -s -X <METHOD> "https://unisticket.item.com/api/item-tickets/v1/staff/..." \
  -H "x-tickets-token: $UNIS_TICKET_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -H "Authorization: Bearer $IAM_CLIENT_CREDENTIAL_TOKEN" \
  -H "User-Agent: ItemClaw-TicketSkill/1.0" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"
```

## API Base URL

`https://unisticket.item.com/api/item-tickets`

## Staff HTTP headers

For `/v1/staff/...` routes, send at minimum:

- `x-tickets-token: $UNIS_TICKET_TOKEN`
- `X-Tenant-Id: 1` (Unisco default; override only if the user specifies another tenant)
- `Content-Type: application/json` and `Accept: application/json` on JSON bodies
- `User-Agent: ItemClaw-TicketSkill/1.0` (recommended)
- `Authorization: Bearer $IAM_CLIENT_CREDENTIAL_TOKEN` when your flows already use IAM on staff calls

Optional:

- **`Accept-Language`** — e.g. `en`, `zh`, aligned with the user’s language for localized labels in responses.
- **`x-tickets-timezone`** — required on `GET /v1/staff/auth/current` (e.g. `America/Los_Angeles`).

## Timestamps (UTC)

Date/time strings in requests and responses use **`MM/dd/yyyy HH:mm:ss`** and are treated as **UTC** by the API.

- Default ticket pulls should use updated/activity-time windows; when the user gives a **local** date range, convert to UTC before setting `updateTimeStart` / `updateTimeEnd` (and similar) on ticket or message queries.
- When showing times to the user, convert API values from UTC to their timezone.
- Example (user in UTC+8, “calendar day” 2026-03-26 local): UTC window might run from `03/25/2026 16:00:00` through `03/26/2026 15:59:59`.

## Login response (staff password / session)

On successful `POST /v1/staff/auth/login`, use:

- `data.session.token` → `x-tickets-token`
- `data.session.userInfo.id` → current **staff id** (string) for `input.staffId` / “assigned to me” ticket queries
- `data.session.tenantId` → tenant id string

### Login failures

If login fails, the user may need admin help: verify username/email, **Auth Type** (Basic / IAM / SSO / LDAP), and that IAM users align email with the IdP. Prefer **IAM** auth type where applicable so staff can use IdP credentials.

### 401 on staff calls (expired session)

If a non-login staff request returns **401**, the session token expired—ask for a fresh sign-in in ClawX (or re-run login); do not keep retrying with the same token.

## Common endpoints

- `GET /v1/staff/auth/current` (requires `x-tickets-timezone`)
- `POST /v1/staff/auth/login`, `POST /v1/staff/auth/login/iam`
- `POST /v1/staff/tickets/page` (paged ticket listing; see **Staff ticket query** below)
- `POST /v1/staff/tickets/search` (keyword search)
- `GET /v1/staff/tickets/{id}` and `GET /v1/staff/tickets/number/{code}`
- `POST /v1/staff/tickets/{ticketId}/timeline` (paged ticket timeline/messages; see **Ticket timeline** below)
- `POST /v1/staff/tickets/{id}/reply`
- `PUT /v1/staff/tickets/{id}`
- `POST /v1/staff/tickets` (create)
- Reference data (staff token): `GET/POST` under **`/v1/staff/departments`**, **`/teams`**, **`/topics`**, **`/customers`**, **`/staff`**, **`/customer-organizations`** — see **Reference data APIs**
- `GET /v1/open/enums` — all enum mappings (**no** auth); use to decode numeric codes in API payloads

## Staff ticket query (`POST /v1/staff/tickets/page`)

Body shape:

```json
{
  "page": 1,
  "size": 20,
  "input": { },
  "orders": [{ "column": "updateTime", "asc": false }]
}
```

- **`page`** — starts at 1  
- **`size`** — page limit  
- **`input`** — `TicketQuery` filters (below)  
- **`orders`** (optional) — sort; `column` examples: `createTime`, `updateTime`, `dueDate`; `asc`: `true` ascending, `false` descending  

### `TicketQuery` filters (commonly used)

| Field | Role |
|--------|------|
| `ticketNumber` | Exact match on display ticket number |
| `title` | Fuzzy title |
| `customerId` | Customer id |
| `organizationIds` | Org id list |
| `staffId` | Assignee (use `data.session.userInfo.id` for “my” tickets) |
| `staffIds` | Multiple assignees |
| `unassigned` | `true` — unassigned only |
| `departmentIds`, `teamIds` | Scope by department / team |
| `displayStatusId`, `displayStatusIds` | Display status id(s) |
| `displayStatusSystemStatus` | System status array: `10` open, `20` closed, `30` archived, `40` deleted |
| `displayStatusEnums` | Strings: `Pending`, `Solved`, `Closed` |
| `reopenOnly` | Reopened tickets only |
| `replyStatus` | `1` WaitAnswer, `2` Answered |
| `sourceChannel` | See **Enums** |
| `priorityId` | Priority id |
| `topicIds` | Topic id list |
| `updateTimeStart`, `updateTimeEnd` | Updated/activity-time range (default), UTC `MM/dd/yyyy HH:mm:ss` |
| `createTimeStart`, `createTimeEnd` | Created-time range (use only when explicitly requested) |
| `ticketViewId` | Saved view id |
| `handover` | Handover tickets |
| `ticketIsOverdue` | Overdue only |
| `teamIdIsNull`, `staffIdIsNull`, `departmentIdIsNull` | Missing team / assignee / department |

### Response (`data` page result)

`data.total`, `data.records[]` ticket rows with fields such as: `id`, `ticketNumber`, `title`, `customerId` / `customerName`, `staffId` / `staffName`, `departmentId` / `departmentName`, `teamId` / `teamName`, `displayStatusId` / `displayStatusName` / `displayStatusSystemStatus`, `priorityId` / `priorityName`, `topicTitle`, `sourceChannel`, `replyStatus`, `dueDate`, `isOverdue`, `createTime`, `updateTime`.

### Query recipes

- **My open tickets:** `staffId` = current user id, `displayStatusSystemStatus: [10]`
- **Awaiting reply:** add `replyStatus: 1`
- **Overdue:** add `ticketIsOverdue: true`
- **Unassigned open:** `unassigned: true`, `displayStatusSystemStatus: [10]`
- **Department open:** `departmentIds: ["…"]`, `displayStatusSystemStatus: [10]`

## Reference data APIs

Staff routes for lookup tables (departments, teams, topics, customers, staff, customer organizations). **Auth:** `x-tickets-token` + `X-Tenant-Id: 1` (same as other staff APIs). Path prefix: **`/v1/staff`**.

| Resource | By id | Paged search |
|----------|--------|----------------|
| Department | `GET /departments/{id}` | `POST /departments/page` — `input`: `name` (fuzzy), `code`, `status` (0 disabled / 1 enabled / 2 draft), `managerId`, `parentId`, `descendantOf` |
| Team | `GET /teams/{id}` | `POST /teams/page` — `input`: `name`, `code`, `status`, `departmentId`, `leaderId`, `nullOrEqualDepartmentId` |
| Topic | `GET /topics/{id}` | `POST /topics/page` — `input`: `title`, `parentId`, `departmentId`, `status` |
| Customer | `GET /customers/{id}` | `POST /customers/page` — `input`: `username`, `email`, `phone`, `name` (fuzzy), `status`, `organizationId` |
| Staff | `GET /staff/{id}` | `POST /staff/page` — `input`: `keyword` (fuzzy name/username/email), `name`, `username`, `email`, `phone`, `employeeNumber`, `status`, `departmentId`, `teamId`, `roleId`, `excludeDepartmentId`, `excludeTeamId` |
| Customer org | `GET /customer-organizations/{id}` | `POST /customer-organizations/page` — `input`: `name`, `status`, `thirdType`, `contactEmail`, `category` |

Paged body pattern:

```json
{ "page": 1, "size": 10, "input": { } }
```

### Open enum catalog

`GET /v1/open/enums` — **no** authentication. Returns `data` as a map of enum class name → code → `{ code, msg, data }`. Use this to translate numeric enum values in ticket or message payloads to human-readable labels.

## Enums (tickets and actors)

**Ticket system status:** `10` open, `20` closed, `30` archived, `40` deleted.

**Reply status:** `1` WaitAnswer, `2` Answered.

**Source channel (ticket query / messages):** `1` Phone, `2` Email, `3` Web, `4` API, `5` Other, `6` Open form, `7` Chat session / session staff, `8` AI assistant, `9` Ticket app; message APIs may also use `99` (e.g. data-entry AI agent).

**Display status strings:** `Pending`, `Solved`, `Closed`.

**User type:** `1` customer, `2` staff, `3` system.

**Reference entity status** (departments, teams, etc.): `0` disabled, `1` enabled, `2` draft.

## Ticket timeline (messages)

When the user asks for details on a specific ticket (summary, root cause, next actions, escalation notes, draft reply), fetch timeline messages first and use them as context for the answer.

### Required context flow

1. Resolve a display ticket number to internal `ticketId` when needed (`GET /v1/staff/tickets/number/{code}`).
2. Call `POST /v1/staff/tickets/{ticketId}/timeline`.
3. Read `data.records[]` message items before answering.
4. If timeline data is partial (pagination limit or API/auth failure), state that limitation explicitly.

### Endpoint

- Method: `POST`
- Path: `/v1/staff/tickets/{ticketId}/timeline`
- Auth: `x-tickets-token` + `X-Tenant-Id: 1`
- Optional: `Accept-Language` aligned with user language

### Path parameter

- `ticketId` (number) - required internal ticket id

### Request body (page request)

```json
{
  "page": 1,
  "size": 20,
  "input": {}
}
```

`input` is optional. Empty `input` returns all timeline items for that ticket page.

### Timeline filters (`input`, all optional)

- `type` (number) - single message type filter
- `types` (number[]) - multi message type filter
- `sourceChannel` (number) - source channel enum
- `excludeMessageId` (number) - exclude one message id
- `withReplyMessage` (boolean) - include reply message details
- `createTimeStart`, `createTimeEnd` (string) - UTC `MM/dd/yyyy HH:mm:ss`
- `updateTimeStart`, `updateTimeEnd` (string) - UTC `MM/dd/yyyy HH:mm:ss`

### Ticket message type enum

- `1` = `MESSAGE`
- `2` = `SYSTEM`
- `3` = `INTERNAL_NOTE`
- `4` = `SIDE_CONVERSATION`
- `5` = `REPLY`
- `6` = `ESCALATION`

### Timeline examples (bash / agent shell)

Resolve number to id:

```bash
curl -s -X GET "https://unisticket.item.com/api/item-tickets/v1/staff/tickets/number/TCK-12345" \
  -H "x-tickets-token: $UNIS_TICKET_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -H "Accept: application/json"
```

Query timeline (all message types):

```bash
curl -s -X POST "https://unisticket.item.com/api/item-tickets/v1/staff/tickets/${TICKET_ID}/timeline" \
  -H "x-tickets-token: $UNIS_TICKET_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -H "Accept-Language: en" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"page":1,"size":20,"input":{}}'
```

Query only normal messages + replies:

```bash
curl -s -X POST "https://unisticket.item.com/api/item-tickets/v1/staff/tickets/${TICKET_ID}/timeline" \
  -H "x-tickets-token: $UNIS_TICKET_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -H "Accept-Language: en" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"page":1,"size":20,"input":{"types":[1,5]}}'
```

## Ticket list example

```bash
curl -s -X POST "https://unisticket.item.com/api/item-tickets/v1/staff/tickets/page" \
  -H "x-tickets-token: $UNIS_TICKET_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -H "Authorization: Bearer $IAM_CLIENT_CREDENTIAL_TOKEN" \
  -H "User-Agent: ItemClaw-TicketSkill/1.0" \
  -H "Accept-Language: en" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"size":20,"input":{"displayStatusSystemStatus":[10]},"orders":[{"column":"updateTime","asc":false}]}'
```

## Notes

- Source channel **`4`** is API-originated traffic (see **Enums** for full list).
- Date/time format **`MM/dd/yyyy HH:mm:ss`**; treat ticket query bounds as **UTC** unless your integration docs say otherwise (**Timestamps**).
