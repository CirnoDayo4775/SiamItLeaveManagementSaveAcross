const { LessThan } = require('typeorm');

/**
 * Clean up leave requests older than 2 years
 * @param {Object} AppDataSource - Database connection
 * @returns {Promise<Object>} Cleanup result
 */
async function cleanupOldLeaveRequests(AppDataSource) {
  try {
    const leaveRequestRepo = AppDataSource.getRepository('LeaveRequest');
    
    // Calculate date 2 years ago
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    console.log(`Cleaning up leave requests older than: ${twoYearsAgo.toISOString()}`);
    
    // Find all records older than 2 years
    const oldRecords = await leaveRequestRepo.find({
      where: {
        createdAt: LessThan(twoYearsAgo)
      }
    });
    
    console.log(`Found ${oldRecords.length} records to delete`);
    
    if (oldRecords.length === 0) {
      return {
        success: true,
        message: 'No old records found to delete',
        deletedCount: 0
      };
    }
    
    // Delete the old records
    const result = await leaveRequestRepo.delete({
      createdAt: LessThan(twoYearsAgo)
    });
    
    console.log(`Successfully deleted ${result.affected} old leave request records`);
    
    return {
      success: true,
      message: `Successfully deleted ${result.affected} old leave request records`,
      deletedCount: result.affected
    };
    
  } catch (error) {
    console.error('Error cleaning up old leave requests:', error);
    return {
      success: false,
      message: `Error: ${error.message}`,
      deletedCount: 0
    };
  }
}

/**
 * Manual cleanup function that can be called from API
 */
async function manualCleanup(AppDataSource) {
  console.log('Starting manual cleanup of old leave requests...');
  const result = await cleanupOldLeaveRequests(AppDataSource);
  console.log('Manual cleanup completed:', result);
  return result;
}

module.exports = {
  cleanupOldLeaveRequests,
  manualCleanup
};
