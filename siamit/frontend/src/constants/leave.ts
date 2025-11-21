// Leave-related constants used throughout the application

import { STATUS } from './status';

// Leave duration types
export const LEAVE_DURATION_TYPES = {
  FULL_DAY: 'full_day',
  HALF_DAY: 'half_day',
  HOURS: 'hours'
} as const;

export type LeaveDurationType = typeof LEAVE_DURATION_TYPES[keyof typeof LEAVE_DURATION_TYPES];

// Leave duration display names
export const LEAVE_DURATION_DISPLAY_NAMES = {
  [LEAVE_DURATION_TYPES.FULL_DAY]: {
    th: 'เต็มวัน',
    en: 'Full Day'
  },
  [LEAVE_DURATION_TYPES.HALF_DAY]: {
    th: 'ครึ่งวัน',
    en: 'Half Day'
  },
  [LEAVE_DURATION_TYPES.HOURS]: {
    th: 'ชั่วโมง',
    en: 'Hours'
  }
} as const;

// Leave request statuses
export const LEAVE_STATUS = {
  ...STATUS,
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: STATUS.APPROVED,
  REJECTED: STATUS.REJECTED,
  CANCELLED: STATUS.CANCELLED
} as const;

export type LeaveStatus = typeof LEAVE_STATUS[keyof typeof LEAVE_STATUS];

// Leave request priorities
export const LEAVE_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
} as const;

export type LeavePriority = typeof LEAVE_PRIORITIES[keyof typeof LEAVE_PRIORITIES];

// Leave priority display names
export const LEAVE_PRIORITY_DISPLAY_NAMES = {
  [LEAVE_PRIORITIES.LOW]: {
    th: 'ต่ำ',
    en: 'Low'
  },
  [LEAVE_PRIORITIES.NORMAL]: {
    th: 'ปกติ',
    en: 'Normal'
  },
  [LEAVE_PRIORITIES.HIGH]: {
    th: 'สูง',
    en: 'High'
  },
  [LEAVE_PRIORITIES.URGENT]: {
    th: 'เร่งด่วน',
    en: 'Urgent'
  }
} as const;

// Leave priority colors
export const LEAVE_PRIORITY_COLORS = {
  [LEAVE_PRIORITIES.LOW]: 'bg-gray-100 text-gray-800',
  [LEAVE_PRIORITIES.NORMAL]: 'bg-blue-100 text-blue-800',
  [LEAVE_PRIORITIES.HIGH]: 'bg-orange-100 text-orange-800',
  [LEAVE_PRIORITIES.URGENT]: 'bg-red-100 text-red-800'
} as const;

// Maximum leave request values
export const LEAVE_LIMITS = {
  MAX_DAYS_PER_REQUEST: 30,
  MAX_HOURS_PER_REQUEST: 240,
  MAX_ATTACHMENTS: 5,
  MAX_ATTACHMENT_SIZE: 10 * 1024 * 1024, // 10MB
  MIN_NOTICE_DAYS: 1,
  MAX_BACKDATED_DAYS: 7
} as const;

// Leave request validation rules
export const LEAVE_VALIDATION = {
  MIN_REASON_LENGTH: 10,
  MAX_REASON_LENGTH: 1000,
  ALLOWED_FILE_TYPES: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
  MAX_FILE_SIZE: LEAVE_LIMITS.MAX_ATTACHMENT_SIZE
} as const;

// Default leave request settings
export const LEAVE_DEFAULTS = {
  DEFAULT_DURATION_TYPE: LEAVE_DURATION_TYPES.FULL_DAY,
  DEFAULT_PRIORITY: LEAVE_PRIORITIES.NORMAL,
  DEFAULT_STATUS: LEAVE_STATUS.DRAFT
} as const;
