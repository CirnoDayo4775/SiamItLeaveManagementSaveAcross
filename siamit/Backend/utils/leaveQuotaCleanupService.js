/**
 * Leave Quota Cleanup Service
 * 
 * This service handles automated cleanup of orphaned leave quota records
 * that reference non-existent or deleted leave types.
 */

const { Not, IsNull } = require('typeorm');

class LeaveQuotaCleanupService {
  constructor(AppDataSource) {
    this.AppDataSource = AppDataSource;
  }

  /**
   * Check if a leave quota record is orphaned (references invalid leave type)
   * @param {string} leaveTypeId - The leave type ID to check
   * @returns {Promise<Object>} Check result with details
   */
  async isLeaveQuotaOrphaned(leaveTypeId) {
    try {
      const leaveTypeRepo = this.AppDataSource.getRepository('LeaveType');
      
      // Check if leave type exists and is active
      const leaveType = await leaveTypeRepo.findOne({
        where: { id: leaveTypeId }
      });

      if (!leaveType) {
        return {
          isOrphaned: true,
          reason: 'Leave type not found',
          leaveTypeInfo: {
            nameEn: 'Unknown',
            nameTh: 'Unknown',
            status: 'Not Found'
          }
        };
      }

      if (leaveType.deleted_at) {
        return {
          isOrphaned: true,
          reason: 'Leave type is soft-deleted',
          leaveTypeInfo: {
            nameEn: leaveType.leave_type_en,
            nameTh: leaveType.leave_type_th,
            status: 'Soft-deleted',
            deletedAt: leaveType.deleted_at
          }
        };
      }

      if (!leaveType.is_active) {
        return {
          isOrphaned: true,
          reason: 'Leave type is inactive',
          leaveTypeInfo: {
            nameEn: leaveType.leave_type_en,
            nameTh: leaveType.leave_type_th,
            status: 'Inactive'
          }
        };
      }

      return {
        isOrphaned: false,
        reason: 'Leave type is valid and active',
        leaveTypeInfo: {
          nameEn: leaveType.leave_type_en,
          nameTh: leaveType.leave_type_th,
          status: 'Active'
        }
      };

    } catch (error) {
      console.error(`Error checking leave type ${leaveTypeId}:`, error);
      return {
        isOrphaned: true,
        reason: `Error checking leave type: ${error.message}`,
        leaveTypeInfo: {
          nameEn: 'Unknown',
          nameTh: 'Unknown',
          status: 'Error'
        }
      };
    }
  }

  /**
   * Find all orphaned leave quota records
   * @returns {Promise<Array>} Array of orphaned leave quota records
   */
  // ในไฟล์ leaveQuotaCleanupService.js
// แก้ไขฟังก์ชัน findOrphanedLeaveQuotas

  async findOrphanedLeaveQuotas() {
    try {
      const leaveQuotaRepo = this.AppDataSource.getRepository('LeaveQuota');
      
      // --- วิธีแก้: ใช้ QueryBuilder หาเฉพาะตัวที่ไม่มี LeaveType จริงๆ ---
      // SELECT quota.* FROM leave_quota quota
      // LEFT JOIN leave_type lt ON quota.leaveTypeId = lt.id
      // WHERE lt.id IS NULL OR lt.deleted_at IS NOT NULL OR lt.is_active = 0
      
      const orphanedQuotas = await leaveQuotaRepo.createQueryBuilder('quota')
        .leftJoinAndSelect('LeaveType', 'lt', 'lt.id = quota.leaveTypeId')
        .where('lt.id IS NULL') // หาตัวที่ไม่มี LeaveType อยู่จริง
        .orWhere('lt.deleted_at IS NOT NULL') // หรือถูกลบไปแล้ว
        .orWhere('lt.is_active = :isActive', { isActive: false }) // หรือไม่ active
        .getMany();

      // จัดรูปแบบข้อมูลให้เหมือนเดิมเพื่อให้ code ส่วนอื่นทำงานต่อได้
      return orphanedQuotas.map(quota => ({
        ...quota,
        leaveTypeInfo: {
          nameEn: 'Orphaned/Invalid',
          nameTh: 'ไม่พบข้อมูลประเภทการลา',
          status: 'Invalid'
        }
      }));
      // -----------------------------------------------------------
      
    } catch (error) {
      console.error('Error finding orphaned leave quotas:', error);
      throw error;
    }
  }

  /**
   * Delete orphaned leave quota records
   * @param {Array} orphanedQuotas - Array of orphaned leave quota records
   * @returns {Promise<Object>} Deletion results
   */
  async deleteOrphanedLeaveQuotas(orphanedQuotas) {
    try {
      const leaveQuotaRepo = this.AppDataSource.getRepository('LeaveQuota');
      
      const results = {
        totalToDelete: orphanedQuotas.length,
        deleted: [],
        failed: [],
        totalQuotaRemoved: 0
      };
      
      for (const quota of orphanedQuotas) {
        try {
          console.log(`🗑️ Deleting orphaned leave quota: ${quota.id} (${quota.leaveTypeInfo.nameEn || 'Unknown'})`);
          
          // Permanently delete the record
          await leaveQuotaRepo.remove(quota);
          
          results.deleted.push({
            id: quota.id,
            positionId: quota.positionId,
            leaveTypeId: quota.leaveTypeId,
            leaveTypeName: quota.leaveTypeInfo.nameEn || 'Unknown',
            quota: quota.quota,
            status: quota.leaveTypeInfo.status
          });
          
          results.totalQuotaRemoved += quota.quota;
          
          console.log(`✅ Successfully deleted: ${quota.id}`);
          
        } catch (deleteError) {
          console.error(`❌ Failed to delete ${quota.id}:`, deleteError.message);
          
          results.failed.push({
            id: quota.id,
            positionId: quota.positionId,
            leaveTypeId: quota.leaveTypeId,
            leaveTypeName: quota.leaveTypeInfo.nameEn || 'Unknown',
            quota: quota.quota,
            error: deleteError.message
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Error deleting orphaned leave quotas:', error);
      throw error;
    }
  }

  /**
   * Auto-cleanup: Find and delete orphaned leave quota records
   * @returns {Promise<Object>} Cleanup results
   */
  async autoCleanupOrphanedLeaveQuotas() {
    try {
      console.log('🔍 Starting automated leave quota cleanup...');
      
      // Find orphaned leave quota records
      const orphanedQuotas = await this.findOrphanedLeaveQuotas();
      
      if (orphanedQuotas.length === 0) {
        console.log('✅ No orphaned leave quota records found.');
        return {
          totalChecked: 0,
          totalToDelete: 0,
          deleted: [],
          failed: [],
          totalQuotaRemoved: 0,
          message: 'No orphaned records found'
        };
      }
      
      console.log(`🔍 Found ${orphanedQuotas.length} orphaned leave quota records`);
      
      // Delete orphaned records
      const deletionResults = await this.deleteOrphanedLeaveQuotas(orphanedQuotas);
      
      // Prepare summary
      const summary = {
        totalChecked: orphanedQuotas.length,
        totalToDelete: deletionResults.totalToDelete,
        deleted: deletionResults.deleted,
        failed: deletionResults.failed,
        totalQuotaRemoved: deletionResults.totalQuotaRemoved,
        message: `Cleaned up ${deletionResults.deleted.length} orphaned leave quota records`
      };
      
      // Log summary
      console.log('📊 Leave quota cleanup summary:', {
        totalChecked: summary.totalChecked,
        deleted: summary.deleted.length,
        failed: summary.failed.length,
        totalQuotaRemoved: summary.totalQuotaRemoved
      });
      
      // Log details for monitoring
      if (summary.deleted.length > 0) {
        console.log('🗑️ Deleted leave quota records:', summary.deleted.map(d => ({
          id: d.id,
          leaveType: d.leaveTypeName,
          quota: d.quota,
          status: d.status
        })));
      }
      
      if (summary.failed.length > 0) {
        console.log('❌ Failed deletions:', summary.failed.map(f => ({
          id: f.id,
          leaveType: f.leaveTypeName,
          error: f.error
        })));
      }
      
      return summary;
      
    } catch (error) {
      console.error('❌ Automated leave quota cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   * @returns {Promise<Object>} Statistics about leave quota records
   */
  async getCleanupStatistics() {
    try {
      const leaveQuotaRepo = this.AppDataSource.getRepository('LeaveQuota');
      const leaveTypeRepo = this.AppDataSource.getRepository('LeaveType');
      
      // Get all leave quota records
      const allLeaveQuotas = await leaveQuotaRepo.find();
      
      // Get all valid leave types
      const validLeaveTypes = await leaveTypeRepo.find({
        where: {
          deleted_at: IsNull(),
          is_active: true
        }
      });
      
      // Find orphaned records
      const orphanedQuotas = await this.findOrphanedLeaveQuotas();
      
      // Calculate statistics
      const totalQuota = allLeaveQuotas.reduce((sum, quota) => sum + quota.quota, 0);
      const orphanedQuota = orphanedQuotas.reduce((sum, quota) => sum + quota.quota, 0);
      
      return {
        totalRecords: allLeaveQuotas.length,
        validRecords: allLeaveQuotas.length - orphanedQuotas.length,
        orphanedRecords: orphanedQuotas.length,
        totalQuota,
        orphanedQuota,
        validLeaveTypes: validLeaveTypes.length,
        orphanedPercentage: allLeaveQuotas.length > 0 ? 
          ((orphanedQuotas.length / allLeaveQuotas.length) * 100).toFixed(2) : 0
      };
      
    } catch (error) {
      console.error('Error getting cleanup statistics:', error);
      throw error;
    }
  }
}

module.exports = LeaveQuotaCleanupService;
