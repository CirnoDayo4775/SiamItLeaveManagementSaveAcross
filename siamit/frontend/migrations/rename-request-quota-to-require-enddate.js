const mysql = require('mysql2/promise');
const config = require('../config.js');

async function renameRequestQuotaColumn() {
  let connection;
  
  try {
    console.log('Starting migration: Rename request_quota to require_enddate...');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: config.database.host,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      port: config.database.port
    });

    console.log('Connected to database successfully');

    // Check if the column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'position' 
      AND COLUMN_NAME = 'request_quota'
    `, [config.database.name]);

    if (columns.length === 0) {
      console.log('Column request_quota does not exist, skipping rename');
      return;
    }

    // Rename the column
    await connection.execute(`
      ALTER TABLE position 
      CHANGE COLUMN request_quota require_enddate BOOLEAN DEFAULT FALSE NOT NULL
    `);

    // Add comment to the column
    await connection.execute(`
      ALTER TABLE position 
      MODIFY COLUMN require_enddate BOOLEAN DEFAULT FALSE NOT NULL 
      COMMENT 'Whether position requires end work date'
    `);

    console.log('Successfully renamed request_quota column to require_enddate');
    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  renameRequestQuotaColumn()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = renameRequestQuotaColumn;
