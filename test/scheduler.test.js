// src/tests/scheduler.test.js
import { describe, it, expect } from 'vitest';
import { scheduleTasks } from '../src/utils/scheduler';

describe('scheduleTasks - Core Functionality', () => {

    // Helper function to easily create task objects for tests
    // Uses default resolvedDuration of 1 if not specified
    const createTask = (name, duration, dependencies = [], description = '') => ({
        name,
        description,
        duration, // Keep original duration string as well for completeness if needed by scheduler
        resolvedDuration: typeof duration === 'number' ? duration : 1, // Default if not numeric
        dependencies // Inline dependencies, though scheduler uses separate 'dependencies' array
    });

    // Helper to easily create dependency objects
    const createDependency = (source, target) => ({ source, target });

    // Helper to easily create task group objects
    const createTaskGroup = (type, identifiers, bandwidth) => ({ type, identifiers, bandwidth });

    it('should schedule a single task with no dependencies', () => {
        const tasks = [
            createTask('Task A', 5)
        ];
        const dependencies = [];
        const globalBandwidth = 'unbound';
        const taskGroups = [];

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(1);
        expect(scheduledTasks[0].name).toBe('Task A');
        expect(scheduledTasks[0].startTime).toBe(0);
        expect(scheduledTasks[0].endTime).toBe(5);
    });

    it('should schedule two sequential tasks correctly (A -> B)', () => {
        const tasks = [
            createTask('Task A', 3),
            createTask('Task B', 2)
        ];
        const dependencies = [
            createDependency('Task A', 'Task B') // A must finish before B starts
        ];
        const globalBandwidth = 'unbound';
        const taskGroups = [];

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(2);

        const taskA = scheduledTasks.find(t => t.name === 'Task A');
        const taskB = scheduledTasks.find(t => t.name === 'Task B');

        expect(taskA.startTime).toBe(0);
        expect(taskA.endTime).toBe(3);
        expect(taskB.startTime).toBe(3); // B starts when A finishes
        expect(taskB.endTime).toBe(5);
    });

    it('should schedule two independent tasks in parallel when bandwidth is unbound', () => {
        const tasks = [
            createTask('Task X', 4),
            createTask('Task Y', 5)
        ];
        const dependencies = [];
        const globalBandwidth = 'unbound'; // Allows unlimited parallel tasks
        const taskGroups = [];

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(2);

        const taskX = scheduledTasks.find(t => t.name === 'Task X');
        const taskY = scheduledTasks.find(t => t.name === 'Task Y');

        expect(taskX.startTime).toBe(0);
        expect(taskY.startTime).toBe(0); // Both start at time 0
        expect(taskX.endTime).toBe(4);
        expect(taskY.endTime).toBe(5); // Longest task dictates overall end time
    });

    it('should detect a simple circular dependency (A -> B -> A)', () => {
        const tasks = [
            createTask('Task A', 1),
            createTask('Task B', 1)
        ];
        const dependencies = [
            createDependency('Task A', 'Task B'),
            createDependency('Task B', 'Task A')
        ];
        const globalBandwidth = 'unbound';
        const taskGroups = [];

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

        expect(scheduledTasks).toHaveLength(0); // No tasks should be scheduled in case of cycle
        expect(errors).toHaveLength(1);
        expect(errors[0].type).toBe('error');
        expect(errors[0].message).toContain('Circular dependency detected: Task A -> Task B -> Task A');
    });

    it('should apply global bandwidth limit (e.g., 1) for sequential execution', () => {
        const tasks = [
            createTask('Task P', 3),
            createTask('Task Q', 2)
        ];
        const dependencies = [];
        const globalBandwidth = 1; // Only one task can run at a time
        const taskGroups = [];

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(2);

        const taskP = scheduledTasks.find(t => t.name === 'Task P');
        const taskQ = scheduledTasks.find(t => t.name === 'Task Q');

        // Due to global bandwidth 1, tasks must run sequentially
        // Sorting in scheduler prioritizes longer tasks, so P (3) might run first, then Q (2)
        // Or vice-versa depending on how the initial queue is built if durations are equal.
        // Let's test for correct sequential flow for either order
        const actualStartTimes = {
            'Task P': taskP.startTime,
            'Task Q': taskQ.startTime,
        };
        const actualEndTimes = {
            'Task P': taskP.endTime,
            'Task Q': taskQ.endTime,
        };

        if (taskP.startTime === 0) {
            expect(taskP.endTime).toBe(3);
            expect(taskQ.startTime).toBe(3); // Q starts after P finishes
            expect(taskQ.endTime).toBe(5);
        } else { // Q started at 0
            expect(taskQ.endTime).toBe(2);
            expect(taskP.startTime).toBe(2); // P starts after Q finishes
            expect(taskP.endTime).toBe(5);
        }
    });

    it('should apply task group bandwidth limit for list type', () => {
        const tasks = [
            createTask('FE-Task1', 2),
            createTask('FE-Task2', 3),
            createTask('BE-Task1', 1),
        ];
        const dependencies = [];
        const globalBandwidth = 'unbound';
        const taskGroups = [
            createTaskGroup('list', ['FE-Task1', 'FE-Task2'], 1) // Only 1 frontend task at a time
        ];

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(3);

        const fe1 = scheduledTasks.find(t => t.name === 'FE-Task1');
        const fe2 = scheduledTasks.find(t => t.name === 'FE-Task2');
        const be1 = scheduledTasks.find(t => t.name === 'BE-Task1');

        // BE-Task1 should run in parallel at time 0 as it's unbound by the FE group
        expect(be1.startTime).toBe(0);
        expect(be1.endTime).toBe(1);

        // FE tasks must run sequentially due to group limit
        if (fe1.startTime === 0) { // FE-Task1 starts first
            expect(fe1.endTime).toBe(2);
            expect(fe2.startTime).toBe(2); // FE-Task2 starts after FE-Task1 finishes
            expect(fe2.endTime).toBe(5);
        } else { // FE-Task2 starts first
            expect(fe2.endTime).toBe(3);
            expect(fe1.startTime).toBe(3); // FE-Task1 starts after FE-Task2 finishes
            expect(fe1.endTime).toBe(5);
        }
    });

    it('should apply task group bandwidth limit for regex type', () => {
        const tasks = [
            createTask('backend-login', 4),
            createTask('backend-data', 3),
            createTask('frontend-home', 2),
        ];
        const dependencies = [];
        const globalBandwidth = 'unbound';
        const taskGroups = [
            createTaskGroup('regex', ['backend-.*'], 1) // Only 1 backend task at a time
        ];

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(3);

        const beLogin = scheduledTasks.find(t => t.name === 'backend-login');
        const beData = scheduledTasks.find(t => t.name === 'backend-data');
        const feHome = scheduledTasks.find(t => t.name === 'frontend-home');

        // frontend-home should run in parallel at time 0
        expect(feHome.startTime).toBe(0);
        expect(feHome.endTime).toBe(2);

        // Backend tasks must run sequentially due to regex group limit
        // Longer backend task (login: 4) might run first.
        if (beLogin.startTime === 0) {
            expect(beLogin.endTime).toBe(4);
            expect(beData.startTime).toBe(4); // Data starts after Login finishes
            expect(beData.endTime).toBe(7);
        } else {
            expect(beData.endTime).toBe(3);
            expect(beLogin.startTime).toBe(3); // Login starts after Data finishes
            expect(beLogin.endTime).toBe(7);
        }
    });

    // Add more tests for complex scenarios:
    // - Mixed global and group bandwidths
    // - Tasks belonging to multiple groups (last group definition should win)
    // - Edge cases: zero duration tasks, very large durations
    // - Combined dependencies and bandwidths
    // - Tasks with missing dependencies (already caught by parser, but good to ensure scheduler handles gracefully)
});
