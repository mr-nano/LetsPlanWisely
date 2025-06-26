# How the Scheduler Works

Based on the code in `src/utils/scheduler.js`, here's a breakdown of how the scheduler works. It's a sophisticated process that models task execution over time, respecting dependencies and resource limits.

### Core Concepts

1.  **Dependency Graph:** The scheduler first converts your list of tasks and their dependencies into a directed graph. Each task is a node, and a dependency (e.g., "Task A -> Task B") is a directed edge, meaning Task A must complete before Task B can start.

2.  **Topological Sort (Kahn's Algorithm):** To determine the correct order of execution, it uses a topological sort. It identifies tasks with no incoming dependencies (an "in-degree" of 0) and adds them to a queue of tasks that are ready to be scheduled.

3.  **Time Simulation & Resource Management:** The scheduler simulates the passage of time to figure out when each task can run. It maintains a list of `runningTasks` and tracks "bandwidth" (how many tasks can run in parallel).

    *   **Global Bandwidth:** A limit on the total number of tasks that can run simultaneously.
    *   **Task Group Bandwidth:** You can define groups of tasks (by name or regex) that have their own, separate parallelization limit.

### Step-by-Step Scheduling Process

The main logic is within the `scheduleTasks` function:

1.  **Build and Validate the Graph:**
    *   It calls `buildGraph` to create the adjacency list and calculate the initial in-degree for each task.
    *   Crucially, it calls `detectCircularDependencies`. If it finds a loop (e.g., A -> B -> C -> A), it stops and reports an error, as such a schedule is impossible.

2.  **Initialize Tasks and Assign Bandwidth:**
    *   Every task is initialized with a `startTime` and `endTime` of 0.
    *   It checks if any tasks belong to a defined `TaskGroup` and assigns the corresponding bandwidth rules to them.

3.  **The Scheduling Loop:**
    *   The scheduler enters a loop that continues until every task has been scheduled (i.e., its `endTime` is no longer 0).
    *   **Advance Time:** The simulation time advances based on when the next running task is scheduled to finish.
    *   **Identify Ready Tasks:** It looks for tasks that meet two conditions:
        1.  All their prerequisite tasks have finished (`inDegree` is 0).
        2.  The current simulation `time` has passed their `earliestPossibleStartTime`.
    *   **Check Bandwidth:** From the pool of ready tasks, it checks which ones can actually start based on the available global and task group bandwidth. It prioritizes longer tasks to optimize the critical path.
    *   **Start Tasks:** When a task is cleared to start:
        *   Its `startTime` and `endTime` are calculated.
        *   It's added to the `runningTasks` list.
        *   The scheduler then "releases" its dependencies: it finds all tasks that depend on the one that just started, and decrements their `inDegree`. If a dependent task's `inDegree` becomes 0, it's now ready to be considered in the next scheduling cycle.
        *   The `earliestPossibleStartTime` of these dependent tasks is updated to be, at minimum, the `endTime` of the task that just finished.

4.  **Completion:**
    *   The loop continues, advancing time, finishing tasks, and starting new ones until no tasks are left to schedule.
    *   The final result is a list of all the original tasks, now updated with their calculated `startTime` and `endTime`.