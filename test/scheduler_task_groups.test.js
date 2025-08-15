// test/scheduler_task_groups.test.js
import { describe, it, expect } from 'vitest';
import { scheduleTasks } from '../src/utils/scheduler';

describe('scheduleTasks - Task Group Assignment', () => {

    // Helper function to easily create task objects for tests
    const createTask = (name, duration, dependencies = [], description = '') => ({
        name,
        description,
        duration,
        resolvedDuration: typeof duration === 'number' ? duration : 1,
        dependencies
    });

    // Helper to easily create dependency objects
    const createDependency = (source, target) => ({ source, target });

    // Helper to easily create task group objects
    const createTaskGroup = (name, type, identifiers, bandwidth) => ({
        name,
        type,
        identifiers,
        bandwidth
    });

    describe('Task Group Assignment', () => {
        it('should assign tasks to correct task groups for list type', () => {
            const tasks = [
                createTask('Frontend-Task1', 2),
                createTask('Frontend-Task2', 3),
                createTask('Backend-Task1', 1),
                createTask('Backend-Task2', 4),
            ];
            const dependencies = [];
            const globalBandwidth = 'unbound';
            const taskGroups = [
                createTaskGroup('Frontend Team', 'list', ['Frontend-Task1', 'Frontend-Task2'], 2),
                createTaskGroup('Backend Team', 'list', ['Backend-Task1', 'Backend-Task2'], 1),
            ];

            const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

            expect(errors).toHaveLength(0);
            expect(scheduledTasks).toHaveLength(4);

            // Check that tasks are assigned to correct groups
            const frontendTask1 = scheduledTasks.find(t => t.name === 'Frontend-Task1');
            const frontendTask2 = scheduledTasks.find(t => t.name === 'Frontend-Task2');
            const backendTask1 = scheduledTasks.find(t => t.name === 'Backend-Task1');
            const backendTask2 = scheduledTasks.find(t => t.name === 'Backend-Task2');

            expect(frontendTask1.assignedBandwidthGroup).toEqual(taskGroups[0]);
            expect(frontendTask2.assignedBandwidthGroup).toEqual(taskGroups[0]);
            expect(backendTask1.assignedBandwidthGroup).toEqual(taskGroups[1]);
            expect(backendTask2.assignedBandwidthGroup).toEqual(taskGroups[1]);
        });

        it('should assign tasks to correct task groups for regex type', () => {
            const tasks = [
                createTask('backend-login', 2),
                createTask('backend-data', 3),
                createTask('frontend-home', 1),
                createTask('backend-api', 4),
            ];
            const dependencies = [];
            const globalBandwidth = 'unbound';
            const taskGroups = [
                createTaskGroup('Backend Team', 'regex', ['backend-.*'], 2),
            ];

            const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

            expect(errors).toHaveLength(0);
            expect(scheduledTasks).toHaveLength(4);

            // Check that backend tasks are assigned to the group
            const backendLogin = scheduledTasks.find(t => t.name === 'backend-login');
            const backendData = scheduledTasks.find(t => t.name === 'backend-data');
            const backendApi = scheduledTasks.find(t => t.name === 'backend-api');
            const frontendHome = scheduledTasks.find(t => t.name === 'frontend-home');

            expect(backendLogin.assignedBandwidthGroup).toEqual(taskGroups[0]);
            expect(backendData.assignedBandwidthGroup).toEqual(taskGroups[0]);
            expect(backendApi.assignedBandwidthGroup).toEqual(taskGroups[0]);
            expect(frontendHome.assignedBandwidthGroup).toBeNull(); // Not in any group
        });

        it('should handle tasks that match multiple groups (last group wins)', () => {
            const tasks = [
                createTask('backend-login', 2),
                createTask('frontend-home', 1),
            ];
            const dependencies = [];
            const globalBandwidth = 'unbound';
            const taskGroups = [
                createTaskGroup('Backend Team', 'regex', ['backend-.*'], 1),
                createTaskGroup('All Tasks', 'list', ['backend-login', 'frontend-home'], 2),
            ];

            const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

            expect(errors).toHaveLength(0);
            expect(scheduledTasks).toHaveLength(2);

            // Check that tasks are assigned to the last matching group
            const backendLogin = scheduledTasks.find(t => t.name === 'backend-login');
            const frontendHome = scheduledTasks.find(t => t.name === 'frontend-home');

            expect(backendLogin.assignedBandwidthGroup).toEqual(taskGroups[1]); // Last group wins
            expect(frontendHome.assignedBandwidthGroup).toEqual(taskGroups[1]);
        });

        it('should handle tasks with no assigned group (assignedBandwidthGroup = null)', () => {
            const tasks = [
                createTask('Task A', 2),
                createTask('Task B', 3),
            ];
            const dependencies = [];
            const globalBandwidth = 'unbound';
            const taskGroups = []; // No task groups defined

            const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

            expect(errors).toHaveLength(0);
            expect(scheduledTasks).toHaveLength(2);

            // Check that tasks have no assigned group
            scheduledTasks.forEach(task => {
                expect(task.assignedBandwidthGroup).toBeNull();
            });
        });

        it('should handle invalid regex in task group', () => {
            const tasks = [
                createTask('Task A', 2),
            ];
            const dependencies = [];
            const globalBandwidth = 'unbound';
            const taskGroups = [
                createTaskGroup('Invalid Group', 'regex', ['[invalid-regex'], 1), // Invalid regex
            ];

            const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

            expect(errors).toHaveLength(1);
            expect(errors[0].type).toBe('error');
            expect(errors[0].message).toContain('Invalid regex in Task Group');

            // Task should not be assigned to the invalid group 2025-08-15 - Earlier we were still parsing the task and scheduling it we were not just assigning it to a task group but now since task groups are essentially scheduling font mechanisms or impact the scheduling if we fail parsing of a task group we will just not schedule it
            expect(scheduledTasks).toHaveLength(0);
        });

        it('should handle mixed group types and ungrouped tasks', () => {
            const tasks = [
                createTask('backend-login', 2),
                createTask('frontend-home', 1),
                createTask('database-setup', 3),
            ];
            const dependencies = [];
            const globalBandwidth = 'unbound';
            const taskGroups = [
                createTaskGroup('Backend Team', 'regex', ['backend-.*'], 1),
                createTaskGroup('Frontend Team', 'list', ['frontend-home'], 1),
            ];

            const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

            expect(errors).toHaveLength(0);
            expect(scheduledTasks).toHaveLength(3);

            const backendLogin = scheduledTasks.find(t => t.name === 'backend-login');
            const frontendHome = scheduledTasks.find(t => t.name === 'frontend-home');
            const databaseSetup = scheduledTasks.find(t => t.name === 'database-setup');

            expect(backendLogin.assignedBandwidthGroup).toEqual(taskGroups[0]);
            expect(frontendHome.assignedBandwidthGroup).toEqual(taskGroups[1]);
            expect(databaseSetup.assignedBandwidthGroup).toBeNull(); // Not in any group
        });
    });

    describe('Task Group Bandwidth Enforcement', () => {
        it('should enforce bandwidth limits for list-based task groups', () => {
            const tasks = [
                createTask('FE-Task1', 3),
                createTask('FE-Task2', 2),
                createTask('FE-Task3', 1),
            ];
            const dependencies = [];
            const globalBandwidth = 'unbound';
            const taskGroups = [
                createTaskGroup('Frontend Team', 'list', ['FE-Task1', 'FE-Task2', 'FE-Task3'], 1), // Only 1 at a time
            ];

            const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

            expect(errors).toHaveLength(0);
            expect(scheduledTasks).toHaveLength(3);

            // All tasks should be assigned to the group
            scheduledTasks.forEach(task => {
                expect(task.assignedBandwidthGroup).toEqual(taskGroups[0]);
            });

            // Tasks should run sequentially due to bandwidth limit of 1
            const sortedTasks = scheduledTasks.sort((a, b) => a.startTime - b.startTime);
            
            // First task starts at 0
            expect(sortedTasks[0].startTime).toBe(0);
            expect(sortedTasks[0].endTime).toBe(sortedTasks[0].resolvedDuration);
            
            // Second task starts when first ends
            expect(sortedTasks[1].startTime).toBe(sortedTasks[0].endTime);
            expect(sortedTasks[1].endTime).toBe(sortedTasks[1].startTime + sortedTasks[1].resolvedDuration);
            
            // Third task starts when second ends
            expect(sortedTasks[2].startTime).toBe(sortedTasks[1].endTime);
            expect(sortedTasks[2].endTime).toBe(sortedTasks[2].startTime + sortedTasks[2].resolvedDuration);
        });

        it('should enforce bandwidth limits for regex-based task groups', () => {
            const tasks = [
                createTask('backend-login', 4),
                createTask('backend-data', 3),
                createTask('frontend-home', 2),
            ];
            const dependencies = [];
            const globalBandwidth = 'unbound';
            const taskGroups = [
                createTaskGroup('Backend Team', 'regex', ['backend-.*'], 1), // Only 1 backend task at a time
            ];

            const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

            expect(errors).toHaveLength(0);
            expect(scheduledTasks).toHaveLength(3);

            const backendLogin = scheduledTasks.find(t => t.name === 'backend-login');
            const backendData = scheduledTasks.find(t => t.name === 'backend-data');
            const frontendHome = scheduledTasks.find(t => t.name === 'frontend-home');

            // Backend tasks should be assigned to the group
            expect(backendLogin.assignedBandwidthGroup).toEqual(taskGroups[0]);
            expect(backendData.assignedBandwidthGroup).toEqual(taskGroups[0]);
            expect(frontendHome.assignedBandwidthGroup).toBeNull(); // Not in group

            // Frontend task can run in parallel (no group restriction)
            expect(frontendHome.startTime).toBe(0);

            // Backend tasks should run sequentially due to bandwidth limit
            if (backendLogin.startTime === 0) {
                expect(backendLogin.endTime).toBe(4);
                expect(backendData.startTime).toBe(4);
                expect(backendData.endTime).toBe(7);
            } else {
                expect(backendData.endTime).toBe(3);
                expect(backendLogin.startTime).toBe(3);
                expect(backendLogin.endTime).toBe(7);
            }
        });

        it('should handle unbound bandwidth for task groups', () => {
            const tasks = [
                createTask('FE-Task1', 2),
                createTask('FE-Task2', 3),
                createTask('FE-Task3', 1),
            ];
            const dependencies = [];
            const globalBandwidth = 'unbound';
            const taskGroups = [
                createTaskGroup('Frontend Team', 'list', ['FE-Task1', 'FE-Task2', 'FE-Task3'], 'unbound'), // Unlimited
            ];

            const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

            expect(errors).toHaveLength(0);
            expect(scheduledTasks).toHaveLength(3);

            // All tasks should be assigned to the group
            scheduledTasks.forEach(task => {
                expect(task.assignedBandwidthGroup).toEqual(taskGroups[0]);
            });

            // All tasks should run in parallel due to unbound bandwidth
            scheduledTasks.forEach(task => {
                expect(task.startTime).toBe(0);
            });
        });
    });

    describe('Integration with Dependencies', () => {
        it('should respect both dependencies and task group bandwidth', () => {
            const tasks = [
                createTask('FE-Task1', 2),
                createTask('FE-Task2', 3),
                createTask('BE-Task1', 1),
            ];
            const dependencies = [
                createDependency('FE-Task1', 'FE-Task2'), // FE-Task1 must finish before FE-Task2
            ];
            const globalBandwidth = 'unbound';
            const taskGroups = [
                createTaskGroup('Frontend Team', 'list', ['FE-Task1', 'FE-Task2'], 1), // Only 1 frontend task at a time
            ];

            const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups);

            expect(errors).toHaveLength(0);
            expect(scheduledTasks).toHaveLength(3);

            const feTask1 = scheduledTasks.find(t => t.name === 'FE-Task1');
            const feTask2 = scheduledTasks.find(t => t.name === 'FE-Task2');
            const beTask1 = scheduledTasks.find(t => t.name === 'BE-Task1');

            // Check group assignments
            expect(feTask1.assignedBandwidthGroup).toEqual(taskGroups[0]);
            expect(feTask2.assignedBandwidthGroup).toEqual(taskGroups[0]);
            expect(beTask1.assignedBandwidthGroup).toBeNull();

            // Check scheduling respects both dependency and bandwidth
            expect(feTask1.startTime).toBe(0);
            expect(feTask1.endTime).toBe(2);
            expect(feTask2.startTime).toBe(2); // Must wait for FE-Task1 due to dependency
            expect(feTask2.endTime).toBe(5);

            // BE-Task1 can run in parallel with FE-Task1 (no dependency, different group)
            expect(beTask1.startTime).toBe(0);
            expect(beTask1.endTime).toBe(1);
        });
    });
}); 