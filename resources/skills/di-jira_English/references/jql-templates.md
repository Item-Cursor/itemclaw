# Common JQL templates

## Query by role

```
# My tasks in the current sprint
assignee = {username} AND sprint in openSprints() AND project = DTS

# Tasks where I am the Developer
cf[11103] = {username} AND sprint in openSprints() AND project = DTS

# Tasks where I am QA
cf[11102] = {username} AND sprint in openSprints() AND project = DTS
```

## Query by status

```
# Unfinished tasks in the current sprint
project = DTS AND sprint in openSprints() AND status not in (Closed, Released, Canceled)

# Waiting for PO Review
project = DTS AND status = "Ready for PO Review" AND sprint in openSprints()

# PO Review failed
project = DTS AND status = "PO Review Failed" AND sprint in openSprints()

# Testing failed and needs to go back
project = DTS AND status = "Test Failed" AND sprint in openSprints()
```

## Query by assignment

```
# Unassigned tasks
project = DTS AND assignee is EMPTY AND sprint in openSprints()

# Someone's todo items
project = DTS AND assignee = {username} AND status in (New, "Planned for Sprint", Backlog)
```

## Epic-related

```
# All tasks under an epic
"Epic Link" = {epicKey}

# Unfinished tasks under an epic
"Epic Link" = {epicKey} AND status not in (Closed, Released, Canceled)
```

## Developer work-hour reporting

Do not use `assignee`. Do not use `openSprints()`. See section 2.11 in `SKILL.md` for the full workflow.

```
# A developer's work hours for the current sprint
# 1. Get the exact sprint ID through the Agile API
# 2. Query by Developer field + exact sprint ID
cf[11103] = {username} AND sprint = {sprintId} AND project = DTS
# 3. Filter again: keep only issues where customfield_10005 contains exactly one sprint to exclude legacy carryover
```

## Sprint progress

```
# All tasks in the current sprint
project = DTS AND sprint in openSprints()

# Completed tasks in the current sprint
project = DTS AND sprint in openSprints() AND status in (Released, Closed, "PO Approved")
```
