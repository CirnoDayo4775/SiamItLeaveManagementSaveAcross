const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { avatarUpload, handleUploadError } = require('../middleware/fileUploadMiddleware');
const { 
  hashPassword, 
  verifyToken, 
  sendSuccess, 
  sendError, 
  sendUnauthorized,
  toDayHour,
  calculateDaysBetween,
  convertTimeRangeToDecimal
} = require('../utils');

console.log('ProfileController is being loaded...');

module.exports = (AppDataSource) => {
  console.log('ProfileController module function is being executed...');
  const router = express.Router();

  // File upload middleware is now imported from fileUploadMiddleware.js

  /**
   * @swagger
   * /api/profile:
   *   get:
   *     summary: Get the logged-in user's profile information
   *     description: >
   *       Returns the name, email, position, and department of the currently logged-in user.
   *       The system checks the JWT token and finds the user in the unified users table by token.
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Profile data for the logged-in user
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     name:
   *                       type: string
   *                       example: John Doe
   *                     email:
   *                       type: string
   *                       example: john@example.com
   *                     position:
   *                       type: string
   *                       example: Software Developer
   *                     department:
   *                       type: string
   *                       example: IT Department
   *       401:
   *         description: No or invalid token provided
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: Access token required
   *       403:
   *         description: Invalid token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: Invalid token
   *       404:
   *         description: User not found in users table
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: User not found
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: Internal server error
   */
  router.get('/profile', async (req, res) => {
    try {
      // 1. Get token from Authorization header
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }

      // 2. Decode token to get payload
      let payload;
      try {
        payload = jwt.verify(token, config.server.jwtSecret);
      } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid token' });
      }

      // 3. Find user in unified users table by token
      const userRepo = AppDataSource.getRepository('User');
      const user = await userRepo.findOne({ where: { Token: token } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const { Role: role, Email: email, name } = user;
      let profile = { email, name };

      const departmentRepo = AppDataSource.getRepository('Department');
      const positionRepo = AppDataSource.getRepository('Position');
      // Department
      let department = null;
      if (user.department) {
        department = await departmentRepo.findOne({ where: { id: user.department } });
      }
      // Language detection removed - frontend will handle i18n
      profile.department_id = department ? department.id : '';
      profile.department_name = department ? department.department_name_en : '';
      profile.department_name_th = department ? department.department_name_th : '';
      profile.department_name_en = department ? department.department_name_en : '';
      // Position
      let position = null;
      if (user.position) {
        position = await positionRepo.findOne({ where: { id: user.position } });
      }
      profile.position_id = position ? position.id : '';
      profile.position_name = position ? position.position_name_en : '';
      profile.position_name_th = position ? position.position_name_th : '';
      profile.position_name_en = position ? position.position_name_en : '';
      
      // Add nested objects for frontend compatibility
      profile.position = position ? {
        id: position.id,
        name_th: position.position_name_th,
        name_en: position.position_name_en
      } : null;
      
      profile.department = department ? {
        id: department.id,
        name_th: department.department_name_th,
        name_en: department.department_name_en
      } : null;
      
      // Add avatar_url from unified user
      profile.avatar_url = user.avatar_url || null;
      
      // Add additional user fields
      profile.gender = user.gender || null;
      profile.dob = user.dob || null;
      profile.phone_number = user.phone_number || null;
      profile.start_work = user.start_work || null;
      profile.end_work = user.end_work || null;
      
      return res.json({ success: true, data: profile });
    } catch (err) {
      console.error('Profile error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  /**
   * @swagger
   * /api/profile:
   *   put:
   *     summary: Update the logged-in user's profile information
   *     description: >
   *       Allows the user to update their name, email, position, and department. The system checks the JWT token, finds the user in the unified users table by token, and updates the user's information.
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               position:
   *                 type: string
   *               department:
   *                 type: string
   *     responses:
   *       200:
   *         description: Profile updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *       401:
   *         description: No or invalid token provided
   *       403:
   *         description: Invalid token
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  router.put('/profile', async (req, res) => {
    try {
      // Language detection removed - frontend will handle i18n
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }
      let payload;
      try {
        payload = jwt.verify(token, config.server.jwtSecret);
      } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid token' });
      }
      const userRepo = AppDataSource.getRepository('User');
      const user = await userRepo.findOne({ where: { Token: token } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const { Role: role, Email: email } = user;
      const { name, email: newEmail, position_id, department_id, password, gender, dob, phone_number, start_work, end_work } = req.body;
      const departmentRepo = AppDataSource.getRepository('Department');
      const positionRepo = AppDataSource.getRepository('Position');
      let hashedPassword = null;
      if (password) {
        hashedPassword = await hashPassword(password);
      }
      
      // Update user in unified users table
      user.name = name || user.name;
      user.Email = newEmail || user.Email;
      user.department = department_id || user.department;
      user.position = position_id || user.position;
      user.gender = gender !== undefined ? gender : user.gender;
      user.dob = dob !== undefined ? dob : user.dob;
      user.phone_number = phone_number !== undefined ? phone_number : user.phone_number;
      user.start_work = start_work !== undefined ? start_work : user.start_work;
      user.end_work = end_work !== undefined ? end_work : user.end_work;
      if (hashedPassword) user.Password = hashedPassword;
      
      const updated = await userRepo.save(user);
      // Return updated profile in the same format as GET
      let profile = { email: updated.Email || email, name: updated.name };
      // Department
      let department = null;
      if (updated.department) {
        department = await departmentRepo.findOne({ where: { id: updated.department } });
      }
      profile.department_id = department ? department.id : '';
      profile.department_name = department ? department.department_name_en : '';
      profile.department_name_th = department ? department.department_name_th : '';
      profile.department_name_en = department ? department.department_name_en : '';
      // Position
      let position = null;
      if (updated.position) {
        position = await positionRepo.findOne({ where: { id: updated.position } });
      }
      profile.position_id = position ? position.id : '';
      profile.position_name = position ? position.position_name_en : '';
      profile.position_name_th = position ? position.position_name_th : '';
      profile.position_name_en = position ? position.position_name_en : '';
      
      // Add nested objects for frontend compatibility
      profile.position = position ? {
        id: position.id,
        name_th: position.position_name_th,
        name_en: position.position_name_en
      } : null;
      
      profile.department = department ? {
        id: department.id,
        name_th: department.department_name_th,
        name_en: department.department_name_en
      } : null;
      
      // Add avatar_url from unified user
      profile.avatar_url = updated.avatar_url || null;
      
      // Add additional user fields to response
      profile.gender = updated.gender || null;
      profile.dob = updated.dob || null;
      profile.phone_number = updated.phone_number || null;
      profile.start_work = updated.start_work || null;
      profile.end_work = updated.end_work || null;
      
      // Add debug logging
      console.log('Profile update request body:', req.body);
      console.log('Updated user entity:', updated);
      console.log('Response profile data:', profile);
      
      return res.json({ success: true, data: profile });
    } catch (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  /**
   * @swagger
   * /api/avatar:
   *   post:
   *     summary: Upload avatar image for logged-in user
   *     description: >
   *       Uploads an avatar image for the currently logged-in user and stores the URL in the users table.
   *       The image is saved to the server and the avatar_url field is updated in the database.
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               avatar:
   *                 type: string
   *                 format: binary
   *                 description: Image file to upload (max 5MB)
   *     responses:
   *       200:
   *         description: Avatar uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Avatar uploaded successfully
   *                 avatar_url:
   *                   type: string
   *                   example: /uploads/avatars/avatar-1234567890.jpg
   *       400:
   *         description: Invalid file or no file provided
   *       401:
   *         description: No or invalid token provided
   *       403:
   *         description: Invalid token
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  router.post('/avatar', async (req, res) => {
    try {
      // 1. Get token from Authorization header
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }

      // 2. Decode token to get payload
      let payload;
      try {
        payload = jwt.verify(token, config.server.jwtSecret);
      } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid token' });
      }

      // 3. Find user in unified users table by token
      const userRepo = AppDataSource.getRepository('User');
      const user = await userRepo.findOne({ where: { Token: token } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // 4. Handle file upload using new middleware
      avatarUpload.single('avatar')(req, res, async function (err) {
        if (err) {
          return handleUploadError(err, req, res, () => {});
        }

        if (!req.file) {
          return sendError(res, 'No file uploaded', 400);
        }

        try {
          // 5. Generate relative URL for the uploaded file
          const avatarUrl = `/uploads/avatars/${req.file.filename}`;

          // 6. Update unified users table with new avatar URL
          user.avatar_url = avatarUrl;
          await userRepo.save(user);

          return sendSuccess(res, { avatar_url: avatarUrl }, 'Avatar uploaded successfully');
        } catch (updateErr) {
          console.error('Avatar update error:', updateErr);
          // If database update fails, delete the uploaded file
          if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return sendError(res, 'Failed to update avatar URL', 500);
        }
      });
    } catch (err) {
      console.error('Avatar upload error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  /**
   * @swagger
   * /api/avatar:
   *   get:
   *     summary: Get avatar URL for logged-in user
   *     description: >
   *       Returns the avatar URL for the currently logged-in user from the users table.
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Avatar URL retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 avatar_url:
   *                   type: string
   *                   example: /uploads/avatars/avatar-1234567890.jpg
   *       401:
   *         description: No or invalid token provided
   *       403:
   *         description: Invalid token
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  router.get('/avatar', async (req, res) => {
    try {
      // 1. Get token from Authorization header
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }

      // 2. Decode token to get payload
      let payload;
      try {
        payload = jwt.verify(token, config.server.jwtSecret);
      } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid token' });
      }

      // 3. Find user in unified users table by token
      const userRepo = AppDataSource.getRepository('User');
      const user = await userRepo.findOne({ where: { Token: token } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      return res.json({
        success: true,
        avatar_url: user.avatar_url || null
      });
    } catch (err) {
      console.error('Avatar get error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  /**
   * @swagger
   * /api/avatar:
   *   delete:
   *     summary: Delete avatar for logged-in user
   *     description: >
   *       Deletes the avatar image for the currently logged-in user and removes the URL from the users table.
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Avatar deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Avatar deleted successfully
   *       401:
   *         description: No or invalid token provided
   *       403:
   *         description: Invalid token
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  router.delete('/avatar', async (req, res) => {
    try {
      // 1. Get token from Authorization header
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }

      // 2. Decode token to get payload
      let payload;
      try {
        payload = jwt.verify(token, config.server.jwtSecret);
      } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid token' });
      }

      // 3. Find user in unified users table by token
      const userRepo = AppDataSource.getRepository('User');
      const user = await userRepo.findOne({ where: { Token: token } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // 4. HARD DELETE the avatar file if it exists
      if (user.avatar_url) {
        const filePath = path.join(config.getAvatarsUploadPath(), path.basename(user.avatar_url));
        
        try {
          if (fs.existsSync(filePath)) {
            // Force delete the avatar file (hard delete)
            fs.unlinkSync(filePath);
            
            // Verify file is actually deleted
            if (!fs.existsSync(filePath)) {
              console.log(`✅ HARD DELETED avatar: ${path.basename(user.avatar_url)}`);
            } else {
              console.error(`❌ FAILED to delete avatar: ${path.basename(user.avatar_url)} - file still exists`);
              
              // Try alternative deletion method
              try {
                fs.rmSync(filePath, { force: true });
                console.log(`✅ Force deleted avatar: ${path.basename(user.avatar_url)}`);
              } catch (forceDeleteError) {
                console.error(`❌ Force delete also failed for avatar: ${path.basename(user.avatar_url)}:`, forceDeleteError.message);
              }
            }
          } else {
            console.log(`⚠️  Avatar file not found (already deleted?): ${path.basename(user.avatar_url)}`);
          }
        } catch (fileDeleteError) {
          console.error(`❌ Error deleting avatar file ${path.basename(user.avatar_url)}:`, fileDeleteError.message);
          
          // Try alternative deletion method
          try {
            fs.rmSync(filePath, { force: true });
            console.log(`✅ Force deleted avatar: ${path.basename(user.avatar_url)}`);
          } catch (forceDeleteError) {
            console.error(`❌ Force delete also failed for avatar: ${path.basename(user.avatar_url)}:`, forceDeleteError.message);
          }
        }
      }

      // 5. Update unified users table to remove avatar URL
      user.avatar_url = null;
      await userRepo.save(user);

      return res.json({
        success: true,
        message: 'Avatar deleted successfully'
      });
    } catch (err) {
      console.error('Avatar delete error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  /**
   * @swagger
   * /api/leave-quota/me:
   *   get:
   *     summary: Get leave quota for the logged-in user
   *     description: Returns leave quota and usage for the current user.
   *     tags: [Profile]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Leave quota data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       type:
   *                         type: string
   *                       used:
   *                         type: number
   *                       total:
   *                         type: number
   *       401:
   *         description: No or invalid token provided
   *       403:
   *         description: Invalid token
   *       404:
   *         description: User not found
   *       500:
   *         description: Internal server error
   */
  router.get('/leave-quota/me', async (req, res) => {
    try {
      // 1. Get token from Authorization header
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }

      // 2. Decode token to get payload
      let payload;
      try {
        payload = jwt.verify(token, config.server.jwtSecret);
      } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid token' });
      }

      // 3. Find user in unified users table by token
      const userRepo = AppDataSource.getRepository('User');
      const user = await userRepo.findOne({ where: { Token: token } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const { id: userId } = user;

      // เพิ่มเติม: ดึง leave_used ของ user มาด้วย
      const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');
      const leaveUsedRecords = await leaveUsedRepo.find({ where: { user_id: userId } });

      // Get user's position to determine leave quotas
      let userPosition = user.position;

      if (!userPosition) {
        return res.status(404).json({ success: false, message: 'User position not found' });
      }

      // Get leave quotas for this position
      const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      const leaveRequestRepo = AppDataSource.getRepository('LeaveRequest');
      
      const quotas = await leaveQuotaRepo.find({ where: { positionId: userPosition } });
      const leaveTypes = await leaveTypeRepo.find();
      
      // Get all approved leave requests for this user
      const approvedLeaves = await leaveRequestRepo.find({ 
        where: { Repid: userId, status: 'approved' },
        order: { createdAt: 'DESC' }
      });

      // Calculate leave usage from actual approved requests (reflects deletions immediately)
      const result = leaveTypes
        .filter(lt => {
          // Filter out emergency leave
          const leaveTypeEn = lt.leave_type_en?.toLowerCase() || '';
          const leaveTypeTh = lt.leave_type_th?.toLowerCase() || '';
          return !leaveTypeEn.includes('emergency') && !leaveTypeTh.includes('ฉุกเฉิน');
        })
        .map(leaveType => {
          // quota
          const quotaRow = quotas.find(q => q.leaveTypeId === leaveType.id);
          const quotaDays = quotaRow ? quotaRow.quota : 0;

          // ใช้ leave_used ถ้ามี
          const usedRecord = leaveUsedRecords.find(r => r.leave_type_id === leaveType.id);
          let usedDays = 0, usedHours = 0;
          if (usedRecord) {
            usedDays = usedRecord.days || 0;
            usedHours = usedRecord.hour || 0;
          } else {
            // fallback: คำนวณจากใบลาเดิม
            const typeLeaves = approvedLeaves.filter(leave => leave.leaveType === leaveType.id);
            for (const leave of typeLeaves) {
              if (leave.startTime && leave.endTime) {
                // Hour-based leave
                const [sh, sm] = leave.startTime.split(':').map(Number);
                const [eh, em] = leave.endTime.split(':').map(Number);
                const startMinutes = (sh || 0) * 60 + (sm || 0);
                const endMinutes = (eh || 0) * 60 + (em || 0);
                let durationHours = (endMinutes - startMinutes) / 60;
                if (durationHours < 0 || isNaN(durationHours)) durationHours = 0;
                usedHours += Math.floor(durationHours);
              } else if (leave.startDate && leave.endDate) {
                // Day-based leave
                const start = new Date(leave.startDate);
                const end = new Date(leave.endDate);
                let days = calculateDaysBetween(start, end);
                if (days < 0 || isNaN(days)) days = 0;
                usedDays += days;
              }
            }
          }
          
          // Convert hours to days according to working hours per day
          const additionalDays = Math.floor(usedHours / config.business.workingHoursPerDay);
          const remainingHours = usedHours % config.business.workingHoursPerDay;
          const totalUsedDays = usedDays + additionalDays;
          
          // Calculate remaining
          const remainingDays = Math.max(0, quotaDays - totalUsedDays);
          
          return {
            id: leaveType.id,
            leave_type_en: leaveType.leave_type_en,
            leave_type_th: leaveType.leave_type_th,
            quota: quotaDays,
            used_day: usedDays + additionalDays,
            used_hour: remainingHours,
            remaining_day: remainingDays,
            remaining_hour: 0
          };
        });

      return sendSuccess(res, result);
    } catch (err) {
      console.error('Leave quota error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // Test route to verify ProfileController is working
  router.get('/test', (req, res) => {
    res.json({ message: 'ProfileController is working!' });
  });

  console.log('ProfileController router created successfully');
  return router;
};
