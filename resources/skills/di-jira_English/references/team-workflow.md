# Team workflow notes

## Sprint management

- Sprint cadence is fixed at **two weeks**
- BA board: `boardId=127` with `rapidView=127`
- PM board: `boardId=101` with `rapidView=101`

## Issue-type conventions

- The team mainly uses **Story**
- **Bug** and **Task** are used less often
- Larger efforts should be broken into **Sub-task** items
- Related work should be grouped under a shared **Epic**

## Assignment flow

1. During review meetings, developers usually claim work based on ownership or interest
2. If no one claims it, the TL assigns it
3. If the TL does not assign it, the PM assigns it to the TL for redistribution
4. Each developer usually owns a fixed set of modules

## PO Review flow

- PO Review happens in the **Stage** environment
- If review passes, move the issue to `PO Review Pass`
- If review fails, move it to `PO Review Failed` and explain the problem in a comment

## Development handoff checklist

1. Assign the issue to QA
2. Confirm the Developer field, `customfield_11103`, is set to yourself
3. Confirm the sprint is set
4. Add notes about the change in the `commit url` field, `customfield_10805`, or in a comment

## Role guidance

### PM
- Focus on the big picture: overall delivery progress, priority, and whether every issue has an owner
- Use Epics to group related requirements
- Review sprint progress from the broader portfolio view, usually on board `101`

### BA
- Draft requirements outside Jira first, then copy them into the Jira description
- Perform PO Review in Stage and compare behavior against the requirements
- If review fails, explain the exact gap in a comment
- Preferred board: `127`

### Dev
1. Review the tasks assigned to you in the current sprint
2. Check before sprint end whether your planned hours are still realistic
3. Watch daily for newly assigned tickets
4. Split large work into sub-tasks
5. When development is done: assign to QA, confirm Developer is set correctly, confirm sprint is set, then add commit notes
6. For investigation-style tasks, assign the issue back to the original reporter after the investigation is complete

## Known caveat

- Sub-task status does not automatically update the parent issue. Maintain parent status manually.
