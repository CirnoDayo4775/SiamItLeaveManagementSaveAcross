// Business logic constants used throughout the application

// Leave quota reset strategies
export const QUOTA_RESET_STRATEGIES = {
  ZERO: 'zero',
  CARRY_OVER: 'carry_over',
  CUSTOM: 'custom'
} as const;

// Leave request statuses
export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
} as const;

// Position settings
export const POSITION_SETTINGS = {
  NEW_YEAR_QUOTA: {
    RESET: 1,
    NO_RESET: 0
  },
  REQUIRE_ENDDATE: {
    TRUE: true,
    FALSE: false
  }
} as const;

// Leave type settings
export const LEAVE_TYPE_SETTINGS = {
  REQUIRE_ATTACHMENT: {
    TRUE: true,
    FALSE: false
  }
} as const;

// Employee selection modes
export const EMPLOYEE_SELECTION_MODES = {
  ALL: 'all',
  FILTERED: 'filtered',
  SELECTED_ONLY: 'selected_only'
} as const;

// Cleanup operations
export const CLEANUP_OPERATIONS = {
  OLD_LEAVE_REQUESTS: 'old_leave_requests',
  EXPIRED_NOTIFICATIONS: 'expired_notifications',
  ORPHANED_FILES: 'orphaned_files'
} as const;

// Business rules
export const BUSINESS_RULES = {
  MAX_LEAVE_DAYS_PER_YEAR: 20,
  MIN_LEAVE_NOTICE_DAYS: 3,
  MAX_ATTACHMENT_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_ATTACHMENT_TYPES: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']
} as const;

// Time constants
export const TIME_CONSTANTS = {
  WORKING_HOURS_PER_DAY: 8,
  WORKING_START_HOUR: 9,
  WORKING_END_HOUR: 18,
  LUNCH_BREAK_HOURS: 1,
  WORKING_START_TIME: "09:00",
  WORKING_END_TIME: "18:00"
} as const;

// Date constants
export const DATE_CONSTANTS = {
  MIN_DATE: '2000-01-01',
  MAX_DATE: '3000-01-01',
  DEFAULT_YEAR: new Date().getFullYear()
} as const;

// Pagination constants
export const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
} as const;

// Export types for better type safety
export type QuotaResetStrategy = typeof QUOTA_RESET_STRATEGIES[keyof typeof QUOTA_RESET_STRATEGIES];
export type LeaveStatus = typeof LEAVE_STATUS[keyof typeof LEAVE_STATUS];
export type EmployeeSelectionMode = typeof EMPLOYEE_SELECTION_MODES[keyof typeof EMPLOYEE_SELECTION_MODES];
export type CleanupOperation = typeof CLEANUP_OPERATIONS[keyof typeof CLEANUP_OPERATIONS];
