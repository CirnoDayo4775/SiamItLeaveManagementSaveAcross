const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { Between } = require('typeorm');
const config = require('../config');
const { calculateDaysBetween, getLeaveUsageSummary, parseAttachments } = require('../utils');

module.exports = (AppDataSource) => {
  const router = express.Router();

  // parseAttachments function is now imported from ../utils

  // GET /api/leave-history (ต้องแนบ JWT)
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const userId = req.user && req.user.userId; // Get userId from JWT
      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
      }
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      const userRepo = AppDataSource.getRepository('User');

      // --- เพิ่ม paging ---
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || config.pagination.defaultLimit;
      const skip = (page - 1) * limit;

      // --- เพิ่ม filter เดือนและปี ---
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year = req.query.year ? parseInt(req.query.year) : null;
      const leaveType = req.query.leaveType || null;
      const status = req.query.status || null;
      const retroactive = req.query.retroactive || null;
      const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
      const date = req.query.date ? new Date(req.query.date) : null;
      
      // Debug log เพื่อตรวจสอบค่า filter ที่ได้รับ
      console.log('Debug - Received filter values:', {
        month,
        year,
        leaveType,
        status,
        retroactive,
        startDate,
        endDate,
        date,
        query: req.query
      });
      
      // ดึง leave request ของ user (paging) พร้อม filter เดือน/ปี (ใช้ createdAt)
      let where = { Repid: userId };
      
      // Filter ตามเดือนและปี
      if (month && year) {
        // กรอง createdAt ให้อยู่ในเดือน/ปีที่เลือก
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
        where = {
          ...where,
          createdAt: Between(startOfMonth, endOfMonth)
        };
        console.log('Debug - Filtering by month and year:', {
          month,
          year,
          startOfMonth: startOfMonth.toISOString(),
          endOfMonth: endOfMonth.toISOString()
        });
      } else if (year) {
        // ถ้าเลือกแค่ปี
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        where = {
          ...where,
          createdAt: Between(startOfYear, endOfYear)
        };
        console.log('Debug - Filtering by year only:', {
          year,
          startOfYear: startOfYear.toISOString(),
          endOfYear: endOfYear.toISOString()
        });
      } else if (month) {
        // ถ้าเลือกแค่เดือน (ใช้ปีปัจจุบัน)
        const currentYear = new Date().getFullYear();
        const startOfMonth = new Date(currentYear, month - 1, 1);
        const endOfMonth = new Date(currentYear, month, 0, 23, 59, 59, 999);
        where = {
          ...where,
          createdAt: Between(startOfMonth, endOfMonth)
        };
        console.log('Debug - Filtering by month only (current year):', {
          month,
          currentYear,
          startOfMonth: startOfMonth.toISOString(),
          endOfMonth: endOfMonth.toISOString()
        });
      }
      
      // Filter ตามประเภทการลา
      if (leaveType && leaveType !== 'all') {
        where = { ...where, leaveType };
      }
      
      // Filter ตามสถานะ
      if (status && status !== 'all') {
        where = { ...where, status };
      }
      
      // กรองตาม retroactive parameter (ใช้คอลัมน์ backdated)
      if (retroactive === 'retroactive') {
        where = { ...where, backdated: true };
      } else if (retroactive === 'normal') {
        where = { ...where, backdated: false };
      }
      
      // กรองช่วงวันที่ (startDate, endDate) จากฟิลด์ startDate
      if (startDate && endDate) {
        where = { ...where, startDate: Between(startDate, endDate) };
      } else if (startDate) {
        where = { ...where, startDate: Between(startDate, new Date(config.business.maxDate)) };
      } else if (endDate) {
        where = { ...where, startDate: Between(new Date(config.business.minDate), endDate) };
      }
      
      // กรองตามวันที่เดียว
      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        where = { ...where, createdAt: Between(startOfDay, endOfDay) };
      }

      // Debug log สำหรับ where clause
      console.log('Debug - Final where clause:', JSON.stringify(where, null, 2));
      console.log('Debug - Where clause summary:', {
        hasMonthFilter: !!month,
        hasYearFilter: !!year,
        hasLeaveTypeFilter: !!leaveType,
        hasStatusFilter: !!status,
        hasRetroactiveFilter: !!retroactive,
        hasDateFilter: !!date,
        totalFilters: Object.keys(where).length
      });

      // ดึง leave request ของ user (paging)
      const [leaves, total] = await Promise.all([
        leaveRepo.find({ where, order: { createdAt: 'DESC' }, skip, take: limit }),
        leaveRepo.count({ where })
      ]);
      
      console.log('Debug - Database query results:', {
        totalLeaves: total,
        returnedLeaves: leaves.length,
        page,
        limit,
        skip
      });
      
      // Debug log สำหรับตรวจสอบข้อมูลที่ได้
      if (leaves.length > 0) {
        console.log('Debug - Sample leave data:', {
          firstLeave: {
            id: leaves[0].id,
            createdAt: leaves[0].createdAt,
            startDate: leaves[0].startDate,
            status: leaves[0].status
          },
          lastLeave: {
            id: leaves[leaves.length - 1].id,
            createdAt: leaves[leaves.length - 1].createdAt,
            startDate: leaves[leaves.length - 1].startDate,
            status: leaves[leaves.length - 1].status
          }
        });
      }

      // --- ดึง leave request ทั้งหมดของ user เพื่อคำนวณ summary (ใช้ filter เดียวกับตาราง) ---
      const allLeavesForSummary = await leaveRepo.find({ where });
      
      // คำนวณ summary จากชุดข้อมูลที่ผ่านการกรองแล้ว (อิงจากใบลาจริง)
      // นับเฉพาะใบลาที่ "อนุมัติแล้ว" เท่านั้น
      let rawDays = 0;
      let rawHours = 0;
      const approvedLeavesForSummary = allLeavesForSummary.filter(l => l.status === 'approved');
      for (const l of approvedLeavesForSummary) {
        if (l.startTime && l.endTime) {
          const [sh, sm] = l.startTime.split(":").map(Number);
          const [eh, em] = l.endTime.split(":").map(Number);
          const startMinutes = (sh || 0) * 60 + (sm || 0);
          const endMinutes = (eh || 0) * 60 + (em || 0);
          let diffHrs = (endMinutes - startMinutes) / 60;
          if (diffHrs < 0 || isNaN(diffHrs)) diffHrs = 0;
          rawHours += Math.floor(diffHrs);
        } else if (l.startDate && l.endDate) {
          const start = new Date(l.startDate);
          const end = new Date(l.endDate);
          let days = calculateDaysBetween(start, end);
          if (days < 0 || isNaN(days)) days = 0;
          rawDays += days;
        }
      }
      // แปลงชั่วโมงเกินเป็นวันตาม config.business.workingHoursPerDay
      const convertedDaysFromHours = Math.floor(rawHours / config.business.workingHoursPerDay);
      const remainingHoursAfterConvert = rawHours % config.business.workingHoursPerDay;
      const totalLeaveDays = rawDays + convertedDaysFromHours;
      const totalLeaveHours = remainingHoursAfterConvert;
      
      const approvedCount = approvedLeavesForSummary.length;
      const pendingCount = allLeavesForSummary.filter(l => l.status === 'pending').length;
      const rejectedCount = allLeavesForSummary.filter(l => l.status === 'rejected').length;
      
      // คำนวณจำนวนการลาย้อนหลัง (retroactive leave) จากคอลัมน์ backdated - นับทั้งหมดของ user
      const retroactiveCount = allLeavesForSummary.filter(leave => leave.backdated === true).length;
      
      // Debug log เพื่อตรวจสอบ
      console.log('Debug - Total leaves for user:', allLeavesForSummary.length);
      console.log('Debug - Backdated leaves:', retroactiveCount);
      console.log('Debug - Summary calculation:', {
        totalLeaveDays: `${totalLeaveDays} days`,
        totalLeaveHours: `${totalLeaveHours} hours`,
        approvedCount,
        pendingCount,
        rejectedCount,
        retroactiveCount
      });

      // join leaveType, admin (approver/rejector)
      const result = await Promise.all(leaves.map(async (leave) => {
        let leaveTypeName_th = null;
        let leaveTypeName_en = null;
        let leaveTypeId = null;
        let approvedBy = null;
        let rejectedBy = null;
        if (leave.leaveType) {
          // Try multiple approaches to get the leave type (including soft-deleted records)
          let leaveType = null;
          
          // Approach 1: Try using TypeORM withDeleted option
          try {
            const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
            leaveType = await leaveTypeRepo.findOne({
              where: { id: leave.leaveType },
              withDeleted: true
            });
          } catch (error) {
            // TypeORM withDeleted failed, continue to raw query
          }
          
          // Approach 2: If that fails, try raw query
          if (!leaveType) {
            try {
              const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
              const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leave.leaveType]);
              leaveType = leaveTypeResult ? leaveTypeResult[0] : null;
            } catch (error) {
              // Raw query failed, leaveType will remain null
            }
          }
          
          leaveTypeId = leave.leaveType;
          
          // Use proper names even for soft-deleted types
          if (leaveType) {
            // Check if leave type is inactive or deleted
            const isInactive = leaveType.is_active === false || leaveType.deleted_at;
            
            if (isInactive) {
              // Add [DELETED] prefix for inactive/deleted leave types
              const prefix_th = '[ลบ] ';
              const prefix_en = '[DELETED] ';
              
              leaveTypeName_th = prefix_th + (leaveType.leave_type_th || leave.leaveType);
              leaveTypeName_en = prefix_en + (leaveType.leave_type_en || leave.leaveType);
            } else {
              leaveTypeName_th = leaveType.leave_type_th || leave.leaveType;
              leaveTypeName_en = leaveType.leave_type_en || leave.leaveType;
            }
          } else {
            // Fallback if leave type not found
            leaveTypeName_th = `Deleted Leave Type (${leave.leaveType})`;
            leaveTypeName_en = `Deleted Leave Type (${leave.leaveType})`;
          }
        }
        if (leave.statusBy && leave.status === 'approved') {
          // Look up approver in unified users table
          const approver = await userRepo.findOneBy({ id: leave.statusBy });
          if (approver) {
            approvedBy = approver.name;
          } else {
            approvedBy = leave.statusBy; // fallback ใช้ ID ถ้าไม่เจอชื่อ
          }
        }
        if (leave.statusBy && leave.status === 'rejected') {
          // Look up rejector in unified users table
          const rejector = await userRepo.findOneBy({ id: leave.statusBy });
          if (rejector) {
            rejectedBy = rejector.name;
          } else {
            rejectedBy = leave.statusBy; // fallback ใช้ ID ถ้าไม่เจอชื่อ
          }
        }
        // คำนวณระยะเวลาการลา
        let days = 0;
        let durationHours = 0;
        let durationType = 'day';
        let daysFromHours = 0; // เพิ่มตัวแปรสำหรับคำนวณวันจากชั่วโมง
        let remainingHours = 0; // ชั่วโมงที่เหลือ (ไม่ครบ 9 ชั่วโมง)
        
        if (leave.startTime && leave.endTime) {
          // ลาชั่วโมง
          const [sh, sm] = leave.startTime.split(":").map(Number);
          const [eh, em] = leave.endTime.split(":").map(Number);
          let start = sh + (sm || 0) / 60;
          let end = eh + (em || 0) / 60;
          let diff = end - start;
          if (diff < 0) diff += 24;
          durationType = 'hour';
          durationHours = Math.floor(diff);
          days = 0;
          
                 // คำนวณวันจากชั่วโมง (configurable working hours per day)
       // ถ้าครบ working hours ให้นับเป็น 1 วัน และแสดงชั่วโมงที่เหลือ
       daysFromHours = Math.floor(durationHours / config.business.workingHoursPerDay);
       remainingHours = durationHours % config.business.workingHoursPerDay; // ชั่วโมงที่เหลือ
        } else if (leave.startDate && leave.endDate) {
          // ลาวัน
          const start = new Date(leave.startDate);
          const end = new Date(leave.endDate);
          days = calculateDaysBetween(start, end);
          if (days < 0 || isNaN(days)) days = 0;
          durationType = 'day';
          durationHours = 0;
          daysFromHours = 0;
          remainingHours = 0;
        }
        
        return {
          id: leave.id,
          type: leaveTypeId, // id
          leaveType: leaveTypeId, // id (backward compatible)
          leaveTypeName_th,
          leaveTypeName_en,
          startDate: leave.startDate,
          endDate: leave.endDate,
          startTime: leave.startTime,
          endTime: leave.endTime,
          days,
          durationHours,
          daysFromHours, // เพิ่มวันที่คำนวณจากชั่วโมง
          remainingHours, // ชั่วโมงที่เหลือ (ไม่ครบ 9 ชั่วโมง)
          durationType,
          reason: leave.reason,
          status: leave.status,
          approvedBy,
          rejectedBy,
          rejectionReason: leave.rejectedReason,
          submittedDate: leave.createdAt,
          backdated: Boolean(leave.backdated), // แปลงเป็น boolean เพื่อให้แน่ใจ
          attachments: parseAttachments(leave.attachments), // แปลง JSON string เป็น array พร้อม error handling
          contact: leave.contact || null, // เพิ่มข้อมูลการติดต่อ
        };
      }));
      // Debug log สำหรับ pagination
      console.log('Debug - Pagination:', {
        total: total,
        limit: limit,
        page: page,
        totalPages: Math.ceil(total / limit),
        resultLength: result.length
      });

      res.json({
        status: 'success',
        data: result,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: {
          totalLeaveDays,
          totalLeaveHours, // ส่งชั่วโมงรวมทั้งหมดแทนที่จะเป็นแค่ชั่วโมงที่เหลือ
          approvedCount,
          pendingCount,
          rejectedCount,
          retroactiveCount
        },
        message: 'Fetch success'
      });
    } catch (err) {
      res.status(500).json({
        status: 'error',
        message: 'Error: ' + err.message,
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // GET /api/leave-history/filters (ต้องแนบ JWT)
  router.get('/filters', authMiddleware, async (req, res) => {
    try {
      const userId = req.user && req.user.userId;
      if (!userId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      const userRepo = AppDataSource.getRepository('User');

      // ดึง leave ทั้งหมดของ user
      const leaves = await leaveRepo.find({ where: { Repid: userId } });

      // Statuses
      const statuses = Array.from(new Set(leaves.map(l => l.status))).filter(Boolean);
      // Years
      const years = Array.from(new Set(leaves.map(l => l.createdAt && new Date(l.createdAt).getFullYear()))).filter(Boolean).sort();
      // Months (1-12)
      const months = Array.from(new Set(leaves.map(l => l.createdAt && (new Date(l.createdAt).getMonth() + 1)))).filter(Boolean).sort((a, b) => a - b);

      // ดึง leave types ทั้งหมดจาก database (including inactive/deleted)
      const allLeaveTypes = await leaveTypeRepo.find({ 
        order: { leave_type_th: 'ASC' },
        withDeleted: true 
      });

      res.json({
        status: 'success',
        statuses,
        years,
        months,
        leaveTypes: allLeaveTypes.map(lt => {
          // Check if leave type is inactive or deleted
          const isInactive = lt.is_active === false || lt.deleted_at;
          
          if (isInactive) {
            // Add [DELETED] prefix for inactive/deleted leave types
            const prefix_th = '[ลบ] ';
            const prefix_en = '[DELETED] ';
            
            return {
              id: lt.id,
              leave_type: lt.leave_type,
              leave_type_th: prefix_th + (lt.leave_type_th || lt.leave_type),
              leave_type_en: prefix_en + (lt.leave_type_en || lt.leave_type)
            };
          } else {
            return {
              id: lt.id,
              leave_type: lt.leave_type,
              leave_type_th: lt.leave_type_th,
              leave_type_en: lt.leave_type_en
            };
          }
        })
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  return router;
};
