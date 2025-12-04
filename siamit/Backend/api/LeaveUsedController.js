const express = require('express');
const { Between, In } = require('typeorm'); // Import TypeORM operators
const { sendSuccess, sendError } = require('../utils');

module.exports = (AppDataSource) => {
  const router = express.Router();
  const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');
  const leaveTypeRepo = AppDataSource.getRepository('LeaveType');

  // --- Helper Functions ---

  /**
   * Helper: Generate Date Filter for query
   */
  const getDateFilter = (year, month) => {
    if (!year && !month) return null;

    const startDate = new Date();
    const endDate = new Date();

    if (year) {
      startDate.setFullYear(parseInt(year), 0, 1);
      endDate.setFullYear(parseInt(year), 11, 31);
    }

    if (month) {
      // If year is not provided, use current year implicitly
      startDate.setMonth(parseInt(month) - 1, 1);
      endDate.setMonth(parseInt(month), 0);
    }

    // Set time boundaries
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return Between(startDate, endDate);
  };

  /**
   * Helper: Fetch all Leave Types and return as a Map for quick lookup
   * Solves N+1 query problem
   */
  const getLeaveTypeMap = async () => {
    // Select only necessary fields and include soft-deleted records
    const types = await leaveTypeRepo.find({ 
      withDeleted: true,
      select: ['id', 'leave_type_th', 'leave_type_en', 'is_active', 'deleted_at']
    });
    
    return types.reduce((acc, type) => {
      acc[type.id] = type;
      return acc;
    }, {});
  };

  /**
   * Helper: Format Leave Type Name
   */
  const formatLeaveTypeName = (leaveType) => {
    if (!leaveType) {
      return { th: 'Unknown', en: 'Unknown' };
    }
    
    const isDeleted = leaveType.is_active === false || leaveType.deleted_at;
    const prefix = isDeleted ? '[DELETED] ' : ''; // Used English prefix for simplicity, can adjust per language
    const prefixTh = isDeleted ? '[ลบ] ' : '';

    return {
      th: prefixTh + (leaveType.leave_type_th || 'Unknown'),
      en: prefix + (leaveType.leave_type_en || 'Unknown')
    };
  };

  // --- Routes ---

  // GET /api/leave-used/user/:userId
  router.get('/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { year, month } = req.query;

      let whereClause = { user_id: userId };
      const dateFilter = getDateFilter(year, month);
      if (dateFilter) whereClause.created_at = dateFilter;

      // 1. Fetch Leave Used Records
      const leaveUsedRecords = await leaveUsedRepo.find({ where: whereClause });

      // 2. Fetch Leave Types Map (Optimization)
      const leaveTypeMap = await getLeaveTypeMap();

      // 3. Map Data in Memory
      const result = leaveUsedRecords.map(record => {
        const leaveType = leaveTypeMap[record.leave_type_id];
        const names = formatLeaveTypeName(leaveType);

        return {
          id: record.id,
          user_id: record.user_id,
          leave_type_id: record.leave_type_id,
          leave_type_name_th: names.th,
          leave_type_name_en: names.en,
          days: record.days || 0,
          hours: record.hour || 0,
          created_at: record.created_at,
          updated_at: record.updated_at
        };
      });

      return sendSuccess(res, result);
    } catch (err) {
      console.error('Error fetching leave used:', err);
      return sendError(res, 'Failed to fetch leave usage data');
    }
  });

  // GET /api/leave-used/user/:userId/type/:leaveTypeId
  router.get('/user/:userId/type/:leaveTypeId', async (req, res) => {
    try {
      const { userId, leaveTypeId } = req.params;
      const { year } = req.query;

      let whereClause = { user_id: userId, leave_type_id: leaveTypeId };
      if (year) {
        // Specific year filter logic from original code
        const startDate = new Date(parseInt(year), 0, 1);
        const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
        whereClause.created_at = Between(startDate, endDate);
      }

      // Parallel Fetch
      const [leaveUsedRecord, leaveType] = await Promise.all([
        leaveUsedRepo.findOne({ where: whereClause }),
        leaveTypeRepo.findOne({ where: { id: leaveTypeId }, withDeleted: true })
      ]);

      const names = formatLeaveTypeName(leaveType);
      
      // Default empty object if not found
      const data = leaveUsedRecord || { days: 0, hour: 0, created_at: null, updated_at: null, id: null };
      const totalDays = (data.days || 0) + ((data.hour || 0) / 9); // Assuming 9 hrs/day

      const result = {
        id: data.id,
        user_id: userId,
        leave_type_id: leaveTypeId,
        leave_type_name_th: names.th,
        leave_type_name_en: names.en,
        days: data.days || 0,
        hours: data.hour || 0,
        total_days: totalDays,
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      return sendSuccess(res, result);
    } catch (err) {
      console.error('Error fetching leave used by type:', err);
      return sendError(res, 'Failed to fetch leave usage data');
    }
  });

  // GET /api/leave-used/summary
  router.get('/summary', async (req, res) => {
    try {
      const { year, month } = req.query;
      let whereClause = {};
      const dateFilter = getDateFilter(year, month);
      if (dateFilter) whereClause.created_at = dateFilter;

      // Parallel Fetch for Performance
      const [leaveUsedRecords, leaveTypeMap] = await Promise.all([
        leaveUsedRepo.find({ where: whereClause }),
        getLeaveTypeMap()
      ]);

      // Calculate Summary in Memory
      const summaryMap = {};

      for (const record of leaveUsedRecords) {
        const leaveType = leaveTypeMap[record.leave_type_id];
        
        // Key by ID to ensure uniqueness, fallback to name if needed but ID is safer
        const typeId = record.leave_type_id;
        
        if (!summaryMap[typeId]) {
          const names = formatLeaveTypeName(leaveType);
          summaryMap[typeId] = {
            leave_type_id: typeId,
            leave_type_name: names.th || names.en, // Prefer TH for display key
            leave_type_name_en: names.en,
            total_days: 0,
            total_hours: 0,
            user_count_set: new Set()
          };
        }

        summaryMap[typeId].total_days += record.days || 0;
        summaryMap[typeId].total_hours += record.hour || 0;
        summaryMap[typeId].user_count_set.add(record.user_id);
      }

      // Convert Set to count
      const result = Object.values(summaryMap).map(item => {
        const { user_count_set, ...rest } = item;
        return { ...rest, user_count: user_count_set.size };
      });

      return sendSuccess(res, result);
    } catch (err) {
      console.error('Error fetching leave usage summary:', err);
      return sendError(res, 'Failed to fetch leave usage summary');
    }
  });

  return router;
};