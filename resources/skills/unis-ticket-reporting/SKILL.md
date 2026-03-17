---
name: unis-ticket-reporting
description: Generate standardized daily UniTicket department reports with per-agent KPIs, executive summary, and prioritized action queue. Use when the user asks for ticket reporting, daily support metrics, SLA/overdue analysis, or department-level ticket summaries.
metadata:
  openclaw:
    emoji: "📊"
    requires:
      bins: ["curl"]
      env: ["UNIS_TICKET_TOKEN"]
    primaryEnv: "UNIS_TICKET_TOKEN"
---

# UNIS Ticket Reporting - Core Execution Skill (v1.1)

## 1) Execution Goal
Standardize the generation of daily ticket reports for any specified department using the UniTicket API and local staff mapping.

## 2) Agent Setup & Validation Checklist
- [ ] Place mapping CSV in `data/reference/staff_department_20260228.csv`.
- [ ] Set `UNIS_TICKET_API_KEY` and `UNIS_TICKET_USER_AGENT`.
- [ ] Validate staff row exists for target username.

## 2) Primary API Contract
**Endpoint:** `POST https://unisticket.item.com/api/item-tickets/v1/iam/tickets/page`
**Headers:**
- `x-api-key: <UNIS_TICKET_API_KEY>`
- `user-agent: <UNIS_TICKET_USER_AGENT>`
**1. "My Tickets" (Open, Closed, All):**
 *   **Intent:** User asks for tickets assigned to them (e.g., "my open tickets," "tickets assigned to me").
 *   **Action:**
 	1.  **Retrieve Staff ID:** First, attempt to retrieve the cached `staffId` for the current user. If not cached, call `GET /v1/staff/auth/current` to get the `id` from the `data` field and cache it for future use.
 	2.  **Filter Request:** Construct a `POST /v1/staff/tickets/page` request with the following `input` parameters:
     	*   `"staffId": <cached_staff_id>`
     	*   For "open tickets": Add `"displayStatusSystemStatus": [10]` (System Status Code for 'open')
     	*   For "closed tickets": Add `"displayStatusSystemStatus": [20]` (System Status Code for 'closed')
     	*   For "all my tickets": No `displayStatusSystemStatus` filter.
 	3.  **Pagination:** Use `size=10` or `20` initially, and inform the user if `total` is higher.
 
**2. Department-Specific Tickets (Open, Closed, All):**
 *   **Intent:** User asks for tickets within a specific department (e.g., "open tickets in support," "all CSR tickets").
 *   **Action:**
 	1.  **Identify Department ID:** Determine the `departmentId` based on the user's query (e.g., "CSR Ticket Support" -> ID "4"). If unsure or if the department name is ambiguous, use `POST /v1/staff/departments/page` to list departments for user confirmation.
 	2.  **Filter Request:** Construct a `POST /v1/staff/tickets/page` request with the following `input` parameters:
     	*   `"departmentIds": ["<identified_department_id>"]`
     	*   For "open tickets": Add `"displayStatusSystemStatus": [10]`
     	*   For "closed tickets": Add `"displayStatusSystemStatus": [20]`
     	*   For "all department tickets": No `displayStatusSystemStatus` filter.
 	3.  **Pagination:** Use `size=10` or `20` initially, and inform the user if `total` is higher.
 
**3. Tickets by Time Range ("this week", "last month", custom ranges):**
 *   **Intent:** User asks for tickets created within a specific time frame.
 *   **Action:**
 	1.  **Calculate Date Range:** Determine `createTimeStart` and `createTimeEnd` in `MM/dd/yyyy HH:mm:ss` format based on the user's request and the current date.
     	*   *Example: "This week" (assuming today is Friday)*: `createTimeStart` = Monday 00:00:00, `createTimeEnd` = Friday 23:59:59.
 	2.  **Filter Request:** Construct a `POST /v1/staff/tickets/page` request with the following `input` parameters:
     	*   `"createTimeStart": "<calculated_start_date>"`
     	*   `"createTimeEnd": "<calculated_end_date>"`
 	3.  **Combine Filters:** This time range filter can be combined with `staffId` or `departmentIds` filters from rules 1 and 2.
 	4.  **Pagination:** Use `size=10` or `20` initially, and inform the user if `total` is higher.
 
**4. Counting Tickets (any category):**
 *   **Intent:** User asks for the *number* of tickets (e.g., "how many open tickets," "count of tickets for department X").
 *   **Action:**
 	1.  **Use `/tickets/page` with `size=1`:** Apply relevant filters (`staffId`, `departmentIds`, `displayStatusSystemStatus`, `createTimeStart`, `createTimeEnd`) to a `POST /v1/staff/tickets/page` request.
 	2.  **Extract `total`:** Read the `total` field from the response `data` object. This efficiently provides the count without retrieving all ticket records.
 
**5. Brief Information for a Specific Ticket:**
 *   **Intent:** User asks for details about a single ticket by its ID or number, but not necessarily a full timeline or all messages.
 *   **Action:**
 	1.  **By Ticket ID:** Call `GET /v1/staff/tickets/brief/{id}`.
 	2.  **By Ticket Number:** Call `GET /v1/staff/tickets/number/{code}`.
 	3.  **Summarize:** Present key fields like `ticketNumber`, `title`, `displayStatusName`, `staffName`, `customerName`. Only fetch full `GET /v1/staff/tickets/{id}` if more comprehensive details (e.g., full description, custom fields) are explicitly requested.


**Request Body Template:**
```json
{
  "size": 100,
  "page": 1,
  "input": {
    "staffId": 0, // Normalize numeric IDs to integer strings
    "dateField": 1,
    "createTimeStart": "MM/DD/YYYY 00:00:00",
    "createTimeEnd": "MM/DD/YYYY 23:59:59",
    "displayStatusSystemStatus": [10, 20]
  }
}
## Daily Run Procedure

1. Define report window (recommended: previous day in business timezone).

2. For each staff ID:

   - Call page API with `size=100`, `page=1`.

   - Read `data.total` and fetch remaining pages until all records are collected.

3. Compute per-agent KPIs:

   - Total tickets

   - Open (system status 10)

   - Closed (system status 20)

   - Overdue count (`isOverdue=true`)

   - SLA breached count (`isSlaBreached=true`)

   - Breakdown by `displayStatusName`

4. Produce two outputs:

   - **Executive summary** (counts and trends)

   - **Action queue** (open/overdue/SLA-breached tickets first)

5. Deliver report to the team channel and archive JSON/CSV snapshot.
