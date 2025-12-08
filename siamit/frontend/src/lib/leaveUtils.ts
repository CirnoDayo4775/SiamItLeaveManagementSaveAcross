/**
 * Leave Utility Functions
 * Centralized utility functions for leave-related operations
 */

/**
 * Interface for leave request objects
 */
export interface LeaveRequestData {
  id?: string;
  backdated?: boolean | number | string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  durationType?: string;
  durationHours?: number;
  days?: number;
  status?: string;
  type?: string;
  leaveType?: string;
  leaveTypeName?: string;
  leaveTypeName_th?: string;
  leaveTypeName_en?: string;
  leaveTypeEn?: string;
  reason?: string;
  createdAt?: string;
  submittedDate?: string;
}

/**
 * Interface for leave type from backend
 */
export interface LeaveType {
  id: string;
  leave_type: string;
  leave_type_th: string;
  leave_type_en: string;
}

/**
 * Check if a leave request is retroactive
 * @param leave - Leave request object with backdated property
 * @returns boolean indicating if the leave is retroactive
 */
export const isRetroactiveLeave = (leave: LeaveRequestData): boolean => {
  return leave.backdated === true || leave.backdated === 1 || leave.backdated === "1";
};

/**
 * Calculate hours between two time strings
 * @param start - Start time in HH:mm format
 * @param end - End time in HH:mm format
 * @returns Formatted hours string or null if invalid
 */
export const calcHours = (start: string, end: string): string | null => {
  if (!start || !end) return null;

  try {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    let diff = endMins - startMins;
    if (diff < 0) diff += 24 * 60; // Handle day overflow
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}.${mins.toString().padStart(2, '0')}`;
  } catch {
    return null;
  }
};

/**
 * Get leave type color class based on type
 * @param type - Leave type string
 * @returns CSS class string for text color
 */
export const getTypeColor = (type: string): string => {
  if (!type) return "text-gray-600 dark:text-gray-300";

  const typeLower = type.toLowerCase();

  if (typeLower === 'vacation' || typeLower === 'ลาพักร้อน') return "text-blue-600 dark:text-blue-300";
  if (typeLower === 'sick' || typeLower === 'ลาป่วย') return "text-red-600 dark:text-red-300";
  if (typeLower === 'personal' || typeLower === 'ลากิจ') return "text-green-600 dark:text-green-300";
  if (typeLower === 'emergency' || typeLower === 'ลาฉุกเฉิน') return "text-orange-500 dark:text-orange-300";
  if (typeLower === 'maternity' || typeLower === 'ลาคลอด') return "text-purple-600 dark:text-purple-300";
  if (typeLower === 'hourly' || typeLower === 'ลารายชั่วโมง') return "text-indigo-700 dark:text-indigo-300";

  // Default for other types - use darker color for better visibility
  return "text-gray-800 dark:text-white";
};

/**
 * Get leave type label from leave types array
 * @param typeId - Leave type ID or name
 * @param leaveTypes - Array of leave types from backend
 * @param i18n - i18n object with language property
 * @param t - Translation function
 * @returns Localized leave type name
 */
export const getLeaveTypeLabel = (
  typeId: string,
  leaveTypes: LeaveType[],
  i18n: { language: string },
  t: (key: string) => string
): string => {
  if (!typeId) return '';

  // First try to find in leaveTypes array
  const found = leaveTypes.find(lt => lt.id === typeId || lt.leave_type === typeId);
  if (found) {
    return i18n.language.startsWith('th') ? found.leave_type_th : found.leave_type_en;
  }

  // Fallback: try i18n translation
  if (t(`leaveTypes.${typeId}`) !== `leaveTypes.${typeId}`) {
    return t(`leaveTypes.${typeId}`);
  }

  // Final fallback: return the typeId as is
  return typeId;
};

/**
 * Get leave type display name with fallback logic
 * @param leaveDetail - Leave request object
 * @param leaveTypes - Array of leave types from backend
 * @param i18n - i18n object with language property
 * @param t - Translation function
 * @returns Localized leave type display name
 */
export const getLeaveTypeDisplay = (
  leaveDetail: LeaveRequestData,
  leaveTypes: LeaveType[],
  i18n: { language: string },
  t: (key: string) => string
): string => {
  // First try to get from leaveTypes array (preferred method)
  const leaveTypeId = leaveDetail.leaveType || leaveDetail.type || '';
  if (leaveTypeId) {
    const found = leaveTypes.find(lt => lt.id === leaveTypeId || lt.leave_type === leaveTypeId);
    if (found) {
      return i18n.language.startsWith('th') ? found.leave_type_th : found.leave_type_en;
    }
  }

  // Fallback: try i18n translation
  if (leaveTypeId) {
    const i18nKey = `leaveTypes.${leaveTypeId}`;
    const translated = t(i18nKey);
    if (translated !== i18nKey) {
      return translated;
    }
  }

  // Final fallback: use API fields if available
  if (leaveDetail.leaveTypeName_th && leaveDetail.leaveTypeName_en) {
    return i18n.language.startsWith('th') ? leaveDetail.leaveTypeName_th : leaveDetail.leaveTypeName_en;
  }

  // Last resort: single field or type
  return leaveDetail.leaveTypeName || leaveTypeId || 'Unknown';
};

/**
 * Translate leave type using i18n fallback
 * @param type - Leave type string
 * @param leaveTypes - Array of leave types from backend
 * @param i18n - i18n object with language property
 * @param t - Translation function
 * @returns Localized leave type name
 */
export const translateLeaveType = (
  type: string,
  leaveTypes: LeaveType[],
  i18n: { language: string },
  t: (key: string) => string
): string => {
  if (!type) return '';

  // Check if we have data from backend
  const found = leaveTypes.find(lt => lt.id === type || lt.leave_type === type);
  if (found) {
    return i18n.language.startsWith('th') ? found.leave_type_th : found.leave_type_en;
  }

  // Fallback: use i18n translation
  const typeLower = type.toLowerCase();
  const typeMap: Record<string, string> = {
    'vacation': 'leaveTypes.Vacation',
    'sick': 'leaveTypes.Sick',
    'personal': 'leaveTypes.Personal',
    'emergency': 'leaveTypes.Emergency',
    'maternity': 'leaveTypes.Maternity',
    'ลาพักร้อน': 'leaveTypes.Vacation',
    'ลาป่วย': 'leaveTypes.Sick',
    'ลากิจ': 'leaveTypes.Personal',
    'ลาฉุกเฉิน': 'leaveTypes.Emergency',
    'ลาคลอด': 'leaveTypes.Maternity',
  };

  const i18nKey = typeMap[typeLower] || typeMap[type];
  if (i18nKey) return t(i18nKey);

  // Final fallback: try direct translation or return type as is
  const translatedType = t(`leaveTypes.${type}`);
  return translatedType !== `leaveTypes.${type}` ? translatedType : type;
};

/**
 * Validate time format HH:mm (24-hour format)
 * @param timeStr - Time string to validate
 * @returns boolean indicating if time format is valid
 */
export const isValidTimeFormat = (timeStr: string): boolean => {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
};

/**
 * Auto-format time input by adding colon automatically
 * Examples: 900 -> 09:00, 1730 -> 17:30
 * @param value - Input value to format
 * @returns Formatted time string
 */
export const autoFormatTimeInput = (value: string): string => {
  let digits = value.replace(/[^0-9]/g, "");
  if (digits.length > 4) digits = digits.slice(0, 4);
  if (digits.length >= 3) {
    return digits.slice(0, digits.length - 2) + ":" + digits.slice(-2);
  }
  return digits;
};

/**
 * Get leave notice information (backdated, advance, or current)
 * @param startDate - Start date string or Date object
 * @param endDate - End date string or Date object (optional)
 * @param t - Translation function
 * @returns Notice object with type, message, and className
 */
export const getLeaveNotice = (
  startDate: string | Date | undefined,
  endDate?: string | Date | undefined,
  t?: (key: string) => string
) => {
  if (!startDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDateOnly = new Date(startDate);
  startDateOnly.setHours(0, 0, 0, 0);

  // ถ้าวันที่เริ่มลาน้อยกว่าวันนี้ (ไม่รวมวันนี้) = ลาย้อนหลัง
  if (startDateOnly < today) {
    return {
      type: 'backdated',
      message: t ? t('leave.backdatedNotice') : 'This is a backdated leave request',
      className: 'bg-yellow-50 border-yellow-200 text-yellow-800'
    };
  }

  // ถ้าวันที่เริ่มลามากกว่าวันนี้ = ลาล่วงหน้า
  if (startDateOnly > today) {
    return {
      type: 'advance',
      message: t ? t('leave.advanceNotice') : 'This is an advance leave request',
      className: 'bg-blue-50 border-blue-200 text-blue-800'
    };
  }

  // ถ้าวันที่เริ่มลาเท่ากับวันนี้ = ลาปกติ
  return {
    type: 'current',
    message: t ? t('leave.currentNotice') : 'This is a current leave request',
    className: 'bg-green-50 border-green-200 text-green-800'
  };
};

/**
 * Check if a date is backdated (in the past)
 * @param date - Date string or Date object
 * @returns boolean indicating if date is backdated
 */
export const isDateBackdated = (date: string | Date): boolean => {
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate < today;
};

/**
 * Calculate backdated value for database storage
 * @param startDate - Start date string
 * @returns 1 if backdated, 0 if not
 */
export const calculateBackdatedValue = (startDate: string): number => {
  if (!startDate) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const leaveStart = new Date(startDate);
  leaveStart.setHours(0, 0, 0, 0);

  return leaveStart < today ? 1 : 0;
};
