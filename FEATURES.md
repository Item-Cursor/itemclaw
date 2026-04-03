# ItemClaw — Unis Ticket Feature Roadmap

## ✅ Implemented (Phase 1)

### Feature 1: Ticket Dashboard Page
- [x] New `/tickets` route with sidebar navigation (Ticket icon)
- [x] Stat cards: Open, Pending, Overdue, High Priority, Unassigned, Avg Response Time
- [x] Stats scoped to user's departments with proper date range (last 30 days)
- [x] Personalized greeting with staff name
- [x] "AI Summary" button — opens chat with workload summary prompt
- [x] "Reports" tab with large stat cards + AI chat prompt buttons
- [x] i18n support (English, Chinese, Japanese)

### Feature 2: Ticket List & Search
- [x] "My Tickets" default scope — filtered by current user's staffId
- [x] "Department" scope — dropdown showing only user's departments
- [x] Debounced full-text search via Elasticsearch
- [x] Ticket rows with number, title, customer, department, status badge, assignee, time ago
- [x] Overdue badge indicator
- [x] "Load more" pagination
- [x] Display status name and color from API

### Feature 3: Ticket Detail View
- [x] Right-side sheet with ticket header (number, status, priority badges with API colors)
- [x] Ticket metadata grid (customer, assignee, department, topic, created, updated)
- [x] Timeline rendering with correct MESSAGE vs AUDIT_LOG parsing
- [x] Message bubbles: customer (left), staff (right), system (centered), internal notes (yellow)
- [x] "Ask AI about this ticket" button — opens chat pre-filled with ticket context

### Feature 4: Create Ticket
- [x] Create ticket sheet with correct API schema (title, topic, department, status, priority, description)
- [x] Dynamic dropdowns populated from API (topics, priorities, departments, display statuses)
- [x] Required field validation (title, topic, department, display status)
- [x] Auto-refresh list and stats after creation
- [x] Toast notification on success

### Feature 5: Quick Ticket Reply
- [x] Reply input pinned to bottom of detail sheet
- [x] Clear label: "📨 Reply to customer (sends actual response)" vs "📝 Internal note (not visible to customer)"
- [x] Toggle between Reply and Internal Note modes
- [x] Ctrl+Enter / Cmd+Enter keyboard shortcut to send
- [x] Correct API schema with displayStatusId, message object, notificationInfo
- [x] Auto-refresh timeline after reply

### Infrastructure
- [x] `src/types/ticket.ts` — Full TypeScript types aligned with OpenAPI schema
- [x] `src/lib/unis-ticket-api.ts` — API client with auth token from skill config, date formatting, error handling
- [x] `src/stores/tickets.ts` — Zustand store with current user, department scoping, all CRUD actions
- [x] i18n namespace `tickets` registered in en/zh/ja
- [x] Sidebar nav item added
- [x] Route registered in App.tsx

---

## 🔲 Proposed (Phase 2+)

### Views & Filters
- [ ] 6. Saved Ticket Views — create/edit/favorite custom views via `/v1/staff/ticket-views/*`
- [ ] 7. Ticket Filters — build complex filters with filter fields API
- [ ] 8. Filter Groups — organize filters into groups

### Automation & Macros
- [ ] 9. Macro Execution — one-click macro on tickets via `/v1/staff/tickets/{ticketId}/execute-macro/{macroId}`
- [ ] 10. Macro Management — create/edit/list macros
- [ ] 11. Ticket Create Templates — use/manage creation templates

### AI Integration
- [ ] 12. AI Agent Configuration Panel — manage AI agents via `/v1/staff/ai/agents/*`
- [ ] 13. AI Dashboard — stats, accuracy trends, coverage trends
- [ ] 14. AI-Assisted Ticket Triage — auto-classify, prioritize, route incoming tickets
- [ ] 15. AI Answer Status Tracking — mark AI answers correct/incorrect
- [ ] 16. AI Message Process Viewer — view AI processing details

### Reporting & Analytics
- [ ] 17. Ticket Status Report — charts via `/v1/staff/report/ticket/status`
- [ ] 18. SLA Performance Report — SLA achievement and AHT stats
- [ ] 19. Ticket Activity Report — activity statistics
- [ ] 20. Staff Work Status Report — staff work status data
- [ ] 21. Ticket Trend Chart — line chart of volume over time
- [ ] 22. Topic Distribution Chart — pie/bar by topic
- [ ] 23. Department Distribution — tickets by department
- [ ] 24. SLA Achievement by Department — visual breakdown
- [ ] 25. Average Resolution Time — by department and organization
- [ ] 26. Report Export — export any report to Excel

### Ticket Actions
- [ ] 27. Bulk Ticket Status Update — multi-select + change status
- [ ] 28. Bulk Ticket Assignment — reassign multiple tickets
- [ ] 29. Ticket Merge — merge duplicates
- [ ] 30. Ticket Linking (Related Tickets) — relate/unrelate
- [ ] 31. Parallel Ticket Creation — create parallel from existing
- [ ] 32. Ticket Handover — hand over to another agent
- [ ] 33. Ticket Follow/Unfollow — toggle follow for notifications
- [ ] 34. Ticket Print/Export — printable HTML or Excel export
- [ ] 35. Ticket Reminders — set reminders with desktop notifications
- [ ] 36. Force Reopen Ticket — force-open closed tickets

### Staff & Team Management
- [ ] 37. Staff Directory — browse/search staff
- [ ] 38. Team Management — create/edit teams, add/remove members
- [ ] 39. Department Management — manage departments and members
- [ ] 40. Staff Work Status Toggle — online/away/offline from tray/sidebar

### Notifications
- [ ] 41. Notification Center — in-app panel with unread counts
- [ ] 42. Mark Notifications Read — individual or batch
- [ ] 43. Desktop Notification Bridge — push to Electron native notifications

### Configuration & Customization
- [ ] 44. Topic Management — create/manage help topics
- [ ] 45. Priority Management — configure ticket priorities
- [ ] 46. Display Status Management — customize display statuses
- [ ] 47. Tag Management — create/manage tags
- [ ] 48. SLA Policy Management — configure SLA policies
- [ ] 49. Form Builder Integration — view/manage custom forms
- [ ] 50. Signature Management — set/update email signature

### Collaboration & Communication
- [ ] 51. Ticket Collaborators — add/remove collaborators
- [ ] 52. Internal Notes — add/edit internal notes (partially done in Feature 5)
- [ ] 53. Scheduled Messages — schedule replies for later
- [ ] 54. Email Header Viewer — view email headers/user info
- [ ] 55. Chat Session Sync — sync live chat session status

### Data & Integration
- [ ] 56. Audit Log Viewer — view/export audit logs
- [ ] 57. Customer Organization Browser — browse with best-match search
- [ ] 58. Roster Integration — view roster data
- [ ] 59. Facility Lookup — query facilities
- [ ] 60. Data Entry Report — configurable field aggregation reports
