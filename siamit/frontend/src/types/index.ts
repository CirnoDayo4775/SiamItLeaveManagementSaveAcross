// User Types
export interface User {
  id: string;
  full_name: string;
  email: string;
  department: string;
  position: string;
  avatar?: string;
  role: Role;
}

// Position Types
export interface Position {
  id: string;
  position_name_en: string;
  position_name_th: string;
  require_enddate: boolean;
  quotas?: Record<string, number>;
}

// Department Types
export interface Department {
  id: string;
  department_name_en: string;
  department_name_th: string;
}

// Leave Types
export interface LeaveType {
  id: string;
  leave_type: string;
  leave_type_en: string;
  leave_type_th: string;
  quota?: number;
}

// Leave Request Types
export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  attachments?: string[];
  created_at: string;
  updated_at: string;
  user?: User;
  leave_type?: LeaveType;
  // Additional fields for leave type names (for inactive/deleted types)
  leaveTypeName_th?: string;
  leaveTypeName_en?: string;
  // Additional fields that might be present
  leaveType?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  submittedDate?: string;
  duration?: number;
  durationType?: string;
  durationHours?: number;
  backdated?: number;
}

// Employee Types
export interface Employee {
  id: string;
  full_name: string;
  email: string;
  department_id: string;
  position_id: string;
  avatar?: string;
  department?: Department;
  position?: Position;
}

// Announcement Types
export interface Announcement {
  id: string;
  title: string;
  content: string;
  image?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  createdByName?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  totalPages?: number;
  summary?: any;
}

// Form Types
export interface PositionForm {
  name_en: string;
  name_th: string;
  quotas: Record<string, number>;
  require_enddate: boolean;
}

export interface DepartmentForm {
  name_en: string;
  name_th: string;
}

// Filter Types
export interface LeaveHistoryFilters {
  leaveType?: string;
  month?: string;
  year?: string;
  status?: string;
  retroactive?: string;
  date?: string;
}

// Pagination Types
export interface PaginationParams {
  page: number;
  limit: number;
}

// File Upload Types
export interface FileUploadResponse {
  success: boolean;
  file_url?: string;
  message?: string;
}

// Notification Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

// Calendar Event Types
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: CalendarType;
  isDual?: boolean;
}

// Error Types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

import type { Role, LeaveStatus, NotificationType, CalendarType } from '@/constants/roles';
