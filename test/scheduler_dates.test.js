// src/tests/scheduler_dates.test.js
import { describe, it, expect } from 'vitest';
import { scheduleTasks } from '../src/utils/scheduler';
import Calendar from '../src/utils/dateHelpers';

// Mock the date-based helper functions until scheduler is refactored
// This ensures our tests are ready for the new scheduler implementation.
// In a real-world scenario, we would mock these functions if they were complex external dependencies.
const mockCalendar = {
    addWorkingDays: (startDate, days, workDays, holidays) => Calendar.addWorkingDays(startDate, days, workDays, holidays),
    addElapsedDays: (startDate, days) => Calendar.addElapsedDays(startDate, days),
    isWorkingDay: (date, workDays) => Calendar.isWorkingDay(date, workDays),
    isHoliday: (date, holidays) => Calendar.isHoliday(date, holidays)
};

describe('scheduleTasks - Date-Aware Scheduling', () => {

    // Helper functions similar to the existing tests
    const createTask = (name, duration, startDate = null, dependencies = []) => ({
        name,
        resolvedDuration: duration,
        startDate, // New property for task-level start date
        dependencies
    });
    const createDependency = (source, target) => ({ source, target });
    const createTaskGroup = (name, type, identifiers, bandwidth, startDate = null) => ({
        name,
        type,
        identifiers,
        bandwidth,
        startDate // New property for group-level start date
    });

    const mockCalendarData = {
        startDate: new Date('2025-06-01T00:00:00.000Z'), // Global project start date
        workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        holidays: ['2025-06-05'], // A Thursday holiday
        durationMode: 'working'
    };

    it('should schedule a single task starting on a working day', () => {
        const tasks = [createTask('Task A', 3)];
        const dependencies = [];
        const globalBandwidth = 'unbound';
        const taskGroups = [];

        const calendarData = {
            // Start date is a Monday, which is a working day
            startDate: new Date('2025-06-02T00:00:00.000Z'),
            workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            holidays: [],
            durationMode: 'working'
        };

        const result = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups, calendarData);
        console.log("result is");
        console.log(result);
        const { scheduledTasks, errors } = result

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(1);
        const taskA = scheduledTasks.find(t => t.name === 'Task A');

        // Task should start exactly on the global start date
        expect(taskA.startDate).toEqual(new Date('2025-06-02T00:00:00.000Z'));
        // And end date should be 3 working days later (Mon, Tue, Wed)
        expect(taskA.endDate).toEqual(new Date('2025-06-04T00:00:00.000Z'));
    });

    it('should schedule a single task using the global start date properly especially if the start day is a holiday', () => {
        const tasks = [createTask('Task A', 3)];
        const dependencies = [];
        const globalBandwidth = 'unbound';
        const taskGroups = [];

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups, mockCalendarData);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(1);
        const taskA = scheduledTasks.find(t => t.name === 'Task A');

        // Task should start at the global start date
        expect(taskA.startDate).toEqual(new Date('2025-06-02T00:00:00.000Z')); // Since 1st June is Sunday
        // And end date should be 3 working days later (Mon, Tue, Wed)
        expect(taskA.endDate).toEqual(new Date('2025-06-04T00:00:00.000Z'));
    });

    it.skip('should schedule tasks using elapsed duration mode correctly even if the starting date is holiday', () => {
        const tasks = [createTask('Task A', 3)];
        const dependencies = [];
        const globalBandwidth = 'unbound';
        const taskGroups = [];

        const calendarData = {
            ...mockCalendarData,
            durationMode: 'elapsed'
        };

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups, calendarData);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(1);
        const taskA = scheduledTasks.find(t => t.name === 'Task A');

        // Task starts on Sun, 3 elapsed days later is Wed.
        expect(taskA.startDate).toEqual(new Date('2025-06-02T00:00:00.000Z'));
        expect(taskA.endDate).toEqual(new Date('2025-06-04T00:00:00.000Z'));
    });

    it('should skip weekends in working duration mode', () => {
        const tasks = [createTask('Task B', 3)];
        const dependencies = [];
        const globalBandwidth = 'unbound';
        const taskGroups = [];

        // Start on a Friday
        const calendarData = {
            ...mockCalendarData,
            startDate: new Date('2025-06-06T00:00:00.000Z'), // Friday
            durationMode: 'working'
        };

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups, calendarData);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(1);
        const taskB = scheduledTasks.find(t => t.name === 'Task B');

        // Expect start date to be Fri, 3 working days later And inclusive
        // Fri(1), Mon(2), Tue(3)
        expect(taskB.startDate).toEqual(new Date('2025-06-06T00:00:00.000Z'));
        expect(taskB.endDate).toEqual(new Date('2025-06-10T00:00:00.000Z'));
    });

    it('should skip holidays in working duration mode', () => {
        const tasks = [createTask('Task C', 2)];
        const dependencies = [];
        const globalBandwidth = 'unbound';
        const taskGroups = [];

        // Start on Wednesday, with a holiday on Thursday.
        const calendarData = {
            ...mockCalendarData,
            startDate: new Date('2025-06-04T00:00:00.000Z'), // Wednesday
            holidays: ['2025-06-05'], // Thursday
        };

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups, calendarData);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(1);
        const taskC = scheduledTasks.find(t => t.name === 'Task C');

        // Task starts on Wed, 2 working days later should be Fri.
        // Wed(1), Thu(skip holiday), Fri(2) -> Sat
        expect(taskC.startDate).toEqual(new Date('2025-06-04T00:00:00.000Z'));
        expect(taskC.endDate).toEqual(new Date('2025-06-06T00:00:00.000Z'));
    });

    it('should respect a custom work week', () => {
        const tasks = [createTask('Task D', 2)];
        const dependencies = [];
        const globalBandwidth = 'unbound';
        const taskGroups = [];

        const calendarData = {
            ...mockCalendarData,
            startDate: new Date('2025-06-07T00:00:00.000Z'), // Saturday
            workDays: ['Sat', 'Sun'], // Only work on weekends
            holidays: ['2025-06-08'] // Sunday is a holiday
        };

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups, calendarData);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(1);
        const taskD = scheduledTasks.find(t => t.name === 'Task D');

        // Task starts on Sat, 2 working days later should be Mon.
        // Sat(1), Sun(skip holiday), Mon(2)
        expect(taskD.startDate).toEqual(new Date('2025-06-07T00:00:00.000Z'));
        expect(taskD.endDate).toEqual(new Date('2025-06-14T00:00:00.000Z'));
    });

    it('should use the most specific start date (task > group > global)', () => {
        const tasks = [
            createTask('Task A', 2),
            createTask('Task B', 3, new Date('2025-06-10T00:00:00.000Z')) // Task-level start date
        ];
        const dependencies = [];
        const globalBandwidth = 'unbound';
        const taskGroups = [
            createTaskGroup('Group 1', 'list', ['Task A'], 1, new Date('2025-06-05T00:00:00.000Z')) // Group-level start date
        ];

        const calendarData = {
            ...mockCalendarData,
            startDate: new Date('2025-06-01T00:00:00.000Z') // Global start date
        };

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups, calendarData);

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(2);

        const taskA = scheduledTasks.find(t => t.name === 'Task A');
        const taskB = scheduledTasks.find(t => t.name === 'Task B');

        // Task A should use the group start date
        expect(taskA.startDate).toEqual(new Date('2025-06-06T00:00:00.000Z'));
        // 2 working days later: Thu, Fri -> Mon
        expect(taskA.endDate).toEqual(new Date('2025-06-09T00:00:00.000Z'));

        // Task B should use its own specific start date
        expect(taskB.startDate).toEqual(new Date('2025-06-10T00:00:00.000Z'));
        // 3 working days later: Tue, Wed, Thu -> Fri
        expect(taskB.endDate).toEqual(new Date('2025-06-12T00:00:00.000Z'));
    });

    it('should correctly schedule tasks with a dependency after their start date', () => {
        const tasks = [
            createTask('Predecessor', 2),
            createTask('Successor', 3, new Date('2025-06-03T00:00:00.000Z')) // Successor starts after Predecessor
        ];
        const dependencies = [
            createDependency('Predecessor', 'Successor')
        ];
        const globalBandwidth = 'unbound';
        const taskGroups = [];

        const calendarData = {
            ...mockCalendarData,
            startDate: new Date('2025-06-01T00:00:00.000Z') // Global start date (Sunday)
        };

        const { scheduledTasks, errors } = scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups, calendarData);

        console.log("scheduledTasks are")
        console.log(scheduledTasks)

        expect(errors).toHaveLength(0);
        expect(scheduledTasks).toHaveLength(2);

        const predecessor = scheduledTasks.find(t => t.name === 'Predecessor');
        const successor = scheduledTasks.find(t => t.name === 'Successor');

        expect(predecessor.startDate).toEqual(new Date('2025-06-02T00:00:00.000Z')); // since 1st is sunday
        expect(predecessor.endDate).toEqual(new Date('2025-06-03T00:00:00.000Z')); // 2 days

        expect(successor.startDate).toEqual(new Date('2025-06-04T00:00:00.000Z'));
        expect(successor.endDate).toEqual(new Date('2025-06-09T00:00:00.000Z'));
    });
});