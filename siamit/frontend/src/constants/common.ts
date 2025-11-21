// Common constants used throughout the application

// Month names for different languages
export const monthNames = {
  th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};

// Common status values
export const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ALL: 'all'
} as const;

// Common roles
export const ROLES = {
  EMPLOYEE: 'employee',
  ADMIN: 'admin',
  SUPER_ADMIN: 'superadmin'
} as const;

// Common file types
export const FILE_TYPES = {
  IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  DOCUMENT: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt']
} as const;

// Common HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const;

// Common time units
export const TIME_UNITS = {
  HOURS: {
    th: 'ชม',
    en: 'Hours'
  },
  DAYS: {
    th: 'วัน',
    en: 'Days'
  }
} as const;

// Common pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
} as const;

// Common date formats
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DD',
  DISPLAY: 'DD/MM/YYYY',
  DISPLAY_WITH_TIME: 'DD/MM/YYYY HH:mm'
} as const;

// Common validation rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 6,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[0-9+\-\s()]+$/
} as const;

// Common error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred',
  UNAUTHORIZED: 'Unauthorized access',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation failed',
  SERVER_ERROR: 'Server error occurred'
} as const;

// Common success messages
export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: 'Saved successfully',
  DELETE_SUCCESS: 'Deleted successfully',
  UPDATE_SUCCESS: 'Updated successfully',
  CREATE_SUCCESS: 'Created successfully'
} as const;

// Import UI constants to avoid duplication
export { ANIMATION_DELAYS, BREAKPOINTS } from './ui'; 