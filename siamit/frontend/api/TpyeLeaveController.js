const express = require('express');
const router = express.Router();
const { BaseController, sendSuccess, sendError, sendNotFound } = require('../utils');
const { In } = require('typeorm');
const LeaveTypeCleanupService = require('../utils/leaveTypeCleanupService');

/**
 * @swagger
 * /api/leave-types:
 *   get:
 *     summary: Get all leave types
 *     tags:
 *       - LeaveTypes
 *     responses:
 *       200:
 *         description: A list of leave types
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
 *                 message:
 *                   type: string
 */

/**
 * @swagger
 * /api/leave-types:
 *   post:
 *     summary: Create a new leave type
 *     tags:
 *       - LeaveTypes
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               leave_type:
 *                 type: string
 *     responses:
 *       201:
 *         description: Leave type created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 */

/**
 * @swagger
 * /api/leave-types/{id}:
 *   put:
 *     summary: Update a leave type by ID
 *     tags:
 *       - LeaveTypes
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The leave type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               leave_type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Leave type updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 */

/**
 * @swagger
 * /api/leave-types/{id}:
 *   delete:
 *     summary: Delete a leave type by ID
 *     tags:
 *       - LeaveTypes
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The leave type ID
 *     responses:
 *       200:
 *         description: Leave type deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 */

module.exports = (AppDataSource) => {
  // Create base controller instance for LeaveType
  const leaveTypeController = new BaseController('LeaveType');

  // GET all leave types
  router.get('/leave-types', async (req, res) => {
    try {
      const leaveTypes = await leaveTypeController.findAll(AppDataSource);
      sendSuccess(res, leaveTypes, 'Fetched leave types successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // CREATE leave type
  router.post('/leave-types', async (req, res) => {
    try {
      const leaveTypeData = {
        leave_type_en: req.body.leave_type_en,
        leave_type_th: req.body.leave_type_th,
        require_attachment: req.body.require_attachment ?? false
      };
      const saved = await leaveTypeController.create(AppDataSource, leaveTypeData);
      sendSuccess(res, saved, 'Created leave type successfully', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // UPDATE leave type
  router.put('/leave-types/:id', async (req, res) => {
    try {
      const updateData = {
        leave_type_en: req.body.leave_type_en,
        leave_type_th: req.body.leave_type_th
      };
      if (typeof req.body.require_attachment !== 'undefined') {
        updateData.require_attachment = req.body.require_attachment;
      }
      const updated = await leaveTypeController.update(AppDataSource, req.params.id, updateData);
      sendSuccess(res, updated, 'Updated leave type successfully');
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Leave type not found');
      }
      sendError(res, err.message, 500);
    }
  });

  // DELETE leave type
  router.delete('/leave-types/:id', async (req, res) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      const leaveTypeId = req.params.id;
      console.log(`🗑️  Attempting to delete leave type: ${leaveTypeId}`);
      
      // Check if leave type is being used in active leave requests
      const leaveRequestRepo = queryRunner.manager.getRepository('LeaveRequest');
      const activeRequests = await leaveRequestRepo.count({
        where: { 
          leaveType: leaveTypeId,
          status: In(['pending', 'approved'])
        }
      });
      
      console.log(`📊 Found ${activeRequests} active leave requests for this type`);
      
      // Allow deletion but warn about active requests
      if (activeRequests > 0) {
        console.log(`⚠️  Warning: Leave type has ${activeRequests} active requests but deletion will proceed`);
        // Don't return error, just log the warning
      }
      
      // Try soft delete first, fallback to hard delete if columns don't exist
      try {
        console.log('🔄 Attempting soft delete...');
        await leaveTypeController.softDelete(AppDataSource, leaveTypeId);
        console.log('✅ Soft delete completed successfully');
      } catch (softDeleteError) {
        console.log('⚠️  Soft delete failed, falling back to hard delete:', softDeleteError.message);
        
        // Fallback to hard delete
        console.log('🗑️  Performing hard delete...');
        
        // First, delete all related leave quota records
        const leaveQuotaRepo = queryRunner.manager.getRepository('LeaveQuota');
        await leaveQuotaRepo.delete({ leaveTypeId: leaveTypeId });
        
        // Then hard delete the leave type
        await leaveTypeController.delete(AppDataSource, leaveTypeId);
        console.log('✅ Hard delete completed successfully');
      }
      
      await queryRunner.commitTransaction();
      
      // Customize success message based on whether there are active requests
      let successMessage = 'Leave type deleted successfully';
      if (activeRequests > 0) {
        successMessage = `Leave type deleted successfully. Note: ${activeRequests} active leave request(s) still exist and will continue to work.`;
      }
      
      sendSuccess(res, null, successMessage);
    } catch (err) {
      console.error('❌ Error in delete endpoint:', err);
      console.error('Error stack:', err.stack);
      await queryRunner.rollbackTransaction();
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Leave type not found');
      }
      sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });



  // GET all leave types including soft-deleted (for admin)
  router.get('/leave-types/all', async (req, res) => {
    try {
      console.log('🔍 Fetching all leave types including soft-deleted...');
      const leaveTypes = await leaveTypeController.findAllIncludingDeleted(AppDataSource);
      console.log('📊 Found leave types:', leaveTypes);
      console.log('📊 Total count:', leaveTypes.length);
      
      // Log each leave type to see what we have
      leaveTypes.forEach((lt, index) => {
        console.log(`Leave Type ${index + 1}:`, {
          id: lt.id,
          leave_type_th: lt.leave_type_th,
          leave_type_en: lt.leave_type_en,
          is_active: lt.is_active,
          deleted_at: lt.deleted_at
        });
      });
      
      sendSuccess(res, leaveTypes, 'Fetched all leave types successfully');
    } catch (err) {
      console.error('❌ Error fetching all leave types:', err);
      sendError(res, err.message, 500);
    }
  });

  // POST restore soft-deleted leave type
  router.post('/leave-types/:id/restore', async (req, res) => {
    try {
      const restored = await leaveTypeController.restore(AppDataSource, req.params.id);
      sendSuccess(res, restored, 'Leave type restored successfully');
    } catch (err) {
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Leave type not found');
      }
      sendError(res, err.message, 500);
    }
  });

  // DELETE permanently (hard delete) - for admin use only
  router.delete('/leave-types/:id/permanent', async (req, res) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      const leaveTypeId = req.params.id;
      
      // Check if leave type is being used in any leave requests
      const leaveRequestRepo = queryRunner.manager.getRepository('LeaveRequest');
      const allRequests = await leaveRequestRepo.count({
        where: { leaveType: leaveTypeId }
      });
      
      if (allRequests > 0) {
        return sendError(res, 
          `Cannot permanently delete leave type. It has ${allRequests} leave requests.`, 
          400
        );
      }
      
      // First, delete all related leave quota records
      const leaveQuotaRepo = queryRunner.manager.getRepository('LeaveQuota');
      await leaveQuotaRepo.delete({ leaveTypeId: leaveTypeId });
      
      // Then hard delete the leave type
      await leaveTypeController.delete(AppDataSource, leaveTypeId);
      
      await queryRunner.commitTransaction();
      sendSuccess(res, null, 'Leave type permanently deleted successfully');
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err.message === 'Record not found') {
        return sendNotFound(res, 'Leave type not found');
      }
      sendError(res, err.message, 500);
    } finally {
      await queryRunner.release();
    }
  });

  // GET check if leave type can be permanently deleted
  router.get('/leave-types/:id/can-delete-permanently', async (req, res) => {
    try {
      const cleanupService = new LeaveTypeCleanupService(AppDataSource);
      const result = await cleanupService.canPermanentlyDeleteLeaveType(req.params.id);
      
      sendSuccess(res, result, 'Deletion eligibility checked successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  // DELETE permanently with safety check
  router.delete('/leave-types/:id/permanent-safe', async (req, res) => {
    try {
      const cleanupService = new LeaveTypeCleanupService(AppDataSource);
      const result = await cleanupService.permanentlyDeleteLeaveType(req.params.id);
      
      sendSuccess(res, result, 'Leave type permanently deleted safely');
    } catch (err) {
      if (err.message.includes('Cannot delete leave type')) {
        return sendError(res, err.message, 400);
      }
      sendError(res, err.message, 500);
    }
  });

  // POST trigger auto-cleanup
  router.post('/leave-types/auto-cleanup', async (req, res) => {
    try {
      const cleanupService = new LeaveTypeCleanupService(AppDataSource);
      const results = await cleanupService.autoCleanupOrphanedLeaveTypes();
      
      sendSuccess(res, results, 'Auto-cleanup completed successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  });

  return router;
};
