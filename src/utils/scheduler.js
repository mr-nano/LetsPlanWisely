/**
 * src/utils/scheduler.js
 *
 * This file contains the core scheduling logic for the Visual Task Scheduler.
 * It takes parsed task data, builds a dependency graph, and calculates optimal
 * start/end times based on dependencies and parallelization limits.
 */

import Calendar from './dateHelpers';

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
 * @param {Object} [calendarData] - Optional object containing global scheduling parameters.
 * @returns {object} An object containing the scheduled tasks and any new errors.
 */
export function scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups, calendarData) {
    const errors = [];
    const scheduledTasks = {};

    const { graph, inDegree, taskMap } = buildGraph(tasks, dependencies, errors);

    if (errors.length > 0) {
        return { scheduledTasks: Array.from(taskMap.values()), errors };
    }

    if (detectCircularDependencies(graph, Array.from(taskMap.values()), errors)) {
        return { scheduledTasks: Array.from(taskMap.values()), errors };
    }

    // New: Handle invalid regexes before the main loop
    let hasFatalErrors = false;
    const processedTaskGroups = taskGroups.map(group => {
        if (group.type === 'regex') {
            try {
                return { ...group, regex: new RegExp(group.identifiers[0]) };
            } catch (e) {
                errors.push({
                    message: `Invalid regex in Task Group "${group.identifiers[0]}": ${e.message}`,
                    type: 'error',
                    line: 'N/A'
                });
                hasFatalErrors = true;
                return null;
            }
        }
        return group;
    }).filter(Boolean);

    if (hasFatalErrors) {
        return { scheduledTasks: Object.values(scheduledTasks), errors };
    }

    // Add these two log statements
    console.log('--- Scheduler Start ---');
    console.log('Received calendarData:', calendarData);
    const isDateAwareMode = !!calendarData && !!calendarData.startDate;
    console.log('isDateAwareMode:', isDateAwareMode);

    // New: Check if calendarData is present. If not, use the old scheduling logic.
    if (!calendarData || !calendarData.startDate) {
        // --- Fallback to Old Time-Unit Scheduling Logic ---
        Array.from(taskMap.values()).forEach(task => {
            scheduledTasks[task.name] = {
                ...task,
                startTime: 0,
                endTime: 0,
                earliestPossibleStartTime: 0,
                assignedBandwidthGroup: null, // This will be assigned later in the loop
            };
        });

        // The rest of the original time-unit based loop remains unchanged:
        const queue = Object.values(scheduledTasks).filter(task => inDegree[task.name] === 0);
        let time = 0;
        let runningTasks = [];

        while (Object.values(scheduledTasks).some(t => t.endTime === 0)) {
            // Update in-degrees for newly finished tasks
            const newlyFinishedTasks = runningTasks.filter(task => task.endTime <= time);
            runningTasks = runningTasks.filter(task => task.endTime > time);

            if (newlyFinishedTasks.length > 0) {
                newlyFinishedTasks.forEach(finishedTask => {
                    graph[finishedTask.taskName].forEach(dependentTaskName => {
                        inDegree[dependentTaskName]--;
                        scheduledTasks[dependentTaskName].earliestPossibleStartTime = Math.max(
                            scheduledTasks[dependentTaskName].earliestPossibleStartTime,
                            finishedTask.endTime
                        );
                        if (inDegree[dependentTaskName] === 0 && scheduledTasks[dependentTaskName].endTime === 0) {
                            queue.push(scheduledTasks[dependentTaskName]);
                        }
                    });
                });
            }

            const currentGlobalBandwidth = globalBandwidth === 'unbound' ? Infinity : globalBandwidth;
            let globalOccupancy = runningTasks.filter(t => !t.assignedBandwidthGroup).length;

            const currentGroupOccupancyMap = {};
            processedTaskGroups.forEach(group => {
                const key = group.type === 'list' ? group.identifiers.join(',') : group.identifiers[0];
                currentGroupOccupancyMap[key] = runningTasks.filter(t =>
                    t.assignedBandwidthGroup &&
                    ((t.assignedBandwidthGroup.type === 'list' && group.type === 'list' && t.assignedBandwidthGroup.identifiers.join(',') === key) ||
                        (t.assignedBandwidthGroup.type === 'regex' && group.type === 'regex' && t.assignedBandwidthGroup.regex.test(t.taskName)))
                ).length;
            });

            const potentialTasksToRun = queue
                .filter(task =>
                    task.endTime === 0 &&
                    inDegree[task.name] === 0 &&
                    task.earliestPossibleStartTime <= time
                )
                .sort((a, b) => b.resolvedDuration - a.resolvedDuration);

            const tasksStartedThisCycle = [];

            for (let i = 0; i < potentialTasksToRun.length; i++) {
                const task = potentialTasksToRun[i];
                const taskScheduledData = scheduledTasks[task.name];

                // Re-assign group since it's not done initially in this old logic branch
                const taskGroup = processedTaskGroups.find(group =>
                    (group.type === 'list' && group.identifiers.includes(task.name)) ||
                    (group.type === 'regex' && group.regex.test(task.name))
                );
                taskScheduledData.assignedBandwidthGroup = taskGroup;

                let canRun = false;
                const group = taskScheduledData.assignedBandwidthGroup;

                if (group) {
                    const groupKey = group.type === 'list' ? group.identifiers.join(',') : group.identifiers[0];
                    const groupBandwidth = group.bandwidth === 'unbound' ? Infinity : group.bandwidth;
                    const currentThisGroupOccupancy = currentGroupOccupancyMap[groupKey] || 0;
                    if (currentThisGroupOccupancy < groupBandwidth && globalOccupancy < currentGlobalBandwidth) {
                        canRun = true;
                        currentGroupOccupancyMap[groupKey] = currentThisGroupOccupancy + 1;
                        globalOccupancy++;
                    }
                } else {
                    if (globalOccupancy < currentGlobalBandwidth) {
                        canRun = true;
                        globalOccupancy++;
                    }
                }

                if (canRun) {
                    taskScheduledData.startTime = time;
                    taskScheduledData.endTime = taskScheduledData.startTime + task.resolvedDuration;
                    tasksStartedThisCycle.push(task.name);
                    runningTasks.push({
                        taskName: task.name,
                        endTime: taskScheduledData.endTime,
                        assignedBandwidthGroup: group
                    });
                    const queueIndex = queue.indexOf(task);
                    if (queueIndex > -1) {
                        queue.splice(queueIndex, 1);
                    }
                }
            }

            if (runningTasks.length > 0) {
                const minEndTimeRunning = Math.min(...runningTasks.map(t => t.endTime));
                time = Math.max(time, minEndTimeRunning);
            } else if (tasksStartedThisCycle.length === 0 && Object.values(scheduledTasks).some(t => t.endTime === 0)) {
                let nextAdvanceTime = time + 1;
                const nextAvailableEps = Object.values(scheduledTasks)
                    .filter(t => t.endTime === 0 && inDegree[t.name] === 0 && t.earliestPossibleStartTime > time)
                    .map(t => t.earliestPossibleStartTime);

                if (nextAvailableEps.length > 0) {
                    nextAdvanceTime = Math.min(nextAdvanceTime, ...nextAvailableEps);
                }
                time = nextAdvanceTime;
            } else {
                break;
            }
        }

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

    // --- New Date-Aware Scheduling Logic (Only runs if calendarData is present) ---
    Array.from(taskMap.values()).forEach(task => {

        // Log the current task name
        console.log(`\n--- Processing Task: ${task.name} ---`);

        // Log the task's explicit start date from the input
        console.log(`Task's explicit start date:`, task.startDate);

        const taskGroup = processedTaskGroups.find(group =>
            (group.type === 'list' && group.identifiers.includes(task.name)) ||
            (group.type === 'regex' && group.regex.test(task.name))
        );

        // Log the start date from the found group
        console.log(`Group start date found:`, taskGroup ? taskGroup.startDate : 'N/A');

        const taskStartDate = task.startDate || (taskGroup ? taskGroup.startDate : null) || (calendarData ? calendarData.startDate : null);

        // Log the final resolved start date before it's assigned
        console.log(`Resolved start date:`, taskStartDate);

        scheduledTasks[task.name] = {
            ...task,
            startDate: taskStartDate ? new Date(taskStartDate) : null,
            endDate: null,
            isScheduled: false,
            assignedBandwidthGroup: taskGroup,
            // The time fields will be calculated later
            startTime: 0,
            endTime: 0,
            earliestPossibleStartTime: 0,
        };
    });

    // This code is new:
    const workDays = calendarData.workDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const holidays = calendarData.holidays || [];

    // New: Function to find the next valid working day
    function findNextWorkingDay(date) {
        let newDate = new Date(date);
        while (!Calendar.isWorkingDay(newDate, workDays) || Calendar.isHoliday(newDate, holidays)) {
            newDate.setUTCDate(newDate.getUTCDate() + 1);
        }
        return newDate;
    }

    const queue = Object.values(scheduledTasks).filter(t => inDegree[t.name] === 0);
    const scheduledTasksList = [];

    // Simple scheduling loop for date-aware logic (will be expanded later)
    queue.forEach(task => {
        if (!task.startDate) {
            task.startDate = calendarData.startDate;
        }

        const workDays = calendarData.workDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const holidays = calendarData.holidays || [];
        const durationMode = calendarData.durationMode || 'working';

        // Log the date before adjustment
        console.log(`Before adjustment, task.startDate: ${task.startDate.toISOString()}`);

        // New: Check and adjust the task's start date to the next valid working day
        // This is the CRITICAL change to fix the logical flaw
        const adjustedStartDate = findNextWorkingDay(task.startDate);

        // Log the date after adjustment
        console.log(`After adjustment, adjustedStartDate: ${adjustedStartDate.toISOString()}`);

        // This is the line that needs fixing
        scheduledTasks[task.name].startDate = adjustedStartDate;

        if (durationMode === 'working') {
            task.endDate = Calendar.addWorkingDays(task.startDate, task.resolvedDuration, workDays, holidays);
        } else {
            task.endDate = Calendar.addElapsedDays(task.startDate, task.resolvedDuration);
        }
        task.isScheduled = true;
        scheduledTasksList.push(task);
    });

    return {
        scheduledTasks: scheduledTasksList,
        errors: errors
    };
}