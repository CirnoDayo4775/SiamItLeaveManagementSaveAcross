// Authentication and authorization utility functions

export interface User {
  id: string;
  role?: string;
  email?: string;
  full_name?: string;
  [key: string]: any;
}

// Role checking utilities
export const hasRole = (user: User | null, role: string): boolean => {
  return user?.role === role;
};

export const hasAnyRole = (user: User | null, roles: string[]): boolean => {
  return user ? roles.includes(user.role) : false;
};

export const hasAdminRole = (user: User | null): boolean => {
  return hasAnyRole(user, ['admin', 'superadmin']);
};

export const hasSuperAdminRole = (user: User | null): boolean => {
  return hasRole(user, 'superadmin');
};

export const hasEmployeeRole = (user: User | null): boolean => {
  return hasRole(user, 'user') || hasRole(user, 'employee');
};

// Permission checking utilities
export const canManageUsers = (user: User | null): boolean => {
  return hasAdminRole(user);
};

export const canManageLeaveRequests = (user: User | null): boolean => {
  return hasAdminRole(user);
};

export const canViewAllLeaveHistory = (user: User | null): boolean => {
  return hasAdminRole(user);
};

export const canManageSystem = (user: User | null): boolean => {
  return hasSuperAdminRole(user);
};

// User type checking
export const isAdmin = (user: User | null): boolean => {
  return hasRole(user, 'admin');
};

export const isSuperAdmin = (user: User | null): boolean => {
  return hasRole(user, 'superadmin');
};

export const isEmployee = (user: User | null): boolean => {
  return hasEmployeeRole(user);
};

// Role display utilities
export const getRoleDisplayName = (role: string, language: string = 'th'): string => {
  const roleMap = {
    th: {
      'user': 'ผู้ใช้',
      'employee': 'ผู้ใช้',
      'admin': 'ผู้ดูแลระบบ',
      'superadmin': 'ซูเปอร์แอดมิน'
    },
    en: {
      'user': 'User',
      'employee': 'User',
      'admin': 'Admin',
      'superadmin': 'Superadmin'
    }
  };
  
  return roleMap[language as keyof typeof roleMap]?.[role as keyof typeof roleMap.th] || role;
};
