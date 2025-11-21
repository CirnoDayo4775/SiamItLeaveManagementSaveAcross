// Roles
export const ROLES = ['user', 'admin', 'superadmin'] as const;
export type Role = typeof ROLES[number];

// Tabs (frontend role labels)
export const TABS = ['employee', 'admin', 'superadmin'] as const;
export type Tab = typeof TABS[number];

// Password Strength
export const PASSWORD_STRENGTH = ['weak', 'medium', 'strong'] as const;
export type PasswordStrength = typeof PASSWORD_STRENGTH[number];

// Status
export const LEAVE_STATUS = ['pending', 'approved', 'rejected'] as const;
export type LeaveStatus = typeof LEAVE_STATUS[number];

// Notification Type
export const NOTIFICATION_TYPE = ['info', 'success', 'warning', 'error'] as const;
export type NotificationType = typeof NOTIFICATION_TYPE[number];

// Calendar Event Type
export const CALENDAR_TYPE = ['company', 'annual', 'employee'] as const;
export type CalendarType = typeof CALENDAR_TYPE[number];

// Special values
export const NO_DEPARTMENT = 'No Department';
export const NO_POSITION = 'No Position';
