const axios = require('axios');
const cron = require('node-cron');
const LeaveTypeCleanupService = require('./leaveTypeCleanupService');
const LeaveQuotaCleanupService = require('./leaveQuotaCleanupService');

/**
 * Register all scheduled jobs for the backend application.
 * - Yearly reset of leave usage on Jan 1st 00:05 Asia/Bangkok
 *   Calls POST /api/leave-quota/reset with { force: false, strategy: 'zero' }
 *   and only affects positions with new_year_quota = 0.
 *
 * @param {object} config - Application configuration from ./config
 */
function registerScheduledJobs(config) {
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
        const resetUrl = `${config.server.apiBaseUrl}/api/leave-quota-reset/reset`;
        const response = await axios.post(resetUrl, { force: false, strategy: 'zero' }, { timeout: 60000 });
        console.log('[CRON] Yearly leave reset executed:', response.data);
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
 * Runs daily at 2 AM to clean up orphaned soft-deleted leave types
 * and automatically cleans up orphaned leave quota records afterward
 * @param {Object} AppDataSource - Database connection
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

        // Log details for monitoring
        if (leaveTypeResults.deleted.length > 0) {
          console.log('🗑️ Deleted leave types:', leaveTypeResults.deleted);
        }
        
        if (leaveTypeResults.cannotDelete.length > 0) {
          console.log('⚠️ Cannot delete leave types:', leaveTypeResults.cannotDelete);
        }

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

          // Log details for monitoring
          if (leaveQuotaResults.deleted.length > 0) {
            console.log('🗑️ Deleted leave quota records:', leaveQuotaResults.deleted.map(d => ({
              id: d.id,
              leaveType: d.leaveTypeName,
              quota: d.quota,
              status: d.status
            })));
          }
          
          if (leaveQuotaResults.failed.length > 0) {
            console.log('❌ Failed leave quota deletions:', leaveQuotaResults.failed.map(f => ({
              id: f.id,
              leaveType: f.leaveTypeName,
              error: f.error
            })));
          }
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
    console.log(`[CRON] Set ENABLE_LEAVE_TYPE_CLEANUP_CRON=false to disable leave type cleanup.`);
    console.log(`[CRON] Set ENABLE_LEAVE_QUOTA_CLEANUP_CRON=false to disable leave quota cleanup.`);
  } catch (err) {
    console.error('[CRON] Failed to schedule leave type cleanup job:', err?.message || err);
  }
}

module.exports = { registerScheduledJobs, scheduleLeaveTypeCleanup };


