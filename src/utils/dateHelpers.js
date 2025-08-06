// src/utils/dateHelpers.js

/**
 * A static class for handling date and calendar-related calculations.
 * Encapsulates logic for working days, holidays, and adding durations.
 */
class Calendar {
  
  /**
   * Checks if a given date is a working day based on a provided list of workdays.
   * @param {Date} date - The JavaScript Date object to check.
   * @param {string[]} workDays - An array of valid 3-letter weekday abbreviations (e.g., ['Mon', 'Tue']).
   * @returns {boolean} - True if the date is a working day, false otherwise.
   */
  static isWorkingDay(date, workDays) {
    const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
    return workDays.includes(dayOfWeek);
  }

  /**
   * Checks if a given date is a holiday.
   * @param {Date} date - The JavaScript Date object to check.
   * @param {string[]} holidays - An array of holiday dates in 'YYYY-MM-DD' format.
   * @returns {boolean} - True if the date is a holiday, false otherwise.
   */
  static isHoliday(date, holidays) {
    const dateString = date.toISOString().split('T')[0];
    return holidays.includes(dateString);
  }

/**
   * Adds a specified number of working days to a start date, skipping weekends and holidays.
   * @param {Date} startDate - The initial date.
   * @param {number} days - The number of working days to add.
   * @param {string[]} workDays - An array of valid 3-letter weekday abbreviations.
   * @param {string[]} holidays - An array of holiday dates in 'YYYY-MM-DD' format.
   * @returns {Date} - The calculated end date.
   */
  static addWorkingDays(startDate, days, workDays, holidays) {
    const resultDate = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < days) {
      resultDate.setUTCDate(resultDate.getUTCDate() + 1); // Use UTC method
      if (this.isWorkingDay(resultDate, workDays) && !this.isHoliday(resultDate, holidays)) {
        daysAdded++;
      }
    }

    return resultDate;
  }

  /**
   * Adds a specified number of elapsed days to a start date, counting every day.
   * @param {Date} startDate - The initial date.
   * @param {number} days - The number of elapsed days to add.
   * @returns {Date} - The calculated end date.
   */
  static addElapsedDays(startDate, days) {
    const resultDate = new Date(startDate);
    resultDate.setUTCDate(resultDate.getUTCDate() + days); // Use UTC method
    return resultDate;
  }
}

export default Calendar;