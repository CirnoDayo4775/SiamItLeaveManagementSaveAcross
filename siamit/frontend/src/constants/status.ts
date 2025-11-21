// Status constants used throughout the application

export const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  ALL: 'all'
} as const;

export type RequestStatus = typeof STATUS[keyof typeof STATUS];

// Status display names for different languages
export const STATUS_DISPLAY_NAMES = {
  [STATUS.PENDING]: {
    th: 'รอการอนุมัติ',
    en: 'Pending'
  },
  [STATUS.APPROVED]: {
    th: 'อนุมัติแล้ว',
    en: 'Approved'
  },
  [STATUS.REJECTED]: {
    th: 'ปฏิเสธแล้ว',
    en: 'Rejected'
  },
  [STATUS.CANCELLED]: {
    th: 'ยกเลิกแล้ว',
    en: 'Cancelled'
  }
} as const;

// Status colors for UI components
export const STATUS_COLORS = {
  [STATUS.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [STATUS.APPROVED]: 'bg-green-100 text-green-800 border-green-200',
  [STATUS.REJECTED]: 'bg-red-100 text-red-800 border-red-200',
  [STATUS.CANCELLED]: 'bg-gray-100 text-gray-800 border-gray-200'
} as const;

// Status icons for UI components
export const STATUS_ICONS = {
  [STATUS.PENDING]: 'Clock',
  [STATUS.APPROVED]: 'CheckCircle',
  [STATUS.REJECTED]: 'XCircle',
  [STATUS.CANCELLED]: 'X'
} as const;

// Check if status is final (no further changes possible)
export const isFinalStatus = (status: RequestStatus): boolean => {
  return [STATUS.APPROVED, STATUS.REJECTED, STATUS.CANCELLED].includes(status as any);
};

// Check if status can be changed
export const canChangeStatus = (currentStatus: RequestStatus, newStatus: RequestStatus): boolean => {
  if (isFinalStatus(currentStatus)) return false;
  return [STATUS.APPROVED, STATUS.REJECTED, STATUS.CANCELLED].includes(newStatus as any);
};
