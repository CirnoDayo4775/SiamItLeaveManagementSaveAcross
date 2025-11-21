/**
 * Leave Type Cleanup Service
 * Provides methods to safely check and permanently delete leave types
 * that are no longer in use after soft deletion
 */

const { Not, IsNull } = require('typeorm');

class LeaveTypeCleanupService {
  constructor(AppDataSource) {
    this.AppDataSource = AppDataSource;
  }

  /**
   * Check if a leave type can be permanently deleted
   * @param {string} leaveTypeId - The leave type ID to check
   * @returns {Promise<Object>} Result with canDelete and details
   */
  async canPermanentlyDeleteLeaveType(leaveTypeId) {
    try {
      // 1. Check if leave type exists and is soft-deleted
      const leaveTypeRepo = this.AppDataSource.getRepository('LeaveType');
      const leaveType = await leaveTypeRepo.findOne({
        where: { id: leaveTypeId }
      });

      if (!leaveType) {
        return { canDelete: false, reason: 'Leave type not found' };
      }

      if (!leaveType.deleted_at) {
        return { canDelete: false, reason: 'Leave type is not soft-deleted' };
      }

      // 2. Check for active leave requests
      const leaveRequestRepo = this.AppDataSource.getRepository('LeaveRequest');
      const activeRequests = await leaveRequestRepo.count({
        where: { 
          leaveTypeId: leaveTypeId,
          status: ['pending', 'approved', 'in_progress'] // Active statuses
        }
      });

      if (activeRequests > 0) {
        return { 
          canDelete: false, 
          reason: `Leave type has ${activeRequests} active leave request(s)`,
          activeRequests 
        };
      }

      // 3. Check for leave history (optional - for audit purposes)
      const leaveHistoryRepo = this.AppDataSource.getRepository('LeaveHistory');
      const historicalRequests = await leaveHistoryRepo.count({
        where: { leaveTypeId: leaveTypeId }
      });

      // 4. Check for leave quotas
      const leaveQuotaRepo = this.AppDataSource.getRepository('LeaveQuota');
      const leaveQuotas = await leaveQuotaRepo.count({
        where: { leaveTypeId: leaveTypeId }
      });

      return {
        canDelete: true,
        reason: 'No active usage found',
        details: {
          leaveType: leaveType,
          historicalRequests,
          leaveQuotas,
          softDeletedAt: leaveType.deleted_at
        }
      };

    } catch (error) {
      console.error('Error checking leave type deletion eligibility:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a leave type if safe to do so
   * @param {string} leaveTypeId - The leave type ID to delete
   * @returns {Promise<Object>} Deletion result
   */
  async permanentlyDeleteLeaveType(leaveTypeId) {
    const queryRunner = this.AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Check if safe to delete
      const checkResult = await this.canPermanentlyDeleteLeaveType(leaveTypeId);
      
      if (!checkResult.canDelete) {
        throw new Error(`Cannot delete leave type: ${checkResult.reason}`);
      }

      // 2. Delete related records first
      const leaveQuotaRepo = queryRunner.manager.getRepository('LeaveQuota');
      await leaveQuotaRepo.delete({ leaveTypeId: leaveTypeId });

      // 3. Permanently delete the leave type
      const leaveTypeRepo = queryRunner.manager.getRepository('LeaveType');
      await leaveTypeRepo.delete({ id: leaveTypeId });

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Leave type permanently deleted',
        details: checkResult.details
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Auto-cleanup: Find and delete orphaned soft-deleted leave types
   * @returns {Promise<Object>} Cleanup results
   */
  async autoCleanupOrphanedLeaveTypes() {
    try {
      const leaveTypeRepo = this.AppDataSource.getRepository('LeaveType');
      
      // Get all soft-deleted leave types
      const softDeletedTypes = await leaveTypeRepo.find({
        where: { deleted_at: Not(IsNull()) }
      });

      const results = {
        totalChecked: softDeletedTypes.length,
        deleted: [],
        cannotDelete: [],
        errors: []
      };

      for (const leaveType of softDeletedTypes) {
        try {
          const checkResult = await this.canPermanentlyDeleteLeaveType(leaveType.id);
          
          if (checkResult.canDelete) {
            await this.permanentlyDeleteLeaveType(leaveType.id);
            results.deleted.push({
              id: leaveType.id,
              name: leaveType.leave_type_en || leaveType.leave_type_th,
              reason: checkResult.reason
            });
          } else {
            results.cannotDelete.push({
              id: leaveType.id,
              name: leaveType.leave_type_en || leaveType.leave_type_th,
              reason: checkResult.reason
            });
          }
        } catch (error) {
          results.errors.push({
            id: leaveType.id,
            name: leaveType.leave_type_en || leaveType.leave_type_th,
            error: error.message
          });
        }
      }

      return results;

    } catch (error) {
      console.error('Error in auto-cleanup:', error);
      throw error;
    }
  }
}

module.exports = LeaveTypeCleanupService;
