// const axios = require('axios'); // ไม่ต้องใช้ axios แล้ว
const cron = require('node-cron');
const LeaveTypeCleanupService = require('./leaveTypeCleanupService');
const LeaveQuotaCleanupService = require('./leaveQuotaCleanupService');
// Import Service ที่เราสร้าง
const { executeResetLogic } = require('./utils/leaveResetService');

/**
 * Register all scheduled jobs for the backend application.
 * - Yearly reset of leave usage on Jan 1st 00:05 Asia/Bangkok
 * Calls executeResetLogic directly
 *
 * @param {object} config - Application configuration
 * @param {object} AppDataSource - TypeORM Data Source (เพิ่ม parameter นี้)
 */
function registerScheduledJobs(config, AppDataSource) { // <--- 1. รับ AppDataSource เข้ามา
  try {
    const isCronEnabled = (process.env.ENABLE_YEARLY_RESET_CRON || 'true').toLowerCase() !== 'false';
    const cronTimezone = process.env.CRON_TZ || 'Asia/Bangkok';
    
    if (!isCronEnabled) {
      console.log('[CRON] Yearly reset job is disabled via ENABLE_YEARLY_RESET_CRON=false');
      return;
    }

    // Run at 00:05 on January 1st every year
    cron.schedule('5 0 1 1 *', async () => {
      try {
        console.log('[CRON] Starting yearly leave reset (Direct Function Call)...');
        
        // --- 2. เรียกใช้ Logic โดยตรงตรงนี้ (แทน axios) ---
        const result = await executeResetLogic(AppDataSource, { force: false, strategy: 'zero' });
        // -------------------------------------------------

        console.log('[CRON] Yearly leave reset executed:', result);
      } catch (err) {
        console.error('[CRON] Yearly leave reset failed:', err?.message || err);
      }
    }, { timezone: cronTimezone });

    console.log(`[CRON] Yearly reset job scheduled at 00:05 1 Jan (${cronTimezone}). Set ENABLE_YEARLY_RESET_CRON=false to disable.`);
  } catch (err) {
    console.error('[CRON] Failed to schedule yearly reset job:', err?.message || err);
  }
}

/**
 * Schedule leave type cleanup job
 * ... (ส่วนนี้เหมือนเดิม) ...
 */
function scheduleLeaveTypeCleanup(AppDataSource) {
  try {
    const isCleanupEnabled = (process.env.ENABLE_LEAVE_TYPE_CLEANUP_CRON || 'true').toLowerCase() !== 'false';
    const isQuotaCleanupEnabled = (process.env.ENABLE_LEAVE_QUOTA_CLEANUP_CRON || 'true').toLowerCase() !== 'false';
    const cronTimezone = process.env.CRON_TZ || 'Asia/Bangkok';
    
    if (!isCleanupEnabled) {
      console.log('[CRON] Leave type cleanup job is disabled via ENABLE_LEAVE_TYPE_CLEANUP_CRON=false');
      return;
    }

    // Schedule automatic cleanup every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🔄 Starting scheduled leave type cleanup...');
        
        // Step 1: Clean up orphaned leave types
        const leaveTypeCleanupService = new LeaveTypeCleanupService(AppDataSource);
        const leaveTypeResults = await leaveTypeCleanupService.autoCleanupOrphanedLeaveTypes();
        
        console.log('✅ Leave type cleanup completed:', {
          totalChecked: leaveTypeResults.totalChecked,
          deleted: leaveTypeResults.deleted.length,
          cannotDelete: leaveTypeResults.cannotDelete.length,
          errors: leaveTypeResults.errors.length
        });

        // Step 2: Clean up orphaned leave quota records (if enabled)
        if (isQuotaCleanupEnabled) {
          console.log('🔄 Starting scheduled leave quota cleanup...');
          
          const leaveQuotaCleanupService = new LeaveQuotaCleanupService(AppDataSource);
          const leaveQuotaResults = await leaveQuotaCleanupService.autoCleanupOrphanedLeaveQuotas();
          
          console.log('✅ Leave quota cleanup completed:', {
            totalChecked: leaveQuotaResults.totalChecked,
            deleted: leaveQuotaResults.deleted.length,
            failed: leaveQuotaResults.failed.length,
            totalQuotaRemoved: leaveQuotaResults.totalQuotaRemoved
          });
        } else {
          console.log('[CRON] Leave quota cleanup is disabled via ENABLE_LEAVE_QUOTA_CLEANUP_CRON=false');
        }

        console.log('✅ Scheduled cleanup process completed successfully!');

      } catch (error) {
        console.error('❌ Scheduled cleanup failed:', error);
      }
    }, {
      scheduled: true,
      timezone: cronTimezone
    });

    const quotaStatus = isQuotaCleanupEnabled ? 'enabled' : 'disabled';
    console.log(`[CRON] Leave type cleanup job scheduled at 02:00 daily (${cronTimezone}). Leave quota cleanup: ${quotaStatus}.`);
  } catch (err) {
    console.error('[CRON] Failed to schedule leave type cleanup job:', err?.message || err);
  }
}

module.exports = { registerScheduledJobs, scheduleLeaveTypeCleanup };