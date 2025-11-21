/**
 * User Deletion Utilities
 * Provides comprehensive deletion functionality for users, admins, and superadmins
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { parseAttachments } = require('./leaveUtils');

/**
 * Delete all files and data related to a user
 * @param {Object} AppDataSource - Database connection
 * @param {string} userId - User ID to delete
 * @param {string} userRole - User role ('user', 'admin', 'superadmin')
 * @returns {Promise<Object>} Deletion summary
 */
async function deleteUserData(AppDataSource, userId, userRole) {
  const processRepo = AppDataSource.getRepository('User');
  const leaveRequestRepo = AppDataSource.getRepository('LeaveRequest');
  const leaveUsedRepo = AppDataSource.getRepository('LeaveUsed');
  
  const deletionSummary = {
    avatarDeleted: false,
    leaveRequestsDeleted: 0,
    leaveAttachmentsDeleted: 0,
    leaveUsageRecordsDeleted: 0,
    errors: []
  };

  try {
    // Get user info for avatar cleanup from unified users table
    const user = await processRepo.findOneBy({ id: userId });

    // HARD DELETE avatar file if exists
    if (user && user.avatar_url) {
      try {
        const avatarPath = path.join(config.getAvatarsUploadPath(), path.basename(user.avatar_url));
        
        if (fs.existsSync(avatarPath)) {
          // Force delete the avatar file (hard delete)
          fs.unlinkSync(avatarPath);
          
          // Verify file is actually deleted
          if (!fs.existsSync(avatarPath)) {
            deletionSummary.avatarDeleted = true;
            console.log(`✅ HARD DELETED avatar: ${path.basename(user.avatar_url)}`);
          } else {
            console.error(`❌ FAILED to delete avatar: ${path.basename(user.avatar_url)} - file still exists`);
            
            // Try alternative deletion method
            try {
              fs.rmSync(avatarPath, { force: true });
              deletionSummary.avatarDeleted = true;
              console.log(`✅ Force deleted avatar: ${path.basename(user.avatar_url)}`);
            } catch (forceDeleteError) {
              console.error(`❌ Force delete also failed for avatar: ${path.basename(user.avatar_url)}:`, forceDeleteError.message);
              deletionSummary.errors.push(`Avatar force delete error: ${forceDeleteError.message}`);
            }
          }
        } else {
          console.log(`⚠️  Avatar file not found (already deleted?): ${path.basename(user.avatar_url)}`);
        }
      } catch (avatarError) {
        console.error('❌ Error deleting avatar file:', avatarError);
        deletionSummary.errors.push(`Avatar deletion error: ${avatarError.message}`);
        
        // Try alternative deletion method
        try {
          const avatarPath = path.join(config.getAvatarsUploadPath(), path.basename(user.avatar_url));
          fs.rmSync(avatarPath, { force: true });
          deletionSummary.avatarDeleted = true;
          console.log(`✅ Force deleted avatar: ${path.basename(user.avatar_url)}`);
        } catch (forceDeleteError) {
          console.error(`❌ Force delete also failed for avatar: ${path.basename(user.avatar_url)}:`, forceDeleteError.message);
          deletionSummary.errors.push(`Avatar force delete error: ${forceDeleteError.message}`);
        }
      }
    }

    // Skip deleting leave requests - keep them in the system
    const leaveRequests = await leaveRequestRepo.findBy({ Repid: userId });
    deletionSummary.leaveRequestsDeleted = 0; // No leave requests deleted
    console.log(`Preserved ${leaveRequests.length} leave requests for ${userRole} ${userId} - not deleting them`);

    // Delete leave usage records
    const leaveUsedRecords = await leaveUsedRepo.findBy({ user_id: userId });
    await leaveUsedRepo.delete({ user_id: userId });
    deletionSummary.leaveUsageRecordsDeleted = leaveUsedRecords.length;
    console.log(`Deleted ${leaveUsedRecords.length} leave usage records for ${userRole} ${userId}`);

    // Delete from unified users table
    await processRepo.delete({ id: userId });

  } catch (error) {
    console.error(`Error in deleteUserData for ${userRole} ${userId}:`, error);
    deletionSummary.errors.push(`General deletion error: ${error.message}`);
  }

  return deletionSummary;
}

/**
 * Delete user with comprehensive cleanup
 * @param {Object} AppDataSource - Database connection
 * @param {string} userId - User ID to delete
 * @param {string} userRole - User role ('user', 'admin', 'superadmin')
 * @param {Object} userRepo - User repository (User, Admin, or SuperAdmin)
 * @returns {Promise<Object>} Deletion result
 */
async function deleteUserComprehensive(AppDataSource, userId, userRole, userRepo) {
  try {
    // Check if user exists
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new Error(`${userRole} not found`);
    }

    // Delete all related data and files (including user record)
    const deletionSummary = await deleteUserData(AppDataSource, userId, userRole);

    return {
      success: true,
      message: `${userRole} deleted successfully (leave requests preserved)`,
      deletionSummary
    };

  } catch (error) {
    throw error;
  }
}

module.exports = {
  deleteUserData,
  deleteUserComprehensive
};
