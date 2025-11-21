-- Migration: Add soft delete columns to leave_type table
-- Date: 2024-12-19
-- Description: Adds deleted_at and is_active columns for soft delete functionality

-- Add new columns
ALTER TABLE leave_type 
ADD COLUMN deleted_at TIMESTAMP NULL,
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Update existing records to be active
UPDATE leave_type SET is_active = TRUE, deleted_at = NULL;

-- Add index for better performance on soft delete queries
CREATE INDEX idx_leave_type_active ON leave_type(is_active, deleted_at);

-- Add comment to document the purpose
COMMENT ON COLUMN leave_type.deleted_at IS 'Timestamp when the leave type was soft deleted';
COMMENT ON COLUMN leave_type.is_active IS 'Whether the leave type is currently active (TRUE) or inactive (FALSE)';
