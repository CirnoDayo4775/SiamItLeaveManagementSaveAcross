const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Between, In } = require('typeorm');
const config = require('../config');
const LineController = require('./LineController');
const { leaveAttachmentsUpload, handleUploadError } = require('../middleware/fileUploadMiddleware');
const {
  verifyToken,
  sendSuccess,
  sendError,
  sendUnauthorized,
  convertToMinutes,
  calculateDaysBetween,
  isWithinWorkingHours,
  sendValidationError,
  sendNotFound,
  parseAttachments
} = require('../utils');

module.exports = (AppDataSource) => {
  const router = express.Router();
  
  // Repositories
  const leaveRepo = AppDataSource.getRepository('LeaveRequest');
  const userRepo = AppDataSource.getRepository('User');
  const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
  const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
  const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');

  // --- Helper Functions ---

  /**
   * Helper: Batch fetch Leave Types to avoid N+1 queries
   */
  const getLeaveTypeMap = async (leaveTypeIds) => {
    if (!leaveTypeIds.length) return {};
    const uniqueIds = [...new Set(leaveTypeIds.filter(Boolean))];
    
    // Try finding by ID first
    const types = await leaveTypeRepo.find({
      where: { id: In(uniqueIds) },
      withDeleted: true
    });

    const map = {};
    types.forEach(t => map[t.id] = t);
    return map;
  };

  /**
   * Helper: Batch fetch Users to avoid N+1 queries
   */
  const getUserMap = async (userIds) => {
    if (!userIds.length) return {};
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    const users = await userRepo.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'name', 'department', 'position', 'lineUserId'] // Select only needed fields
    });
    
    const map = {};
    users.forEach(u => map[u.id] = u);
    return map;
  };

  /**
   * Helper: Complex logic to resolve a single LeaveType entity (ID or Name string)
   */
  const resolveLeaveType = async (identifier) => {
    if (!identifier) return null;
    let entity = null;

    // 1. Try finding by ID with soft-delete
    if (identifier.length > 20) {
      try {
        entity = await leaveTypeRepo.findOne({ where: { id: identifier }, withDeleted: true });
      } catch (e) { /* ignore UUID error */ }

      // 2. Fallback to raw query if TypeORM fails (legacy data issues)
      if (!entity) {
        try {
          const [result] = await AppDataSource.query(`SELECT * FROM leave_type WHERE id = ?`, [identifier]);
          if (result) entity = result;
        } catch (e) { /* ignore */ }
      }
    }

    // 3. Fallback to name search
    if (!entity) {
      entity = await leaveTypeRepo.findOne({
        where: [{ leave_type_th: identifier }, { leave_type_en: identifier }]
      });
    }

    return entity;
  };

  /**
   * Helper: Get formatted leave type names
   */
  const formatLeaveTypeNames = (leaveTypeObj, fallbackId) => {
    if (!leaveTypeObj) {
      return {
        th: `Deleted Leave Type (${fallbackId})`,
        en: `Deleted Leave Type (${fallbackId})`
      };
    }
    const isInactive = leaveTypeObj.deleted_at || leaveTypeObj.is_active === false;
    const prefixTh = isInactive ? '[ลบ] ' : '';
    const prefixEn = isInactive ? '[DELETED] ' : '';
    
    return {
      th: prefixTh + (leaveTypeObj.leave_type_th || fallbackId),
      en: prefixEn + (leaveTypeObj.leave_type_en || fallbackId)
    };
  };

  /**
   * Helper: Calculate duration (Days/Hours)
   */
  const calculateDurationDetails = (leave) => {
    let duration = 0;
    let durationType = 'day';
    let durationHours = 0;

    if (leave.startTime && leave.endTime) {
      // Hour based
      const [sh, sm] = leave.startTime.split(':').map(Number);
      const [eh, em] = leave.endTime.split(':').map(Number);
      let start = sh + (sm || 0) / 60;
      let end = eh + (em || 0) / 60;
      let diff = end - start;
      if (diff < 0) diff += 24;
      
      durationType = 'hour';
      duration = 0;
      durationHours = diff; // Float
    } else if (leave.startDate && leave.endDate) {
      // Day based
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const days = calculateDaysBetween(start, end);
      
      durationType = 'day';
      duration = (days < 0 || isNaN(days)) ? 0 : days;
      durationHours = 0;
    }

    // Normalize hours to days for quota calculation
    let calculatedDays = duration;
    let calculatedHours = Math.floor(durationHours);
    
    if (calculatedHours >= config.business.workingHoursPerDay) {
      calculatedDays += Math.floor(calculatedHours / config.business.workingHoursPerDay);
      calculatedHours = calculatedHours % config.business.workingHoursPerDay;
    }

    return { durationType, duration, durationHours, calculatedDays, calculatedHours };
  };

  /**
   * Helper: Update LeaveUsed table
   */
  const updateLeaveUsed = async (leave) => {
    try {
      const leaveTypeEntity = await resolveLeaveType(leave.leaveType);
      if (!leaveTypeEntity) {
        console.error('Leave type not found for updating quota:', leave.id);
        return;
      }

      const { calculatedDays, calculatedHours } = calculateDurationDetails(leave);

      if (calculatedDays === 0 && calculatedHours === 0) return;

      const existingRecord = await leaveUsedRepo.findOne({
        where: { user_id: leave.Repid, leave_type_id: leaveTypeEntity.id }
      });

      if (existingRecord) {
        existingRecord.days = (existingRecord.days || 0) + calculatedDays;
        existingRecord.hour = (existingRecord.hour || 0) + calculatedHours;
        existingRecord.updated_at = new Date();
        await leaveUsedRepo.save(existingRecord);
      } else {
        const newRecord = leaveUsedRepo.create({
          user_id: leave.Repid,
          leave_type_id: leaveTypeEntity.id,
          days: calculatedDays,
          hour: calculatedHours
        });
        await leaveUsedRepo.save(newRecord);
      }
    } catch (error) {
      console.error('Error updating LeaveUsed table:', error);
    }
  };

  /**
   * Helper: Delete attachments safely
   */
  const deleteAttachments = (attachmentsJson) => {
    if (!attachmentsJson) return;
    const files = parseAttachments(attachmentsJson);
    const uploadPath = config.getLeaveUploadsPath();

    files.forEach(file => {
      const filePath = path.join(uploadPath, file);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true }); // Fallback
        }
      } catch (e) {
        console.error(`Error deleting file ${file}:`, e.message);
      }
    });
  };

  /**
   * Helper: Parse Date (YYYY-MM-DD) to Date Object
   */
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  /**
   * Helper: Send LINE Notification
   */
  const sendLineNotification = async (leave, status, approverName, rejectedReason) => {
    try {
      const user = await userRepo.findOneBy({ id: leave.Repid });
      if (!user || !user.lineUserId) return;

      const leaveTypeEntity = await resolveLeaveType(leave.leaveType);
      const { th, en } = formatLeaveTypeNames(leaveTypeEntity, leave.leaveType);
      const leaveTypeNameDisplay = (en && en !== th) ? `${th} (${en})` : th;

      const startDate = new Date(leave.startDate).toLocaleDateString('th-TH');
      const endDate = new Date(leave.endDate).toLocaleDateString('th-TH');
      const currentTime = new Date().toLocaleString('th-TH');

      let message = '';
      if (status === 'approved') {
        message = `✅ คำขอการลาได้รับการอนุมัติ!\n📋 ${leaveTypeNameDisplay}\n📅 ${startDate} - ${endDate}\n👤 โดย: ${approverName}\n⏰ ${currentTime}`;
      } else if (status === 'rejected') {
        message = `❌ คำขอการลาถูกปฏิเสธ\n📋 ${leaveTypeNameDisplay}\n📅 ${startDate} - ${endDate}\n👤 โดย: ${approverName}\n⏰ ${currentTime}`;
        if (rejectedReason) message += `\n📝 เหตุผล: ${rejectedReason}`;
      }

      await LineController.sendNotification(user.lineUserId, message);
    } catch (error) {
      console.error('Error sending LINE notification:', error);
    }
  };

  // --- Routes ---

  // POST /api/leave-request
 router.post('/',
    (req, res, next) => {
      leaveAttachmentsUpload.array('attachments', 10)(req, res, (err) => {
        if (err) return handleUploadError(err, req, res, next);
        next();
      });
    },
    async (req, res) => {
      // ใช้ QueryRunner เพื่อทำ Transaction (สำคัญมากสำหรับการตัดโควต้า)
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const uploadedFiles = req.files || [];

      try {
        // --- 1. Auth & Data Prep (Strict Check) ---
        let userId = null;
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
           return sendUnauthorized(res, 'Authorization token is required');
        }

        try {
           userId = verifyToken(authHeader.split(' ')[1]).userId;
        } catch (err) { 
           return sendUnauthorized(res, 'Invalid token'); 
        }

        // ดึงข้อมูล User ผ่าน Transaction Manager
        const user = await queryRunner.manager.findOne('User', { where: { id: userId } });
        if (!user) throw new Error('User not found');
        
        const employeeType = user.position;
        const { leaveType, startDate, endDate, startTime, endTime, reason, supervisor, contact, durationType } = req.body;

        // --- 2. Calculate Duration (คำนวณวัน/ชั่วโมงที่ขอก่อน เพื่อไปเช็คโควต้า) ---
        let reqDays = 0;
        let reqHours = 0;

        if (durationType === 'hour' && startTime && endTime) {
           // คำนวณชั่วโมง
           const [sh, sm] = startTime.split(':').map(Number);
           const [eh, em] = endTime.split(':').map(Number);
           let diff = (eh * 60 + em) - (sh * 60 + sm);
           if (diff < 0) diff += 24 * 60; // กรณีข้ามเที่ยงคืน (ถ้ามี)
           reqHours = diff / 60;
        } else {
           // คำนวณวัน
           const start = new Date(startDate);
           const end = new Date(endDate);
           reqDays = calculateDaysBetween(start, end); // สมมติว่ามี function นี้ใน utils
           if (reqDays <= 0) reqDays = 1; // ลาอย่างน้อย 1 วัน
        }

        // --- 3. Resolve Leave Type & Quota Validation (Critical) ---
        const leaveTypeEntity = await resolveLeaveType(leaveType);
        if (!leaveTypeEntity) throw new Error('Invalid Leave Type');

        // ข้ามการเช็คโควต้าถ้าเป็น "Emergency" (หรือตาม Business Logic)
        if (leaveTypeEntity.leave_type_en !== 'Emergency') {
          // 3.1 ดึง Quota (Lock row เพื่อป้องกันการแย่งกันอ่านค่า)
          const quotaRow = await queryRunner.manager.getRepository('LeaveQuota')
            .createQueryBuilder('quota')
            .setLock('pessimistic_write') // Lock จนกว่าจะจบ Transaction
            .where('quota.positionId = :pid', { pid: employeeType })
            .andWhere('quota.leaveTypeId = :ltid', { ltid: leaveTypeEntity.id })
            .getOne();

          if (!quotaRow) return sendValidationError(res, 'Leave quota not found for this position.');

          // 3.2 ดึงข้อมูลที่ใช้ไปแล้ว (LeaveUsed)
          const usedRow = await queryRunner.manager.findOne('LeaveUsed', { 
            where: { user_id: userId, leave_type_id: leaveTypeEntity.id } 
          });

          const currentUsedDays = usedRow ? usedRow.days : 0;
          const currentUsedHours = usedRow ? usedRow.hour : 0;

          // 3.3 ตรวจสอบว่าพอหรือไม่ (Logic อย่างง่าย: แปลงทุกอย่างเป็นชั่วโมงหรือวันแล้วเทียบ)
          // สมมติ 1 วัน = 8 ชั่วโมง (ดึงจาก config จะดีที่สุด)
          const WORK_HOURS = config.business.workingHoursPerDay || 8;
          
          const totalQuotaUnits = (quotaRow.quota || 0) * WORK_HOURS; // แปลงเป็นหน่วยย่อยสุด (ชั่วโมง)
          const totalUsedUnits = (currentUsedDays * WORK_HOURS) + currentUsedHours;
          const totalRequestUnits = (reqDays * WORK_HOURS) + reqHours;

          if (totalUsedUnits + totalRequestUnits > totalQuotaUnits) {
             throw new Error(`Quota exceeded. Remaining: ${((totalQuotaUnits - totalUsedUnits)/WORK_HOURS).toFixed(2)} days.`);
          }
        }

        // --- 4. Time & Backdated Validation ---
        if (startTime && endTime) {
           if (startTime === endTime) return sendValidationError(res, 'Start and end time cannot be same');
           const toMins = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
           const startM = toMins(startTime), endM = toMins(endTime);
           const workStart = config.business.workingStartHour * 60;
           const workEnd = config.business.workingEndHour * 60;
           if (startM < workStart || endM > workEnd) return sendValidationError(res, 'Outside working hours');
        }

        let backdated = 0;
        if (startDate) {
          const today = new Date(); today.setHours(0,0,0,0);
          const start = parseLocalDate(startDate);
          if (start && start < today) backdated = 1;
        }

        // FIX: ตัดการรับค่า allowBackdated จาก req.body เพื่อความปลอดภัย
        // ควรเช็คจาก Config หรือ Role ของ User เท่านั้น
        const isBackdatedAllowed = false; // หรือ config.allowBackdated
        if (!isBackdatedAllowed && backdated === 1) {
           // ยกเว้นกรณีฉุกเฉิน หรือเงื่อนไขพิเศษ
           if (leaveTypeEntity.leave_type_en !== 'Emergency') {
              return sendValidationError(res, 'Backdated leave is not allowed');
           }
        }

        // --- 5. Save ---
        const attachmentsArr = uploadedFiles.map(f => f.filename);
        const leaveData = {
          Repid: userId,
          employeeType,
          leaveType: leaveTypeEntity.id, // Save ID strictly
          startDate, endDate,
          startTime: durationType === 'hour' ? startTime : null,
          endTime: durationType === 'hour' ? endTime : null,
          reason, supervisor, contact,
          attachments: attachmentsArr.length ? JSON.stringify(attachmentsArr) : null,
          status: 'pending',
          backdated
        };

        const savedLeave = await queryRunner.manager.save('LeaveRequest', leaveData);

        // Commit Transaction (บันทึกจริง)
        await queryRunner.commitTransaction();

        // --- 6. Socket Notification (ทำหลังจาก Commit สำเร็จ) ---
        if (global.io) {
          const ltName = leaveTypeEntity.leave_type_th || leaveTypeEntity.leave_type_en;
          global.io.to('admin_room').emit('newLeaveRequest', {
            requestId: savedLeave.id,
            userName: user.name,
            leaveType: ltName,
            startDate: savedLeave.startDate,
            endDate: savedLeave.endDate,
            reason: savedLeave.reason,
            employeeId: savedLeave.Repid
          });
        }

        res.status(201).json({ status: 'success', data: savedLeave, message: 'Leave request created' });

      } catch (err) {
        // Rollback Transaction (ยกเลิก Database)
        await queryRunner.rollbackTransaction();

        // Cleanup: ลบไฟล์ที่อัปโหลดไปแล้วทิ้ง เพราะ Save ไม่สำเร็จ
        if (uploadedFiles.length > 0) {
           uploadedFiles.forEach(f => {
              const fs = require('fs');
              const path = require('path');
              try { fs.unlinkSync(f.path); } catch(e) {}
           });
        }

        console.error('Create Leave Error:', err);
        // Security: ส่ง Generic Error หรือ Error ที่ Safe
        const statusCode = err.message.includes('Quota') ? 400 : 500;
        res.status(statusCode).json({ status: 'error', message: err.message });
      } finally {
        await queryRunner.release();
      }
    }
  );

  // Common handler for list endpoints to standardize formatting and avoid N+1
  const processLeaveList = async (leaves) => {
    // 1. Collect IDs
    const leaveTypeIds = leaves.map(l => l.leaveType);
    const userIds = [...leaves.map(l => l.Repid), ...leaves.map(l => l.statusBy)];

    // 2. Batch Fetch
    const [leaveTypeMap, userMap] = await Promise.all([
      getLeaveTypeMap(leaveTypeIds),
      getUserMap(userIds)
    ]);

    // 3. Map Results
    return leaves.map(l => {
      const lt = leaveTypeMap[l.leaveType];
      const names = formatLeaveTypeNames(lt, l.leaveType);
      const user = userMap[l.Repid] || null;
      const approver = userMap[l.statusBy] || null;
      const { duration, durationType } = calculateDurationDetails(l);

      // Construct formatted duration string
      const durationDisplay = durationType === 'hour' 
        ? calculateDurationDetails(l).durationHours.toFixed(2) 
        : duration.toString();

      return {
        id: l.id,
        leaveType: l.leaveType,
        leaveTypeName_th: names.th,
        leaveTypeName_en: names.en,
        startDate: l.startDate,
        endDate: l.endDate,
        startTime: l.startTime,
        endTime: l.endTime,
        duration: durationDisplay,
        durationType,
        reason: l.reason,
        status: l.status,
        submittedDate: l.createdAt,
        user: user ? { name: user.name, department: user.department, position: user.position } : null,
        approvedBy: l.status === 'approved' && approver ? approver.name : null,
        rejectedBy: l.status === 'rejected' && approver ? approver.name : null,
        rejectionReason: l.rejectedReason,
        attachments: parseAttachments(l.attachments),
        backdated: Number(l.backdated),
        contact: l.contact
      };
    });
  };

  // GET /api/leave-request/pending
  router.get('/pending', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || config.pagination.defaultLimit;
      const skip = (page - 1) * limit;

      let where = { status: 'pending' };
      
      // Basic Filters
      if (req.query.leaveType) where.leaveType = req.query.leaveType;
      
      // Date Filters (Simplified)
      if (req.query.month && req.query.year) {
        const m = parseInt(req.query.month), y = parseInt(req.query.year);
        where.createdAt = Between(new Date(y, m-1, 1), new Date(y, m, 0, 23, 59, 59));
      } else if (req.query.year) {
        const y = parseInt(req.query.year);
        where.createdAt = Between(new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59));
      }

      if (req.query.backdated) where.backdated = req.query.backdated === '1' ? 1 : 0;

      const [leaves, total] = await Promise.all([
        leaveRepo.find({ where, order: { createdAt: 'DESC' }, skip, take: limit }),
        leaveRepo.count({ where })
      ]);

      const data = await processLeaveList(leaves);
      res.json({ status: 'success', data, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // GET /api/leave-request/history
  router.get('/history', async (req, res) => {
    try {
      const { userId, status, month, year, leaveType, backdated } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || config.pagination.defaultLimit;
      
      let where = {};
      if (userId) where.Repid = userId;
      
      // Status Filter
      if (status) {
        where.status = status.includes(',') ? In(status.split(',')) : status;
      } else {
        where.status = In(['approved', 'rejected', 'pending']);
      }

      // Date Filter
      if (month && year) {
        const m = parseInt(month), y = parseInt(year);
        where.createdAt = Between(new Date(y, m-1, 1), new Date(y, m, 0, 23, 59, 59));
      } else if (year) {
        const y = parseInt(year);
        where.createdAt = Between(new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59));
      }

      if (leaveType) where.leaveType = leaveType;
      if (backdated) where.backdated = backdated === '1' ? 1 : 0;

      const [leaves, total] = await Promise.all([
        leaveRepo.find({ where, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit }),
        leaveRepo.count({ where })
      ]);

      // Count stats efficiently
      const [approvedCount, rejectedCount] = await Promise.all([
        leaveRepo.count({ where: { ...where, status: 'approved' } }),
        leaveRepo.count({ where: { ...where, status: 'rejected' } })
      ]);

      const data = await processLeaveList(leaves);
      
      res.json({ 
        status: 'success', data, total, 
        page, totalPages: Math.ceil(total / limit),
        approvedCount, rejectedCount 
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // GET /api/leave-request/detail/:id
  router.get('/detail/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const leave = await leaveRepo.findOneBy({ id });
      if (!leave) return res.status(404).json({ success: false, message: 'Not found' });

      // Use the processor to format data consistently
      const processed = await processLeaveList([leave]);
      res.json({ success: true, data: processed[0] });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // PUT /api/leave-request/:id (Update)
  router.put('/:id', leaveAttachmentsUpload.array('attachments', 10), async (req, res) => {
    try {
      const { id } = req.params;
      const leave = await leaveRepo.findOneBy({ id });
      if (!leave) return res.status(404).json({ success: false, message: 'Not found' });

      // Validation: Cannot edit past leave
      const now = new Date(); now.setHours(0,0,0,0);
      const start = leave.startDate ? new Date(leave.startDate) : null;
      if (start && start <= now) return res.status(400).json({ success: false, message: 'Cannot edit started leave' });

      // Update fields
      const fields = ['leaveType', 'personalLeaveType', 'startDate', 'endDate', 'startTime', 'endTime', 'reason', 'supervisor', 'contact'];
      fields.forEach(f => { if (req.body[f] !== undefined) leave[f] = req.body[f]; });

      // Recalculate backdated
      if (req.body.startDate) {
        const s = parseLocalDate(req.body.startDate);
        leave.backdated = (s && s < now) ? 1 : 0;
      }

      // Attachments
      if (req.files && req.files.length) {
        leave.attachments = JSON.stringify(req.files.map(f => f.filename));
      }

      await leaveRepo.save(leave);
      res.json({ success: true, data: leave, message: 'Updated' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // PUT /api/leave-request/:id/status (Approve/Reject)
  router.put('/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      // FIX 1: ตัด statusby ออกจาก body ไม่ให้ส่งมาหลอกระบบ
      const { status, rejectedReason } = req.body; 
      
      let approverId;

      // FIX 1 (ต่อ): บังคับดึง ID จาก Token เท่านั้น
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = verifyToken(authHeader.split(' ')[1]);
          approverId = decoded.userId;
          // (Optional) ตรงนี้คุณควรเช็ค Role ด้วยว่า approverId เป็น Admin หรือ Supervisor หรือไม่
        } catch (e) { 
          return sendUnauthorized(res, 'Invalid Token'); 
        }
      } else {
        return sendUnauthorized(res, 'Authorization token is required');
      }

      // FIX 2: Validate ค่า status ป้องกันการส่งค่ามั่วๆ
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status. Must be approved or rejected.' });
      }

      const leave = await leaveRepo.findOneBy({ id });
      if (!leave) return res.status(404).json({ success: false, message: 'Leave request not found' });

      // FIX 3: ป้องกันการอนุมัติให้ตัวเอง (Self-Approval Prevention)
      if (leave.Repid === approverId) {
        return res.status(403).json({ success: false, message: 'You cannot approve/reject your own leave request.' });
      }

      // ตรวจสอบว่าใบลาถูกดำเนินการไปแล้วหรือยัง (Optional but recommended)
      if (leave.status === 'approved' || leave.status === 'rejected') {
         return res.status(400).json({ success: false, message: 'This request has already been processed.' });
      }

      // --- Logic การบันทึก (เหมือนเดิม) ---
      leave.status = status;
      leave.statusBy = approverId;
      leave.statusChangeTime = new Date();
      
      if (status === 'approved') {
        leave.approvedTime = new Date();
        await updateLeaveUsed(leave); // ฟังก์ชันคำนวณโควต้า
      } else if (status === 'rejected') {
        leave.rejectedTime = new Date();
        leave.rejectedReason = rejectedReason;
      }

      await leaveRepo.save(leave);

      // --- Notifications (เหมือนเดิม) ---
      if (global.io) {
        const msg = status === 'approved' ? 'Your leave request has been approved' : 'Your leave request has been rejected';
        // แจ้งเตือน User เจ้าของใบลา
        global.io.to(`user_${leave.Repid}`).emit('leaveRequestUpdated', {
          requestId: leave.id, status, statusBy: approverId, employeeId: leave.Repid, message: msg
        });
        // แจ้งเตือน Admin Room
        global.io.to('admin_room').emit('leaveRequestStatusChanged', {
          requestId: leave.id, status, employeeId: leave.Repid, statusBy: approverId
        });
      }

      // LINE Notification
      const approver = await userRepo.findOneBy({ id: approverId });
      // ส่งการแจ้งเตือนกลับหา User ว่าได้รับการอนุมัติ/ปฏิเสธแล้ว
      await sendLineNotification(leave, status, approver ? approver.name : 'System', rejectedReason);

      res.json({ success: true, data: leave });

    } catch (err) {
      // FIX 4: Log Error จริงไว้ดูเอง แต่ส่งข้อความทั่วไปให้ User เพื่อความปลอดภัย
      console.error('Error in update status:', err); 
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  });

  // DELETE /api/leave-request/:id
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const leave = await leaveRepo.findOneBy({ id });
      if (!leave) return res.status(404).json({ success: false, message: 'Not found' });

      // Revert quota if approved
      if (leave.status === 'approved') {
        try {
          const leaveTypeEntity = await resolveLeaveType(leave.leaveType);
          if (leaveTypeEntity) {
             const { calculatedDays, calculatedHours } = calculateDurationDetails(leave);
             const used = await leaveUsedRepo.findOne({ where: { user_id: leave.Repid, leave_type_id: leaveTypeEntity.id } });
             if (used) {
               used.days = Math.max(0, (used.days || 0) - calculatedDays);
               used.hour = Math.max(0, (used.hour || 0) - calculatedHours);
               await leaveUsedRepo.save(used);
             }
          }
        } catch (e) { console.error('Error reverting quota:', e); }
      }

      // Delete files
      deleteAttachments(leave.attachments);

      await leaveRepo.delete({ id });
      res.json({ success: true, message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/leave-request/calendar/:year
  router.get('/calendar/:year', async (req, res) => {
    try {
      const { year } = req.params;
      const { month } = req.query;
      
      let start, end;
      if (month) {
        start = new Date(parseInt(year), parseInt(month) - 1, 1);
        end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      } else {
        start = new Date(parseInt(year), 0, 1);
        end = new Date(parseInt(year), 11, 31, 23, 59, 59);
      }

      const where = { status: 'approved', startDate: Between(start, end) };
      
      // User role check
      if (req.headers.authorization) {
        const { userId, role } = verifyToken(req.headers.authorization.split(' ')[1]);
        if (role === 'user') where.Repid = userId;
      }

      const leaves = await leaveRepo.find({ where, order: { startDate: 'ASC' } });
      const data = await processLeaveList(leaves); // Reuse the batch processor

      res.json({ status: 'success', data, message: 'Calendar data fetched' });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // GET /api/leave-request/dashboard-stats
  router.get('/dashboard-stats', async (req, res) => {
    try {
      const { month, year } = req.query;
      let dateFilter = {};
      
      if (month && year) {
        const m = parseInt(month), y = parseInt(year);
        dateFilter = { createdAt: Between(new Date(y, m-1, 1), new Date(y, m, 0, 23, 59, 59)) };
      } else if (year) {
        const y = parseInt(year);
        dateFilter = { createdAt: Between(new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59)) };
      }

      // Parallel queries for performance
      const [pendingCount, approvedCount, rejectedCount, allLeaves] = await Promise.all([
        leaveRepo.count({ where: { status: 'pending', ...dateFilter } }),
        leaveRepo.count({ where: { status: 'approved', ...dateFilter } }),
        leaveRepo.count({ where: { status: 'rejected', ...dateFilter } }),
        leaveRepo.find({ where: dateFilter, select: ['Repid', 'status', 'startDate', 'endDate'] })
      ]);

      const userCount = new Set(allLeaves.map(l => l.Repid)).size;
      
      // Calculate avg days
      const approved = allLeaves.filter(l => l.status === 'approved');
      let avgDays = 0;
      if (approved.length) {
        const totalDays = approved.reduce((sum, l) => {
          const days = calculateDaysBetween(new Date(l.startDate), new Date(l.endDate));
          return sum + (days > 0 ? days : 0);
        }, 0);
        avgDays = parseFloat((totalDays / approved.length).toFixed(1));
      }

      res.json({
        status: 'success',
        data: { pendingCount, approvedCount, rejectedCount, userCount, averageDayOff: avgDays }
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // GET /api/leave-request/my
  router.get('/my', async (req, res) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const { userId } = verifyToken(token);
      const leaves = await leaveRepo.find({ where: { Repid: userId }, order: { createdAt: 'DESC' } });
      const data = await processLeaveList(leaves);
      res.json({ status: 'success', data });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // GET /api/leave-request/user/:id
  router.get('/user/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || config.pagination.defaultLimit;
      
      const [leaves, total] = await Promise.all([
        leaveRepo.find({ where: { Repid: id }, order: { createdAt: 'DESC' }, skip: (page-1)*limit, take: limit }),
        leaveRepo.count({ where: { Repid: id } })
      ]);

      const data = await processLeaveList(leaves);
      res.json({ status: 'success', data, total, page, totalPages: Math.ceil(total/limit) });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // POST /api/leave-request/admin (Create for others)
  router.post('/admin', leaveAttachmentsUpload.array('attachments', 10), async (req, res) => {
    try {
      // Admin check logic...
      const { repid, leaveType, durationType, startDate, endDate, startTime, endTime, reason, contact, approvalStatus, approverId } = req.body;
      
      if (!repid || !leaveType) return sendValidationError(res, 'Missing fields');

      const targetUser = await userRepo.findOneBy({ id: repid });
      if (!targetUser) return sendNotFound(res, 'User not found');

      const leaveTypeEntity = await resolveLeaveType(leaveType);
      if (!leaveTypeEntity) return sendNotFound(res, 'Leave type not found');

      const attachmentsArr = req.files ? req.files.map(f => f.filename) : [];
      
      // Basic Backdate check
      let backdated = 0;
      if (startDate) {
         const s = parseLocalDate(startDate);
         if (s && s < new Date().setHours(0,0,0,0)) backdated = 1;
      }

      const leaveData = {
        Repid: repid,
        employeeType: targetUser.position,
        leaveType: leaveTypeEntity.id,
        startDate, endDate, startTime, endTime, reason, contact,
        status: approvalStatus,
        approverId,
        backdated,
        attachments: attachmentsArr.length ? JSON.stringify(attachmentsArr) : null
      };

      const saved = await leaveRepo.save(leaveRepo.create(leaveData));
      
      if (approvalStatus === 'approved') {
        await updateLeaveUsed(saved);
      }

      res.json({ success: true, message: 'Created', data: saved });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};