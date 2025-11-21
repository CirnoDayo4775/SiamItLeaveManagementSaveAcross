/**
 * Date and Time Utility Functions
 * Centralized utilities for date/time calculations used across the application
 */

const config = require('../config');

/**
 * Convert hours and minutes to total minutes
 * @param {number} h - Hours
 * @param {number} m - Minutes (optional)
 * @returns {number} Total minutes
 */
const convertToMinutes = (h, m = 0) => {
  return h * 60 + (m || 0);
};

/**
 * Convert time string (HH:MM) to decimal hours
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {number} Decimal hours
 */
const timeStringToDecimal = (timeStr) => {
  if (!timeStr || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
    return 0;
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes || 0) / 60;
};

/**
 * Calculate days between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Number of days (inclusive)
 */
const calculateDaysBetween = (startDate, endDate) => {
  // Ensure we have valid dates
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return 0;
  }
  
  // For same day, return 1
  if (startDate.toDateString() === endDate.toDateString()) {
    return 1;
  }
  
  // Use a more reliable method: calculate the difference in days
  // Set both dates to midnight to avoid time zone issues
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  // Calculate difference in milliseconds and convert to days
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Add 1 for inclusive counting (if start and end are different)
  return diffDays + 1;
};

/**
 * Convert time components to decimal hours for calculation
 * @param {number} sh - Start hours
 * @param {number} sm - Start minutes (optional)
 * @param {number} eh - End hours
 * @param {number} em - End minutes (optional)
 * @returns {Object} Object with start and end decimal hours
 */
const convertTimeRangeToDecimal = (sh, sm = 0, eh, em = 0) => {
  return {
    start: sh + (sm || 0) / 60,
    end: eh + (em || 0) / 60
  };
};

/**
 * Convert total hours to days and remaining hours format
 * @param {number} val - Total hours
 * @returns {Object} Object with days and hours
 */
const toDayHour = (val) => {
  const day = Math.floor(val);
  const hour = Math.round((val - day) * config.business.workingHoursPerDay);
  return { day, hour };
};

/**
 * Create end of day date (23:59:59.999)
 * @param {Date} date - Base date
 * @returns {Date} End of day date
 */
const getEndOfDay = (date) => {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
};

/**
 * Create end of month date
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {Date} End of month date
 */
const getEndOfMonth = (year, month) => {
  return new Date(year, month, 0, 23, 59, 59, 999);
};

/**
 * Create end of year date
 * @param {number} year - Year
 * @returns {Date} End of year date
 */
const getEndOfYear = (year) => {
  return new Date(year, 11, 31, 23, 59, 59, 999);
};

/**
 * Validate time string format (HH:MM)
 * @param {string} timeStr - Time string to validate
 * @returns {boolean} True if valid format
 */
const isValidTimeFormat = (timeStr) => {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
};

/**
 * Calculate duration in hours between two time strings
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {number} Duration in hours
 */
const calculateDurationHours = (startTime, endTime) => {
  const startMinutes = convertToMinutes(...startTime.split(':').map(Number));
  const endMinutes = convertToMinutes(...endTime.split(':').map(Number));
  return (endMinutes - startMinutes) / 60;
};

module.exports = {
  convertToMinutes,
  timeStringToDecimal,
  calculateDaysBetween,
  convertTimeRangeToDecimal,
  toDayHour,
  getEndOfDay,
  getEndOfMonth,
  getEndOfYear,
  isValidTimeFormat,
  calculateDurationHours
}; 