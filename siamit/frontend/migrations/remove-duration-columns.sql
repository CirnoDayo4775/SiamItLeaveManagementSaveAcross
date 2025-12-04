-- Migration: Remove unused duration columns from leave_request table
-- These columns are not used by the system as duration is calculated on-the-fly

-- Drop the columns if they exist
ALTER TABLE leave_request DROP COLUMN IF EXISTS days;
ALTER TABLE leave_request DROP COLUMN IF EXISTS durationType;
ALTER TABLE leave_request DROP COLUMN IF EXISTS durationHours;

-- Verify the columns are removed
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'leave_request' AND TABLE_SCHEMA = DATABASE();
