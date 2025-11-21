/**
 * Migration: Add soft delete columns to leave_type table
 * Date: 2024-12-19
 * Description: Adds deleted_at and is_active columns for soft delete functionality
 */

const { DataSource } = require('typeorm');
const config = require('../config');

async function migrate() {
  let dataSource;
  
  try {
    console.log('Starting migration: Add soft delete to leave_type table...');
    
    // Create data source
    dataSource = new DataSource({
      type: config.database.type,
      host: config.database.host,
      port: config.database.port,
      username: config.database.username,
      password: config.database.password,
      database: config.database.database,
      synchronize: false,
      logging: true
    });
    
    await dataSource.initialize();
    console.log('Database connection established');
    
    // Add new columns
    console.log('Adding deleted_at column...');
    await dataSource.query(`
      ALTER TABLE leave_type 
      ADD COLUMN deleted_at TIMESTAMP NULL
    `);
    
    console.log('Adding is_active column...');
    await dataSource.query(`
      ALTER TABLE leave_type 
      ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE
    `);
    
    // Update existing records
    console.log('Updating existing records...');
    await dataSource.query(`
      UPDATE leave_type 
      SET is_active = TRUE, deleted_at = NULL
    `);
    
    // Add index for better performance
    console.log('Creating index...');
    await dataSource.query(`
      CREATE INDEX idx_leave_type_active 
      ON leave_type(is_active, deleted_at)
    `);
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };
