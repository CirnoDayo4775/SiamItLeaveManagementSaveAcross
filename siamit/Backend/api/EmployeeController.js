const express = require('express');
const bcrypt = require('bcrypt');
const config = require('../config');
const { calculateDaysBetween, sendSuccess, sendError, sendNotFound } = require('../utils');
const { avatarUpload, handleUploadError } = require('../middleware/fileUploadMiddleware');
const fs = require('fs');

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: แสดงข้อมูลผู้ใช้ทั้งหมด (admin/user)
 *     tags: [Employees]
 *     responses:
 *       200:
 *         description: รายการผู้ใช้ทั้งหมด
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
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       position:
 *                         type: string
 *                       department:
 *                         type: string
 *                       status:
 *                         type: string
 *                 message:
 *                   type: string
 */
module.exports = (AppDataSource) => {
  const router = express.Router();

  router.get('/employees', async (req, res) => {
    try {
      const userRepo = AppDataSource.getRepository('User');
      const adminRepo = AppDataSource.getRepository('User'); // Admin users are stored in User table
      const superadminRepo = AppDataSource.getRepository('User'); // Superadmin users are also stored in User table
      // Language detection removed - frontend will handle i18n

      // ดึงข้อมูลผู้ใช้ทั้งหมดจาก table User โดยตรง
      const allUsers = await userRepo.find();
      console.log('allUsers:', allUsers); // log ข้อมูลทั้งหมด
      const results = [];

      for (const user of allUsers) {
        let name = user.name || '';
        let position = '';
        let position_id = '';
        let position_name_th = '';
        let position_name_en = '';
        let department = '';
        let department_id = '';
        let department_name_th = '';
        let department_name_en = '';
        let id = user.id;
        let role = user.Role;
        
        // ดึงชื่อ position และ department
        if (user.position) {
          const posEntity = await AppDataSource.getRepository('Position').findOne({ where: { id: user.position } });
          position_id = user.position || '';
          position = user.position || ''; // เก็บ ID แทนชื่อ
          position_name_th = posEntity ? posEntity.position_name_th : '';
          position_name_en = posEntity ? posEntity.position_name_en : '';
        }
        
        if (user.department) {
          const deptEntity = await AppDataSource.getRepository('Department').findOne({ where: { id: user.department } });
          department_id = user.department || '';
          department = user.department || ''; // เก็บ ID แทนชื่อ
          department_name_th = deptEntity ? deptEntity.department_name_th : '';
          department_name_en = deptEntity ? deptEntity.department_name_en : '';
        }

        // --- เพิ่มส่วนนี้ ---
        // 1. ดึง leave quota ตาม position (แบบใหม่)
        let totalLeaveDays = 0;
        try {
          const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
          const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
          // ดึง leaveQuota ทั้งหมดของตำแหน่งนี้
          const quotas = await leaveQuotaRepo.find({ where: { positionId: user.position } });
          // รวม quota ทุกประเภท (หรือเลือกเฉพาะประเภทที่ต้องการ)
          totalLeaveDays = quotas.reduce((sum, q) => sum + (q.quota || 0), 0);
        } catch (e) { totalLeaveDays = 0; }

        // 2. ดึง leaveRequest ที่อนุมัติของ user/admin นี้
        let usedLeaveDays = 0;
        try {
          // Use centralized utility function for leave usage summary
          const { getLeaveUsageSummary } = require('../utils/leaveUtils');
          const leaveUsageSummary = await getLeaveUsageSummary(id, null, AppDataSource);
          
          // Calculate total used leave days from all leave types
          usedLeaveDays = leaveUsageSummary.reduce((total, item) => {
            return total + item.total_used_days;
          }, 0);
          
          usedLeaveDays = Math.round(usedLeaveDays * 100) / 100;
        } catch (e) { 
          usedLeaveDays = 0; 
        }

        // --- จบส่วนเพิ่ม ---

        results.push({
          id,
          name,
          email: user.Email,
          position: position_id, // ส่ง ID สำหรับ filtering
          position_name_th,
          position_name_en,
          department: department_id, // ส่ง ID สำหรับ filtering
          department_name_th,
          department_name_en,
          status: user.Role,
          role,
          usedLeaveDays,
          totalLeaveDays,
          avatar: user.avatar_url || null
        });
      }
      sendSuccess(res, results, 'Fetch all users success');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Get employee/admin profile by ID
  router.get('/employee/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const userRepo = AppDataSource.getRepository('User');
      const adminRepo = AppDataSource.getRepository('User'); // Admin users are stored in User table
      const superadminRepo = AppDataSource.getRepository('User'); // Superadmin users are also stored in User table
      const departmentRepo = AppDataSource.getRepository('Department');
      const positionRepo = AppDataSource.getRepository('Position');
      const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      const leaveRequestRepo = AppDataSource.getRepository('LeaveRequest');
      // Language detection removed - frontend will handle i18n

      // Find user in unified User table
      const profile = await userRepo.findOne({ where: { id } });
      if (!profile) {
        return sendNotFound(res, 'User not found');
      }

      const role = profile.Role;
      const email = profile.Email || '';

      // Get department and position names (i18n key or readable)
      let department = '';
      let department_id = '';
      let position = '';
      let position_id = '';
      let department_th = '';
      let department_en = '';
      let position_th = '';
      let position_en = '';
      
      if (profile.department) {
        const deptEntity = await departmentRepo.findOne({ where: { id: profile.department } });
        department = deptEntity ? deptEntity.department_name_en : '';
        department_th = deptEntity ? deptEntity.department_name_th : '';
        department_en = deptEntity ? deptEntity.department_name_en : '';
        department_id = profile.department;
      }
      if (profile.position) {
        const posEntity = await positionRepo.findOne({ where: { id: profile.position } });
        position = posEntity ? posEntity.position_name_en : '';
        position_th = posEntity ? posEntity.position_name_th : '';
        position_en = posEntity ? posEntity.position_name_en : '';
        position_id = profile.position;
      }

      // Password field (for future editing)
      const password = profile.Password || '';

      // --- เพิ่มส่วนนี้: คำนวณ usedLeaveDays/totalLeaveDays ---
      let totalLeaveDays = 0;
      try {
        const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
        // Use position_id instead of position name for the query
        let quota = null;
        if (position_id) {
          quota = await leaveQuotaRepo.findOneBy({ positionId: position_id });
        }
        if (quota) {
          totalLeaveDays = (quota.sick || 0) + (quota.vacation || 0) + (quota.personal || 0);
        }
      } catch (e) { totalLeaveDays = 0; }

      let usedLeaveDays = 0;
      try {
        // Use centralized utility function for leave usage summary
        const { getLeaveUsageSummary } = require('../utils/leaveUtils');
        const leaveUsageSummary = await getLeaveUsageSummary(id, null, AppDataSource);
        
        // Calculate total used leave days from all leave types
        usedLeaveDays = leaveUsageSummary.reduce((total, item) => {
          return total + item.total_used_days;
        }, 0);
        
        usedLeaveDays = Math.round(usedLeaveDays * 100) / 100;
      } catch (e) { 
        usedLeaveDays = 0; 
      }
      // --- จบส่วนเพิ่ม ---

      res.json({
        success: true,
        data: {
          id,
          name: profile.name || '',
          email,
          password,
          position: position,
          position_id: position_id,
          position_th: position_th,
          position_en: position_en,
          department: department,
          department_id: department_id,
          department_th: department_th,
          department_en: department_en,
          role,
          gender: profile.gender || null,
          dob: profile.dob || null,
          phone_number: profile.phone_number || null,
          start_work: profile.start_work || null,
          end_work: profile.end_work || null,
          // สำหรับฝั่ง frontend ที่ใช้ชื่อ intern*
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

  // Update employee/admin/superadmin profile by ID
  router.put('/employee/:id', async (req, res) => {
    try {
      const { id } = req.params;
      // Accept both position_id/department_id and position/department for compatibility
      const name = req.body.name;
      const email = req.body.email;
      const password = req.body.password;
      // Prefer position_id/department_id if present, else fallback to position/department
      // Handle empty strings and null values properly
      const position = req.body.position_id !== undefined ? 
        (req.body.position_id && req.body.position_id.trim() !== '' ? req.body.position_id : null) : 
        (req.body.position && req.body.position.trim() !== '' ? req.body.position : null);
      const department = req.body.department_id !== undefined ? 
        (req.body.department_id && req.body.department_id.trim() !== '' ? req.body.department_id : null) : 
        (req.body.department && req.body.department.trim() !== '' ? req.body.department : null);
      const userRepo = AppDataSource.getRepository('User');
      const adminRepo = AppDataSource.getRepository('User'); // Admin users are stored in User table
      const superadminRepo = AppDataSource.getRepository('User'); // Superadmin users are also stored in User table
      const departmentRepo = AppDataSource.getRepository('Department');
      const positionRepo = AppDataSource.getRepository('Position');

      // Find user in unified User table
      const profile = await userRepo.findOne({ where: { id } });
      if (!profile) {
        return sendNotFound(res, 'User not found');
      }

      const role = profile.Role;

      // Update fields
      if (name !== undefined) profile.name = name;
      if (position !== undefined) profile.position = position;
      if (department !== undefined) profile.department = department;
      if (req.body.gender !== undefined) profile.gender = req.body.gender;
      if (req.body.birthdate !== undefined) profile.dob = req.body.birthdate;
      if (req.body.phone !== undefined) profile.phone_number = req.body.phone;
      if (req.body.startWorkDate !== undefined) profile.start_work = req.body.startWorkDate;
      if (req.body.endWorkDate !== undefined) profile.end_work = req.body.endWorkDate;
      if (req.body.internStartDate !== undefined) profile.start_work = req.body.internStartDate;
      if (req.body.internEndDate !== undefined) profile.end_work = req.body.internEndDate;
      
      // Update email and password in the same record
      if (email !== undefined) profile.Email = email;
      if (password !== undefined) {
        const saltRounds = 10;
        profile.Password = await bcrypt.hash(password, saltRounds);
      }
      
      await userRepo.save(profile);

      // Get department and position names
      let departmentName = '';
      let positionName = '';
      if (profile.department) {
        const deptEntity = await departmentRepo.findOne({ where: { id: profile.department } });
        departmentName = deptEntity ? deptEntity.department_name_th : profile.department;
      }
      if (profile.position) {
        const posEntity = await positionRepo.findOne({ where: { id: profile.position } });
        positionName = posEntity ? posEntity.position_name_th : profile.position;
      }

      sendSuccess(res, {
        id,
        name: profile.name || '',
        email: profile.Email || '',
        password: profile.Password || '',
        position: positionName,
        department: departmentName,
        role,
        usedLeaveDays: null,
        totalLeaveDays: null
      }, 'Employee profile updated successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // Upload avatar for employee/admin/superadmin by ID (admin/superadmin only)
  router.post('/employee/:id/avatar', async (req, res) => {
    try {
      const { id } = req.params;
      const userRepo = AppDataSource.getRepository('User');
      const adminRepo = AppDataSource.getRepository('User'); // Admin users are stored in User table
      const superadminRepo = AppDataSource.getRepository('User'); // Superadmin users are also stored in User table

      // Validate target profile exists
      const profile = await userRepo.findOne({ where: { id } });
      if (!profile) return sendNotFound(res, 'User not found');

      // Handle upload
      avatarUpload.single('avatar')(req, res, async function (err) {
        if (err) return handleUploadError(err, req, res, () => {});
        if (!req.file) return sendError(res, 'No file uploaded', 400);
        try {
          const avatarUrl = `/uploads/avatars/${req.file.filename}`;
          // HARD DELETE old avatar file if any
          if (profile.avatar_url) {
            try {
              const oldPath = require('path').join(config.getAvatarsUploadPath(), require('path').basename(profile.avatar_url));
              
              if (fs.existsSync(oldPath)) {
                // Force delete the old avatar file (hard delete)
                fs.unlinkSync(oldPath);
                
                // Verify file is actually deleted
                if (!fs.existsSync(oldPath)) {
                  console.log(`✅ HARD DELETED old avatar: ${require('path').basename(profile.avatar_url)}`);
                } else {
                  console.error(`❌ FAILED to delete old avatar: ${require('path').basename(profile.avatar_url)} - file still exists`);
                  
                  // Try alternative deletion method
                  try {
                    fs.rmSync(oldPath, { force: true });
                    console.log(`✅ Force deleted old avatar: ${require('path').basename(profile.avatar_url)}`);
                  } catch (forceDeleteError) {
                    console.error(`❌ Force delete also failed for old avatar: ${require('path').basename(profile.avatar_url)}:`, forceDeleteError.message);
                  }
                }
              } else {
                console.log(`⚠️  Old avatar file not found (already deleted?): ${require('path').basename(profile.avatar_url)}`);
              }
            } catch (avatarDeleteError) {
              console.error(`❌ Error deleting old avatar file ${require('path').basename(profile.avatar_url)}:`, avatarDeleteError.message);
              
              // Try alternative deletion method
              try {
                const oldPath = require('path').join(config.getAvatarsUploadPath(), require('path').basename(profile.avatar_url));
                fs.rmSync(oldPath, { force: true });
                console.log(`✅ Force deleted old avatar: ${require('path').basename(profile.avatar_url)}`);
              } catch (forceDeleteError) {
                console.error(`❌ Force delete also failed for old avatar: ${require('path').basename(profile.avatar_url)}:`, forceDeleteError.message);
              }
            }
          }
          profile.avatar_url = avatarUrl;
          await userRepo.save(profile);
          return sendSuccess(res, { avatar_url: avatarUrl }, 'Avatar uploaded successfully');
        } catch (updateErr) {
          if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return sendError(res, 'Failed to update avatar URL', 500);
        }
      });
    } catch (err) {
      return sendError(res, err.message || 'Upload failed', 500);
    }
  });

  // GET /employee/:id/leave-history - Filter leave history by type, month, year, status
  router.get('/employee/:id/leave-history', async (req, res) => {
    try {
      const { id } = req.params;
      const { leaveType, month, year, status, page = 1, limit = config.pagination.defaultLimit, backdated } = req.query;
      const leaveRepo = AppDataSource.getRepository('LeaveRequest');
      const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
      const userRepo = AppDataSource.getRepository('User');

      // ดึง leave ทั้งหมดของ user/admin
      let leaves = await leaveRepo.find({ where: { Repid: id }, order: { createdAt: 'DESC' } });

      // Filter ตาม leaveType (ชื่อ หรือ id)
      if (leaveType && leaveType !== 'all') {
        const leaveTypeLower = String(leaveType).trim().toLowerCase();
        leaves = await Promise.all(leaves.map(async (l) => {
          let typeName_th = l.leaveType;
          let typeName_en = l.leaveType;
          if (l.leaveType && l.leaveType.length > 20) {
            // Try multiple approaches to get the leave type (including soft-deleted records)
            let typeObj = null;
            
            // Approach 1: Try using TypeORM withDeleted option
            try {
              const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
              typeObj = await leaveTypeRepo.findOne({
                where: { id: l.leaveType },
                withDeleted: true
              });
            } catch (error) {
              // TypeORM withDeleted failed, continue to raw query
            }
            
            // Approach 2: If that fails, try raw query
            if (!typeObj) {
              try {
                const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
                const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [l.leaveType]);
                typeObj = leaveTypeResult ? leaveTypeResult[0] : null;
              } catch (error) {
                // Raw query failed, typeObj will remain null
              }
            }
            
            if (typeObj) {
              if (typeObj.is_active === false) {
                // Add [DELETED] prefix for inactive/deleted leave types
                const prefix_th = '[ลบ] ';
                const prefix_en = '[DELETED] ';
                typeName_th = prefix_th + (typeObj.leave_type_th || l.leaveType);
                typeName_en = prefix_en + (typeObj.leave_type_en || l.leaveType);
              } else {
                typeName_th = typeObj.leave_type_th || l.leaveType;
                typeName_en = typeObj.leave_type_en || l.leaveType;
              }
            }
          }
          return { ...l, leaveTypeName_th: typeName_th, leaveTypeName_en: typeName_en };
        }));
        leaves = leaves.filter(l => 
          (l.leaveTypeName_th && String(l.leaveTypeName_th).trim().toLowerCase().includes(leaveTypeLower)) ||
          (l.leaveTypeName_en && String(l.leaveTypeName_en).trim().toLowerCase().includes(leaveTypeLower)) ||
          (l.leaveType && String(l.leaveType).trim().toLowerCase().includes(leaveTypeLower))
        );
      }

      // Filter ตามปี/เดือน (month ต้องมี year)
      if (year && year !== 'all') {
        leaves = leaves.filter(l => {
          if (!l.startDate) return false;
          const d = new Date(l.startDate);
          if (isNaN(d.getTime())) return false;
          if (month && month !== 'all') {
            return d.getFullYear() === Number(year) && (d.getMonth() + 1) === Number(month);
          } else {
            return d.getFullYear() === Number(year);
          }
        });
      }

      // Filter ตาม status
      if (status && status !== 'all') {
        leaves = leaves.filter(l => l.status === status);
      }

      // ===== เพิ่ม filter ตาม backdated ก่อนแบ่งหน้า =====
      if (typeof backdated !== 'undefined' && backdated !== 'all') {
        if (backdated === '1') {
          leaves = leaves.filter(l => Number(l.backdated) === 1);
        } else if (backdated === '0') {
          leaves = leaves.filter(l => Number(l.backdated) === 0); // เปลี่ยน logic: ต้องเป็น 0 เท่านั้น
        }
      }

      // ===== เพิ่มส่วนนี้ก่อน paging =====
      const allLeaves = [...leaves];
      const approvedLeaves = allLeaves.filter(l => l.status === 'approved');
      let totalLeaveDays = 0;
      let totalLeaveHours = 0;
             approvedLeaves.forEach(l => {
         if (l.startDate && l.endDate && (!l.startTime || !l.endTime)) {
           const start = new Date(l.startDate);
           const end = new Date(l.endDate);
           let days = calculateDaysBetween(start, end);
           if (days < 0 || isNaN(days)) days = 0;
           // Ensure minimum duration of 1 day for same-day leaves
           if (days === 0 && l.startDate === l.endDate) {
             days = 1;
           }
           totalLeaveDays += days;
         } else if (l.startTime && l.endTime) {
           const [sh, sm] = l.startTime.split(":").map(Number);
           const [eh, em] = l.endTime.split(":").map(Number);
           let start = sh + (sm || 0) / 60;
           let end = eh + (em || 0) / 60;
           let diff = end - start;
           if (diff < 0) diff += 24;
           totalLeaveHours += Math.floor(diff);
         }
       });
      // รวมชั่วโมงเป็นวัน (1 วัน = 9 ชั่วโมง)
               const summaryDays = totalLeaveDays + Math.floor(totalLeaveHours / config.business.workingHoursPerDay);
               const summaryHours = totalLeaveHours % config.business.workingHoursPerDay;
      // ===== จบส่วนที่เพิ่ม =====

      // Apply paging
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;
      const total = leaves.length;
      leaves = leaves.slice(skip, skip + limitNum);

      // Join leaveTypeName
      leaves = await Promise.all(leaves.map(async (l) => {
        let leaveTypeName_th = l.leaveType;
        let leaveTypeName_en = l.leaveType;
        if (l.leaveType && l.leaveType.length > 20) {
          // Try multiple approaches to get the leave type (including soft-deleted records)
          let leaveTypeObj = null;
          
          // Approach 1: Try using TypeORM withDeleted option
          try {
            const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
            leaveTypeObj = await leaveTypeRepo.findOne({
              where: { id: l.leaveType },
              withDeleted: true
            });
          } catch (error) {
            // TypeORM withDeleted failed, continue to raw query
          }
          
          // Approach 2: If that fails, try raw query
          if (!leaveTypeObj) {
            try {
              const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
              const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [l.leaveType]);
              leaveTypeObj = leaveTypeResult ? leaveTypeResult[0] : null;
            } catch (error) {
              // Raw query failed, leaveTypeObj will remain null
            }
          }
          
          if (leaveTypeObj) {
            if (leaveTypeObj.is_active === false) {
              // Add [DELETED] prefix for inactive/deleted leave types
              const prefix_th = '[ลบ] ';
              const prefix_en = '[DELETED] ';
              leaveTypeName_th = prefix_th + (leaveTypeObj.leave_type_th || l.leaveType);
              leaveTypeName_en = prefix_en + (leaveTypeObj.leave_type_en || l.leaveType);
            } else {
              leaveTypeName_th = leaveTypeObj.leave_type_th || l.leaveType;
              leaveTypeName_en = leaveTypeObj.leave_type_en || l.leaveType;
            }
          }
        }
        // --- เพิ่มการคำนวณ duration/durationType ---
        let duration = 0;
        let durationType = 'day';
        let durationHours = 0;
        if (l.startTime && l.endTime) {
          // ลาชั่วโมง
          const [sh, sm] = l.startTime.split(":").map(Number);
          const [eh, em] = l.endTime.split(":").map(Number);
          let start = sh + (sm || 0) / 60;
          let end = eh + (em || 0) / 60;
          let diff = end - start;
          if (diff < 0) diff += 24;
          durationType = 'hour';
          durationHours = Math.floor(diff);
          duration = 0;
        } else if (l.startDate && l.endDate) {
          // ลาวัน
          const start = new Date(l.startDate);
          const end = new Date(l.endDate);
          
          let days = calculateDaysBetween(start, end);
          
          if (days < 0 || isNaN(days)) days = 0;
          // Ensure minimum duration of 1 day for same-day leaves
          if (days === 0 && l.startDate === l.endDate) {
            days = 1;
          }
          
          durationType = 'day';
          duration = days;
          durationHours = 0;
        }
        // --- ส่ง backdated จาก DB เท่านั้น ---
        const backdated = Number(l.backdated);
        return {
          id: l.id,
          leaveType: l.leaveType,
          leaveTypeName_th,
          leaveTypeName_en,
          leaveDate: l.startDate,
          startDate: l.startDate,
          endDate: l.endDate,
          startTime: l.startTime || null,
          endTime: l.endTime || null,
          duration,
          durationType,
          durationHours: durationType === 'hour' ? durationHours : undefined,
          reason: l.reason,
          status: l.status,
          submittedDate: l.createdAt,
          // ส่ง backdated จาก DB เท่านั้น
          backdated,
        };
      }));

      // ===== เพิ่มส่วนนี้: คำนวณวันลาทั้งหมดที่อนุมัติแล้ว (ไม่สน filter) =====
      // Use centralized utility function for leave usage summary
      const { getLeaveUsageSummary } = require('../utils/leaveUtils');
      const leaveUsageSummary = await getLeaveUsageSummary(id, null, AppDataSource);
      
      // Calculate total leave days from all leave types
      const totalLeaveDaysFinal = leaveUsageSummary.reduce((total, item) => {
        return total + item.total_used_days;
      }, 0);
      // ===== จบส่วนเพิ่ม =====

      sendSuccess(res, { 
        data: leaves, 
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        summary: {
          days: summaryDays,
          hours: summaryHours,
                     totalLeaveDays: summaryDays + summaryHours / config.business.workingHoursPerDay, // สำหรับ compat เดิม
        }
      }, 'Leave history retrieved successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  return router;
};
