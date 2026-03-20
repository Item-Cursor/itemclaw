# DTS project custom field mapping

Verified from the Jira instance API.

## People fields

| Field ID | Field name | Type | Value format |
|---------|------------|------|--------------|
| `customfield_11103` | Developer | multi-user picker | `[{"name": "username"}]` |
| `customfield_11000` | Developer(single) | user picker | `{"name": "username"}` |
| `customfield_11102` | QA | multi-user picker | `[{"name": "username"}]` |
| `customfield_11104` | BA | multi-user picker | `[{"name": "username"}]` |
| `customfield_10804` | Quality assurance (QA) | user picker | `{"name": "username"}` |
| `customfield_12404` | Escalated Assignee | user picker | `{"name": "username"}` |

## Hours and points

| Field ID | Field name | Type | Value format |
|---------|------------|------|--------------|
| `customfield_10002` | Story Points | float | `3.0` |
| `customfield_11602` | Dev Hours | float | `8.0` |
| `customfield_11601` | Test Hours | float | `4.0` |
| `customfield_11901` | Story Points for BA | float | `2.0` |
| `customfield_12100` | Test Points | float | `1.0` |
| `customfield_12801` | Story Point for Lead | string | `"3"` |
| `customfield_12802` | Estimate SP | float | `5.0` |

## Sprint and epic fields

| Field ID | Field name | Type | Value format |
|---------|------------|------|--------------|
| `customfield_10005` | Sprint | gh-sprint | numeric Sprint ID |
| `customfield_10006` | Epic Link | gh-epic-link | `"DTS-1234"` |
| `customfield_10007` | Epic Name | string | epic name when creating an Epic |

## Date fields

| Field ID | Field name | Value format |
|---------|------------|--------------|
| `customfield_12800` | Start Date | `"YYYY-MM-DD"` |
| `customfield_11701` | Expected Testing Time | `"YYYY-MM-DD"` |

## Other fields

| Field ID | Field name | Type | Value format |
|---------|------------|------|--------------|
| `customfield_10805` | commit url | string | URL string |
| `customfield_12201` | Pending | select | `{"value": "option value"}` |
| `customfield_12300` | Demand Type | select | `{"value": "option value"}` |
| `customfield_12402` | Code Change | - | - |
| `customfield_12622` | Bug Responsible | - | - |
| `customfield_12623` | Severity | - | - |
| `customfield_10700` | url | string | URL string |
| `customfield_11801` | Function | string | module or feature name |
| `customfield_10000` | Flagged | multi-checkbox | - |

## Common update examples

```json
// Assignee
{"fields": {"assignee": {"name": "username"}}}

// Developer, multi-select
{"fields": {"customfield_11103": [{"name": "dev1"}, {"name": "dev2"}]}}

// QA, multi-select
{"fields": {"customfield_11102": [{"name": "qa1"}]}}

// Story Points
{"fields": {"customfield_10002": 5.0}}

// Priority
{"fields": {"priority": {"name": "Major"}}}

// Epic Link
{"fields": {"customfield_10006": "DTS-1234"}}
```

## Status list

### To Do
| ID | Name |
|----|------|
| 1 | New |
| 10100 | Pending |
| 11200 | Backlog |
| 11800 | Requirement Ready |

### In Progress
| ID | Name |
|----|------|
| 10807 | Planned for Sprint |
| 3 | In Dev |
| 10810 | Work in progress |
| 11700 | In Progress |
| 11005 | Dev Completed |
| 11006 | Released to Staging |
| 11007 | QA Testing |
| 10614 | Testing |
| 11100 | Ready to Test |
| 11101 | Test Failed |
| 11600 | Ready for PO Review |
| 11601 | PO Review Failed |
| 11602 | PO Review Pass |

### Done
| ID | Name |
|----|------|
| 11009 | PO Review |
| 11011 | PO Approved |
| 11010 | Released |
| 6 | Closed |
| 10808 | Canceled |
