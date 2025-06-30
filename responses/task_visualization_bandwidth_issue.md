# Task Visualization Bandwidth Issue Analysis

## Context

Given the following input:

```
Task "Frontend Task" "Desc" "M"
Task "Frontend Task2" "Desc" "M"
Task "Frontend Task3" "Desc" "M" "Frontend Task"
Task "Frontend Task4" "Desc" "M" "Frontend Task"
Task "Frontend Task5" "Desc" "M" "Frontend Task"

Task "Backend Task" "Desc" "M"
Task "API Task" "Desc" "M"
Task "Database Task" "Desc" "M"
        
Task Group "Frontend Team" /Frontend-*/ bandwidth: 2
Task Group "Backend Team" ["Backend Task", "API Task"] bandwidth: 3
Task Group "Database Team" /Database*/ bandwidth: 1
        
M:5
```

## Observed Visualization
- The UI shows **5 separate lanes** for the frontend tasks (one per task), even though the group bandwidth is 2.
- Backend and Database tasks are shown in their own lanes as expected.

## Expected Behavior
- The number of visible lanes for a group should **not exceed the group's bandwidth**.
- For the frontend group (bandwidth: 2), there should be **at most 2 horizontal lanes** for all frontend tasks, regardless of how many tasks are in the group.
- Tasks within the group should be stacked in these lanes, with parallel tasks sharing lanes up to the bandwidth limit, and others waiting for a lane to become available (i.e., respecting scheduling constraints).

## Root Cause Analysis
- The current visualization logic assigns each task in a group to its own lane, **ignoring the group's bandwidth constraint**.
- This results in as many lanes as there are tasks, rather than limiting to the bandwidth.
- The scheduler may be respecting bandwidth for start times, but the visualization does not reflect this in its lane assignment.

## Recommendation
- **Lane assignment in the visualization should be based on the group's bandwidth:**
    - For each group, create only as many lanes as the group's bandwidth.
    - Assign tasks to these lanes such that no more than `bandwidth` tasks from the group are shown in parallel at any time.
    - If more than `bandwidth` tasks overlap in time, some should be visually stacked (or offset) to indicate waiting for a lane.
- This will ensure the visualization accurately represents the resource constraints defined by the group bandwidth.

## Next Steps
- Update the lane assignment algorithm in the visualization component to enforce the bandwidth limit per group.
- Add or update tests to verify that the number of lanes per group never exceeds the group's bandwidth.

---

**Summary:**
The current implementation does not enforce group bandwidth in the visualization, leading to more lanes than allowed. The visualization logic should be updated to respect bandwidth constraints for each group.

---

## Test Cases To Update or Add

### 1. Update Existing Visualization Tests
- **File:** `test/TaskVisualizationCanvas.test.js`
- **What to update:**
  - Any test that checks lane assignment for grouped tasks should assert that the number of lanes per group does not exceed the group's bandwidth.
  - Example: For a group with bandwidth 2 and 5 tasks, assert that no more than 2 lanes are used for that group, even if all tasks overlap in time.

### 2. Add New Test Cases
- **Test: Bandwidth-limited Lane Assignment**
  - Create a scenario with more tasks in a group than the bandwidth allows, with overlapping times.
  - Assert that:
    - No more than `bandwidth` lanes are used for that group.
    - Tasks are assigned to lanes such that at most `bandwidth` tasks are shown in parallel.
    - If more than `bandwidth` tasks overlap, some are visually stacked or offset.

- **Test: Multiple Groups with Different Bandwidths**
  - Create a scenario with several groups, each with different bandwidths and overlapping tasks.
  - Assert that each group never exceeds its bandwidth in the number of lanes used.

- **Test: Ungrouped Tasks**
  - Ensure that ungrouped tasks are still visualized correctly and do not interfere with group lane limits.

### 3. Scheduler Tests (Optional)
- If the scheduler is responsible for assigning start times based on bandwidth, ensure that its tests cover scenarios where tasks must wait for bandwidth to become available.

---

**Action:**
- Update and add the above test cases to ensure the visualization accurately enforces group bandwidth constraints. 