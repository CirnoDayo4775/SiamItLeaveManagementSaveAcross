const express = require('express');
const { sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');
const { In } = require('typeorm');

/**
 * @swagger
 * tags:
 *   name: LeaveQuotaReset
 *   description: รีเซ็ตโควต้าการลา (reset leave quota) ประจำปี
 */

module.exports = (AppDataSource) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/leave-quota-reset/reset:
   *   post:
   *     summary: รีเซ็ตการใช้สิทธิ์ลาประจำปี (เริ่ม 1 มกราคม) ตามตำแหน่ง
   *     description: รีเซ็ตตารางการใช้สิทธิ์ลา (leave_used) ของผู้ใช้ที่อยู่ในตำแหน่งที่กำหนด โดยค่าเริ่มต้นจะทำงานเฉพาะวันที่ 1 มกราคม เว้นแต่ส่ง force=true
   *     tags: [LeaveQuotaReset]
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               positionId:
   *                 type: string
   *                 description: ระบุตำแหน่งเดียวที่ต้องการรีเซ็ต (ถ้าไม่ระบุ จะใช้ทุกตำแหน่งที่ตั้งค่า new_year_quota=true)
   *               force:
   *                 type: boolean
   *                 description: หาก true จะอนุญาตให้รีเซ็ตนอกวันที่ 1 มกราคมได้
   *               strategy:
   *                 type: string
   *                 enum: [delete, zero]
   *                 description: วิธีรีเซ็ต (delete = ลบระเบียน leave_used, zero = ตั้งค่า days/hour เป็น 0)
   *     responses:
   *       200:
   *         description: รีเซ็ตสำเร็จ
   *       400:
   *         description: เงื่อนไขไม่ถูกต้อง
   */
  router.post('/reset', async (req, res) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { positionId, force = false, strategy = 'zero' } = req.body || {};

      // ตรวจสอบวันที่ (1 มกราคม) หากไม่ force
      const now = new Date();
      const isJanFirst = now.getMonth() === 0 && now.getDate() === 1; // 0=Jan
      if (!force && !isJanFirst) {
        return sendValidationError(res, 'Reset is only allowed on January 1st (or send force=true)');
      }

      const positionRepo = queryRunner.manager.getRepository('Position');
      const userRepo = queryRunner.manager.getRepository('User');
      const adminRepo = queryRunner.manager.getRepository('User'); // Admin users are stored in User table
      const superAdminRepo = queryRunner.manager.getRepository('User'); // Superadmin users are also stored in User table
      const leaveUsedRepo = queryRunner.manager.getRepository('LeaveUsed');

      // คัดเลือกตำแหน่งเป้าหมาย
      let targetPositions = [];
      if (positionId) {
        const pos = await positionRepo.findOne({ where: { id: positionId } });
        if (!pos) {
          await queryRunner.rollbackTransaction();
          return sendNotFound(res, 'Position not found');
        }
        targetPositions = [pos];
      } else {
        // เลือกเฉพาะตำแหน่งที่ต้องรีเซ็ต: new_year_quota = 0
        targetPositions = await positionRepo.find({ where: { new_year_quota: 0 } });
      }

      const positionIds = targetPositions.map(p => p.id);
      if (positionIds.length === 0) {
        await queryRunner.commitTransaction();
        return sendSuccess(res, { positions: 0, users: 0, affected: 0 }, 'No positions to reset');
      }

      // ค้นหาผู้ใช้ในตำแหน่งเป้าหมาย (unified users table)
      const users = await userRepo.find({ where: { position: In(positionIds) } });

      const userIds = users.map(u => u.id);

      if (userIds.length === 0) {
        await queryRunner.commitTransaction();
        return sendSuccess(res, { positions: positionIds.length, users: 0, affected: 0 }, 'No users in selected positions');
      }

      let affected = 0;
      if (strategy === 'delete') {
        const result = await leaveUsedRepo.delete({ user_id: In(userIds) });
        affected = result.affected || 0;
      } else {
        // ตั้งค่า days/hour เป็น 0 แบบรวดเดียว
        const qb = queryRunner.manager.createQueryBuilder()
          .update('LeaveUsed')
          .set({ days: 0, hour: 0 })
          .where({ user_id: In(userIds) });
        const result = await qb.execute();
        affected = result.affected || 0;
      }

      await queryRunner.commitTransaction();
      return sendSuccess(res, {
        positions: positionIds.length,
        users: userIds.length,
        affected,
        strategy
      }, 'Leave quota reset successfully');
    } catch (err) {
      await queryRunner.rollbackTransaction();
      return sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });

  /**
   * @swagger
   * /api/leave-quota-reset/reset-by-users:
   *   post:
   *     summary: รีเซ็ตการใช้สิทธิ์ลาแบบเลือกผู้ใช้ (manual reset)
   *     description: ตั้งค่า days/hour ใน leave_used ของ user ที่เลือกเป็น 0 หรือจะลบระเบียน leave_used ตาม strategy
   *     tags: [LeaveQuotaReset]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               userIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: รายการ user_id ที่ต้องการรีเซ็ต
   *               strategy:
   *                 type: string
   *                 enum: [delete, zero]
   *                 description: วิธีรีเซ็ต (delete = ลบระเบียน leave_used, zero = ตั้งค่า days/hour เป็น 0)
   *     responses:
   *       200:
   *         description: รีเซ็ตสำเร็จ
   *       400:
   *         description: เงื่อนไขไม่ถูกต้อง
   */
  router.post('/reset-by-users', async (req, res) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { userIds, strategy = 'zero' } = req.body || {};
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return sendValidationError(res, 'userIds (array) is required');
      }
      const leaveUsedRepo = queryRunner.manager.getRepository('LeaveUsed');
      let affected = 0;
      if (strategy === 'delete') {
        const result = await leaveUsedRepo.delete({ user_id: In(userIds) });
        affected = result.affected || 0;
      } else {
        const qb = queryRunner.manager.createQueryBuilder()
          .update('LeaveUsed')
          .set({ days: 0, hour: 0 })
          .where({ user_id: In(userIds) });
        const result = await qb.execute();
        affected = result.affected || 0;
      }
      await queryRunner.commitTransaction();
      return sendSuccess(res, { users: userIds.length, affected, strategy }, 'Leave quota reset successfully');
    } catch (err) {
      await queryRunner.rollbackTransaction();
      return sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });

  return router;
};
