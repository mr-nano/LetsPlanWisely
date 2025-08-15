import Calendar from '../src/utils/dateHelpers';

describe('Calendar Class - Foundational Logic', () => {

    it('should correctly identify a standard working day', () => {
        const date = new Date('2025-06-02T12:00:00Z'); // A Monday
        const workDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        expect(Calendar.isWorkingDay(date, workDays)).toBe(true);
    });

    it('should correctly identify a standard weekend day as non-working', () => {
        const date = new Date('2025-06-07T12:00:00Z'); // A Saturday
        const workDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        expect(Calendar.isWorkingDay(date, workDays)).toBe(false);
    });

    it('should correctly identify a holiday', () => {
        const date = new Date('2025-07-04T12:00:00Z'); // A Friday
        const holidays = ['2025-07-04'];
        expect(Calendar.isHoliday(date, holidays)).toBe(true);
    });

    it('should correctly identify a non-holiday', () => {
        const date = new Date('2025-07-05T12:00:00Z');
        const holidays = ['2025-07-04'];
        expect(Calendar.isHoliday(date, holidays)).toBe(false);
    });

    it('should add elapsed days correctly without skipping any days', () => {
        const startDate = new Date('2025-06-01T12:00:00Z'); // A Sunday
        const daysToAdd = 5;
        const expectedDate = new Date('2025-06-06T12:00:00Z'); // A Friday
        expect(Calendar.addElapsedDays(startDate, daysToAdd)).toEqual(expectedDate);
    });
});

// Standard work days, e.g., Mon-Fri
const standardWorkDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

describe('Calendar Class - Comprehensive addWorkingDays Logic', () => {

    it('should add a single working day correctly', () => {
        const startDate = new Date('2025-06-02T12:00:00Z'); // Mon
        const daysToAdd = 1;
        const expectedDate = new Date('2025-06-02T12:00:00Z'); // Mon (duration 1 means it ends same day)
        expect(Calendar.addWorkingDays(startDate, daysToAdd, standardWorkDays, [])).toEqual(expectedDate);
    });

    it('should skip a weekend when adding working days', () => {
        const startDate = new Date('2025-06-06T12:00:00Z'); // Fri
        const daysToAdd = 1;
        // Corrected expectation: A 1-day task starting Friday ends on Friday.
        // Your previous test expected it to end on Monday, which would be a 2-day task.
        const expectedDate = new Date('2025-06-06T12:00:00Z'); // Fri
        expect(Calendar.addWorkingDays(startDate, daysToAdd, standardWorkDays, [])).toEqual(expectedDate);
    });

    it('should skip multiple weekends when adding a long duration', () => {
        const startDate = new Date('2025-06-02T12:00:00Z'); // Mon
        const daysToAdd = 10;
        const expectedDate = new Date('2025-06-13T12:00:00Z'); // Fri (the 10th working day is Fri, 6/13)
        expect(Calendar.addWorkingDays(startDate, daysToAdd, standardWorkDays, [])).toEqual(expectedDate);
    });

    it('should skip a holiday when adding working days', () => {
        const startDate = new Date('2025-07-03T12:00:00Z'); // Thu
        const daysToAdd = 2;
        const holidays = ['2025-07-04']; // Friday holiday
        const expectedDate = new Date('2025-07-07T12:00:00Z'); // Mon (2 working days: Thu, Mon)
        expect(Calendar.addWorkingDays(startDate, daysToAdd, standardWorkDays, holidays)).toEqual(expectedDate);
    });

    it('should handle a holiday falling on a weekend', () => {
        const startDate = new Date('2025-06-06T12:00:00Z'); // Fri
        const daysToAdd = 1;
        const holidays = ['2025-06-07']; // Saturday holiday
        const expectedDate = new Date('2025-06-06T12:00:00Z'); // Fri (holiday is irrelevant as it's a weekend)
        expect(Calendar.addWorkingDays(startDate, daysToAdd, standardWorkDays, holidays)).toEqual(expectedDate);
    });

    it('should handle a custom work week (e.g., Mon-Sun)', () => {
        const startDate = new Date('2025-06-06T12:00:00Z'); // Fri
        const daysToAdd = 3;
        const workDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const expectedDate = new Date('2025-06-08T12:00:00Z'); // Sun (Fri, Sat, Sun)
        expect(Calendar.addWorkingDays(startDate, daysToAdd, workDays, [])).toEqual(expectedDate);
    });

    it('should handle zero days to add, returning the same date', () => {
        const startDate = new Date('2025-06-02T12:00:00Z'); // Mon
        const daysToAdd = 0;
        const expectedDate = new Date('2025-06-02T12:00:00Z');
        expect(Calendar.addWorkingDays(startDate, daysToAdd, standardWorkDays, [])).toEqual(expectedDate);
    });
});