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
 * @returns {object} An object containing the graph (adjacency list) and in-degrees, and task map with predecessors.
 */
function buildGraph(tasks, dependencies, errors) {
    const graph = {}; // Adjacency list: { taskName: [dependentTask1, dependentTask2] }
    const inDegree = {}; // Number of incoming dependencies: { taskName: count }
    const taskMap = new Map(tasks.map(task => [task.name, { ...task, predecessors: [] }]));

    tasks.forEach(task => {
        graph[task.name] = [];
        inDegree[task.name] = 0;
    });

    dependencies.forEach(dep => {
        const sourceTask = taskMap.get(dep.source);
        const targetTask = taskMap.get(dep.target);

        if (sourceTask && targetTask) {
            graph[dep.source].push(dep.target);
            inDegree[dep.target]++;
            targetTask.predecessors.push(dep.source);
        } else {
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
                return;
            }
        }
    });

    return hasCycle;
}

/**
 * Calculates the earliest possible start time for each task using topological sort.
 * @param {Array<Object>} tasks - An array of task objects from the parser (not yet scheduled).
 * @param {Array<Object>} dependencies - An array of dependency objects { source, target }.
 * @param {number|'unbound'} globalBandwidth - The global parallelization limit.
 * @param {Array<Object>} taskGroups - An array of task group objects.
 * @returns {object} An object containing the scheduled tasks and any new errors.
 */
export function scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups) {
    const errors = [];

    const { graph, inDegree, taskMap } = buildGraph(tasks, dependencies, errors);

    if (errors.length > 0) {
        return { scheduledTasks: Array.from(taskMap.values()), errors };
    }

    if (detectCircularDependencies(graph, Array.from(taskMap.values()), errors)) {
        return { scheduledTasks: Array.from(taskMap.values()), errors };
    }

    const scheduledTasks = {};
    Array.from(taskMap.values()).forEach(task => {
        scheduledTasks[task.name] = {
            ...task,
            startTime: 0,
            endTime: 0,
            earliestPossibleStartTime: 0,
            assignedBandwidthGroup: null,
        };
    });

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
                return;
            }
        }

        Object.values(scheduledTasks).forEach(task => {
            let appliesToTask = false;
            if (group.type === 'list') {
                appliesToTask = group.identifiers.includes(task.name);
            } else if (group.type === 'regex' && regex) {
                appliesToTask = regex.test(task.name);
            }

            if (appliesToTask) {
                scheduledTasks[task.name].assignedBandwidthGroup = group;
            }
        });
    });

    const queue = Object.values(scheduledTasks).filter(task => inDegree[task.name] === 0);

    let time = 0;
    let runningTasks = [];

    while (Object.values(scheduledTasks).some(t => t.endTime === 0)) {
        // --- START LOGS & REFINED LOGIC ---
        console.log(`\n--- Scheduling Cycle: Current Time = ${time} ---`);
        console.log(`Initial running tasks: ${runningTasks.map(t => `${t.taskName} (ends ${t.endTime})`).join(', ')}`);

        // Update in-degrees for newly finished tasks (based on tasks that finish at or before `time`)
        const newlyFinishedTasks = runningTasks.filter(task => task.endTime <= time);
        runningTasks = runningTasks.filter(task => task.endTime > time); // Filter out finished tasks
        
        if (newlyFinishedTasks.length > 0) {
            console.log(`Tasks finished at time ${time}: ${newlyFinishedTasks.map(t => t.taskName).join(', ')}`);
            newlyFinishedTasks.forEach(finishedTask => {
                graph[finishedTask.taskName].forEach(dependentTaskName => {
                    inDegree[dependentTaskName]--;
                    scheduledTasks[dependentTaskName].earliestPossibleStartTime = Math.max(
                        scheduledTasks[dependentTaskName].earliestPossibleStartTime,
                        finishedTask.endTime
                    );
                    // Add tasks to queue if they just became ready
                    if (inDegree[dependentTaskName] === 0 && scheduledTasks[dependentTaskName].endTime === 0) {
                        queue.push(scheduledTasks[dependentTaskName]);
                        console.log(`  Task "${dependentTaskName}" became ready.`);
                    }
                });
            });
        }
        console.log(`Running tasks AFTER cleanup: ${runningTasks.map(t => `${t.taskName} (ends ${t.endTime})`).join(', ')}`);
        console.log(`Queue: ${queue.map(t => t.name).join(', ')}`);

        // Determine available bandwidth for different groups and global
        const currentGlobalBandwidth = globalBandwidth === 'unbound' ? Infinity : globalBandwidth;
        let globalOccupancy = runningTasks.filter(t => !t.assignedBandwidthGroup).length; // Tasks without a specific group
        
        // Use a temporary map to track group occupancy for the current cycle
        const currentGroupOccupancyMap = {}; 
        taskGroups.forEach(group => {
            const key = group.type === 'list' ? group.identifiers.join(',') : group.identifiers[0];
            currentGroupOccupancyMap[key] = runningTasks.filter(t =>
                t.assignedBandwidthGroup &&
                ((t.assignedBandwidthGroup.type === 'list' && group.type === 'list' && t.assignedBandwidthGroup.identifiers.join(',') === key) ||
                 (t.assignedBandwidthGroup.type === 'regex' && group.type === 'regex' && t.assignedBandwidthGroup.identifiers[0] === key))
            ).length;
        });

        console.log(`Global Bandwidth: ${currentGlobalBandwidth}, Global Occupancy (before new tasks): ${globalOccupancy}`);
        Object.keys(currentGroupOccupancyMap).forEach(key => {
            console.log(`  Group "${key}" Occupancy (before new tasks): ${currentGroupOccupancyMap[key]}`);
        });
        

        // Identify tasks that are ready to run at the current `time` and sort
        const potentialTasksToRun = queue
            .filter(task => 
                task.endTime === 0 && // Not yet scheduled
                inDegree[task.name] === 0 && // All predecessors are done
                task.earliestPossibleStartTime <= time // Task can start by 'time'
            )
            .sort((a, b) => b.resolvedDuration - a.resolvedDuration); // Prioritize longer tasks
        console.log(`Potential tasks to start now: ${potentialTasksToRun.map(t => `${t.name} (eps: ${t.earliestPossibleStartTime})`).join(', ')}`);

        const tasksStartedThisCycle = [];

        // Iterate through potential tasks and try to schedule them
        for (let i = 0; i < potentialTasksToRun.length; i++) {
            const task = potentialTasksToRun[i]; // Get from sorted list
            const taskScheduledData = scheduledTasks[task.name];
            const group = taskScheduledData.assignedBandwidthGroup;

            let canRun = false;
            let debugReason = '';

            // This is the CRITICAL LOGIC FIX for global + group bandwidths
            if (group) { // Task is part of a specific group
                const groupKey = group.type === 'list' ? group.identifiers.join(',') : group.identifiers[0];
                const groupBandwidth = group.bandwidth === 'unbound' ? Infinity : group.bandwidth;
                const currentThisGroupOccupancy = currentGroupOccupancyMap[groupKey] || 0;

                // A group-assigned task consumes BOTH group capacity AND global capacity
                if (currentThisGroupOccupancy < groupBandwidth && globalOccupancy < currentGlobalBandwidth) {
                    canRun = true;
                    currentGroupOccupancyMap[groupKey] = currentThisGroupOccupancy + 1; // Consume group slot
                    globalOccupancy++; // Consume global slot
                    debugReason = `Group capacity OK (${currentThisGroupOccupancy}/${groupBandwidth}), Global capacity OK (${globalOccupancy-1}/${currentGlobalBandwidth})`;
                } else {
                    if (currentThisGroupOccupancy >= groupBandwidth) debugReason = `Group capacity exhausted (${currentThisGroupOccupancy}/${groupBandwidth})`;
                    else debugReason = `Global capacity exhausted (${globalOccupancy}/${currentGlobalBandwidth})`;
                }
            } else { // Task is not part of any specific group (only global bandwidth applies)
                if (globalOccupancy < currentGlobalBandwidth) {
                    canRun = true;
                    globalOccupancy++; // Consume global slot
                    debugReason = `Global capacity OK (${globalOccupancy-1}/${currentGlobalBandwidth})`;
                } else {
                    debugReason = `Global capacity exhausted (${globalOccupancy}/${currentGlobalBandwidth})`;
                }
            }
            console.log(`  Attempting to schedule "${task.name}" (Group: ${group ? group.name || group.identifiers[0] : 'None'}). Can run: ${canRun}. Reason: ${debugReason}`);


            if (canRun) {
                taskScheduledData.startTime = time; // Start task at current time
                taskScheduledData.endTime = taskScheduledData.startTime + task.resolvedDuration;
                tasksStartedThisCycle.push(task.name);

                runningTasks.push({
                    taskName: task.name,
                    endTime: taskScheduledData.endTime,
                    assignedBandwidthGroup: group
                });
                // Remove task from `queue` since it's now running
                const queueIndex = queue.indexOf(task);
                if (queueIndex > -1) {
                    queue.splice(queueIndex, 1);
                }
                console.log(`    --> Task "${task.name}" SCHEDULED! Start: ${taskScheduledData.startTime}, End: ${taskScheduledData.endTime}`);
            }
        }
        console.log(`Tasks actually started this cycle: ${tasksStartedThisCycle.join(', ')}`);


        // --- Time Advancement ---
        if (runningTasks.length > 0) {
            // Advance time to the earliest finish time among currently running tasks
            const minEndTimeRunning = Math.min(...runningTasks.map(t => t.endTime));
            // Ensure time only moves forward
            time = Math.max(time, minEndTimeRunning);
            console.log(`Advancing time to next task finish: ${time}`);
        } else if (tasksStartedThisCycle.length === 0 && Object.values(scheduledTasks).some(t => t.endTime === 0)) {
            // If no tasks started this cycle, but there are still unscheduled tasks,
            // this implies waiting for earliestPossibleStartTime or a resource to free up.
            // Find the next earliest possible start time among *ready* tasks, or simply advance by 1.
            let nextAdvanceTime = time + 1; // Default to advancing by 1
            const nextAvailableEps = Object.values(scheduledTasks)
                .filter(t => t.endTime === 0 && inDegree[t.name] === 0 && t.earliestPossibleStartTime > time)
                .map(t => t.earliestPossibleStartTime);
            
            if (nextAvailableEps.length > 0) {
                nextAdvanceTime = Math.min(nextAdvanceTime, ...nextAvailableEps);
            }
            time = nextAdvanceTime;
            console.log(`Advancing time to ${time} (no tasks started, or waiting for EPS).`);
        } else {
            // No running tasks, no tasks to start, and all unscheduled tasks are either blocked by inDegree
            // or should have been caught earlier (e.g. deadlocks). Break the loop.
            console.log(`No more tasks can be scheduled. Breaking loop.`);
            break;
        }

        console.log(`End of Cycle ${time} state: Running: ${runningTasks.map(t => t.name).join(', ')}. Queue: ${queue.map(t => t.name).join(', ')}. Remaining Unscheduled: ${Object.values(scheduledTasks).filter(t => t.endTime === 0).map(t => t.name).join(', ')}`);

    } // End of while loop

    // Final check for unscheduled tasks
    Object.values(scheduledTasks).forEach(task => {
        if (task.endTime === 0) {
            errors.push({
                message: `Scheduling error: Task "${task.name}" could not be scheduled. Possible deadlock or unreachable state.`,
                type: 'error',
                line: task.originalLineNum || 'N/A'
            });
        }
    });

    return { scheduledTasks: Object.values(scheduledTasks), errors };
}