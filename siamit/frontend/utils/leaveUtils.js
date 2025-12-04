/**
 * Leave Management Utility Functions
 * Centralized utilities for leave-related operations and data processing
 */

const config = require('../config');
const { Between } = require('typeorm');

/**
 * Safely parse attachments JSON string
 * @param {string} val - JSON string containing attachments array
 * @returns {Array} Array of attachment filenames
 */
const parseAttachments = (val) => {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch (e) {
    console.error('Invalid attachments JSON:', val, e);
    return [];
  }
};



/**
 * Normalize leave type name
 * @param {string} leaveType - Leave type string
 * @returns {string} Normalized leave type name
 */
const normalizeLeaveType = (leaveType) => {
  if (!leaveType) return 'Unknown';
  
  // Convert to lowercase for comparison
  const normalized = leaveType.toLowerCase();
  
  // Map common variations
  if (normalized.includes('sick') || normalized.includes('ป่วย')) {
    return 'Sick Leave';
  } else if (normalized.includes('personal') || normalized.includes('กิจ')) {
    return 'Personal Leave';
  } else if (normalized.includes('vacation') || normalized.includes('พักผ่อน')) {
    return 'Vacation Leave';
  } else if (normalized.includes('maternity') || normalized.includes('คลอด')) {
    return 'Maternity Leave';
  } else if (normalized.includes('emergency') || normalized.includes('ฉุกเฉิน')) {
    return 'Emergency Leave';
  }
  
  return leaveType;
};

/**
 * Check if time is within working hours
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {boolean} True if within working hours
 */
const isWithinWorkingHours = (timeStr) => {
  if (!timeStr || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
    return false;
  }
  
  const [h, m] = timeStr.split(':').map(Number);
  const minutes = h * 60 + m;
  
  return minutes >= config.business.workingStartHour * 60 && 
         minutes <= config.business.workingEndHour * 60;
};



/**
 * Get leave usage from LeaveUsed table for a specific user and leave type
 * @param {string} userId - User ID
 * @param {string} leaveTypeId - Leave type ID
 * @param {number} year - Year to filter (optional)
 * @param {Object} AppDataSource - TypeORM DataSource
 * @returns {Promise<Object>} Leave usage data
 */
const getLeaveUsageFromTable = async (userId, leaveTypeId, year = null, AppDataSource) => {
  try {
    const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');
    const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
    
    let whereClause = { 
      user_id: userId, 
      leave_type_id: leaveTypeId 
    };
    
    // Add year filtering if provided
    if (year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
      whereClause.created_at = Between(startDate, endDate);
    }
    
    const leaveUsedRecord = await leaveUsedRepo.findOne({ where: whereClause });
    const leaveType = await leaveTypeRepo.findOneBy({ id: leaveTypeId });
    
    if (!leaveUsedRecord) {
      return {
        user_id: userId,
        leave_type_id: leaveTypeId,
        leave_type_name_th: leaveType?.leave_type_th || 'ไม่ระบุ',
        leave_type_name_en: leaveType?.leave_type_en || 'Unknown',
        days: 0,
        hours: 0,
        total_days: 0
      };
    }
    
    // Calculate total days (including hours converted to days)
    const totalDays = leaveUsedRecord.days + (leaveUsedRecord.hour / config.business.workingHoursPerDay);
    
    return {
      id: leaveUsedRecord.id,
      user_id: leaveUsedRecord.user_id,
      leave_type_id: leaveUsedRecord.leave_type_id,
      leave_type_name_th: leaveType?.leave_type_th || 'ไม่ระบุ',
      leave_type_name_en: leaveType?.leave_type_en || 'Unknown',
      days: leaveUsedRecord.days || 0,
      hours: leaveUsedRecord.hour || 0,
      total_days: totalDays,
      created_at: leaveUsedRecord.created_at,
      updated_at: leaveUsedRecord.updated_at
    };
  } catch (error) {
    console.error('Error getting leave usage from table:', error);
    throw error;
  }
};

/**
 * Get user's leave quota for a specific leave type
 * @param {string} userId - User ID
 * @param {string} leaveTypeId - Leave type ID
 * @param {Object} AppDataSource - TypeORM DataSource
 * @returns {Promise<number>} Leave quota in days
 */
const getUserLeaveQuota = async (userId, leaveTypeId, AppDataSource) => {
  try {
    const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
    const userRepo = AppDataSource.getRepository('User');
    
    // Get user's position from unified users table
    let positionId = null;
    const userEntity = await userRepo.findOne({ where: { id: userId } });
    if (userEntity) {
      positionId = userEntity.position;
    }
    
    if (!positionId) {
      throw new Error('User position not found');
    }
    
    // Get leave quota by position and leave type
    const quota = await leaveQuotaRepo.findOne({
      where: { 
        positionId: positionId, 
        leaveTypeId: leaveTypeId 
      }
    });
    
    return quota ? quota.quota : 0;
  } catch (error) {
    console.error('Error getting user leave quota:', error);
    throw error;
  }
};





/**
 * Get leave usage summary for a user across all leave types
 * @param {string} userId - User ID
 * @param {number} year - Year to filter (optional)
 * @param {Object} AppDataSource - TypeORM DataSource
 * @returns {Promise<Array>} Array of leave usage summary objects
 */
const getLeaveUsageSummary = async (userId, year = null, AppDataSource) => {
  try {
    const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');
    const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
    const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
    const userRepo = AppDataSource.getRepository('User');
    
    // Get user's position from unified users table
    let positionId = null;
    const userEntity = await userRepo.findOne({ where: { id: userId } });
    if (userEntity) {
      positionId = userEntity.position;
    }
    
    if (!positionId) {
      throw new Error('User position not found');
    }
    
    // Get leave usage records for this user
    let whereClause = { user_id: userId };
    
    // Add year filtering if provided
    if (year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
      whereClause.created_at = Between(startDate, endDate);
    }
    
    const leaveUsedRecords = await leaveUsedRepo.find({ where: whereClause });
    
    // Get all leave types and quotas for this position
    const allLeaveTypes = await leaveTypeRepo.find();
    const quotas = await leaveQuotaRepo.find({ where: { positionId } });
    
    const summary = await Promise.all(
      allLeaveTypes.map(async (leaveType) => {
        // Find quota for this leave type
        const quotaRow = quotas.find(q => q.leaveTypeId === leaveType.id);
        const quotaDays = quotaRow ? quotaRow.quota : 0;
        
        // Find used leave for this type
        const usedRecord = leaveUsedRecords.find(record => record.leave_type_id === leaveType.id);
        const usedDays = usedRecord ? (usedRecord.days || 0) : 0;
        const usedHours = usedRecord ? (usedRecord.hour || 0) : 0;
        
        const totalUsedDays = usedDays + (usedHours / config.business.workingHoursPerDay);
        const remainingDays = Math.max(0, quotaDays - totalUsedDays);
        
        return {
          leave_type_id: leaveType.id,
          leave_type_name_th: leaveType.leave_type_th,
          leave_type_name_en: leaveType.leave_type_en,
          quota_days: quotaDays,
          used_days: usedDays,
          used_hours: usedHours,
          total_used_days: totalUsedDays,
          remaining_days: remainingDays
        };
      })
    );
    
    return summary;
  } catch (error) {
    console.error('Error getting leave usage summary:', error);
    throw error;
  }
};







module.exports = {
  parseAttachments,
  isWithinWorkingHours,
  normalizeLeaveType,
  getLeaveUsageFromTable,
  getUserLeaveQuota,
  getLeaveUsageSummary
}; 