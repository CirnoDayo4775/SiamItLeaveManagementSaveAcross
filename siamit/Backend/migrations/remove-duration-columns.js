const { createConnection } = require('typeorm');
const config = require('../config');

async function removeDurationColumns() {
  try {
    console.log('🗑️  Starting removal of duration columns from leave_request table...');
    
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // Drop the columns
      await queryRunner.query('ALTER TABLE leave_request DROP COLUMN IF EXISTS days');
      await queryRunner.query('ALTER TABLE leave_request DROP COLUMN IF EXISTS durationType');
      await queryRunner.query('ALTER TABLE leave_request DROP COLUMN IF EXISTS durationHours');
      
      console.log('✅ Successfully removed duration columns from leave_request table');
      
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  } catch (error) {
    console.error('❌ Error removing duration columns:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  removeDurationColumns()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { removeDurationColumns };
