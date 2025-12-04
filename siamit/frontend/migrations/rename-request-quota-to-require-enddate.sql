-- Migration: Rename request_quota column to require_enddate in position table
-- Date: 2024-12-19
-- Description: Renames the request_quota column to require_enddate to better reflect its purpose

-- Check if the column exists before renaming
SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'position'
  AND COLUMN_NAME = 'request_quota'
);

-- Only rename if the column exists
SET @sql = IF(@column_exists > 0,
  'ALTER TABLE position CHANGE COLUMN request_quota require_enddate BOOLEAN DEFAULT FALSE NOT NULL',
  'SELECT "Column request_quota does not exist, skipping rename" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add comment to the column
ALTER TABLE position MODIFY COLUMN require_enddate BOOLEAN DEFAULT FALSE NOT NULL COMMENT 'Whether position requires end work date';
