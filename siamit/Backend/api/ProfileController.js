const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { avatarUpload, handleUploadError } = require('../middleware/fileUploadMiddleware');
const { 
  hashPassword, 
  sendSuccess, 
  sendError, 
  calculateDaysBetween,
  convertToMinutes
} = require('../utils');

module.exports = (AppDataSource) => {
  const router = express.Router();
  
  // Repositories
  const userRepo = AppDataSource.getRepository('User');
  const departmentRepo = AppDataSource.getRepository('Department');
  const positionRepo = AppDataSource.getRepository('Position');
  const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
  const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
  const leaveRequestRepo = AppDataSource.getRepository('LeaveRequest');
  const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');

  // --- Helper Functions ---

  /**
   * Extract User from JWT Token
   */
  const getUserFromToken = async (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) throw { status: 401, message: 'Access token required' };

    try {
      jwt.verify(token, config.server.jwtSecret);
    } catch (err) {
      throw { status: 403, message: 'Invalid token' };
    }

    const user = await userRepo.findOne({ where: { Token: token } });
    if (!user) throw { status: 404, message: 'User not found' };
    
    return user;
  };

  /**
   * Fetch full user profile with relations
   */
  const getFullUserProfile = async (user) => {
    const [department, position] = await Promise.all([
      user.department ? departmentRepo.findOne({ where: { id: user.department } }) : null,
      user.position ? positionRepo.findOne({ where: { id: user.position } }) : null
    ]);

    return {
      email: user.Email,
      name: user.name,
      department_id: department?.id || '',
      department_name: department?.department_name_en || '',
      department_name_th: department?.department_name_th || '',
      department_name_en: department?.department_name_en || '',
      position_id: position?.id || '',
      position_name: position?.position_name_en || '',
      position_name_th: position?.position_name_th || '',
      position_name_en: position?.position_name_en || '',
      
      // Nested objects for frontend compatibility
      position: position ? {
        id: position.id,
        name_th: position.position_name_th,
        name_en: position.position_name_en
      } : null,
      department: department ? {
        id: department.id,
        name_th: department.department_name_th,
        name_en: department.department_name_en
      } : null,

      avatar_url: user.avatar_url || null,
      gender: user.gender || null,
      dob: user.dob || null,
      phone_number: user.phone_number || null,
      start_work: user.start_work || null,
      end_work: user.end_work || null
    };
  };

  /**
   * Delete user avatar file safely
   */
  const deleteAvatarFile = (avatarUrl) => {
    if (!avatarUrl) return;
    const filePath = path.join(config.getAvatarsUploadPath(), path.basename(avatarUrl));
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true }); // Fallback
        console.log(`✅ Deleted avatar: ${path.basename(avatarUrl)}`);
      }
    } catch (e) {
      console.error(`❌ Error deleting avatar: ${e.message}`);
    }
  };

  // --- Routes ---


  router.get('/profile', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      const profile = await getFullUserProfile(user);
      return res.json({ success: true, data: profile });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
    }
  });

  
  router.put('/profile', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      const { name, email, position_id, department_id, password, gender, dob, phone_number, start_work, end_work } = req.body;

      // Prepare Update Data
      if (name) user.name = name;
      if (email) user.Email = email;
      if (department_id) user.department = department_id;
      if (position_id) user.position = position_id;
      if (gender !== undefined) user.gender = gender;
      if (dob !== undefined) user.dob = dob;
      if (phone_number !== undefined) user.phone_number = phone_number;
      if (start_work !== undefined) user.start_work = start_work;
      if (end_work !== undefined) user.end_work = end_work;
      
      if (password) {
        user.Password = await hashPassword(password);
      }

      const updatedUser = await userRepo.save(user);
      const profile = await getFullUserProfile(updatedUser);
      
      return res.json({ success: true, data: profile });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
    }
  });


  router.post('/avatar', async (req, res) => {
    try {
      const user = await getUserFromToken(req);

      avatarUpload.single('avatar')(req, res, async (err) => {
        if (err) return handleUploadError(err, req, res, () => {});
        if (!req.file) return sendError(res, 'No file uploaded', 400);

        try {
          // Delete old avatar if exists
          deleteAvatarFile(user.avatar_url);

          const avatarUrl = `/uploads/avatars/${req.file.filename}`;
          user.avatar_url = avatarUrl;
          await userRepo.save(user);

          return sendSuccess(res, { avatar_url: avatarUrl }, 'Avatar uploaded successfully');
        } catch (updateErr) {
          // Cleanup on error
          if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return sendError(res, 'Failed to update avatar URL', 500);
        }
      });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  });

  router.get('/avatar', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      return res.json({ success: true, avatar_url: user.avatar_url || null });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  });


  router.delete('/avatar', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      
      deleteAvatarFile(user.avatar_url);
      
      user.avatar_url = null;
      await userRepo.save(user);

      return res.json({ success: true, message: 'Avatar deleted successfully' });
    } catch (err) {
      return res.status(err.status || 500).json({ success: false, message: err.message });
    }
  });

 
  router.get('/leave-quota/me', async (req, res) => {
    try {
      const user = await getUserFromToken(req);
      const userId = user.id;
      const userPosition = user.position;

      if (!userPosition) {
        return res.status(404).json({ success: false, message: 'User position not found' });
      }

      // Optimization: Fetch all related data in parallel (Batch Fetching)
      const [quotas, leaveTypes, leaveUsedRecords, approvedLeaves] = await Promise.all([
        leaveQuotaRepo.find({ where: { positionId: userPosition } }),
        leaveTypeRepo.find(),
        leaveUsedRepo.find({ where: { user_id: userId } }),
        leaveRequestRepo.find({ where: { Repid: userId, status: 'approved' } })
      ]);

      // Process Data in Memory
      const result = leaveTypes
        .filter(lt => {
          const en = (lt.leave_type_en || '').toLowerCase();
          const th = (lt.leave_type_th || '').toLowerCase();
          return !en.includes('emergency') && !th.includes('ฉุกเฉิน');
        })
        .map(leaveType => {
          // 1. Quota
          const quotaRow = quotas.find(q => q.leaveTypeId === leaveType.id);
          const quotaDays = quotaRow ? quotaRow.quota : 0;

          // 2. Usage Calculation
          let usedDays = 0, usedHours = 0;
          const usedRecord = leaveUsedRecords.find(r => r.leave_type_id === leaveType.id);

          if (usedRecord) {
            // Use cached calculation if available
            usedDays = usedRecord.days || 0;
            usedHours = usedRecord.hour || 0;
          } else {
            // Fallback: Calculate from raw requests if cache missing
            const typeLeaves = approvedLeaves.filter(l => l.leaveType === leaveType.id);
            for (const l of typeLeaves) {
              if (l.startTime && l.endTime) {
                const [sh, sm] = l.startTime.split(':').map(Number);
                const [eh, em] = l.endTime.split(':').map(Number);
                const diff = ((eh*60+em) - (sh*60+sm)) / 60;
                usedHours += Math.floor(Math.max(0, diff));
              } else if (l.startDate && l.endDate) {
                usedDays += Math.max(0, calculateDaysBetween(new Date(l.startDate), new Date(l.endDate)));
              }
            }
          }

          // 3. Normalize & Calculate Remaining
          const additionalDays = Math.floor(usedHours / config.business.workingHoursPerDay);
          const remainingHours = usedHours % config.business.workingHoursPerDay;
          const totalUsedDays = usedDays + additionalDays;
          const remainingDays = Math.max(0, quotaDays - totalUsedDays);

          return {
            id: leaveType.id,
            leave_type_en: leaveType.leave_type_en,
            leave_type_th: leaveType.leave_type_th,
            quota: quotaDays,
            used_day: totalUsedDays,
            used_hour: remainingHours,
            remaining_day: remainingDays,
            remaining_hour: 0
          };
        });

      return sendSuccess(res, result);
    } catch (err) {
      console.error('Leave quota error:', err);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
    }
  });

  return router;
};