   // Backend/api/LeaveRequestController.js
   const express = require('express');
   const fs = require('fs');
   const path = require('path');
   const jwt = require('jsonwebtoken');
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
    convertTimeRangeToDecimal,
    isWithinWorkingHours,
    sendValidationError,
    sendNotFound,
    sendConflict,
    parseAttachments
  } = require('../utils');

  // File upload middleware is now imported from fileUploadMiddleware.js
  // parseAttachments function is now imported from ../utils

   // Helper function to update LeaveUsed table (only for approved requests)
   async function updateLeaveUsed(leave) {
     try {
       const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');
       const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
    
       
       
               // Get leave type entity
        let leaveTypeEntity = null;
        if (leave.leaveType && leave.leaveType.length > 20) {
          // Try multiple approaches to get the leave type
          try {
            // Approach 1: Try with withDeleted option
            leaveTypeEntity = await leaveTypeRepo.findOne({
              where: { id: leave.leaveType },
              withDeleted: true
            });
          } catch (error) {
            // TypeORM withDeleted failed, continue to raw query
          }
          
          // Approach 2: If that fails, try raw query
          if (!leaveTypeEntity) {
            try {
              const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
              const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leave.leaveType]);
              if (leaveTypeResult && leaveTypeResult[0]) {
                leaveTypeEntity = leaveTypeResult[0];
              }
            } catch (error) {
              // Raw query failed, leaveTypeEntity will remain null
            }
          }
        } else {
          leaveTypeEntity = await leaveTypeRepo.findOne({
            where: [
              { leave_type_th: leave.leaveType },
              { leave_type_en: leave.leaveType }
            ]
          });
        }

       if (!leaveTypeEntity) {
         console.error('Leave type not found for leave request:', leave.id);
         return;
       }

       // Calculate days/hours
       let days = 0;
       let hours = 0;

               // Check if this leave type supports time-based calculation
        // Instead of hard-coding specific leave types, we'll check if both startTime and endTime are provided
        const isTimeBased = leave.startTime && leave.endTime;

               if (isTimeBased) {
          // Hour-based calculation for any leave type that has start/end times
          const startMinutes = convertToMinutes(...leave.startTime.split(':').map(Number));
          const endMinutes = convertToMinutes(...leave.endTime.split(':').map(Number));
          let durationHours = (endMinutes - startMinutes) / 60;
          if (durationHours < 0 || isNaN(durationHours)) durationHours = 0;
          hours = durationHours;
        } else if (leave.startDate && leave.endDate) {
         // Day-based calculation
         const start = new Date(leave.startDate);
         const end = new Date(leave.endDate);
         let calculatedDays = calculateDaysBetween(start, end);
         if (calculatedDays < 0 || isNaN(calculatedDays)) calculatedDays = 0;
         days = calculatedDays;
       }

       // Skip if no days or hours
       if (days === 0 && hours === 0) {
         console.log('No days or hours to update for leave request:', leave.id);
         return;
       }

       // Convert 9 hours to 1 day
       let finalDays = days;
       let finalHours = hours;
       
       if (hours >= config.business.workingHoursPerDay) {
         const additionalDays = Math.floor(hours / config.business.workingHoursPerDay);
         finalDays += additionalDays;
         finalHours = hours % config.business.workingHoursPerDay;
         console.log(`Converted ${hours} hours to ${additionalDays} days + ${finalHours} hours for leave request:`, leave.id);
       }

       // Find existing record
       const existingRecord = await leaveUsedRepo.findOne({
         where: { 
           user_id: leave.Repid, 
           leave_type_id: leaveTypeEntity.id 
         }
       });

       // Add to LeaveUsed table
       if (existingRecord) {
         existingRecord.days = (existingRecord.days || 0) + finalDays;
         existingRecord.hour = (existingRecord.hour || 0) + finalHours;
         existingRecord.updated_at = new Date();
         await leaveUsedRepo.save(existingRecord);
         console.log('Updated LeaveUsed record for user:', leave.Repid, 'leave type:', leaveTypeEntity.leave_type_th, `(${finalDays} days, ${finalHours} hours)`);
       } else {
         const newRecord = leaveUsedRepo.create({
           user_id: leave.Repid,
           leave_type_id: leaveTypeEntity.id,
           days: finalDays,
           hour: finalHours
         });
         await leaveUsedRepo.save(newRecord);
         console.log('Created new LeaveUsed record for user:', leave.Repid, 'leave type:', leaveTypeEntity.leave_type_th, `(${finalDays} days, ${finalHours} hours)`);
       }
     } catch (error) {
       console.error('Error updating LeaveUsed table:', error);
       // Don't fail the main request if LeaveUsed update fails
     }
   }

   // ใช้ฟังก์ชันแปลงวันที่ให้เป็น Local Time (แก้บัค -1 วัน)
   function parseLocalDate(dateStr) {
     if (!dateStr) return null;
     // dateStr: 'YYYY-MM-DD'
     const [year, month, day] = dateStr.split('-').map(Number);
     return new Date(year, month - 1, day);
   }

     // Function to send LINE notification when leave request status changes
  async function sendLineNotification(leave, status, approverName, rejectedReason) {
    try {
      // Get the user's LINE user ID from unified User table
      const userRepo = AppDataSource.getRepository('User');
      const user = await userRepo.findOneBy({ id: leave.Repid });
      
      console.log('=== LINE Notification Database Debug ===');
      console.log('Leave Repid:', leave.Repid);
      console.log('User found:', !!user);
      if (user) {
        console.log('User lineUserId:', user.lineUserId);
        console.log('User lineUserId type:', typeof user.lineUserId);
        console.log('User lineUserId length:', user.lineUserId ? user.lineUserId.length : 0);
      }
      console.log('========================================');
      
      if (!user || !user.lineUserId) {
        console.log('User not linked to LINE or not found:', leave.Repid);
        return; // User not linked to LINE
      }

             // Get the leave type name from the database
       let leaveTypeData = null;
       
       // Try multiple approaches to get the leave type
       try {
         // Approach 1: Try with withDeleted option
         const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
         leaveTypeData = await leaveTypeRepo.findOne({
           where: { id: leave.leaveType },
           withDeleted: true
         });
       } catch (error) {
         // TypeORM withDeleted failed, continue to raw query
       }
       
       // Approach 2: If that fails, try raw query
       if (!leaveTypeData) {
         try {
           const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
           const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leave.leaveType]);
           if (leaveTypeResult && leaveTypeResult[0]) {
             leaveTypeData = leaveTypeResult[0];
           }
         } catch (error) {
           // Raw query failed, leaveTypeData will remain null
         }
       }
       
       const leaveTypeNameTh = leaveTypeData ? leaveTypeData.leave_type_th : 'Unknown Type';
       const leaveTypeNameEn = leaveTypeData ? leaveTypeData.leave_type_en : 'Unknown Type';
      const leaveTypeNameBilingual = leaveTypeNameEn && leaveTypeNameEn !== leaveTypeNameTh 
        ? `${leaveTypeNameTh} (${leaveTypeNameEn})` 
        : leaveTypeNameTh;

      // Format the notification message (Thai and English)
      let message = '';
      const startDate = new Date(leave.startDate).toLocaleDateString('th-TH');
      const endDate = new Date(leave.endDate).toLocaleDateString('th-TH');
      const currentTime = new Date().toLocaleString('th-TH');
       
       if (status === 'approved') {
         message = `✅ คำขอการลาของคุณได้รับการอนุมัติแล้ว!\n\n` +
                   `📋 ประเภทการลา: ${leaveTypeNameBilingual}\n` +
                   `📅 วันที่: ${startDate} - ${endDate}\n` +
                   `👤 ผู้อนุมัติ: ${approverName}\n` +
                   `⏰ เวลาที่อนุมัติ: ${currentTime}\n\n` +
                   `ขอบคุณที่ใช้ระบบจัดการการลาของเรา!\n\n` +
                   `---\n` +
                   `✅ Your leave request has been approved!\n\n` +
                   `📋 Leave Type: ${leaveTypeNameBilingual}\n` +
                   `📅 Date: ${startDate} - ${endDate}\n` +
                   `👤 Approved by: ${approverName}\n` +
                   `⏰ Approved at: ${currentTime}\n\n` +
                   `Thank you for using our leave management system!`;
       } else if (status === 'rejected') {
         message = `❌ คำขอการลาของคุณไม่ได้รับการอนุมัติ\n\n` +
                   `📋 ประเภทการลา: ${leaveTypeNameBilingual}\n` +
                   `📅 วันที่: ${startDate} - ${endDate}\n` +
                   `👤 ผู้อนุมัติ: ${approverName}\n` +
                   `⏰ เวลาที่ปฏิเสธ: ${currentTime}`;
         
         if (rejectedReason) {
           message += `\n📝 เหตุผล: ${rejectedReason}`;
         }
         
         message += `\n\nหากมีข้อสงสัย กรุณาติดต่อผู้ดูแลระบบ\n\n` +
                   `---\n` +
                   `❌ Your leave request has been rejected\n\n` +
                   `📋 Leave Type: ${leaveTypeNameBilingual}\n` +
                   `📅 Date: ${startDate} - ${endDate}\n` +
                   `👤 Rejected by: ${approverName}\n` +
                   `⏰ Rejected at: ${currentTime}`;
         
         if (rejectedReason) {
           message += `\n📝 Reason: ${rejectedReason}`;
         }
         
         message += `\n\nIf you have any questions, please contact the administrator.`;
       }

      // Send the notification via LINE
      const notificationResult = await LineController.sendNotification(user.lineUserId, message);
      
      if (notificationResult.success) {
        console.log('LINE notification sent successfully to:', user.lineUserId);
      } else {
        console.error('Failed to send LINE notification:', notificationResult.error);
        console.log('LINE user ID:', user.lineUserId);
        console.log('Message length:', message.length);
      }
       
     } catch (error) {
       console.error('Error sending LINE notification:', error);
       throw error;
     }
   }

     // Helper function to get leave type names (always return actual names regardless of active status)
     const getLeaveTypeNames = (leaveTypeObj, fallbackValue, lang = 'th') => {
       if (!leaveTypeObj) {
         // If no leave type object found, return a more descriptive fallback
         return {
           leaveTypeName_th: `Deleted Leave Type (${fallbackValue})`,
           leaveTypeName_en: `Deleted Leave Type (${fallbackValue})`
         };
       }
       
       // Check if this is an inactive/deleted leave type
       const isInactive = leaveTypeObj.deleted_at || leaveTypeObj.is_active === false;
       
       // Always return the actual names from the database, regardless of active status
       let thName = leaveTypeObj.leave_type_th || fallbackValue;
       let enName = leaveTypeObj.leave_type_en || fallbackValue;
       
       // If inactive/deleted, add a prefix to indicate status
       if (isInactive) {
         thName = `[ลบ] ${thName}`;
         enName = `[DELETED] ${enName}`;
       }
       
       return {
         leaveTypeName_th: thName,
         leaveTypeName_en: enName
       };
     };

  module.exports = (AppDataSource) => {
    const router = express.Router();
    
    // Define repositories for unified User table (adminRepo and superadminRepo are now just aliases for User)
    const adminRepo = AppDataSource.getRepository('User');
    const superadminRepo = AppDataSource.getRepository('User');

    // POST /api/leave-request
    // Wrap multer to ensure errors are handled by handleUploadError and returned as JSON
    router.post('/',
      (req, res, next) => {
        // invoke multer and intercept possible errors
        leaveAttachmentsUpload.array('attachments', 10)(req, res, (err) => {
          if (err) {
            return handleUploadError(err, req, res, next);
          }
          next();
        });
      },
      async (req, res) => {
      try {
        const leaveRepo = AppDataSource.getRepository('LeaveRequest');
        let userId = null;
        let role = null;
        // ดึง userId จาก JWT
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          try {
            const decoded = verifyToken(token);
            userId = decoded.userId;
            role = decoded.role;
          } catch (err) {
            return sendUnauthorized(res, 'Invalid or expired token');
          }
        }
        // Language detection removed - frontend will handle i18n
        // ดึงตำแหน่งจาก unified User table
        let employeeType = null;
        if (userId) {
          const userRepo = AppDataSource.getRepository('User');
          const user = await userRepo.findOneBy({ id: userId });
          employeeType = user ? user.position : null;
        }
        const {
          /* employeeType, */ leaveType, personalLeaveType, startDate, endDate,
          startTime, endTime, reason, supervisor, contact, durationType, allowBackdated
        } = req.body;

        // --- Validation: quota ---
        // 1. ดึง quota ของ user
        const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
        const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
        // ดึง leaveType entity
        let leaveTypeEntity = null;
        if (leaveType && leaveType.length > 20) {
          // Try multiple approaches to get the leave type
          try {
            // Approach 1: Try with withDeleted option
            leaveTypeEntity = await leaveTypeRepo.findOne({
              where: { id: leaveType },
              withDeleted: true
            });
          } catch (error) {
            // TypeORM withDeleted failed, continue to raw query
          }
          
          // Approach 2: If that fails, try raw query
          if (!leaveTypeEntity) {
            try {
              const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
              const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leaveType]);
              if (leaveTypeResult && leaveTypeResult[0]) {
                leaveTypeEntity = leaveTypeResult[0];
              }
            } catch (error) {
              // Raw query failed, leaveTypeEntity will remain null
            }
          }
        } else {
          leaveTypeEntity = await leaveTypeRepo.findOne({
            where: [
              { leave_type_th: leaveType },
              { leave_type_en: leaveType }
            ]
          });
        }
        // ถ้าเป็น Emergency Leave ไม่ต้องตรวจสอบ quota
        if (
          leaveTypeEntity &&
          (leaveTypeEntity.leave_type_en === 'Emergency')
        ) {
          // ข้าม validation quota สำหรับ Emergency Leave
        } else {
          // ดึง quota ของ leaveType นี้
          const quotaRow = leaveTypeEntity ? await leaveQuotaRepo.findOne({ where: { positionId: employeeType, leaveTypeId: leaveTypeEntity.id } }) : null;
          if (!quotaRow) {
            return res.status(400).json({ status: 'error', message: 'Leave quota for this type not found.' });
          }
          const quota = quotaRow.quota;
          // 2. คำนวณ leave ที่ใช้ไปในปีนี้ (approved เฉพาะ leaveType นี้)
          const year = (parseLocalDate(startDate)).getFullYear();
          const startOfYear = new Date(year, 0, 1);
          const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
          const { Between } = require('typeorm');
          const approvedLeaves = await leaveRepo.find({
            where: {
              Repid: userId,
              status: 'approved',
              startDate: Between(startOfYear, endOfYear)
            }
          });
          // 3. คำนวณ leave ที่ใช้ไป (approved) ในปีนี้ (ชั่วโมง เฉพาะ leaveType นี้)
          let usedHours = 0;
          // Using utility function instead of local function
          for (const lr of approvedLeaves) {
                         let leaveTypeName = lr.leaveType;
             if (leaveTypeName && leaveTypeName.length > 20) {
               // Try multiple approaches to get the leave type
               let leaveTypeEntity2 = null;
               
               try {
                 // Approach 1: Try with withDeleted option
                 leaveTypeEntity2 = await leaveTypeRepo.findOne({
                   where: { id: leaveTypeName },
                   withDeleted: true
                 });
               } catch (error) {
                 // TypeORM withDeleted failed, continue to raw query
               }
               
               // Approach 2: If that fails, try raw query
               if (!leaveTypeEntity2) {
                 try {
                   const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
                   const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leaveTypeName]);
                   if (leaveTypeResult && leaveTypeResult[0]) {
                     leaveTypeEntity2 = leaveTypeResult[0];
                   }
                 } catch (error) {
                   // Raw query failed, leaveTypeEntity2 will remain null
                 }
               }
               
               if (leaveTypeEntity2 && leaveTypeEntity2.leave_type_th) {
                 leaveTypeName = leaveTypeEntity2.leave_type_th;
               }
             }
            // เฉพาะ leaveType นี้เท่านั้น
            if (
              leaveTypeName === leaveTypeEntity.leave_type_th ||
              leaveTypeName === leaveTypeEntity.leave_type_en
            ) {
                              // Check if this leave type supports time-based calculation
               // Instead of hard-coding specific leave types, we'll check if both startTime and endTime are provided
               const isTimeBased = lr.startTime && lr.endTime;
              
              if (isTimeBased) {
                // Time-based leave types: can be hours or days
                if (lr.startTime && lr.endTime) {
                  const startMinutes = convertToMinutes(...lr.startTime.split(':').map(Number));
                  const endMinutes = convertToMinutes(...lr.endTime.split(':').map(Number));
                  let durationHours = (endMinutes - startMinutes) / 60;
                  if (durationHours < 0 || isNaN(durationHours)) durationHours = 0;
                  usedHours += durationHours;
                } else if (lr.startDate && lr.endDate) {
                  const start = new Date(lr.startDate);
                  const end = new Date(lr.endDate);
                  let days = calculateDaysBetween(start, end);
                  if (days < 0 || isNaN(days)) days = 0;
                  usedHours += days * config.business.workingHoursPerDay;
                }
              } else {
                // Day-based leave types: only days
                if (lr.startDate && lr.endDate) {
                  const start = new Date(lr.startDate);
                  const end = new Date(lr.endDate);
                  let days = calculateDaysBetween(start, end);
                  if (days < 0 || isNaN(days)) days = 0;
                  usedHours += days * config.business.workingHoursPerDay;
                }
              }
            }
          }
          // 4. คำนวณ leave ที่ขอใหม่ (ชั่วโมง)
          let requestHours = 0;
          // Check if this leave type supports time-based calculation
          // Instead of hard-coding specific leave types, we'll check if both startTime and endTime are provided
          const isTimeBased = startTime && endTime;
          
          if (isTimeBased) {
            // Time-based leave types: can be hours or days
            if (startTime && endTime) {
              const startMinutes = convertToMinutes(...startTime.split(':').map(Number));
              const endMinutes = convertToMinutes(...endTime.split(':').map(Number));
              let durationHours = (endMinutes - startMinutes) / 60;
              if (durationHours < 0 || isNaN(durationHours)) durationHours = 0;
              requestHours += durationHours;
            } else if (startDate && endDate) {
              const start = parseLocalDate(startDate);
              const end = parseLocalDate(endDate);
              let days = calculateDaysBetween(start, end);
              if (days < 0 || isNaN(days)) days = 0;
              requestHours += days * config.business.workingHoursPerDay;
            }
          } else {
            // Day-based leave types: only days
            if (startDate && endDate) {
              const start = parseLocalDate(startDate);
              const end = parseLocalDate(endDate);
              let days = calculateDaysBetween(start, end);
              if (days < 0 || isNaN(days)) days = 0;
              requestHours += days * config.business.workingHoursPerDay;
            }
          }
          // 5. quota (ชั่วโมง)
          const totalQuotaHours = quota * config.business.workingHoursPerDay;
          // 6. ถ้า used + request > quota => reject
          if (usedHours + requestHours > totalQuotaHours) {
            return res.status(400).json({
              status: 'error',
              message: 'You have exceeded your leave quota for this type.',
              code: 'QUOTA_EXCEEDED'
            });
          }
        }

        // ตรวจสอบภาษา
        // const lang = (req.headers['accept-language'] || '').toLowerCase().startsWith('en') ? 'en' : 'th';

        // --- Contact Validation ---
        if (!contact) {
          return res.status(400).json({
            status: 'error',
            message: 'Contact information is required.'
          });
        }

        // ฟังก์ชันตรวจสอบเวลาในช่วง 09:00-18:00
        function isTimeInRange(timeStr) {
          if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) return false;
          const [h, m] = timeStr.split(':').map(Number);
          const minutes = h * 60 + m;
          return minutes >= config.business.workingStartHour * 60 && minutes <= config.business.workingEndHour * 60;
        }
        // ตรวจสอบเฉพาะกรณีมี startTime/endTime
        if (startTime && endTime) {
          if (startTime === endTime) {
            return res.status(400).json({
              status: 'error',
              message: 'Start time and end time must not be the same.'
            });
          }
          if (!isTimeInRange(startTime) || !isTimeInRange(endTime)) {
            return res.status(400).json({
              status: 'error',
              message: `You can request leave only during working hours: ${config.business.workingStartHour}:00 to ${config.business.workingEndHour}:00.`
            });
          }
        }

        const attachmentsArr = req.files ? req.files.map(f => f.filename) : [];
        // Determine if the leave request is backdated
        let backdated = 0; // Default to 0 (not backdated)
        if (startDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const leaveStart = parseLocalDate(startDate);
          if (leaveStart && leaveStart < today) {
            // ถ้าวันลาอยู่ในอดีต (ย้อนหลัง) ให้ backdated = 1
            backdated = 1;
    }
          // ถ้าวันลาเป็นวันปัจจุบันหรืออนาคต ให้ backdated = 0 (ไม่นับเป็นย้อนหลัง)
        }

        // ตรวจสอบการย้อนหลังเมื่อไม่อนุญาต - รองรับทั้งตัวเลขและสตริงเพื่อความเข้ากันได้
        const allowBackdatedValue = allowBackdated === '0' || allowBackdated === 0 || allowBackdated === 'disallow';
        if (allowBackdatedValue && backdated === 1) {
          return res.status(400).json({
            status: 'error',
            message: lang === 'th' 
              ? 'ไม่อนุญาตให้ส่งคำขอลาย้อนหลัง กรุณาเปลี่ยนการตั้งค่าหรือเลือกวันที่ใหม่' 
              : 'Backdated leave is not allowed. Please change settings or select a new date'
          });
        }
        const leaveData = {
          Repid: userId, // ใส่ user_id จาก JWT
          employeeType, // ดึงจาก user.position
          leaveType,
          startDate,
          endDate,
          startTime: durationType === 'hour' ? (startTime || null) : null,
          endTime: durationType === 'hour' ? (endTime || null) : null,
          reason,
          supervisor,
          contact,
          attachments: attachmentsArr.length > 0 ? JSON.stringify(attachmentsArr) : null,
          status: 'pending',
          backdated, // set backdated column
        };

        // เพิ่มข้อมูลลงฐานข้อมูล
        const leave = leaveRepo.create(leaveData);
        const savedLeave = await leaveRepo.save(leave);

        // Emit Socket.io event for real-time notification
        if (global.io) {
          // Get user information for the notification
          let userName = 'Unknown User';
          let leaveTypeName = leaveType;
          
          try {
            // Get user name from unified User table
            const userRepo = AppDataSource.getRepository('User');
            const user = await userRepo.findOneBy({ id: userId });
            userName = user ? user.name : 'Unknown User';
            
                         // Get leave type name
             if (leaveTypeEntity) {
               leaveTypeName = leaveTypeEntity.leave_type_th || leaveTypeEntity.leave_type_en || leaveType;
             } else {
               // Try to get from cache or fallback
               leaveTypeName = leaveType;
             }
          } catch (error) {
            console.error('Error getting user/leave type info for socket emit:', error);
          }
          
          // Emit to admin room for new leave request notification
          global.io.to('admin_room').emit('newLeaveRequest', {
            requestId: savedLeave.id,
            userName: userName,
            leaveType: leaveTypeName,
            startDate: savedLeave.startDate,
            endDate: savedLeave.endDate,
            reason: savedLeave.reason,
            employeeId: savedLeave.Repid
          });
        }

        res.status(201).json({ status: 'success', data: savedLeave, message: 'Leave request created' });
      } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
      }
    });

    // GET /api/leave-request/pending
    router.get('/pending', async (req, res) => {
      try {
        // Language detection removed - frontend will handle i18n
        const leaveRepo = AppDataSource.getRepository('LeaveRequest');
        const userRepo = AppDataSource.getRepository('User');
        const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
        // --- เพิ่ม paging ---
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || config.pagination.defaultLimit;
        const skip = (page - 1) * limit;
        // --- เพิ่ม filter leaveType, startDate, endDate, month, year ---
        const leaveType = req.query.leaveType || null;
        const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
        const month = req.query.month ? parseInt(req.query.month) : null;
        const year = req.query.year ? parseInt(req.query.year) : null;
        let where = { status: 'pending' };
        if (leaveType) {
          const leaveTypeObj = await leaveTypeRepo.findOneBy({ id: leaveType });
          if (leaveTypeObj) {
            where = { ...where, leaveType: leaveTypeObj.id };
          } else {
            where = { ...where, leaveType };
          }
        }
        if (month && year) {
          const { Between } = require('typeorm');
          const startOfMonth = new Date(year, month - 1, 1);
          const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
          where = { ...where, createdAt: Between(startOfMonth, endOfMonth) };
        } else if (year) {
          const { Between } = require('typeorm');
          const startOfYear = new Date(year, 0, 1);
          const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
          where = { ...where, createdAt: Between(startOfYear, endOfYear) };
        }
        // --- ใน /pending ---
        const date = req.query.date ? new Date(req.query.date) : null;
        if (date) {
          const { Between } = require('typeorm');
          const startOfDay = new Date(date);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);
          where = { ...where, createdAt: Between(startOfDay, endOfDay) };
        }
        // --- เพิ่ม filter backdated ---
        const backdatedParam = req.query.backdated;
        if (backdatedParam === '1') {
          where = { ...where, backdated: 1 };
        } else if (backdatedParam === '0') {
          where = { ...where, backdated: 0 }; // ต้องเป็น 0 เท่านั้น
        }
        // ดึง leave requests ที่ pending (paging)
        const [pendingLeaves, total] = await Promise.all([
          leaveRepo.find({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take: limit
          }),
          leaveRepo.count({ where })
        ]);
        // join user (Repid -> user.id) และ leaveType (leaveType -> LeaveType.id)
        const result = await Promise.all(pendingLeaves.map(async (leave) => {
          let user = null;
          let leaveTypeObj = null;
          if (leave.Repid) {
            user = await userRepo.findOneBy({ id: leave.Repid });
            if (user) {
              user = { name: user.name, department: user.department, position: user.position };
            }
          }
          let leaveTypeName_th = null;
          let leaveTypeName_en = null;
                     if (leave.leaveType) {
             // Include soft-deleted leave types to get proper names
             // Try multiple approaches to get the leave type
             let leaveTypeObj = null;
             
             // Approach 1: Try raw query with explicit soft-delete bypass (including deleted records)
             try {
               const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
               const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leave.leaveType]);
               if (leaveTypeResult && leaveTypeResult.length > 0) {
                 leaveTypeObj = leaveTypeResult[0];
               }
             } catch (error) {
               console.log('Raw query failed for leave type:', leave.leaveType, error.message);
             }
             
             // Approach 2: If raw query fails, try with withDeleted option
             if (!leaveTypeObj) {
               try {
                 const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
                 leaveTypeObj = await leaveTypeRepo.findOne({
                   where: { id: leave.leaveType },
                   withDeleted: true
                 });
               } catch (error) {
                 console.log('TypeORM withDeleted failed for leave type:', leave.leaveType, error.message);
               }
             }
             
             // Approach 3: Final fallback - try to get any record with this ID
             if (!leaveTypeObj) {
               try {
                 const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
                 leaveTypeObj = await leaveTypeRepo.findOne({
                   where: { id: leave.leaveType }
                 });
               } catch (error) {
                 console.log('Final TypeORM attempt failed for leave type:', leave.leaveType, error.message);
               }
             }
             
             const names = getLeaveTypeNames(leaveTypeObj, leave.leaveType, 'en');
             leaveTypeName_th = names.leaveTypeName_th;
             leaveTypeName_en = names.leaveTypeName_en;
           }
          return {
            ...leave,
            user: user ? { name: user.name, department: user.department, position: user.position } : null,
            leaveTypeName_th,
            leaveTypeName_en,
            attachments: parseAttachments(leave.attachments),
            backdated: Number(leave.backdated),
          };
        }));
        res.json({ status: 'success', data: result, total, page, totalPages: Math.ceil(total / limit), message: 'Fetch success' });
      } catch (err) {
        let lang = req.headers['accept-language'] || req.query.lang || 'th';
        lang = lang.split(',')[0].toLowerCase().startsWith('en') ? 'en' : 'th';
        res.status(500).json({ status: 'error', message: 'Error: ' + err.message });
      }
    });

    // GET /api/leave-request/history
    router.get('/history', async (req, res) => {
      try {
        // Language detection removed - frontend will handle i18n
        const leaveRepo = AppDataSource.getRepository('LeaveRequest');
        const userRepo = AppDataSource.getRepository('User');
        const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
        const { userId, status } = req.query;
        // --- เพิ่ม filter เดือน/ปี ---
        const month = req.query.month ? parseInt(req.query.month) : null;
        const year = req.query.year ? parseInt(req.query.year) : null;
        // --- เพิ่ม filter ช่วงวัน ---
        const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
        let where;
        const { Between, In } = require('typeorm');
        if (status) {
          // รองรับ status หลายค่า (comma separated)
          let statusArr = status;
          if (typeof status === 'string' && status.includes(',')) {
            statusArr = status.split(',').map(s => s.trim());
          }
          if (Array.isArray(statusArr)) {
            where = statusArr.map(s => ({ status: s }));
            if (userId) where = statusArr.map(s => ({ status: s, Repid: userId }));
            if (month && year) {
              const startOfMonth = new Date(year, month - 1, 1);
              const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
              where = statusArr.map(s => ({ status: s, createdAt: Between(startOfMonth, endOfMonth) }));
              if (userId) where = statusArr.map(s => ({ status: s, Repid: userId, createdAt: Between(startOfMonth, endOfMonth) }));
            } else if (year) {
              const startOfYear = new Date(year, 0, 1);
              const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
              where = statusArr.map(s => ({ status: s, createdAt: Between(startOfYear, endOfYear) }));
              if (userId) where = statusArr.map(s => ({ status: s, Repid: userId, createdAt: Between(startOfYear, endOfYear) }));
            }
            // --- เพิ่ม filter ช่วงวัน ---
            if (startDate && endDate) {
              where = where.map(w => ({ ...w, startDate: Between(startDate, endDate) }));
            } else if (startDate) {
              where = where.map(w => ({ ...w, startDate: Between(startDate, new Date(config.business.maxDate)) }));
            } else if (endDate) {
              where = where.map(w => ({ ...w, startDate: Between(new Date(config.business.minDate), endDate) }));
            }
          } else {
            // เดิม: status เดียว
            where = [{ status }];
            if (userId) where = [{ status, Repid: userId }];
            if (month && year) {
              const startOfMonth = new Date(year, month - 1, 1);
              const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
              where = [{ status, createdAt: Between(startOfMonth, endOfMonth) }];
              if (userId) where = [{ status, Repid: userId, createdAt: Between(startOfMonth, endOfMonth) }];
            } else if (year) {
              const startOfYear = new Date(year, 0, 1);
              const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
              where = [{ status, createdAt: Between(startOfYear, endOfYear) }];
              if (userId) where = [{ status, Repid: userId, createdAt: Between(startOfYear, endOfYear) }];
            }
            // --- เพิ่ม filter ช่วงวัน ---
            if (startDate && endDate) {
              where = where.map(w => ({ ...w, startDate: Between(startDate, endDate) }));
            } else if (startDate) {
              where = where.map(w => ({ ...w, startDate: Between(startDate, new Date(config.business.maxDate)) }));
            } else if (endDate) {
              where = where.map(w => ({ ...w, startDate: Between(new Date(config.business.minDate), endDate) }));
            }
          }
        } else {
          // ไม่ได้กรอง status (default: approved, rejected, pending)
          where = [
            { status: 'approved' },
            { status: 'rejected' },
            { status: 'pending' }
          ];
          if (userId) {
            where = [
              { status: 'approved', Repid: userId },
              { status: 'rejected', Repid: userId },
              { status: 'pending', Repid: userId }
            ];
          }
          if (month && year) {
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
            where = [
              { status: 'approved', createdAt: Between(startOfMonth, endOfMonth) },
              { status: 'rejected', createdAt: Between(startOfMonth, endOfMonth) },
              { status: 'pending', createdAt: Between(startOfMonth, endOfMonth) }
            ];
            if (userId) where = [
              { status: 'approved', Repid: userId, createdAt: Between(startOfMonth, endOfMonth) },
              { status: 'rejected', Repid: userId, createdAt: Between(startOfMonth, endOfMonth) },
              { status: 'pending', Repid: userId, createdAt: Between(startOfMonth, endOfMonth) }
            ];
          } else if (year) {
            const startOfYear = new Date(year, 0, 1);
            const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
            where = [
              { status: 'approved', createdAt: Between(startOfYear, endOfYear) },
              { status: 'rejected', createdAt: Between(startOfYear, endOfYear) },
              { status: 'pending', createdAt: Between(startOfYear, endOfYear) }
            ];
            if (userId) where = [
              { status: 'approved', Repid: userId, createdAt: Between(startOfYear, endOfYear) },
              { status: 'rejected', Repid: userId, createdAt: Between(startOfYear, endOfYear) },
              { status: 'pending', Repid: userId, createdAt: Between(startOfYear, endOfYear) }
            ];
          }
          // --- เพิ่ม filter ช่วงวัน ---
          if (startDate && endDate) {
            where = where.map(w => ({ ...w, startDate: Between(startDate, endDate) }));
          } else if (startDate) {
            where = where.map(w => ({ ...w, startDate: Between(startDate, new Date(config.business.maxDate)) }));
          } else if (endDate) {
            where = where.map(w => ({ ...w, startDate: Between(new Date(config.business.minDate), endDate) }));
          }
        }
        // --- ใน /history ---
        const singleDate = req.query.date ? new Date(req.query.date) : null;
        if (singleDate) {
          where = where.map(w => {
            const startOfDay = new Date(singleDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(singleDate);
            endOfDay.setHours(23, 59, 59, 999);
            return { ...w, createdAt: Between(startOfDay, endOfDay) }; 
          });
        }
        // --- เพิ่ม filter backdated (ใช้ field จริงจาก database) ---
        const backdatedParamH = req.query.backdated;
        if (backdatedParamH === '1') {
          where = Array.isArray(where)
            ? where.map(w => ({ ...w, backdated: 1 }))
            : { ...where, backdated: 1 };
        } else if (backdatedParamH === '0') {
          where = Array.isArray(where)
            ? where.map(w => ({ ...w, backdated: 0 }))
            : { ...where, backdated: 0 };
        }
        // --- เพิ่ม filter leaveType ---
        const leaveType = req.query.leaveType;
        if (leaveType) {
          where = Array.isArray(where)
            ? where.map(w => ({ ...w, leaveType }))
            : { ...where, leaveType };
        }
        // --- เพิ่ม paging ---
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || config.pagination.defaultLimit;
        const skip = (page - 1) * limit;
        // ดึงใบคำขอที่ status เป็น approved หรือ rejected (และ filter ตาม userId/เดือน/ปี/ช่วงวัน ถ้ามี) (paging)
        const [processedLeaves, total] = await Promise.all([
          leaveRepo.find({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take: limit
          }),
          leaveRepo.count({ where })
        ]);
        // --- เพิ่มการคำนวณ approvedCount/rejectedCount ตาม filter ---
        const approvedCount = await leaveRepo.count({ where: where.map(w => ({ ...w, status: 'approved' })) });
        const rejectedCount = await leaveRepo.count({ where: where.map(w => ({ ...w, status: 'rejected' })) });
        const result = await Promise.all(processedLeaves.map(async (leave) => {
          let user = null;
          let leaveTypeObj = null;
          if (leave.Repid) {
            user = await userRepo.findOneBy({ id: leave.Repid });
            if (user) {
              user = { name: user.name, department: user.department, position: user.position };
            } else {
              // User not found (deleted), return deleted user info
              user = { name: 'deleted_user', department: null, position: null };
            }
          }
                     // join leaveType จาก database
           if (leave.leaveType) {
             // Try multiple approaches to get the leave type
             
             // Approach 1: Try raw query with explicit soft-delete bypass
             try {
               const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
               const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leave.leaveType]);
               if (leaveTypeResult && leaveTypeResult[0]) {
                 leaveTypeObj = leaveTypeResult[0];
               }
             } catch (error) {
               // Raw query failed, continue to TypeORM approach
             }
             
             // Approach 2: If raw query fails, try with withDeleted option
             if (!leaveTypeObj) {
               try {
                 const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
                 leaveTypeObj = await leaveTypeRepo.findOne({
                   where: { id: leave.leaveType },
                   withDeleted: true
                 });
               } catch (error) {
                 // TypeORM withDeleted failed, leaveTypeObj will remain null
               }
             }
           }
          // คำนวณจำนวนวันหรือชั่วโมงลา
          let duration = '';
          let durationType = '';
          if (leave.startTime && leave.endTime) {
            // Calculate hours
            const [sh, sm] = leave.startTime.split(':').map(Number);
            const [eh, em] = leave.endTime.split(':').map(Number);
            let start = sh + (sm || 0) / 60;
            let end = eh + (em || 0) / 60;
            let diff = end - start;
            if (diff < 0) diff += 24; // ข้ามวัน
            duration = diff.toFixed(2);
            durationType = 'hour';
          } else if (leave.startDate && leave.endDate) {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            duration = Math.abs((end - start) / (1000*60*60*24)) + 1;
            durationType = 'day';
          }
          // เพิ่มดึงชื่อ admin ที่อนุมัติ/ไม่อนุมัติ
          let approvedBy = null;
          let rejectedBy = null;
          if (leave.statusBy && leave.status === 'approved') {
            // statusBy ตอนนี้เป็น ID แล้ว ให้ดึงชื่อจาก unified users table
            const approver = await userRepo.findOneBy({ id: leave.statusBy });
            if (approver) {
              approvedBy = approver.name;
            } else {
              approvedBy = leave.statusBy; // fallback ใช้ ID ถ้าไม่เจอชื่อ
            }
          }
          if (leave.statusBy && leave.status === 'rejected') {
            // statusBy ตอนนี้เป็น ID แล้ว ให้ดึงชื่อจาก unified users table
            const rejector = await userRepo.findOneBy({ id: leave.statusBy });
            if (rejector) {
              rejectedBy = rejector.name;
            } else {
              rejectedBy = leave.statusBy; // fallback ใช้ ID ถ้าไม่เจอชื่อ
            }
          }
          // Get proper leave type names using helper function
          let leaveTypeName_th = null;
          let leaveTypeName_en = null;
          if (leave.leaveType) {
            const names = getLeaveTypeNames(leaveTypeObj, leave.leaveType, 'en');
            leaveTypeName_th = names.leaveTypeName_th;
            leaveTypeName_en = names.leaveTypeName_en;
          }
          
          return {
            id: leave.id,
            leaveType: leaveTypeObj ? leaveTypeObj.leave_type_th : leave.leaveType,
            leaveTypeName_th,
            leaveTypeName_en,
            leaveDate: leave.startDate,
            startDate: leave.startDate,
            endDate: leave.endDate,
            startTime: leave.startTime || null,
            endTime: leave.endTime || null,
            approvedTime: leave.approvedTime,
            rejectedTime: leave.rejectedTime,
            createdAt: leave.createdAt,
            duration,
            durationType,
            reason: leave.reason,
            status: leave.status,
            submittedDate: leave.createdAt,
            user: user ? { name: user.name, department: user.department, position: user.position } : null,
            approvedBy,
            rejectedBy,
            rejectionReason: leave.rejectedReason || null,
            attachments: parseAttachments(leave.attachments),
            contact: leave.contact || null,
            // ส่ง backdated ตรงจาก db
            backdated: Number(leave.backdated),
          };
        }));
        res.json({ status: 'success', data: result, total, page, totalPages: Math.ceil(total / limit), approvedCount, rejectedCount, message: 'Fetch success' });
      } catch (err) {
        let lang = req.headers['accept-language'] || req.query.lang || 'th';
        lang = lang.split(',')[0].toLowerCase().startsWith('en') ? 'en' : 'th';
        res.status(500).json({ status: 'error', message: 'Error: ' + err.message });
      }
    });

    // GET /api/leave-request/dashboard-stats
    router.get('/dashboard-stats', async (req, res) => {
      try {
        const leaveRepo = AppDataSource.getRepository('LeaveRequest');
        const { month, year } = req.query;
        let wherePending = { status: 'pending' };
        let whereApproved = { status: 'approved' };
        let whereRejected = { status: 'rejected' };
        let whereAll = {};
        if (month && year) {
          const { Between } = require('typeorm');
          const m = parseInt(month);
          const y = parseInt(year);
          const startOfMonth = new Date(y, m - 1, 1);
          const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);
          wherePending = { status: 'pending', createdAt: Between(startOfMonth, endOfMonth) };
          whereApproved = { status: 'approved', createdAt: Between(startOfMonth, endOfMonth) };
          whereRejected = { status: 'rejected', createdAt: Between(startOfMonth, endOfMonth) };
          whereAll = { createdAt: Between(startOfMonth, endOfMonth) };
        } else if (year) {
          const { Between } = require('typeorm');
          const y = parseInt(year);
          const startOfYear = new Date(y, 0, 1);
          const endOfYear = new Date(y, 11, 31, 23, 59, 59, 999);
          wherePending = { status: 'pending', createdAt: Between(startOfYear, endOfYear) };
          whereApproved = { status: 'approved', createdAt: Between(startOfYear, endOfYear) };
          whereRejected = { status: 'rejected', createdAt: Between(startOfYear, endOfYear) };
          whereAll = { createdAt: Between(startOfYear, endOfYear) };
        }
        // 1. Pending count
        const pendingCount = await leaveRepo.count({ where: wherePending });
        // 2. Approved count
        const approvedCount = await leaveRepo.count({ where: whereApproved });
        // 3. Rejected count
        const rejectedCount = await leaveRepo.count({ where: whereRejected });
        // 4. User count (unique Repid in leave requests)
        const allLeaves = await leaveRepo.find({ where: whereAll });
        const userIds = Array.from(new Set(allLeaves.map(l => l.Repid)));
        const userCount = userIds.length;
        // 5. Average leave days (approved)
        const approvedLeaves = allLeaves.filter(l => l.status === 'approved');
        let averageDayOff = 0;
        if (approvedLeaves.length > 0) {
          const totalDays = approvedLeaves.reduce((sum, l) => {
            const start = l.startDate ? new Date(l.startDate) : null;
            const end = l.endDate ? new Date(l.endDate) : null;
            if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
              return sum + ((end.getTime() - start.getTime()) / (1000*60*60*24) + 1);
            }
            return sum;
          }, 0);
          averageDayOff = parseFloat((totalDays / approvedLeaves.length).toFixed(1));
        }
        res.json({
          status: 'success',
          data: {
            pendingCount,
            approvedCount,
            rejectedCount,
            userCount,
            averageDayOff
          }
        });
      } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
      }
    });

    // GET /api/leave-request/my - Get all leave requests for the logged-in user
    router.get('/my', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ status: 'error', message: 'No token provided' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.server.jwtSecret);
        const userId = decoded.userId;

        const leaveRepo = AppDataSource.getRepository('LeaveRequest');
        const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
        const leaves = await leaveRepo.find({ where: { Repid: userId }, order: { createdAt: 'DESC' } });

        // Map to required fields, with leave type name
        const result = await Promise.all(leaves.map(async l => {
          let leaveTypeName = l.leaveType;
                     if (l.leaveType) {
             // Try multiple approaches to get the leave type
             let leaveTypeObj = null;
             
             // Approach 1: Try raw query with explicit soft-delete bypass
             try {
               const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
               const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [l.leaveType]);
               if (leaveTypeResult && leaveTypeResult[0]) {
                 leaveTypeObj = leaveTypeResult[0];
               }
             } catch (error) {
               // Raw query failed, continue to TypeORM approach
             }
             
             // Approach 2: If raw query fails, try with withDeleted option
             if (!leaveTypeObj) {
               try {
                 const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
                 leaveTypeObj = await leaveTypeRepo.findOne({
                   where: { id: l.leaveType },
                   withDeleted: true
                 });
               } catch (error) {
                 // TypeORM withDeleted failed, leaveTypeObj will remain null
               }
             }
             
             if (leaveTypeObj) {
               // Use the helper function to get proper names
               const names = getLeaveTypeNames(leaveTypeObj, l.leaveType, 'en');
               leaveTypeName = names.leaveTypeName_th;
             }
           }
          // Calculate duration
          let duration = '';
          let durationType = '';
          if (l.startTime && l.endTime) {
            // Calculate hours (as float)
            const [sh, sm] = l.startTime.split(':').map(Number);
            const [eh, em] = l.endTime.split(':').map(Number);
            let start = sh + sm / 60;
            let end = eh + em / 60;
            duration = (end - start).toFixed(2);
            durationType = 'hour';
          } else            if (l.startDate && l.endDate) {
             const start = new Date(l.startDate);
             const end = new Date(l.endDate);
             // Inclusive: (end - start) in days + 1
             const diff = Math.abs((end - start) / (1000*60*60*24)) + 1;
             duration = diff.toString();
             durationType = 'day';
           }
           return {
             id: l.id,
             leaveType: leaveTypeName,
             leaveDate: l.startDate || '',
             duration,
             durationType,
             reason: l.reason,
             status: l.status,
             submittedDate: l.createdAt
           };
         }));

         res.json({ status: 'success', data: result });
       } catch (err) {
         res.status(500).json({ status: 'error', message: err.message });
       }
     });

     // GET /api/leave-request/user/:id - Get all leave requests for a specific user by id
     router.get('/user/:id', async (req, res) => {
       try {
         // --- i18n: ตรวจจับภาษา ---
         let lang = req.headers['accept-language'] || req.query.lang || 'th';
         lang = lang.split(',')[0].toLowerCase().startsWith('en') ? 'en' : 'th';
         
         const { id } = req.params;
         const leaveRepo = AppDataSource.getRepository('LeaveRequest');
         const userRepo = AppDataSource.getRepository('User');
         const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
         // --- เพิ่ม paging ---
         const page = parseInt(req.query.page) || 1;
         const limit = parseInt(req.query.limit) || config.pagination.defaultLimit;
         const skip = (page - 1) * limit;
         // ดึง leave requests ของ user ตาม id (paging)
         const [leaves, total] = await Promise.all([
           leaveRepo.find({ where: { Repid: id }, order: { createdAt: 'DESC' }, skip, take: limit }),
           leaveRepo.count({ where: { Repid: id } })
         ]);
         const result = await Promise.all(leaves.map(async (leave) => {
           let user = null;
           let leaveTypeObj = null;
           let leaveTypeName_th = null;
           let leaveTypeName_en = null;
           if (leave.Repid) {
             // Look up user directly in unified users table
             const userData = await userRepo.findOneBy({ id: leave.Repid });
             if (userData) {
               user = { name: userData.name, department: userData.department, position: userData.position };
             } else {
               // User not found (deleted), return deleted user info
               user = { name: 'deleted_user', department: null, position: null };
             }
           }
           if (leave.leaveType) {
             // Include soft-deleted leave types to get proper names
             // Try multiple approaches to get the leave type
             let leaveTypeObj = null;
             
             // Approach 1: Try raw query with explicit soft-delete bypass
             try {
               const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
               const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leave.leaveType]);
               if (leaveTypeResult && leaveTypeResult[0]) {
                 leaveTypeObj = leaveTypeResult[0];
               }
             } catch (error) {
               // Raw query failed, continue to TypeORM approach
             }
             
             // Approach 2: If raw query fails, try with withDeleted option
             if (!leaveTypeObj) {
               try {
                 const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
                 leaveTypeObj = await leaveTypeRepo.findOne({
                   where: { id: leave.leaveType },
                   withDeleted: true
                 });
               } catch (error) {
                 // TypeORM withDeleted failed, leaveTypeObj will remain null
               }
             }
             
             // Approach 3: If still no result, try to get from the cache we already have
             if (!leaveTypeObj) {
               // No leave type found, will use fallback
             }
             
             const names = getLeaveTypeNames(leaveTypeObj, leave.leaveType, 'en');
             leaveTypeName_th = names.leaveTypeName_th;
             leaveTypeName_en = names.leaveTypeName_en;
           }
           // คำนวณจำนวนวันหรือชั่วโมงลา
           let duration = '';
           let durationType = '';
           if (leave.startTime && leave.endTime) {
             // Calculate hours
             const [sh, sm] = leave.startTime.split(":").map(Number);
             const [eh, em] = leave.endTime.split(":").map(Number);
             let start = sh + (sm || 0) / 60;
             let end = eh + (em || 0) / 60;
             let diff = end - start;
             if (diff < 0) diff += 24; // ข้ามวัน
             duration = diff.toFixed(2);
             durationType = 'hour';
           } else if (leave.startDate && leave.endDate) {
             const start = new Date(leave.startDate);
             const end = new Date(leave.endDate);
             duration = Math.abs((end - start) / (1000*60*60*24)) + 1;
             durationType = 'day';
           }

           // ดึงชื่อผู้อนุมัติ/ไม่อนุมัติ
           let approvedBy = null;
           let rejectedBy = null;
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

           return {
             id: leave.id,
             leaveType: leave.leaveType, // id
             leaveTypeName_th,
             leaveTypeName_en,
             leaveDate: leave.startDate,
             startDate: leave.startDate,
             endDate: leave.endDate,
             startTime: leave.startTime || null,
             endTime: leave.endTime || null,
             approvedTime: leave.approvedTime,
             rejectedTime: leave.rejectedTime,
             createdAt: leave.createdAt,
             duration,
             durationType,
             reason: leave.reason,
             status: leave.status,
             submittedDate: leave.createdAt,
             user: user ? { name: user.name, department: user.department, position: user.position } : null,
             approvedBy,
             rejectedBy,
             rejectionReason: leave.rejectedReason || null,
             attachments: parseAttachments(leave.attachments),
             contact: leave.contact || null,
             // เพิ่ม backdated
             backdated: Number(leave.backdated),
           };
         }));
         res.json({ status: 'success', data: result, total, page, totalPages: Math.ceil(total / limit) });
       } catch (err) {
         res.status(500).json({ status: 'error', message: err.message });
       }
     });

     // GET /api/leave-request/:id
     router.get('/:id', async (req, res) => {
       try {
         // --- i18n: ตรวจจับภาษา ---
         let lang = req.headers['accept-language'] || req.query.lang || 'th';
         lang = lang.split(',')[0].toLowerCase().startsWith('en') ? 'en' : 'th';
         
         const leaveRepo = AppDataSource.getRepository('LeaveRequest');
         const userRepo = AppDataSource.getRepository('User');
         const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
         const { id } = req.params;

         const leave = await leaveRepo.findOneBy({ id });
         if (!leave) return res.status(404).json({ success: false, message: 'Not found' });

         let user = null;
         if (leave.Repid) {
           // Look up user directly in unified users table
           const userData = await userRepo.findOneBy({ id: leave.Repid });
           if (userData) {
             user = { name: userData.name, department: userData.department, position: userData.position };
           }
         }
                   let leaveTypeObj = null;
          if (leave.leaveType) {
            // Try multiple approaches to get the leave type
            // Approach 1: Try raw query with explicit soft-delete bypass
            try {
              const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
              const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leave.leaveType]);
              if (leaveTypeResult && leaveTypeResult[0]) {
                leaveTypeObj = leaveTypeResult[0];
              }
            } catch (error) {
              // Raw query failed, continue to TypeORM approach
            }
            
            // Approach 2: If raw query failed, try with withDeleted option
            if (!leaveTypeObj) {
              try {
                const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
                leaveTypeObj = await leaveTypeRepo.findOne({
                  where: { id: leave.leaveType },
                  withDeleted: true
                });
              } catch (error) {
                // TypeORM withDeleted failed, leaveTypeObj will remain null
              }
            }
          }

         // Get proper leave type names using helper function
         let leaveTypeName_th = null;
         let leaveTypeName_en = null;
         if (leave.leaveType) {
           const names = getLeaveTypeNames(leaveTypeObj, leave.leaveType, 'en');
           leaveTypeName_th = names.leaveTypeName_th;
           leaveTypeName_en = names.leaveTypeName_en;
         }
         
         res.json({
           success: true,
           data: {
             ...leave,
             user: user ? { name: user.name, department: user.department, position: user.position } : null,
             leaveTypeName: leaveTypeObj ? leaveTypeObj.leave_type_th : leave.leaveType,
             leaveTypeName_th,
             leaveTypeName_en,
             attachments: parseAttachments(leave.attachments),
           }
         });
       } catch (err) {
         res.status(500).json({ success: false, message: err.message });
       }
     });

     // PUT /api/leave-request/:id (update leave request)
     router.put('/:id', leaveAttachmentsUpload.array('attachments', 10), async (req, res) => {
       try {
         const leaveRepo = AppDataSource.getRepository('LeaveRequest');
         const { id } = req.params;
         const leave = await leaveRepo.findOneBy({ id });
         if (!leave) return res.status(404).json({ success: false, message: 'Leave request not found' });
         // --- เพิ่ม validation: ห้ามแก้ไขถ้า startDate <= วันนี้ ---
         const now = new Date();
         now.setHours(0, 0, 0, 0);
         const leaveStart = leave.startDate ? new Date(leave.startDate) : null;
         if (leaveStart) leaveStart.setHours(0, 0, 0, 0);
         if (leaveStart && leaveStart <= now) {
           return res.status(400).json({ success: false, message: 'Cannot edit leave request that has already started.' });
         }
         // อัปเดตฟิลด์ที่ส่งมา
         const {
           leaveType, personalLeaveType, startDate, endDate,
           startTime, endTime, reason, supervisor, contact
         } = req.body;
         if (leaveType !== undefined) leave.leaveType = leaveType;
         if (personalLeaveType !== undefined) leave.personalLeaveType = personalLeaveType;
         if (startDate !== undefined) leave.startDate = startDate;
         if (endDate !== undefined) leave.endDate = endDate;
         if (startTime !== undefined) leave.startTime = startTime;
         if (endTime !== undefined) leave.endTime = endTime;
         if (reason !== undefined) leave.reason = reason;
         if (supervisor !== undefined) leave.supervisor = supervisor;
         if (contact !== undefined) leave.contact = contact;
         
         // คำนวณค่า backdated ใหม่เมื่อมีการอัปเดตวันที่หรือเวลา
         if (startDate !== undefined || startTime !== undefined) {
           let backdated = 0; // Default to 0 (not backdated)
           const currentStartDate = startDate !== undefined ? startDate : leave.startDate;
           
           if (currentStartDate) {
             const today = new Date();
             today.setHours(0, 0, 0, 0);
             const leaveStart = parseLocalDate(currentStartDate);
             if (leaveStart && leaveStart < today) {
               // ถ้าวันลาอยู่ในอดีต (ย้อนหลัง) ให้ backdated = 1
               backdated = 1;
             }
             // ถ้าวันลาเป็นวันปัจจุบันหรืออนาคต ให้ backdated = 0 (ไม่นับเป็นย้อนหลัง)
           }
           leave.backdated = backdated;
         }
         
         // แนบไฟล์ใหม่ (ถ้ามี)
         const attachmentsArr = req.files ? req.files.map(f => f.filename) : [];
         if (attachmentsArr.length > 0) {
           leave.attachments = JSON.stringify(attachmentsArr);
         }
         await leaveRepo.save(leave);
         res.json({ success: true, data: leave, message: 'Leave request updated' });
       } catch (err) {
         res.status(500).json({ success: false, message: err.message });
       }
     });

     // GET /api/leave-request/detail/:id - For dialog details
     router.get('/detail/:id', async (req, res) => {
       try {
        const leaveRepo = AppDataSource.getRepository('LeaveRequest');
        const userRepo = AppDataSource.getRepository('User');
        const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
         const { id } = req.params;
          // --- i18n: Detect language (fallback to 'th') ---
          let lang = req.headers['accept-language'] || req.query.lang || 'th';
          lang = String(lang).split(',')[0].toLowerCase().startsWith('en') ? 'en' : 'th';

        

         const leave = await leaveRepo.findOneBy({ id });
         console.log('Detail API called for leave id:', id);
         if (!leave) return res.status(404).json({ success: false, message: 'Not found' });
         console.log('Leave row:', leave);
         console.log('StartDate from database:', leave.startDate);
         console.log('EndDate from database:', leave.endDate);

        // Get name by looking up Repid in unified User table
        let name = '-';
        if (leave.Repid) {
          const user = await userRepo.findOneBy({ id: leave.Repid });
          console.log('User lookup:', user);
          if (user && user.name) name = user.name;
        }

                   // Get leave type name
          let leaveTypeName = leave.leaveType;
          let leaveTypeEn = leave.leaveType;
          if (leave.leaveType) {
            // Try multiple approaches to get the leave type
            let leaveTypeObj = null;
            
            // Approach 1: Try raw query with explicit soft-delete bypass
            try {
              const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
              const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leave.leaveType]);
              if (leaveTypeResult && leaveTypeResult[0]) {
                leaveTypeObj = leaveTypeResult[0];
              }
            } catch (error) {
              // Raw query failed, continue to TypeORM approach
            }
            
            // Approach 2: If raw query fails, try with withDeleted option
            if (!leaveTypeObj) {
              try {
                const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
                leaveTypeObj = await leaveTypeRepo.findOne({
                  where: { id: leave.leaveType },
                  withDeleted: true
                });
              } catch (error) {
                // TypeORM withDeleted failed, leaveTypeObj will remain null
              }
            }
            
            if (leaveTypeObj) {
              // Use the helper function to get proper names
              const names = getLeaveTypeNames(leaveTypeObj, leave.leaveType, 'en');
              leaveTypeName = names.leaveTypeName_th;
              leaveTypeEn = names.leaveTypeName_en;
            }
          }

         // Format submittedDate as DD/MM/YYYY
         let submittedDate = '-';
         if (leave.createdAt) {
           const d = new Date(leave.createdAt);
           if (!isNaN(d.getTime())) {
             const day = String(d.getDate()).padStart(2, '0');
             const month = String(d.getMonth() + 1).padStart(2, '0');
             const year = d.getFullYear();
             submittedDate = `${day}/${month}/${year}`;
           }
         }

         // Format endDate as YYYY-MM-DD or '-'
         let endDate = '-';
         if (leave.endDate) {
           const e = new Date(leave.endDate);
           if (!isNaN(e.getTime())) {
             endDate = e.toISOString().slice(0, 10);
           }
         }

         // Format leaveDate (startDate) as YYYY-MM-DD or '-'
         let leaveDate = '-';
         if (leave.startDate) {
           const s = new Date(leave.startDate);
           if (!isNaN(s.getTime())) {
             leaveDate = s.toISOString().slice(0, 10);
           }
         }

         // ดึงชื่อผู้อนุมัติ/ไม่อนุมัติ
         let approvedBy = null;
         let rejectedBy = null;
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

         res.json({
           success: true,
           data: {
             id: leave.id,
             name,
             status: leave.status,
             leaveType: leave.leaveType, // id
             leaveTypeName, // th
             leaveTypeEn, // en
             startDate: leave.startDate,
             endDate: leave.endDate,
             leaveDate: leaveDate, // สำหรับ backward compatibility
             reason: leave.reason,
             rejectedReason: leave.rejectedReason,
             submittedDate,
             createdAt: leave.createdAt,
             attachments: parseAttachments(leave.attachments),
             contact: leave.contact || null,
             backdated: Number(leave.backdated),
             // เพิ่มข้อมูลที่จำเป็นสำหรับการแสดงผล
             startTime: leave.startTime,
             endTime: leave.endTime,
             statusBy: leave.statusBy,
             approvedTime: leave.approvedTime,
             rejectedTime: leave.rejectedTime,
             employeeType: leave.employeeType,
             Repid: leave.Repid,
             approvedBy,
             rejectedBy,
           }
         });
       } catch (err) {
         res.status(500).json({ success: false, message: err.message });
       }
     });

     // PUT /api/leave-request/:id/status
     router.put('/:id/status', async (req, res) => {
       try {
         const leaveRepo = AppDataSource.getRepository('LeaveRequest');
         const userRepo = AppDataSource.getRepository('User');
         const { status, statusby, rejectedReason } = req.body;
         const { id } = req.params;

         // ดึง ID ของผู้อนุมัติจาก JWT (ถ้าไม่ได้ส่งมา)
         let approverId = statusby;
         const authHeader = req.headers.authorization;
         if (!approverId && authHeader && authHeader.startsWith('Bearer ')) {
           const token = authHeader.split(' ')[1];
           try {
             const decoded = jwt.verify(token, config.server.jwtSecret);
             approverId = decoded.userId; // ใช้ user ID แทนชื่อ
           } catch (err) {
             return res.status(401).json({ success: false, message: 'Invalid or expired token' });
           }
         }

         const leave = await leaveRepo.findOneBy({ id: id });
         if (!leave) return res.status(404).json({ success: false, message: 'Leave request not found' });

         // Store the old status to check if we need to update LeaveUsed
         const oldStatus = leave.status;
         
         leave.status = status;
         leave.statusBy = approverId; // เก็บ ID แทนชื่อ
         leave.statusChangeTime = new Date();
         if (status === 'approved') {
           leave.approvedTime = new Date();
         }
         if (status === 'rejected') {
           leave.rejectedTime = new Date();
           if (rejectedReason) leave.rejectedReason = rejectedReason;
         }
         await leaveRepo.save(leave);

         // Update LeaveUsed table only when status changes to approved
         if (status === 'approved') {
           await updateLeaveUsed(leave);
         }

         // Emit Socket.io event for real-time notification
         if (global.io) {
           // Emit to specific user room
           global.io.to(`user_${leave.Repid}`).emit('leaveRequestUpdated', {
             requestId: leave.id,
             status: leave.status,
             statusBy: leave.statusBy, // ส่ง ID
             employeeId: leave.Repid,
             message: status === 'approved' ? 'Your leave request has been approved' : 'Your leave request has been rejected'
           });

           // Emit to admin room for dashboard updates
           global.io.to('admin_room').emit('leaveRequestStatusChanged', {
             requestId: leave.id,
             status: leave.status,
             employeeId: leave.Repid,
             statusBy: leave.statusBy // ส่ง ID
           });
         }

         // Send LINE notification to the user
         try {
           // ดึงชื่อผู้อนุมัติสำหรับ LINE notification
           let approverName = 'System';
           if (approverId) {
             // Look up approver in unified users table
             const approver = await userRepo.findOneBy({ id: approverId });
             if (approver) {
               approverName = approver.name;
             }
           }
           await sendLineNotification(leave, status, approverName, rejectedReason);
         } catch (notificationError) {
           console.error('Failed to send LINE notification:', notificationError);
           // Don't fail the request if notification fails
         }

         res.json({ success: true, data: leave });
       } catch (err) {
         res.status(500).json({ success: false, message: err.message });
       }
     });

     // DELETE /api/leave-request/:id
     router.delete('/:id', async (req, res) => {
       try {
         // --- i18n: ตรวจจับภาษา ---
         let lang = req.headers['accept-language'] || req.query.lang || 'th';
         lang = lang.split(',')[0].toLowerCase().startsWith('en') ? 'en' : 'th';
         
         const leaveRepo = AppDataSource.getRepository('LeaveRequest');
         const { id } = req.params;
         const leave = await leaveRepo.findOneBy({ id });
         if (!leave) return res.status(404).json({ 
           success: false, 
           message: 'Leave request not found'
         });
         
                  // No restrictions - admins can delete any leave request
          

         
         // Adjust LeaveUsed if this leave had been approved
         try {
           if (leave.status === 'approved') {
             const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');
             const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
                           // Resolve leave type entity
              let leaveTypeEntity = null;
              if (leave.leaveType && leave.leaveType.length > 20) {
                // Try multiple approaches to get the leave type
                try {
                  // Approach 1: Try with withDeleted option
                  leaveTypeEntity = await leaveTypeRepo.findOne({
                    where: { id: leave.leaveType },
                    withDeleted: true
                  });
                } catch (error) {
                  // TypeORM withDeleted failed, continue to raw query
                }
                
                // Approach 2: If that fails, try raw query
                if (!leaveTypeEntity) {
                  try {
                    const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
                    const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leave.leaveType]);
                    if (leaveTypeResult && leaveTypeResult[0]) {
                      leaveTypeEntity = leaveTypeResult[0];
                    }
                  } catch (error) {
                    // Raw query failed, leaveTypeEntity will remain null
                  }
                }
              } else {
                leaveTypeEntity = await leaveTypeRepo.findOne({
                  where: [
                    { leave_type_th: leave.leaveType },
                    { leave_type_en: leave.leaveType }
                  ]
                });
              }
                            if (leaveTypeEntity) {
                 let days = 0;
                 let hours = 0;
                 
                                   // Check if this leave type supports time-based calculation
                  // Instead of hard-coding specific leave types, we'll check if both startTime and endTime are provided
                  const isTimeBased = leave.startTime && leave.endTime;
                 
                 // Calculate duration based on available data and leave type configuration
                 if (isTimeBased && leave.startTime && leave.endTime) {
                   // Time-based calculation for any leave type that supports it
                   const startMinutes = convertToMinutes(...leave.startTime.split(':').map(Number));
                   const endMinutes = convertToMinutes(...leave.endTime.split(':').map(Number));
                   let durationHours = (endMinutes - startMinutes) / 60;
                   if (durationHours < 0 || isNaN(durationHours)) durationHours = 0;
                   hours = durationHours;
                 } else if (leave.startDate && leave.endDate) {
                   // Date-based calculation (default for most leave types)
                   const start = new Date(leave.startDate);
                   const end = new Date(leave.endDate);
                   let calculatedDays = calculateDaysBetween(start, end);
                   if (calculatedDays < 0 || isNaN(calculatedDays)) calculatedDays = 0;
                   days = calculatedDays;
                 }
               // Normalize hours to days
               let finalDays = days;
               let finalHours = hours;
               if (finalHours >= config.business.workingHoursPerDay) {
                 const additionalDays = Math.floor(finalHours / config.business.workingHoursPerDay);
                 finalDays += additionalDays;
                 finalHours = finalHours % config.business.workingHoursPerDay;
               }
               const existingRecord = await leaveUsedRepo.findOne({
                 where: { user_id: leave.Repid, leave_type_id: leaveTypeEntity.id }
               });
               if (existingRecord) {
                 existingRecord.days = (existingRecord.days || 0) - finalDays;
                 existingRecord.hour = (existingRecord.hour || 0) - finalHours;
                 if (existingRecord.hour < 0) {
                   existingRecord.days = (existingRecord.days || 0) - 1;
                   existingRecord.hour += config.business.workingHoursPerDay;
                 }
                 if (existingRecord.days < 0) existingRecord.days = 0;
                 if (existingRecord.hour < 0) existingRecord.hour = 0;
                 existingRecord.updated_at = new Date();
                 await leaveUsedRepo.save(existingRecord);
               }
             }
           }
         } catch (adjustErr) {
           console.error('Failed to decrement LeaveUsed on delete:', adjustErr);
         }
         
         // HARD DELETE attachment files from file system
         if (leave.attachments) {
           try {
             const attachments = parseAttachments(leave.attachments);
             const leaveUploadsPath = config.getLeaveUploadsPath();
             
             console.log(`🗑️  Hard deleting ${attachments.length} attachment files...`);
             
             for (const attachment of attachments) {
               const filePath = path.join(leaveUploadsPath, attachment);
               
               try {
                 if (fs.existsSync(filePath)) {
                   // Force delete the file (hard delete)
                   fs.unlinkSync(filePath);
                   
                   // Verify file is actually deleted
                   if (!fs.existsSync(filePath)) {
                     console.log(`✅ HARD DELETED: ${attachment}`);
                   } else {
                     console.error(`❌ FAILED to delete: ${attachment} - file still exists`);
                   }
                 } else {
                   console.log(`⚠️  File not found (already deleted?): ${attachment}`);
                 }
               } catch (fileDeleteError) {
                 console.error(`❌ Error deleting file ${attachment}:`, fileDeleteError.message);
                 
                 // Try alternative deletion method
                 try {
                   fs.rmSync(filePath, { force: true });
                   console.log(`✅ Force deleted: ${attachment}`);
                 } catch (forceDeleteError) {
                   console.error(`❌ Force delete also failed for ${attachment}:`, forceDeleteError.message);
                 }
               }
             }
           } catch (fileError) {
             console.error('❌ Error in attachment file deletion process:', fileError);
             // Continue with database deletion even if file deletion fails
           }
         }
         
         await leaveRepo.delete({ id });
         res.json({ 
           success: true, 
           message: 'Leave request deleted successfully'
         });
       } catch (err) {
         res.status(500).json({ success: false, message: err.message });
       }
     });

     // GET /api/leave-request/calendar/:year - Get approved leave requests for calendar display
     router.get('/calendar/:year', async (req, res) => {
       try {
         const { year } = req.params;
         const { month } = req.query;
         
         // Get user info from JWT token
         let currentUserId = null;
         let currentUserRole = null;
         const authHeader = req.headers.authorization;
         if (authHeader && authHeader.startsWith('Bearer ')) {
           const token = authHeader.split(' ')[1];
           try {
             const decoded = jwt.verify(token, config.server.jwtSecret);
             currentUserId = decoded.userId;
             currentUserRole = decoded.role;
           } catch (err) {
             return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
           }
         }
         
         const leaveRepo = AppDataSource.getRepository('LeaveRequest');
         const userRepo = AppDataSource.getRepository('User');
         const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
         
         const { Between } = require('typeorm');
         
         // Create date range for the year
         const startOfYear = new Date(parseInt(year), 0, 1);
         const endOfYear = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
         
         let where = {
           status: 'approved',
           startDate: Between(startOfYear, endOfYear)
         };
         
         // If month is specified, filter by month
         if (month) {
           const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
           const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
           where = {
             status: 'approved',
             startDate: Between(startOfMonth, endOfMonth)
           };
         }
         
         // Filter by user role - admin/superadmin can see all, user can only see their own
         if (currentUserRole === 'user') {
           where.Repid = currentUserId;
         }
         
         const approvedLeaves = await leaveRepo.find({
           where,
           order: { startDate: 'ASC' }
         });
         
         const result = await Promise.all(approvedLeaves.map(async (leave) => {
           let user = null;
           let leaveTypeObj = null;
           
           // Find user information
           if (leave.Repid) {
             user = await userRepo.findOneBy({ id: leave.Repid });
             if (user) {
               user = { 
                 name: user.name, 
                 department: user.department, 
                 position: user.position 
               };
             }
           }
           
           // Get leave type information
           if (leave.leaveType) {
             try {
               // Use raw query to get leave type (including soft-deleted ones for historical data)
               const leaveTypeQuery = `SELECT id, leave_type_en, leave_type_th FROM leave_type WHERE id = ?`;
               const leaveTypeResult = await AppDataSource.query(leaveTypeQuery, [leave.leaveType]);
               if (leaveTypeResult && leaveTypeResult.length > 0) {
                 leaveTypeObj = leaveTypeResult[0];
               }
             } catch (error) {
               console.error('Error fetching leave type:', error);
               // If query fails, leaveTypeObj will remain null and we'll use the ID as fallback
             }
           }
           
           // Calculate duration
           let duration = '';
           let durationType = '';
           if (leave.startTime && leave.endTime) {
             // Calculate hours
             const [sh, sm] = leave.startTime.split(':').map(Number);
             const [eh, em] = leave.endTime.split(':').map(Number);
             let start = sh + (sm || 0) / 60;
             let end = eh + (em || 0) / 60;
             let diff = end - start;
             if (diff < 0) diff += 24; // Cross day
             duration = diff.toFixed(2);
             durationType = 'hour';
           } else if (leave.startDate && leave.endDate) {
             const start = new Date(leave.startDate);
             const end = new Date(leave.endDate);
             duration = Math.abs((end - start) / (1000*60*60*24)) + 1;
             durationType = 'day';
           }
           
           return {
             id: leave.id,
             userId: leave.Repid,
             userName: user ? user.name : 'Unknown',
             department: user ? user.department : '',
             position: user ? user.position : '',
             leaveType: leaveTypeObj ? leaveTypeObj.leave_type_th : leave.leaveType,
             leaveTypeEn: leaveTypeObj ? leaveTypeObj.leave_type_en : leave.leaveType,
             startDate: leave.startDate,
             endDate: leave.endDate,
             startTime: leave.startTime,
             endTime: leave.endTime,
             duration,
             durationType,
             reason: leave.reason,
             status: leave.status,
             createdAt: leave.createdAt
           };
         }));
         
         res.json({ 
           status: 'success', 
           data: result,
           message: 'Calendar leave data fetched successfully'
         });
         
       } catch (err) {
         res.status(500).json({ 
           status: 'error', 
           message: err.message 
         });
       }
         });

    // POST /api/leave-request/admin - Admin creates leave request for other users
    router.post('/admin', leaveAttachmentsUpload.array('attachments', 10), async (req, res) => {
      try {
        const leaveRepo = AppDataSource.getRepository('LeaveRequest');
        let adminUserId = null;
        let adminRole = null;
        
        // ดึง admin userId จาก JWT
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          try {
            const decoded = verifyToken(token);
            adminUserId = decoded.userId;
            adminRole = decoded.role;
          } catch (err) {
            return sendUnauthorized(res, 'Invalid or expired token');
          }
        }

        // ตรวจสอบว่าเป็น admin หรือ superadmin
        if (adminRole !== 'admin' && adminRole !== 'superadmin') {
          return sendUnauthorized(res, 'Admin access required');
        }

        // กำหนดภาษา
        const lang = (req.headers['accept-language'] || '').toLowerCase().startsWith('en') ? 'en' : 'th';
        
        const {
          repid, // User ID ที่ admin ต้องการสร้าง leave request ให้
          leaveType, 
          durationType, 
          startDate, 
          endDate, 
          startTime, 
          endTime, 
          reason, 
          contact,
          approvalStatus,
          approverId,
          approverName,
          statusBy,
          approvalNote,
          allowBackdated,
          backdated: backdatedFromBody,
          approvedTime,
          rejectedTime,
          rejectedReason // <<== เพิ่มตรงนี้
        } = req.body;


        // Validation
        if (!repid) {
          return sendValidationError(res, 'User ID is required');
        }
        if (!leaveType) {
          return sendValidationError(res, 'Leave type is required');
        }
        if (!durationType) {
          return sendValidationError(res, 'Duration type is required');
        }
        if (!startDate) {
          return sendValidationError(res, 'Start date is required');
        }
        if (durationType === 'day' && !endDate) {
          return sendValidationError(res, 'End date is required for day leave');
        }
        if (durationType === 'hour' && (!startTime || !endTime)) {
          return sendValidationError(res, 'Start time and end time are required for hourly leave');
        }
        if (!reason) {
          return sendValidationError(res, 'Reason is required');
        }
        if (!contact) {
          return sendValidationError(res, 'Contact information is required');
        }
        if (!approvalStatus) {
          return sendValidationError(res, 'Approval status is required');
        }

        // Backdated control is now handled by frontend UI
        // No need to validate backdated dates here since user can choose to allow or disallow

        // ตรวจสอบว่า user ที่จะสร้าง leave request ให้มีอยู่จริง
        const userRepo = AppDataSource.getRepository('User');
        const targetUser = await userRepo.findOneBy({ id: repid });
        if (!targetUser) {
          return sendNotFound(res, 'Target user not found');
        }

        // ดึง leave type entity
        const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
        let leaveTypeEntity = null;
        if (leaveType && leaveType.length > 20) {
          try {
            leaveTypeEntity = await leaveTypeRepo.findOne({
              where: { id: leaveType },
              withDeleted: true
            });
          } catch (error) {
            // Try raw query if withDeleted fails
            try {
              const leaveTypeQuery = `SELECT * FROM leave_type WHERE id = ?`;
              const [leaveTypeResult] = await AppDataSource.query(leaveTypeQuery, [leaveType]);
              if (leaveTypeResult && leaveTypeResult[0]) {
                leaveTypeEntity = leaveTypeResult[0];
              }
            } catch (error) {
              // Raw query failed
            }
          }
        } else {
          leaveTypeEntity = await leaveTypeRepo.findOne({
            where: [
              { leave_type_th: leaveType },
              { leave_type_en: leaveType }
            ]
          });
        }

        if (!leaveTypeEntity) {
          return sendNotFound(res, 'Leave type not found');
        }

        // ดึง employeeType จาก target user
        let employeeType = null;
        if (targetUser.position) {
          employeeType = targetUser.position;
        }

        // ใช้ค่า backdated จาก allowBackdated (หน้า AdminLeaveForm)
        let isBackdated = 0;
        if (allowBackdated !== undefined) {
          // ใช้ค่าจาก allowBackdated (0 = ไม่ย้อนหลัง, 1 = ย้อนหลัง)
          isBackdated = Number(allowBackdated);
        } else if (backdatedFromBody !== undefined) {
          // fallback สำหรับ API เก่า
          isBackdated = Number(backdatedFromBody);
        } else {
          // Logic เดิมสำหรับ API อื่นๆ
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (durationType === 'day') {
            const startDateObj = new Date(startDate);
            if (startDateObj < today) {
              isBackdated = 1;
            }
          } else if (durationType === 'hour') {
            const leaveDateObj = new Date(startDate);
            if (leaveDateObj < today) {
              isBackdated = 1;
            }
          }
        }

        // สร้าง leave request
        const leaveRequest = leaveRepo.create({
          Repid: repid,
          employeeType: employeeType,
          leaveType: leaveTypeEntity.id,
          startDate: startDate,
          endDate: durationType === 'hour' ? startDate : endDate,
          startTime: durationType === 'hour' ? (startTime || null) : null,
          endTime: durationType === 'hour' ? (endTime || null) : null,
          reason: reason,
          contact: contact,
          status: approvalStatus,
          approverId: approverId || null,
          approverName: approverName || null,
          statusBy: statusBy || null,
          approvalNote: approvalNote || null,
          rejectedReason: rejectedReason || null, // <<== เพิ่ม map ตรงนี้
          backdated: isBackdated,
          approvedTime: approvedTime || null,
          rejectedTime: rejectedTime || null,
          createdAt: new Date(),
          updatedAt: new Date()
        });


        // Handle attachments
        if (req.files && req.files.length > 0) {
          const attachmentFilenames = req.files.map(file => file.filename);
          leaveRequest.attachments = JSON.stringify(attachmentFilenames);
        }

        const savedLeaveRequest = await leaveRepo.save(leaveRequest);

        // Update LeaveUsed table if approved
        if (approvalStatus === 'approved') {
          await updateLeaveUsed(savedLeaveRequest);
        }

        // Get leave type names for response
        const leaveTypeNames = getLeaveTypeNames(leaveTypeEntity, 'en');

        res.json({
          success: true,
          message: 'Leave request created successfully',
          data: {
            id: savedLeaveRequest.id,
            userId: savedLeaveRequest.Repid,
            leaveType: leaveTypeNames.leaveTypeName_th,
            leaveTypeEn: leaveTypeNames.leaveTypeName_en,
            startDate: savedLeaveRequest.startDate,
            endDate: savedLeaveRequest.endDate,
            startTime: savedLeaveRequest.startTime,
            endTime: savedLeaveRequest.endTime,
            reason: savedLeaveRequest.reason,
            contact: savedLeaveRequest.contact,
            status: savedLeaveRequest.status,
            approverId: savedLeaveRequest.approverId,
            approverName: savedLeaveRequest.approverName,
            approvalNote: savedLeaveRequest.approvalNote,
            backdated: savedLeaveRequest.backdated,
            allowBackdated: allowBackdated,
            createdAt: savedLeaveRequest.createdAt
          }
        });

      } catch (error) {
        console.error('Error creating admin leave request:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Internal server error'
        });
      }
    });

    return router;
  };