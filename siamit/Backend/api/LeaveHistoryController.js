const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { Between, In } = require('typeorm');
const config = require('../config');
const { calculateDaysBetween, parseAttachments } = require('../utils');

module.exports = (AppDataSource) => {
  const router = express.Router();

  // --- Helpers ---

  /**
   * Helper: Build Where Clause from Request Query
   */
  const buildWhereClause = (userId, query) => {
    let where = { Repid: userId };
    const { month, year, leaveType, status, retroactive, startDate, endDate, date } = query;

    // Filter by Month/Year (based on createdAt)
    if (month || year) {
      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      let start, end;

      if (month) {
        const targetMonth = parseInt(month);
        start = new Date(targetYear, targetMonth - 1, 1);
        end = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
      } else {
        start = new Date(targetYear, 0, 1);
        end = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      }
      where.createdAt = Between(start, end);
    }

    // Direct Filters
    if (leaveType && leaveType !== 'all') where.leaveType = leaveType;
    if (status && status !== 'all') where.status = status;

    // Retroactive Filter
    if (retroactive === 'retroactive') where.backdated = true;
    if (retroactive === 'normal') where.backdated = false;

    // Date Range Filter (based on startDate field)
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(config.business.minDate);
      const end = endDate ? new Date(endDate) : new Date(config.business.maxDate);
      where.startDate = Between(start, end);
    } else if (date) {
      // Single Date Filter
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      where.createdAt = Between(startOfDay, endOfDay);
    }

    return where;
  };

  /**
   * Helper: Fetch Map for quick lookup
   */
  const getEntityMap = async (repo, ids, keyField = 'id') => {
    if (!ids.length) return {};
    const uniqueIds = [...new Set(ids)];
    const entities = await repo.find({ where: { [keyField]: In(uniqueIds) }, withDeleted: true });
    return entities.reduce((acc, item) => {
      acc[item[keyField]] = item;
      return acc;
    }, {});
  };

  /**
   * Helper: Calculate Leave Duration details
   */
  const calculateDuration = (leave) => {
    let days = 0, hours = 0, durationType = 'day';

    if (leave.startTime && leave.endTime) {
      const [sh, sm] = leave.startTime.split(":").map(Number);
      const [eh, em] = leave.endTime.split(":").map(Number);
      const start = (sh || 0) + (sm || 0) / 60;
      const end = (eh || 0) + (em || 0) / 60;
      let diff = end - start;
      if (diff < 0) diff += 24;
      
      hours = Math.floor(diff);
      durationType = 'hour';
    } else if (leave.startDate && leave.endDate) {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      days = calculateDaysBetween(start, end);
      if (days < 0 || isNaN(days)) days = 0;
      // Force 1 day min for same-day
      if (days === 0 && leave.startDate === leave.endDate) days = 1;
    }

    // Convert hours to days for summary
    const daysFromHours = Math.floor(hours / config.business.workingHoursPerDay);
    const remainingHours = hours % config.business.workingHoursPerDay;

    return { days, hours, durationType, daysFromHours, remainingHours };
  };

  // --- Routes ---

  // GET /api/leave-history
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      const userRepo = AppDataSource.getRepository('User');

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || config.pagination.defaultLimit;
      const skip = (page - 1) * limit;

      // 1. Build Where Clause
      const where = buildWhereClause(userId, req.query);

      // 2. Fetch Data (Parallel: Leaves + Total Count + Summary Data)
      const [leaves, total, allLeavesForSummary] = await Promise.all([
        leaveRepo.find({ where, order: { createdAt: 'DESC' }, skip, take: limit }),
        leaveRepo.count({ where }),
        leaveRepo.find({ where }) // Fetch for summary calculation
      ]);

      // 3. Batch Fetch Related Entities (Optimization)
      const leaveTypeIds = leaves.map(l => l.leaveType).filter(Boolean);
      const statusByIds = leaves.map(l => l.statusBy).filter(Boolean);
      
      const [leaveTypeMap, userMap] = await Promise.all([
        getEntityMap(leaveTypeRepo, leaveTypeIds),
        getEntityMap(userRepo, statusByIds)
      ]);

      // 4. Process Display Data
      const result = leaves.map(leave => {
        // Resolve Leave Type
        const lt = leaveTypeMap[leave.leaveType];
        let typeNameTh = `Deleted (${leave.leaveType})`, typeNameEn = typeNameTh;

        if (lt) {
            const prefixTh = (lt.is_active === false || lt.deleted_at) ? '[ลบ] ' : '';
            const prefixEn = (lt.is_active === false || lt.deleted_at) ? '[DELETED] ' : '';
            typeNameTh = prefixTh + (lt.leave_type_th || lt.leave_type);
            typeNameEn = prefixEn + (lt.leave_type_en || lt.leave_type);
        }

        // Resolve Approver/Rejector
        const statusUser = userMap[leave.statusBy];
        const statusByName = statusUser ? statusUser.name : leave.statusBy;

        const duration = calculateDuration(leave);

        return {
          id: leave.id,
          type: leave.leaveType,
          leaveType: leave.leaveType,
          leaveTypeName_th: typeNameTh,
          leaveTypeName_en: typeNameEn,
          startDate: leave.startDate,
          endDate: leave.endDate,
          startTime: leave.startTime,
          endTime: leave.endTime,
          ...duration,
          reason: leave.reason,
          status: leave.status,
          approvedBy: leave.status === 'approved' ? statusByName : null,
          rejectedBy: leave.status === 'rejected' ? statusByName : null,
          rejectionReason: leave.rejectedReason,
          submittedDate: leave.createdAt,
          backdated: Boolean(leave.backdated),
          attachments: parseAttachments(leave.attachments),
          contact: leave.contact || null
        };
      });

      // 5. Calculate Summary (from allLeavesForSummary)
      let rawDays = 0, rawHours = 0;
      let approvedCount = 0, pendingCount = 0, rejectedCount = 0, retroactiveCount = 0;

      allLeavesForSummary.forEach(l => {
        if (l.backdated) retroactiveCount++;
        if (l.status === 'pending') pendingCount++;
        if (l.status === 'rejected') rejectedCount++;
        
        if (l.status === 'approved') {
          approvedCount++;
          const d = calculateDuration(l);
          if (d.durationType === 'hour') rawHours += d.hours;
          else rawDays += d.days;
        }
      });

      // Convert excess hours to days for summary
      const daysFromHours = Math.floor(rawHours / config.business.workingHoursPerDay);
      const totalLeaveDays = rawDays + daysFromHours;
      const totalLeaveHours = rawHours % config.business.workingHoursPerDay;

      res.json({
        status: 'success',
        data: result,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: {
          totalLeaveDays,
          totalLeaveHours,
          approvedCount,
          pendingCount,
          rejectedCount,
          retroactiveCount
        },
        message: 'Fetch success'
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // GET /api/leave-history/filters
  router.get('/filters', authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');

      // Fetch minimal data for filters
      const leaves = await leaveRepo.find({ 
        where: { Repid: userId },
        select: ['status', 'createdAt'] // Select only needed fields
      });

      const statuses = [...new Set(leaves.map(l => l.status))].filter(Boolean);
      const years = [...new Set(leaves.map(l => l.createdAt && new Date(l.createdAt).getFullYear()))].filter(Boolean).sort();
      const months = [...new Set(leaves.map(l => l.createdAt && (new Date(l.createdAt).getMonth() + 1)))].filter(Boolean).sort((a, b) => a - b);

      const allLeaveTypes = await leaveTypeRepo.find({ order: { leave_type_th: 'ASC' }, withDeleted: true });

      res.json({
        status: 'success',
        statuses,
        years,
        months,
        leaveTypes: allLeaveTypes.map(lt => {
          const isInactive = lt.is_active === false || lt.deleted_at;
          const prefixTh = isInactive ? '[ลบ] ' : '';
          const prefixEn = isInactive ? '[DELETED] ' : '';
          return {
            id: lt.id,
            leave_type: lt.leave_type,
            leave_type_th: prefixTh + (lt.leave_type_th || lt.leave_type),
            leave_type_en: prefixEn + (lt.leave_type_en || lt.leave_type)
          };
        })
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  return router;
};