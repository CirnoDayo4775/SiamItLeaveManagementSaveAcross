const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { calculateDaysBetween, sendSuccess, sendError, sendNotFound } = require('../utils');
const { avatarUpload, handleUploadError } = require('../middleware/fileUploadMiddleware');
const { getLeaveUsageSummary } = require('../utils/leaveUtils');

module.exports = (AppDataSource) => {
  const router = express.Router();

  // --- Repositories (Defined once for clarity, though used inside routes for scope) ---
  const userRepo = AppDataSource.getRepository('User');
  const departmentRepo = AppDataSource.getRepository('Department');
  const positionRepo = AppDataSource.getRepository('Position');
  const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
  const leaveRepo = AppDataSource.getRepository('LeaveRequest');
  const leaveTypeRepo = AppDataSource.getRepository('LeaveType');

  // --- Helper Functions ---

  /**
   * Helper: Safely delete a file with multiple fallback attempts
   */
  const safeDeleteFile = (relativeUrl) => {
    if (!relativeUrl) return;
    try {
      const fileName = path.basename(relativeUrl);
      const filePath = path.join(config.getAvatarsUploadPath(), fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        if (fs.existsSync(filePath)) {
          // Fallback force delete
          fs.rmSync(filePath, { force: true });
        }
        console.log(`✅ Deleted avatar: ${fileName}`);
      }
    } catch (err) {
      console.error(`❌ Error deleting avatar: ${err.message}`);
    }
  };

  /**
   * Helper: Calculate leave duration details
   */
  const calculateDurationDetails = (leave) => {
    let duration = 0;
    let durationType = 'day';
    let durationHours = 0;

    if (leave.startTime && leave.endTime) {
      // Hourly calculation
      const [sh, sm] = leave.startTime.split(":").map(Number);
      const [eh, em] = leave.endTime.split(":").map(Number);
      let start = sh + (sm || 0) / 60;
      let end = eh + (em || 0) / 60;
      let diff = end - start;
      if (diff < 0) diff += 24;
      
      durationType = 'hour';
      durationHours = Math.floor(diff);
    } else if (leave.startDate && leave.endDate) {
      // Daily calculation
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      let days = calculateDaysBetween(start, end);
      
      if (days < 0 || isNaN(days)) days = 0;
      if (days === 0 && leave.startDate === leave.endDate) days = 1;

      durationType = 'day';
      duration = days;
    }

    return { duration, durationType, durationHours };
  };

  /**
   * Helper: Fetch Map for quick lookup (ID -> Entity)
   */
  const getEntityMap = async (repo, keyField = 'id') => {
    const entities = await repo.find();
    return entities.reduce((acc, item) => {
      acc[item[keyField]] = item;
      return acc;
    }, {});
  };


  // --- Routes ---

  router.get('/employees', async (req, res) => {
    try {
      const allUsers = await userRepo.find();
      
      // Optimization: Fetch all related data once (Batch Fetching)
      const [departments, positions, allQuotas] = await Promise.all([
        getEntityMap(departmentRepo),
        getEntityMap(positionRepo),
        leaveQuotaRepo.find() // Fetch all quotas to process in memory
      ]);

      const results = await Promise.all(allUsers.map(async (user) => {
        // Map Department & Position from memory (No DB calls here)
        const dept = departments[user.department] || null;
        const pos = positions[user.position] || null;

        // Calculate Leave Quota from memory
        const userQuotas = allQuotas.filter(q => q.positionId == user.position);
        const totalLeaveDays = userQuotas.reduce((sum, q) => sum + (q.quota || 0), 0);

        // Calculate Used Leaves (This still needs utility call, but we wrap it safely)
        let usedLeaveDays = 0;
        try {
          const summary = await getLeaveUsageSummary(user.id, null, AppDataSource);
          usedLeaveDays = summary.reduce((acc, item) => acc + item.total_used_days, 0);
          usedLeaveDays = Math.round(usedLeaveDays * 100) / 100;
        } catch (e) { /* ignore */ }

        return {
          id: user.id,
          name: user.name || '',
          email: user.Email,
          position: user.position || '',
          position_name_th: pos?.position_name_th || '',
          position_name_en: pos?.position_name_en || '',
          department: user.department || '',
          department_name_th: dept?.department_name_th || '',
          department_name_en: dept?.department_name_en || '',
          status: user.Role,
          role: user.Role,
          usedLeaveDays,
          totalLeaveDays,
          avatar: user.avatar_url || null
        };
      }));

      sendSuccess(res, results, 'Fetch all users success');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Get employee profile by ID
  router.get('/employee/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await userRepo.findOne({ where: { id } });

      if (!profile) return sendNotFound(res, 'User not found');

      // Parallel fetch for details
      const [dept, pos, quota] = await Promise.all([
        profile.department ? departmentRepo.findOneBy({ id: profile.department }) : null,
        profile.position ? positionRepo.findOneBy({ id: profile.position }) : null,
        profile.position ? leaveQuotaRepo.findOneBy({ positionId: profile.position }) : null
      ]);

      // Calculate leaves
      let totalLeaveDays = quota ? ((quota.sick || 0) + (quota.vacation || 0) + (quota.personal || 0)) : 0;
      let usedLeaveDays = 0;
      try {
        const summary = await getLeaveUsageSummary(id, null, AppDataSource);
        usedLeaveDays = summary.reduce((acc, item) => acc + item.total_used_days, 0);
        usedLeaveDays = Math.round(usedLeaveDays * 100) / 100;
      } catch (e) { /* ignore */ }

      res.json({
        success: true,
        data: {
          id,
          name: profile.name || '',
          email: profile.Email || '',
          password: profile.Password || '',
          position: pos?.position_name_en || '',
          position_id: profile.position,
          position_th: pos?.position_name_th || '',
          position_en: pos?.position_name_en || '',
          department: dept?.department_name_en || '',
          department_id: profile.department,
          department_th: dept?.department_name_th || '',
          department_en: dept?.department_name_en || '',
          role: profile.Role,
          gender: profile.gender || null,
          dob: profile.dob || null,
          phone_number: profile.phone_number || null,
          start_work: profile.start_work || null,
          end_work: profile.end_work || null,
          internStartDate: profile.start_work || profile.internStartDate || null,
          internEndDate: profile.end_work || profile.internEndDate || null,
          usedLeaveDays,
          totalLeaveDays,
          avatar: profile.avatar_url || null
        }
      });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Update employee profile
  router.put('/employee/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await userRepo.findOne({ where: { id } });
      if (!profile) return sendNotFound(res, 'User not found');

      const body = req.body;

      // Logic to prefer ID, fallback to plain text, handle empty strings
      const resolveField = (idVal, val) => (idVal && idVal.trim() !== '') ? idVal : (val && val.trim() !== '' ? val : null);
      
      profile.name = body.name ?? profile.name;
      profile.position = resolveField(body.position_id, body.position) ?? profile.position;
      profile.department = resolveField(body.department_id, body.department) ?? profile.department;
      profile.gender = body.gender ?? profile.gender;
      profile.dob = body.birthdate ?? profile.dob;
      profile.phone_number = body.phone ?? profile.phone_number;
      profile.start_work = body.startWorkDate ?? body.internStartDate ?? profile.start_work;
      profile.end_work = body.endWorkDate ?? body.internEndDate ?? profile.end_work;
      profile.Email = body.email ?? profile.Email;

      if (body.password) {
        profile.Password = await bcrypt.hash(body.password, 10);
      }

      await userRepo.save(profile);

      // Fetch names for response
      const [dept, pos] = await Promise.all([
        profile.department ? departmentRepo.findOneBy({ id: profile.department }) : null,
        profile.position ? positionRepo.findOneBy({ id: profile.position }) : null
      ]);

      sendSuccess(res, {
        id,
        name: profile.name,
        email: profile.Email,
        position: pos?.position_name_th || profile.position,
        department: dept?.department_name_th || profile.department,
        role: profile.Role
      }, 'Employee profile updated successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Upload avatar
  router.post('/employee/:id/avatar', async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await userRepo.findOne({ where: { id } });
      if (!profile) return sendNotFound(res, 'User not found');

      avatarUpload.single('avatar')(req, res, async function (err) {
        if (err) return handleUploadError(err, req, res, () => {});
        if (!req.file) return sendError(res, 'No file uploaded', 400);

        try {
          const avatarUrl = `/uploads/avatars/${req.file.filename}`;
          
          // Delete old avatar
          if (profile.avatar_url) {
            safeDeleteFile(profile.avatar_url);
          }

          profile.avatar_url = avatarUrl;
          await userRepo.save(profile);
          return sendSuccess(res, { avatar_url: avatarUrl }, 'Avatar uploaded successfully');
        } catch (updateErr) {
          // Clean up new file if DB update fails
          if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return sendError(res, 'Failed to update avatar URL', 500);
        }
      });
    } catch (err) {
      return sendError(res, err.message || 'Upload failed', 500);
    }
  });

  // Get leave history
  router.get('/employee/:id/leave-history', async (req, res) => {
    try {
      const { id } = req.params;
      const { leaveType, month, year, status, page = 1, limit = config.pagination.defaultLimit, backdated } = req.query;

      // 1. Fetch all leaves for user
      let leaves = await leaveRepo.find({ where: { Repid: id }, order: { createdAt: 'DESC' } });

      // 2. Optimization: Pre-fetch all Leave Types once to avoid N+1 queries
      // We explicitly select 'withDeleted' because history might reference deleted types
      const allLeaveTypes = await leaveTypeRepo.find({ withDeleted: true });
      const leaveTypeMap = allLeaveTypes.reduce((acc, type) => {
        acc[type.id] = type;
        return acc;
      }, {});

      // 3. Map and Enrich Data (Resolve Names and Durations)
      let enrichedLeaves = leaves.map(l => {
        const typeObj = leaveTypeMap[l.leaveType];
        let typeName_th = l.leaveType;
        let typeName_en = l.leaveType;

        if (typeObj) {
            const prefix_th = typeObj.is_active === false ? '[ลบ] ' : '';
            const prefix_en = typeObj.is_active === false ? '[DELETED] ' : '';
            typeName_th = prefix_th + (typeObj.leave_type_th || l.leaveType);
            typeName_en = prefix_en + (typeObj.leave_type_en || l.leaveType);
        }

        const { duration, durationType, durationHours } = calculateDurationDetails(l);

        return {
          ...l,
          leaveTypeName_th: typeName_th,
          leaveTypeName_en: typeName_en,
          leaveDate: l.startDate,
          duration,
          durationType,
          durationHours: durationType === 'hour' ? durationHours : undefined,
          backdated: Number(l.backdated)
        };
      });

      // 4. Filtering (In Memory)
      if (leaveType && leaveType !== 'all') {
        const keyword = String(leaveType).trim().toLowerCase();
        enrichedLeaves = enrichedLeaves.filter(l => 
          String(l.leaveTypeName_th).toLowerCase().includes(keyword) ||
          String(l.leaveTypeName_en).toLowerCase().includes(keyword) ||
          String(l.leaveType).toLowerCase().includes(keyword)
        );
      }

      if (year && year !== 'all') {
        enrichedLeaves = enrichedLeaves.filter(l => {
          if (!l.startDate) return false;
          const d = new Date(l.startDate);
          const sameYear = d.getFullYear() === Number(year);
          return (month && month !== 'all') ? (sameYear && (d.getMonth() + 1) === Number(month)) : sameYear;
        });
      }

      if (status && status !== 'all') {
        enrichedLeaves = enrichedLeaves.filter(l => l.status === status);
      }

      if (typeof backdated !== 'undefined' && backdated !== 'all') {
        const target = backdated === '1' ? 1 : 0;
        enrichedLeaves = enrichedLeaves.filter(l => l.backdated === target);
      }

      // 5. Calculate Summary (Days/Hours)
      // Note: Calculation is based on Approved leaves within the *original* set or filtered set?
      // Usually summary reflects the view, so we use filtered leaves that are approved.
      const approvedLeaves = enrichedLeaves.filter(l => l.status === 'approved');
      const totalHoursSum = approvedLeaves.reduce((sum, l) => {
        if (l.durationType === 'hour') return sum + (l.durationHours || 0);
        return sum + ((l.duration || 0) * config.business.workingHoursPerDay);
      }, 0);

      const summaryDays = Math.floor(totalHoursSum / config.business.workingHoursPerDay);
      const summaryHours = totalHoursSum % config.business.workingHoursPerDay;

      // 6. Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const totalCount = enrichedLeaves.length;
      const paginatedData = enrichedLeaves.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      // 7. Get Total Used (Global)
      let totalLeaveDaysFinal = 0;
      try {
        const summary = await getLeaveUsageSummary(id, null, AppDataSource);
        totalLeaveDaysFinal = summary.reduce((acc, item) => acc + item.total_used_days, 0);
      } catch(e) {}

      sendSuccess(res, { 
        data: paginatedData, 
        total: totalCount,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        summary: {
          days: summaryDays,
          hours: summaryHours,
          totalLeaveDays: totalLeaveDaysFinal // Compatibility
        }
      }, 'Leave history retrieved successfully');

    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  return router;
};