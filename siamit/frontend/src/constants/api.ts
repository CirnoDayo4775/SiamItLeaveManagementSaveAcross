// api.ts

// ===== Base URL =====
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ===== API Endpoints (เก็บเหมือนเดิม) =====
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

// ===== Helper ดึง Token =====
const getAuthHeader = () => {
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const token = currentUser?.token;

    if (!token) {
      console.warn("No token found in localStorage");
      return {}; // หรือ throw new Error("No token available");
    }

    return { Authorization: `Bearer ${token}` };
  } catch (e) {
    console.error("Error parsing currentUser from localStorage", e);
    return {};
  }
};

// ===== Join URL =====
const joinUrl = (base: string, path: string) => {
  if (!base) throw new Error("API_BASE_URL is undefined");
  if (!path) throw new Error("API path is undefined");

  const formattedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const formattedPath = path.startsWith("/") ? path : `/${path}`;
  return `${formattedBase}${formattedPath}`;
};

// ===== Fetch Wrapper =====
export const api = {
  get: async (path: string) => {
    const res = await fetch(joinUrl(API_BASE_URL, path), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
    });
    return res.json();
  },

  post: async (path: string, body: any) => {
    const res = await fetch(joinUrl(API_BASE_URL, path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(body),
    });
    return res.json();
  },

  put: async (path: string, body: any) => {
    const res = await fetch(joinUrl(API_BASE_URL, path), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(body),
    });
    return res.json();
  },

  delete: async (path: string) => {
    const res = await fetch(joinUrl(API_BASE_URL, path), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
    });
    return res.json();
  },
};
