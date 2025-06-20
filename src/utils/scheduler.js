/**
 * src/utils/scheduler.js
 *
 * This file contains the core scheduling logic for the Visual Task Scheduler.
 * It takes parsed task data, builds a dependency graph, and calculates optimal
 * start/end times based on dependencies and parallelization limits.
 */

/**
 * Creates a graph from tasks and dependencies for topological sorting and scheduling.
 * @param {Array<Object>} tasks - An array of task objects from the parser.
 * @param {Array<Object>} dependencies - An array of dependency objects { source, target }.
 * @param {Array<Object>} errors - An array to push errors into.
 * @returns {object} An object containing the graph (adjacency list) and in-degrees.
 */
function buildGraph(tasks, dependencies, errors) {
    const graph = {}; // Adjacency list: { taskName: [dependentTask1, dependentTask2] }
    const inDegree = {}; // Number of incoming dependencies: { taskName: count }
    const taskMap = new Map(tasks.map(task => [task.name, task])); // For quick lookup

    // Initialize graph and in-degrees for all tasks
    tasks.forEach(task => {
        graph[task.name] = [];
        inDegree[task.name] = 0;
    });

    // Populate graph and in-degrees based on dependencies
    dependencies.forEach(dep => {
        const sourceTask = taskMap.get(dep.source);
        const targetTask = taskMap.get(dep.target);

        // Only add if both source and target tasks exist
        if (sourceTask && targetTask) {
            graph[dep.source].push(dep.target);
            inDegree[dep.target]++;
        } else {
            // Parser should catch these, but defensive check
            if (!sourceTask) {
                errors.push({
                    message: `Scheduling error: Dependency source task "${dep.source}" not found.`,
                    type: 'error',
                    line: 'N/A'
                });
            }
            if (!targetTask) {
                errors.push({
                    message: `Scheduling error: Dependency target task "${dep.target}" not found.`,
                    type: 'error',
                    line: 'N/A'
                });
            }
        }
    });

    return { graph, inDegree, taskMap };
}

/**
 * Detects circular dependencies in the graph using DFS.
 * @param {Object} graph - The adjacency list representation of the graph.
 * @param {Array<Object>} tasks - Array of task objects.
 * @param {Array<Object>} errors - Array to push errors into.
 * @returns {boolean} True if circular dependency detected, false otherwise.
 */
function detectCircularDependencies(graph, tasks, errors) {
    const visited = new Set();
    const recursionStack = new Set();
    let hasCycle = false;

    function dfs(taskName, path = []) {
        visited.add(taskName);
        recursionStack.add(taskName);
        path.push(taskName);

        for (const neighbor of graph[taskName]) {
            if (!visited.has(neighbor)) {
                if (dfs(neighbor, path)) {
                    return true;
                }
            } else if (recursionStack.has(neighbor)) {
                // Cycle detected
                hasCycle = true;
                const cycleStart = path.indexOf(neighbor);
                const cycle = path.slice(cycleStart).join(' -> ') + ` -> ${neighbor}`;
                errors.push({
                    message: `Circular dependency detected: ${cycle}`,
                    type: 'error',
                    line: 'N/A'
                });
                return true;
            }
        }
        recursionStack.delete(taskName);
        path.pop();
        return false;
    }

    tasks.forEach(task => {
        if (!visited.has(task.name)) {
            if (dfs(task.name)) {
                // If a cycle is found in one DFS path, we can stop
                return;
            }
        }
    });

    return hasCycle;
}

/**
 * Calculates the earliest possible start time for each task using topological sort.
 * @param {Array<Object>} tasks - An array of task objects (with resolvedDuration).
 * @param {Array<Object>} dependencies - An array of dependency objects { source, target }.
 * @param {number|'unbound'} globalBandwidth - The global parallelization limit.
 * @param {Array<Object>} taskGroups - An array of task group objects.
 * @returns {object} An object containing the scheduled tasks and any new errors.
 */
export function scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups) {
    const errors = []; // Errors specific to scheduling (e.g., circular dependencies)
    const scheduledTasks = {}; // { taskName: { taskData, startTime, endTime, assignedBandwidthGroup } }

    const { graph, inDegree, taskMap } = buildGraph(tasks, dependencies, errors);

    // If there were issues building the graph (e.g., undefined tasks), return early
    if (errors.length > 0) {
        return { scheduledTasks: Object.values(scheduledTasks), errors };
    }

    // Detect circular dependencies
    if (detectCircularDependencies(graph, tasks, errors)) {
        return { scheduledTasks: Object.values(scheduledTasks), errors };
    }

    // Initialize tasks with earliest possible start time (0 for no dependencies)
    // and a 'completed time' that tracks when its predecessors are done.
    tasks.forEach(task => {
        scheduledTasks[task.name] = {
            ...task,
            startTime: 0,
            endTime: 0,
            earliestPossibleStartTime: 0, // Tracks when all predecessors are done
            assignedBandwidthGroup: null, // To store which task group's bandwidth applies
        };
    });

    // Apply task group bandwidths (last one defined takes precedence)
    // This is done by modifying the `assignedBandwidthGroup` property
    taskGroups.forEach(group => {
        let regex = null;
        if (group.type === 'regex') {
            try {
                regex = new RegExp(group.identifiers[0]);
            } catch (e) {
                errors.push({
                    message: `Invalid regex in Task Group "${group.identifiers[0]}": ${e.message}`,
                    type: 'error',
                    line: 'N/A'
                });
                return; // Skip this group if regex is invalid
            }
        }

        tasks.forEach(task => {
            let appliesToTask = false;
            if (group.type === 'list') {
                appliesToTask = group.identifiers.includes(task.name);
            } else if (group.type === 'regex' && regex) {
                appliesToTask = regex.test(task.name);
            }

            if (appliesToTask) {
                // Overwrite previous group setting if a task belongs to multiple groups
                scheduledTasks[task.name].assignedBandwidthGroup = group;
            }
        });
    });


    // Use a queue for tasks ready to run (Kahn's algorithm for topological sort)
    const queue = tasks.filter(task => inDegree[task.name] === 0);
    let time = 0; // Represents the current "time unit" in the schedule

    // Keep track of tasks currently running and available capacity
    let runningTasks = []; // { taskName, endTime, assignedBandwidthGroup }

    // Schedule loop
    while (Object.values(scheduledTasks).some(t => t.endTime === 0)) {
        // Increment time if no tasks can start or if all current tasks finished
        if (queue.length === 0 && runningTasks.length === 0 && Object.values(scheduledTasks).some(t => t.endTime === 0)) {
            // This means there's a problem (e.g., cycle not caught) or tasks are waiting for capacity
            // For now, let's just advance time if nothing is ready but tasks are still pending.
            // A more robust scheduler might identify deadlocks here.
             time++;
             continue;
        }

        // Clean up finished tasks from runningTasks
        runningTasks = runningTasks.filter(task => task.endTime > time);

        // Determine available bandwidth for different groups and global
        const currentGlobalBandwidth = globalBandwidth === 'unbound' ? Infinity : globalBandwidth;
        let globalOccupancy = runningTasks.filter(t => !t.assignedBandwidthGroup).length;
        const groupOccupancy = {}; // { groupIdentifier: count }

        // Initialize group occupancy
        taskGroups.forEach(group => {
            const key = group.type === 'list' ? group.identifiers.join(',') : group.identifiers[0];
            groupOccupancy[key] = runningTasks.filter(t =>
                t.assignedBandwidthGroup &&
                ((t.assignedBandwidthGroup.type === 'list' && group.type === 'list' && t.assignedBandwidthGroup.identifiers.join(',') === key) ||
                 (t.assignedBandwidthGroup.type === 'regex' && group.type === 'regex' && t.assignedBandwidthGroup.identifiers[0] === key))
            ).length;
        });

        // Identify tasks that are ready to run (all predecessors done) and satisfy bandwidth
        const potentialTasksToRun = tasks
            .filter(task =>
                scheduledTasks[task.name].endTime === 0 && // Not yet scheduled
                inDegree[task.name] === 0 && // All predecessors are done
                scheduledTasks[task.name].earliestPossibleStartTime <= time // Earliest start time reached
            )
            .sort((a, b) => b.resolvedDuration - a.resolvedDuration); // Prioritize longer tasks for critical path

        const tasksStartedThisCycle = [];

        for (const task of potentialTasksToRun) {
            const taskScheduledData = scheduledTasks[task.name];
            const group = taskScheduledData.assignedBandwidthGroup;

            let canRun = false;
            if (group) {
                const groupKey = group.type === 'list' ? group.identifiers.join(',') : group.identifiers[0];
                const groupBandwidth = group.bandwidth === 'unbound' ? Infinity : group.bandwidth;
                const currentGroupOccupancy = groupOccupancy[groupKey] || 0;

                if (currentGroupOccupancy < groupBandwidth) {
                    canRun = true;
                    groupOccupancy[groupKey] = currentGroupOccupancy + 1; // Temporarily increment for this cycle
                }
            } else { // Global bandwidth applies
                if (globalOccupancy < currentGlobalBandwidth) {
                    canRun = true;
                    globalOccupancy++; // Temporarily increment for this cycle
                }
            }

            if (canRun) {
                taskScheduledData.startTime = Math.max(time, taskScheduledData.earliestPossibleStartTime);
                taskScheduledData.endTime = taskScheduledData.startTime + task.resolvedDuration;
                tasksStartedThisCycle.push(task.name);

                runningTasks.push({
                    taskName: task.name,
                    endTime: taskScheduledData.endTime,
                    assignedBandwidthGroup: group
                });

                // Update in-degrees of dependencies
                graph[task.name].forEach(dependentTaskName => {
                    inDegree[dependentTaskName]--;
                    // Update earliestPossibleStartTime for dependent tasks
                    scheduledTasks[dependentTaskName].earliestPossibleStartTime = Math.max(
                        scheduledTasks[dependentTaskName].earliestPossibleStartTime,
                        taskScheduledData.endTime
                    );
                });
            }
        }

        // Advance time to the earliest endTime of a running task, or just by 1 if nothing started
        if (runningTasks.length > 0) {
            time = Math.min(...runningTasks.map(t => t.endTime));
        } else if (tasksStartedThisCycle.length === 0 && Object.values(scheduledTasks).some(t => t.endTime === 0)) {
            // If no tasks started this cycle, but there are still unscheduled tasks, advance time by 1
            // This prevents infinite loops if no tasks can run due to future predecessors or capacity
             time++;
        }
    }

    return { scheduledTasks: Object.values(scheduledTasks), errors };
}