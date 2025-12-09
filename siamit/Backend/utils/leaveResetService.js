const { In } = require('typeorm');

/**
 * Execute Leave Quota Reset Logic
 * * @param {DataSource} AppDataSource - TypeORM Data Source
 * @param {Object} options - Configuration options
 * @param {boolean} [options.force=false] - If true, bypass date check (Jan 1st)
 * @param {string} [options.strategy='zero'] - Reset strategy: 'zero' (set to 0) or 'delete' (remove rows)
 * @param {string|number} [options.positionId=null] - Specific position ID to reset (optional)
 * @returns {Promise<Object>} Result summary
 */
async function executeResetLogic(AppDataSource, options = {}) {
  const { force = false, strategy = 'zero', positionId = null } = options;

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Validate Date (Must be Jan 1st unless forced)
    // สำหรับ Cron Job ปกติจะรันวันที่ 1 ม.ค. อยู่แล้ว แต่ถ้าเรียก Manual ต้องเช็ค
    const now = new Date();
    const isJanFirst = now.getMonth() === 0 && now.getDate() === 1;
    
    if (!force && !isJanFirst) {
      throw new Error('Reset is only allowed on January 1st (or set force=true)');
    }

    // 2. Determine Target Positions
    const positionRepo = queryRunner.manager.getRepository('Position');
    let positionIds = [];

    if (positionId) {
      // กรณีระบุตำแหน่งเจาะจง
      const pos = await positionRepo.findOne({ where: { id: positionId }, select: ['id'] });
      if (!pos) {
        throw new Error(`Position ID ${positionId} not found`);
      }
      positionIds = [pos.id];
    } else {
      // กรณี Auto Reset: หาตำแหน่งที่ตั้งค่าให้รีเซ็ตปีใหม่ (new_year_quota = 0 หรือ false)
      // หมายเหตุ: ตรวจสอบ data type ของ new_year_quota ใน DB ของคุณว่าเป็น 0/1 หรือ boolean
      const positions = await positionRepo.find({ 
        where: { new_year_quota: 0 }, 
        select: ['id'] 
      });
      positionIds = positions.map(p => p.id);
    }

    if (positionIds.length === 0) {
      await queryRunner.rollbackTransaction(); // ไม่มีอะไรต้องทำ
      return { success: true, message: 'No positions matched for reset', positionsCount: 0, usersCount: 0, affectedRows: 0 };
    }

    // 3. Find Users in those positions
    const userRepo = queryRunner.manager.getRepository('User');
    const users = await userRepo.find({ 
      where: { position: In(positionIds) }, 
      select: ['id'] 
    });

    const userIds = users.map(u => u.id);

    if (userIds.length === 0) {
      await queryRunner.rollbackTransaction();
      return { 
        success: true, 
        message: 'No users found in targeted positions', 
        positionsCount: positionIds.length, 
        usersCount: 0, 
        affectedRows: 0 
      };
    }

    // 4. Execute Reset Strategy
    let affectedRows = 0;
    const leaveUsedRepo = queryRunner.manager.getRepository('LeaveUsed');

    if (strategy === 'delete') {
      // ลบ Record ทิ้ง (User จะเริ่มใหม่เหมือนไม่เคยใช้วันลา)
      const result = await leaveUsedRepo.delete({ user_id: In(userIds) });
      affectedRows = result.affected || 0;
    } else {
      // Default: เซ็ตค่า days และ hour เป็น 0 (เก็บ Record ไว้)
      const result = await queryRunner.manager.createQueryBuilder()
        .update('LeaveUsed')
        .set({ days: 0, hour: 0 }) // รีเซ็ตวันลาที่ใช้ไปให้เป็น 0
        .where({ user_id: In(userIds) })
        .execute();
      affectedRows = result.affected || 0;
    }

    // Commit Transaction
    await queryRunner.commitTransaction();

    return {
      success: true,
      message: 'Leave quota reset successfully',
      positionsCount: positionIds.length,
      usersCount: userIds.length,
      affectedRows,
      strategy
    };

  } catch (err) {
    // Rollback หากเกิดข้อผิดพลาด
    await queryRunner.rollbackTransaction();
    console.error('Execute Reset Logic Error:', err);
    throw err;
  } finally {
    // ปล่อย Connection
    await queryRunner.release();
  }
}

module.exports = { executeResetLogic }; 