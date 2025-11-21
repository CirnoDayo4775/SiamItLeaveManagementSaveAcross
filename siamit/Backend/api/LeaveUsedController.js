// Backend/api/LeaveUsedController.js
const express = require('express');
const { 
  sendSuccess, 
  sendError, 
  sendNotFound,
  sendValidationError
} = require('../utils');

module.exports = (AppDataSource) => {
  const router = express.Router();

  // GET /api/leave-used/user/:userId - Get leave usage for a specific user
  router.get('/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { year, month } = req.query;

      const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');

      let whereClause = { user_id: userId };

      // Add date filtering if year/month provided
      if (year || month) {
        const startDate = new Date();
        const endDate = new Date();

        if (year) {
          startDate.setFullYear(parseInt(year), 0, 1);
          endDate.setFullYear(parseInt(year), 11, 31, 23, 59, 59, 999);
        }

        if (month) {
          startDate.setMonth(parseInt(month) - 1, 1);
          endDate.setMonth(parseInt(month), 0, 23, 59, 59, 999);
        }

        whereClause.created_at = { $gte: startDate, $lte: endDate };
      }

      const leaveUsedRecords = await leaveUsedRepo.find({ where: whereClause });

      // Get leave type details for each record
      const result = await Promise.all(
        leaveUsedRecords.map(async (record) => {
          // Use raw query to include soft-deleted records
          const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
          const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [record.leave_type_id]);
          const leaveType = leaveTypeResult ? leaveTypeResult[0] : null;
          return {
            id: record.id,
            user_id: record.user_id,
            leave_type_id: record.leave_type_id,
            leave_type_name_th: leaveType?.is_active === false ? '[DELETED] ' + (leaveType?.leave_type_th || 'Unknown') : (leaveType?.leave_type_th || 'Unknown'),
            leave_type_name_en: leaveType?.is_active === false ? '[DELETED] ' + (leaveType?.leave_type_en || 'Unknown') : (leaveType?.leave_type_en || 'Unknown'),
            days: record.days || 0,
            hours: record.hour || 0,
            created_at: record.created_at,
            updated_at: record.updated_at
          };
        })
      );

      return sendSuccess(res, result);
    } catch (err) {
      console.error('Error fetching leave used:', err);
      return sendError(res, 'Failed to fetch leave usage data');
    }
  });

  // GET /api/leave-used/user/:userId/type/:leaveTypeId - Get leave usage for specific user and leave type
  router.get('/user/:userId/type/:leaveTypeId', async (req, res) => {
    try {
      const { userId, leaveTypeId } = req.params;
      const { year } = req.query;

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
        whereClause.created_at = { $gte: startDate, $lte: endDate };
      }

      const leaveUsedRecord = await leaveUsedRepo.findOne({ where: whereClause });
      // Use raw query to include soft-deleted records
      const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
      const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leaveTypeId]);
      const leaveType = leaveTypeResult ? leaveTypeResult[0] : null;

      if (!leaveUsedRecord) {
        return sendSuccess(res, {
          user_id: userId,
          leave_type_id: leaveTypeId,
          leave_type_name_th: leaveType?.leave_type_th || 'Unknown',
          leave_type_name_en: leaveType?.leave_type_en || 'Unknown',
          days: 0,
          hours: 0,
          total_days: 0
        });
      }

      const totalDays = leaveUsedRecord.days + (leaveUsedRecord.hour / 9); // Assuming 9 hours per day

      const result = {
        id: leaveUsedRecord.id,
        user_id: leaveUsedRecord.user_id,
        leave_type_id: leaveUsedRecord.leave_type_id,
        leave_type_name_th: leaveType?.is_active === false ? '[DELETED] ' + (leaveType?.leave_type_th || 'Unknown') : (leaveType?.leave_type_th || 'Unknown'),
        leave_type_name_en: leaveType?.is_active === false ? '[DELETED] ' + (leaveType?.leave_type_en || 'Unknown') : (leaveType?.leave_type_en || 'Unknown'),
        days: leaveUsedRecord.days || 0,
        hours: leaveUsedRecord.hour || 0,
        total_days: totalDays,
        created_at: leaveUsedRecord.created_at,
        updated_at: leaveUsedRecord.updated_at
      };

      return sendSuccess(res, result);
    } catch (err) {
      console.error('Error fetching leave used by type:', err);
      return sendError(res, 'Failed to fetch leave usage data');
    }
  });



  // GET /api/leave-used/summary - Get summary of all leave usage
  router.get('/summary', async (req, res) => {
    try {
      const { year, month } = req.query;
      const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');

      let whereClause = {};

      // Add date filtering if year/month provided
      if (year || month) {
        const startDate = new Date();
        const endDate = new Date();

        if (year) {
          startDate.setFullYear(parseInt(year), 0, 1);
          endDate.setFullYear(parseInt(year), 11, 31, 23, 59, 59, 999);
        }

        if (month) {
          startDate.setMonth(parseInt(month) - 1, 1);
          endDate.setMonth(parseInt(month), 0, 23, 59, 59, 999);
        }

        whereClause.created_at = { $gte: startDate, $lte: endDate };
      }

      const leaveUsedRecords = await leaveUsedRepo.find({ where: whereClause });

      // Group by leave type and calculate totals
      const summary = {};
      for (const record of leaveUsedRecords) {
        // Use raw query to include soft-deleted records
        const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
        const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [record.leave_type_id]);
        const leaveType = leaveTypeResult ? leaveTypeResult[0] : null;
        let leaveTypeName = 'Unknown';
        if (leaveType) {
                  if (leaveType.is_active === false) {
          // Add [DELETED] prefix for inactive/deleted leave types
          leaveTypeName = '[DELETED] ' + (leaveType.leave_type_th || leaveType.leave_type_en || 'Unknown');
        } else {
          leaveTypeName = leaveType.leave_type_th || leaveType.leave_type_en || 'Unknown';
        }
        }

        if (!summary[leaveTypeName]) {
          summary[leaveTypeName] = {
            leave_type_id: record.leave_type_id,
            leave_type_name: leaveTypeName,
            total_days: 0,
            total_hours: 0,
            user_count: new Set()
          };
        }

        summary[leaveTypeName].total_days += record.days || 0;
        summary[leaveTypeName].total_hours += record.hour || 0;
        summary[leaveTypeName].user_count.add(record.user_id);
      }

      // Convert user_count Set to count
      const result = Object.values(summary).map(item => ({
        ...item,
        user_count: item.user_count.size
      }));

      return sendSuccess(res, result);
    } catch (err) {
      console.error('Error fetching leave usage summary:', err);
      return sendError(res, 'Failed to fetch leave usage summary');
    }
  });

  return router;
};
