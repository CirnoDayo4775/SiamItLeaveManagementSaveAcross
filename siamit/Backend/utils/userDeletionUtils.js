/**
 * User Deletion Utilities
 * Provides comprehensive deletion functionality for users, admins, and superadmins
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Soft Delete user data (Anonymize & Deactivate)
 * Keeps the record in DB to preserve Referential Integrity for Leave Requests
 * @param {Object} AppDataSource - Database connection
 * @param {string} userId - User ID to delete
 * @param {string} userRole - User role ('user', 'admin', 'superadmin')
 * @returns {Promise<Object>} Deletion summary
 */
async function deleteUserData(AppDataSource, userId, userRole) {
  const userRepo = AppDataSource.getRepository('User');
  // เราไม่เรียก LeaveUsedRepo มาลบแล้ว เพราะต้องการเก็บประวัติการลาไว้ (Soft Delete)
  
  const deletionSummary = {
    avatarDeleted: false,
    userSoftDeleted: false,
    errors: []
  };

  try {
    // 1. หา User
    const user = await userRepo.findOneBy({ id: userId });
    
    if (!user) {
        // ถ้าไม่เจอ User ก็จบการทำงาน (หรือจะ Throw Error ก็ได้ตาม Flow เดิม)
        console.warn(`User ${userId} not found for deletion.`);
        return deletionSummary;
    }

    // 2. HARD DELETE ไฟล์ Avatar จริงๆ (เพื่อประหยัดพื้นที่ Server)
    if (user.avatar_url) {
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
          console.log(`⚠️ Avatar file not found (already deleted?): ${path.basename(user.avatar_url)}`);
        }
      } catch (avatarError) {
        console.error('❌ Error deleting avatar file:', avatarError);
        deletionSummary.errors.push(`Avatar deletion error: ${avatarError.message}`);
      }
    }

    // 3. Soft Delete Logic (เปลี่ยนข้อมูลให้เป็น Anonymous และ Deactivate)
    // ใช้ timestamp ช่วยเพื่อให้ Email ไม่ซ้ำ (Unique Constraint)
    const timestamp = new Date().getTime();
    
    // อัปเดตข้อมูลเพื่อลบตัวตน (Anonymize)
    // หมายเหตุ: ใช้ Property Name ตามที่เห็นใน Controller อื่นๆ (Email, Password ตัวใหญ่)
    user.name = `Deleted User (${userId.substring(0, 8)})`;
    if (user.Email !== undefined) user.Email = `deleted_${userId}_${timestamp}@deleted.com`;
    else user.email = `deleted_${userId}_${timestamp}@deleted.com`; // เผื่อกรณีชื่อ field ต่างกัน
    
    if (user.Password !== undefined) user.Password = 'DELETED_USER';
    else user.password = 'DELETED_USER';

    user.token = null;
    user.avatar_url = null;
    user.lineUserId = null; // ตัดการเชื่อมต่อ LINE (ถ้ามี)
    
    // ตั้งค่า Status
    // หาก Entity User ของคุณไม่มี field 'is_active' อาจต้องเพิ่มใน Entity หรือข้ามบรรทัดนี้ไป
    user.is_active = false; 
    user.Role = 'deleted'; // เปลี่ยน Role เพื่อไม่ให้ Login ได้ หรือเพื่อให้รู้ว่าถูกลบแล้ว

    // 4. บันทึกการเปลี่ยนแปลง (Save instead of Delete)
    await userRepo.save(user);
    
    deletionSummary.userSoftDeleted = true;
    console.log(`✅ Soft deleted user ${userId}. Data preserved but user deactivated.`);

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
 * @param {Object} userRepo - User repository (passed for compatibility, but function uses AppDataSource)
 * @returns {Promise<Object>} Deletion result
 */
async function deleteUserComprehensive(AppDataSource, userId, userRole, userRepo) {
  try {
    // Check if user exists (Optional here as deleteUserData handles it, but good for returning specific error)
    // Note: userRepo passed might be specific, but for soft delete we check mainly via ID
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new Error(`${userRole} not found`);
    }

    // Perform Soft Delete
    const deletionSummary = await deleteUserData(AppDataSource, userId, userRole);

    return {
      success: true,
      message: `${userRole} soft deleted successfully (History preserved)`,
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