const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { Between, In } = require('typeorm');
const config = require('../config');
const { 
  convertToMinutes, 
  calculateDaysBetween 
} = require('../utils');

module.exports = (AppDataSource) => {
  // --- Repositories ---
  const leaveRepo = AppDataSource.getRepository('LeaveRequest');
  const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
  const userRepo = AppDataSource.getRepository('User');
  const departmentRepo = AppDataSource.getRepository('Department');
  const positionRepo = AppDataSource.getRepository('Position');

  // --- Helper Functions ---

  /**
   * Helper: Generate Date Filter for TypeORM
   */
  const getDateFilter = (year, month) => {
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      return Between(startDate, endDate);
    } 
    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      return Between(startDate, endDate);
    }
    return null;
  };

  /**
   * Helper: Calculate Duration in Days and Hours
   */
  const calculateLeaveDuration = (request) => {
    let days = 0;
    let hours = 0;

    if (request.startDate && request.endDate) {
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (request.startTime && request.endTime) {
        // Hour-based calculation
        const startTime = new Date(`2000-01-01T${request.startTime}`);
        const endTime = new Date(`2000-01-01T${request.endTime}`);
        const hoursDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

        if (daysDiff === 1) {
          hours = hoursDiff;
        } else {
          days = daysDiff;
        }
      } else {
        // Full day calculation
        days = daysDiff;
      }
    }
    return { days, hours };
  };

  /**
   * Helper: Get Leave Type Map for quick lookup (Avoid N+1 queries)
   */
  const getLeaveTypeMap = async () => {
    // Select needed fields to reduce payload
    const types = await leaveTypeRepo.find({
      select: ['id', 'leave_type_th', 'leave_type_en', 'is_active']
    });
    return types.reduce((acc, type) => {
      acc[type.id] = type;
      return acc;
    }, {});
  };

  // --- Routes ---

  // Test endpoint
  router.get('/test-db', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;
      const count = await leaveRepo.count({ where: { Repid: userId } });
      
      res.json({ 
        status: 'success', 
        data: { userId, totalLeaveRequests: count, message: 'Database connection working' } 
      });
    } catch (err) {
      console.error('Test DB error:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Dashboard Stats
  router.get('/dashboard-stats', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year = req.query.year ? parseInt(req.query.year) : null;
      
      // 1. Prepare Filter
      let where = { Repid: userId };
      const dateFilter = getDateFilter(year, month);
      if (dateFilter) where.startDate = dateFilter;

      // 2. Fetch Data (Parallel if needed, but here sequential is fine as they are dependent)
      const leaveHistory = await leaveRepo.find({ where });
      // Fetch all leave types once to avoid N+1 inside loop
      const leaveTypeMap = await getLeaveTypeMap();

      // 3. Process Data
      let totalDaysUsed = 0;
      let totalHoursUsed = 0;
      const leaveTypeStats = {};

      const approvedRequests = leaveHistory.filter(lr => lr.status === 'approved');

      for (const request of approvedRequests) {
        // Calculate usage
        const { days, hours } = calculateLeaveDuration(request);
        totalDaysUsed += days;
        totalHoursUsed += hours;

        // Calculate Type Stats
        const typeId = request.leaveType;
        let typeName = typeId;
        const typeData = leaveTypeMap[typeId];

        if (typeData) {
          typeName = typeData.is_active === false 
            ? `[DELETED] ${typeData.leave_type_th || typeId}`
            : (typeData.leave_type_th || typeId);
        }

        if (!leaveTypeStats[typeName]) leaveTypeStats[typeName] = 0;
        
        // Add to stats (convert hours to day fraction for stats consistency)
        if (hours > 0) {
          leaveTypeStats[typeName] += hours / config.business.workingHoursPerDay;
        } else {
          leaveTypeStats[typeName] += days;
        }
      }

      // 4. Normalize Hours to Days
      const additionalDays = Math.floor(totalHoursUsed / config.business.workingHoursPerDay);
      const remainingHours = Math.round(totalHoursUsed % config.business.workingHoursPerDay);
      totalDaysUsed += additionalDays;

      // 5. Aggregate Counts
      const pendingRequests = leaveHistory.filter(lr => lr.status === 'pending').length;
      const approvalRate = leaveHistory.length > 0 
        ? Math.round((approvedRequests.length / leaveHistory.length) * 100) 
        : 0;
      const remainingDays = Math.max(0, config.business.maxLeaveDays - totalDaysUsed);

      res.json({
        status: 'success',
        data: {
          leaveHistory,
          daysUsed: totalDaysUsed,
          hoursUsed: remainingHours,
          pendingRequests,
          approvalRate,
          remainingDays,
          leaveTypeStats
        },
        message: 'Dashboard stats fetched successfully'
      });
    } catch (err) {
      console.error('Dashboard stats error:', err);
      res.status(500).json({ status: 'error', data: null, message: err.message });
    }
  });

  // Total Leave Duration (Days Used)
  router.get('/day-used', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year = req.query.year ? parseInt(req.query.year) : null;

      let where = { Repid: userId, status: 'approved' };
      const dateFilter = getDateFilter(year, month);
      if (dateFilter) where.startDate = dateFilter;

      const approvedRequests = await leaveRepo.find({ where });

      let totalDays = 0;
      let totalHours = 0;

      for (const request of approvedRequests) {
        const { days, hours } = calculateLeaveDuration(request);
        totalDays += days;
        totalHours += hours;
      }

      const additionalDays = Math.floor(totalHours / config.business.workingHoursPerDay);
      const remainingHours = Math.round(totalHours % config.business.workingHoursPerDay);
      totalDays += additionalDays;

      res.json({ status: 'success', data: { days: totalDays, hours: remainingHours } });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Recent Leave Requests
  router.get('/recent-leave-requests', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year = req.query.year ? parseInt(req.query.year) : null;

      let where = { Repid: userId };
      const dateFilter = getDateFilter(year, month);
      if (dateFilter) where.startDate = dateFilter;

      // Fetch Requests & Types Efficiently
      const leaveRequests = await leaveRepo.find({ 
        where, 
        order: { createdAt: 'DESC' }, 
        take: 3 
      });
      
      const leaveTypeMap = await getLeaveTypeMap();

      const result = leaveRequests.map(lr => {
        const typeData = leaveTypeMap[lr.leaveType];
        const leaveTypeNameTh = typeData ? (typeData.leave_type_th || lr.leaveType) : (lr.leaveType || 'Unknown Type');
        const leaveTypeNameEn = typeData ? (typeData.leave_type_en || lr.leaveType) : (lr.leaveType || 'Unknown Type');

        // Formatted Duration String
        let duration = '';
        const { days, hours } = calculateLeaveDuration(lr);
        
        if (hours > 0) {
          duration = `${Math.floor(hours)} hour`;
        } else {
          duration = `${days} day`;
        }

        return {
          leavetype: lr.leaveType,
          leavetype_th: leaveTypeNameTh,
          leavetype_en: leaveTypeNameEn,
          duration,
          startdate: lr.startDate,
          status: lr.status
        };
      });

      res.json({ status: 'success', data: result });
    } catch (err) {
      console.error('Error in recent-leave-requests:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Backdated Count
  router.get('/my-backdated', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year = req.query.year ? parseInt(req.query.year) : null;

      let where = { Repid: userId, backdated: true };
      const dateFilter = getDateFilter(year, month);
      if (dateFilter) where.startDate = dateFilter;

      const count = await leaveRepo.count({ where });
      res.json({ status: 'success', data: { count } });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // User Profile
  router.get('/user-profile', authMiddleware, async (req, res) => {
    try {
      const { userId } = req.user;
      
      const userProfile = await userRepo.findOne({ where: { id: userId } });
      if (!userProfile) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      // Optimize: Fetch Department and Position in parallel
      const [department, position] = await Promise.all([
        userProfile.department ? departmentRepo.findOne({ where: { id: userProfile.department } }) : Promise.resolve(null),
        userProfile.position ? positionRepo.findOne({ where: { id: userProfile.position } }) : Promise.resolve(null)
      ]);

      const departmentInfo = {
        id: department?.id || null,
        name_th: department?.department_name_th || 'No Department',
        name_en: department?.department_name_en || 'No Department'
      };

      const positionInfo = {
        id: position?.id || null,
        name_th: position?.position_name_th || 'No Position',
        name_en: position?.position_name_en || 'No Position'
      };

      res.json({
        status: 'success',
        data: {
          name: userProfile.name || '',
          email: userProfile.Email,
          avatar: userProfile.avatar_url,
          role: userProfile.Role,
          department: departmentInfo,
          position: positionInfo
        },
        message: 'User profile fetched successfully'
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  return router;
};