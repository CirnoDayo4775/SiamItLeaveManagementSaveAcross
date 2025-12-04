const express = require('express');
const router = express.Router();
const { BaseController, sendSuccess, sendError, sendNotFound } = require('../utils');
const { In } = require('typeorm');
const LeaveTypeCleanupService = require('../utils/leaveTypeCleanupService');

module.exports = (AppDataSource) => {
  const leaveTypeController = new BaseController('LeaveType');

  // --- Helpers ---

  /**
   * Helper: Async Error Handler Wrapper
   */
  const safeHandler = (handler) => async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Leave type not found');
      }
      return sendError(res, err.message, err.statusCode || 500);
    }
  };

  /**
   * Helper: Transaction Wrapper
   */
  const withTransaction = async (callback) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const result = await callback(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  };

  // --- Routes ---

 
  router.get('/leave-types', safeHandler(async (req, res) => {
    const leaveTypes = await leaveTypeController.findAll(AppDataSource);
    sendSuccess(res, leaveTypes, 'Fetched leave types successfully');
  }));

 
  router.post('/leave-types', safeHandler(async (req, res) => {
    const { leave_type_en, leave_type_th, require_attachment } = req.body;
    const leaveTypeData = {
      leave_type_en,
      leave_type_th,
      require_attachment: require_attachment ?? false
    };
    const saved = await leaveTypeController.create(AppDataSource, leaveTypeData);
    sendSuccess(res, saved, 'Created leave type successfully', 201);
  }));

 
  router.put('/leave-types/:id', safeHandler(async (req, res) => {
    const { leave_type_en, leave_type_th, require_attachment } = req.body;
    const updateData = { leave_type_en, leave_type_th };
    
    if (require_attachment !== undefined) {
      updateData.require_attachment = require_attachment;
    }
    
    const updated = await leaveTypeController.update(AppDataSource, req.params.id, updateData);
    sendSuccess(res, updated, 'Updated leave type successfully');
  }));

  
  router.delete('/leave-types/:id', safeHandler(async (req, res) => {
    const leaveTypeId = req.params.id;

    const resultMessage = await withTransaction(async (queryRunner) => {
      // 1. Check Usage
      const activeRequests = await queryRunner.manager.getRepository('LeaveRequest').count({
        where: { leaveType: leaveTypeId, status: In(['pending', 'approved']) }
      });

      // 2. Try Soft Delete First
      try {
        await leaveTypeController.softDelete(AppDataSource, leaveTypeId);
      } catch (softDeleteError) {
        // 3. Fallback to Hard Delete
        console.log('⚠️ Soft delete failed, attempting hard delete:', softDeleteError.message);
        
        await queryRunner.manager.getRepository('LeaveQuota').delete({ leaveTypeId });
        await leaveTypeController.delete(AppDataSource, leaveTypeId);
      }

      return activeRequests > 0 
        ? `Leave type deleted. Note: ${activeRequests} active requests exist.`
        : 'Leave type deleted successfully';
    });

    sendSuccess(res, null, resultMessage);
  }));

  // GET all leave types including soft-deleted
  router.get('/leave-types/all', safeHandler(async (req, res) => {
    const leaveTypes = await leaveTypeController.findAllIncludingDeleted(AppDataSource);
    sendSuccess(res, leaveTypes, 'Fetched all leave types successfully');
  }));

  // POST restore soft-deleted leave type
  router.post('/leave-types/:id/restore', safeHandler(async (req, res) => {
    const restored = await leaveTypeController.restore(AppDataSource, req.params.id);
    sendSuccess(res, restored, 'Leave type restored successfully');
  }));

  // DELETE permanently (Hard Delete Only)
  router.delete('/leave-types/:id/permanent', safeHandler(async (req, res) => {
    const leaveTypeId = req.params.id;

    await withTransaction(async (queryRunner) => {
      // 1. Strict Usage Check
      const allRequests = await queryRunner.manager.getRepository('LeaveRequest').count({
        where: { leaveType: leaveTypeId }
      });

      if (allRequests > 0) {
        const error = new Error(`Cannot permanently delete leave type. It has ${allRequests} leave requests.`);
        error.statusCode = 400;
        throw error;
      }

      // 2. Perform Hard Delete
      await queryRunner.manager.getRepository('LeaveQuota').delete({ leaveTypeId });
      await leaveTypeController.delete(AppDataSource, leaveTypeId);
    });

    sendSuccess(res, null, 'Leave type permanently deleted successfully');
  }));

  // GET check permanent deletion eligibility
  router.get('/leave-types/:id/can-delete-permanently', safeHandler(async (req, res) => {
    const cleanupService = new LeaveTypeCleanupService(AppDataSource);
    const result = await cleanupService.canPermanentlyDeleteLeaveType(req.params.id);
    sendSuccess(res, result, 'Deletion eligibility checked successfully');
  }));

  // DELETE permanently with safety check service
  router.delete('/leave-types/:id/permanent-safe', safeHandler(async (req, res) => {
    try {
      const cleanupService = new LeaveTypeCleanupService(AppDataSource);
      const result = await cleanupService.permanentlyDeleteLeaveType(req.params.id);
      sendSuccess(res, result, 'Leave type permanently deleted safely');
    } catch (err) {
      if (err.message.includes('Cannot delete leave type')) {
        return sendError(res, err.message, 400);
      }
      throw err;
    }
  }));

  // POST trigger auto-cleanup
  router.post('/leave-types/auto-cleanup', safeHandler(async (req, res) => {
    const cleanupService = new LeaveTypeCleanupService(AppDataSource);
    const results = await cleanupService.autoCleanupOrphanedLeaveTypes();
    sendSuccess(res, results, 'Auto-cleanup completed successfully');
  }));

  return router;
};