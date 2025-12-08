// API Constants
// This file contains API endpoint constants and base URL
// For API service methods (get, post, put, delete), use apiService from '@/lib/api'

// ===== Base URL =====
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ===== API Endpoints =====
export const apiEndpoints = {
  auth: {
    login: '/api/login',
    register: '/api/register',
    profile: '/api/profile',
    avatar: '/api/avatar',
    userProfile: '/api/user-profile',
  },
  leave: {
    requests: '/api/leave-request',
    pending: '/api/leave-request/pending',
    detail: (id: string) => `/api/leave-request/detail/${id}`,
    status: (id: string) => `/api/leave-request/${id}/status`,
    delete: (id: string) => `/api/leave-request/${id}`,
    calendar: (year: number) => `/api/leave-request/calendar/${year}`,
    calendarWithMonth: (year: number, month: number) => `/api/leave-request/calendar/${year}?month=${month}`,
  },
  employees: {
    list: '/api/employees',
    detail: (id: string) => `/api/employee/${id}`,
    leaveHistory: (id: string, query?: string) => `/api/employee/${id}/leave-history${query || ''}`,
    avatar: (id: string) => `/api/employee/${id}/avatar`,
  },
  departments: '/api/departments',
  positions: '/api/positions',
  positionsWithQuotas: '/api/positions-with-quotas',
  gender: '/api/genders',
  leaveTypes: '/api/leave-types',
  leaveType: (id: string) => `/api/leave-types/${id}`,
  announcements: '/api/announcements',
  announcement: (id: string) => `/api/announcements/${id}`,
  customHolidays: '/api/custom-holidays',
  customHoliday: (id: string) => `/api/custom-holidays/${id}`,
  customHolidaysByYear: (year: number) => `/api/custom-holidays/year/${year}`,
  customHolidaysByYearMonth: (year: number, month: number) => `/api/custom-holidays/year/${year}/month/${month}`,
  notifications: '/api/notifications',
  markAsRead: (id: string) => `/api/notifications/${id}/read`,
  markAllAsRead: '/api/notifications/read',
  line: {
    linkStatus: '/api/line/link-status',
    loginUrl: '/api/line/login-url',
    unlink: '/api/line/unlink',
  },
  dashboard: {
    stats: '/api/dashboard-stats',
    recentLeaves: '/api/recent-leave-requests',
    myBackdated: '/api/my-backdated',
  },
  leaveHistory: {
    list: '/api/leave-history',
    filters: '/api/leave-history/filters',
  },
  leaveQuota: {
    me: '/api/leave-quota/me',
  },
  admin: {
    leaveHistory: '/api/leave-request/history',
    leavePending: '/api/leave-request/pending',
    dashboardStats: '/api/leave-request/dashboard-stats',
  },
  superAdmin: {
    delete: (id: string) => `/api/superadmin/${id}`,
    admins: (id: string) => `/api/admins/${id}`,
    users: (id: string) => `/api/users/${id}`,
    cleanupOldLeaveRequests: '/api/superadmin/cleanup-old-leave-requests',
  },
  leaveQuotaReset: {
    resetByUsers: '/api/leave-quota-reset/reset-by-users',
  },
};

// NOTE: The 'api' service object has been removed from this file.
// Use 'apiService' from '@/lib/api' instead for all API calls.
// Example:
//   import { apiService } from '@/lib/api';
//   const data = await apiService.get(apiEndpoints.leave.requests);
