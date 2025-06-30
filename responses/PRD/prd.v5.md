# PRD v5: Visual Grouping of Task Groups in Task Visualization

## Overview

This version introduces a new visual feature: tasks belonging to the same task group should be visually grouped together in the task visualization, using a box or similar indicator around all tasks in the group.

## Rationale
- Users need to quickly identify which tasks belong to the same group.
- Visual grouping improves clarity, especially when there are many tasks and multiple groups.
- This supports resource management and team-based planning.

## User Story
> As a user, I want to see a clear visual boundary around all tasks that belong to the same group, so that I can easily distinguish between different teams or resource groups in the schedule.

## Acceptance Criteria
- [ ] Each task group is visually represented by a box (or similar indicator) that encloses all its tasks in the visualization.
- [ ] The group box is rendered behind the tasks and does not obscure task details.
- [ ] The group box is labeled with the group name.
- [ ] There is one group box per group, regardless of the number of tasks.
- [ ] Ungrouped tasks are not enclosed in any group box.
- [ ] The feature is covered by automated tests.

## Out of Scope
- Custom colors or styles for different groups (can be added in future versions).
- Grouping for ungrouped tasks.

---

**End of PRD v5** 