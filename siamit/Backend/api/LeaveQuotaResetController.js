const express = require('express');
const { sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');
const { In } = require('typeorm');

module.exports = (AppDataSource) => {
  const router = express.Router();

  // --- Helper Function: Core Reset Logic ---
  /**
   * Executes the reset logic within a transaction manager
   * @param {EntityManager} manager - Transactional entity manager
   * @param {Array} userIds - List of user IDs to reset
   * @param {string} strategy - 'zero' or 'delete'
   * @returns {Promise<number>} - Number of affected rows
   */
  const executeResetStrategy = async (manager, userIds, strategy) => {
    if (!userIds || userIds.length === 0) return 0;

    if (strategy === 'delete') {
      const result = await manager.getRepository('LeaveUsed').delete({ user_id: In(userIds) });
      return result.affected || 0;
    } else {
      // Default: Set days and hours to 0
      const result = await manager.createQueryBuilder()
        .update('LeaveUsed')
        .set({ days: 0, hour: 0 })
        .where({ user_id: In(userIds) })
        .execute();
      return result.affected || 0;
    }
  };




  router.post('/reset', async (req, res) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { positionId, force = false, strategy = 'zero' } = req.body || {};

      // 1. Validate Date (Must be Jan 1st unless forced)
      const now = new Date();
      const isJanFirst = now.getMonth() === 0 && now.getDate() === 1;
      if (!force && !isJanFirst) {
        return sendValidationError(res, 'Reset is only allowed on January 1st (or send force=true)');
      }

      // 2. Determine Target Positions
      const positionRepo = queryRunner.manager.getRepository('Position');
      let positionIds = [];

      if (positionId) {
        const pos = await positionRepo.findOne({ where: { id: positionId }, select: ['id'] });
        if (!pos) {
          throw new Error('Position not found'); // Will be caught by catch block
        }
        positionIds = [pos.id];
      } else {
        // Find all positions configured for auto-reset (new_year_quota = 0)
        const positions = await positionRepo.find({ 
          where: { new_year_quota: 0 }, 
          select: ['id'] 
        });
        positionIds = positions.map(p => p.id);
      }

      if (positionIds.length === 0) {
        await queryRunner.commitTransaction();
        return sendSuccess(res, { positions: 0, users: 0, affected: 0 }, 'No positions to reset');
      }

      // 3. Find Users in those positions (Optimization: Select ID only)
      const userRepo = queryRunner.manager.getRepository('User');
      const users = await userRepo.find({ 
        where: { position: In(positionIds) }, 
        select: ['id'] 
      });

      const userIds = users.map(u => u.id);

      if (userIds.length === 0) {
        await queryRunner.commitTransaction();
        return sendSuccess(res, { positions: positionIds.length, users: 0, affected: 0 }, 'No users in selected positions');
      }

      // 4. Execute Reset Logic using Helper
      const affected = await executeResetStrategy(queryRunner.manager, userIds, strategy);

      await queryRunner.commitTransaction();
      
      return sendSuccess(res, {
        positions: positionIds.length,
        users: userIds.length,
        affected,
        strategy
      }, 'Leave quota reset successfully');

    } catch (err) {
      await queryRunner.rollbackTransaction();
      // Handle specific "not found" error or general errors
      if (err.message === 'Position not found') return sendNotFound(res, err.message);
      return sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });


  router.post('/reset-by-users', async (req, res) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { userIds, strategy = 'zero' } = req.body || {};

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return sendValidationError(res, 'userIds (array) is required');
      }

      // Execute Reset Logic using Helper
      const affected = await executeResetStrategy(queryRunner.manager, userIds, strategy);

      await queryRunner.commitTransaction();

      return sendSuccess(res, { 
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

  return router;
};