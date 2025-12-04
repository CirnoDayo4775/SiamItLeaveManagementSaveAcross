const express = require('express');
const { BaseController, sendSuccess, sendError, sendNotFound, sendValidationError } = require('../utils');
const { In } = require('typeorm');

module.exports = (AppDataSource) => {
  const router = express.Router();
  const leaveQuotaController = new BaseController('LeaveQuota');

  // --- Helper: Async Error Handler ---
  const safeHandler = (handler) => async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Record not found');
      }
      return sendError(res, err.message, 500);
    }
  };

  // --- Routes ---



  router.post('/', safeHandler(async (req, res) => {
    const { positionId, leaveTypeId, quota } = req.body;
    
    if (!positionId || !leaveTypeId || quota === undefined) {
      return sendValidationError(res, 'positionId, leaveTypeId, and quota are required');
    }

    const newQuota = await leaveQuotaController.create(AppDataSource, { positionId, leaveTypeId, quota });
    sendSuccess(res, newQuota, 'Created leave quota successfully');
  }));


  router.get('/', safeHandler(async (req, res) => {
    const quotas = await leaveQuotaController.findAll(AppDataSource);
    sendSuccess(res, quotas, 'Fetched all leave quotas');
  }));

 
  router.get('/position/:positionId', safeHandler(async (req, res) => {
    const { positionId } = req.params;
    const quotas = await leaveQuotaController.findAll(AppDataSource, { where: { positionId } });
    sendSuccess(res, quotas, 'Fetched leave quotas by positionId');
  }));


  router.put('/:id', safeHandler(async (req, res) => {
    const { positionId, leaveTypeId, quota } = req.body;
    const updateData = {};
    
    if (positionId !== undefined) updateData.positionId = positionId;
    if (leaveTypeId !== undefined) updateData.leaveTypeId = leaveTypeId;
    if (quota !== undefined) updateData.quota = quota;
    
    const quotaObj = await leaveQuotaController.update(AppDataSource, req.params.id, updateData);
    sendSuccess(res, quotaObj, 'Updated leave quota successfully');
  }));


  router.delete('/:id', safeHandler(async (req, res) => {
    await leaveQuotaController.delete(AppDataSource, req.params.id);
    sendSuccess(res, null, 'Deleted leave quota successfully');
  }));


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
        // Default: Zero out days and hours
        const result = await queryRunner.manager.createQueryBuilder()
          .update('LeaveUsed')
          .set({ days: 0, hour: 0 })
          .where({ user_id: In(userIds) })
          .execute();
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

  // Test endpoint to check database state
  router.get('/test', safeHandler(async (req, res) => {
    // Repositories
    const userRepo = AppDataSource.getRepository('User');
    const positionRepo = AppDataSource.getRepository('Position');
    const leaveQuotaRepo = AppDataSource.getRepository('LeaveQuota');
    const leaveTypeRepo = AppDataSource.getRepository('LeaveType');
    
    // Optimization: Run queries in parallel
    const [users, positions, quotas, leaveTypes] = await Promise.all([
      userRepo.find(),
      positionRepo.find(),
      leaveQuotaRepo.find(),
      leaveTypeRepo.find()
    ]);
    
    // Note: 'processes' was also querying 'User' table in original code, removed redundancy but kept functionality if needed
    
    sendSuccess(res, {
      users: users.length,
      processes: users.length, // Matching original logic
      positions: positions.length,
      quotas: quotas.length,
      leaveTypes: leaveTypes.length,
      sampleUser: users[0] || null,
      samplePosition: positions[0] || null,
      sampleQuota: quotas[0] || null,
      sampleLeaveType: leaveTypes[0] || null,
    }, 'Database state retrieved successfully');
  }));

  // Test endpoint to check current user's position
  router.get('/test-user', require('../middleware/authMiddleware'), safeHandler(async (req, res) => {
    const { userId } = req.user;
    const userRepo = AppDataSource.getRepository('User');
    
    // Optimization: Fetch user and processUser (legacy logic?) in parallel
    const [user, processUser] = await Promise.all([
      userRepo.findOne({ where: { id: userId } }),
      userRepo.findOne({ where: { Repid: userId } }) // Assuming Repid exists on User table
    ]);
    
    sendSuccess(res, {
      userId,
      user: user || null,
      processUser: processUser || null,
      userPosition: user?.position || null,
      processPosition: processUser?.Position || null,
    }, 'User position retrieved successfully');
  }));

  // Catch-all route for debugging
  router.use((req, res, next) => {
    console.log('DEBUG: Unmatched route:', req.method, req.originalUrl);
    next();
  });

  return router;
};