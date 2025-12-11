import { rateLimiter, RateLimitKeys, formatRemainingTime } from '@/lib/rateLimiter';
import { logger } from '@/lib/logger';
import SessionExpiredDialog from '@/components/dialogs/SessionExpiredDialog';
import { API_BASE_URL } from '@/constants/api';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  position?: string;
  department?: string;
  token?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ role?: string; id: string }>;
  signup: (email: string, password: string, userData: Partial<User>) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  isSessionExpired: boolean;
  closeSessionExpiredDialog: () => void;
}

/**
 * Create a safer default context that throws an error if accessed outside provider
 * This prevents silent failures from using undefined methods
 */
const createDefaultContext = (): AuthContextType => ({
  user: null,
  loading: true,
  login: async () => {
    throw new Error('AuthContext not initialized. Ensure component is wrapped in AuthProvider.');
  },
  signup: async () => {
    throw new Error('AuthContext not initialized. Ensure component is wrapped in AuthProvider.');
  },
  logout: () => {
    throw new Error('AuthContext not initialized. Ensure component is wrapped in AuthProvider.');
  },
  updateUser: () => {
    throw new Error('AuthContext not initialized. Ensure component is wrapped in AuthProvider.');
  },
  isSessionExpired: false,
  closeSessionExpiredDialog: () => {
    throw new Error('AuthContext not initialized. Ensure component is wrapped in AuthProvider.');
  }
});

const AuthContext = createContext<AuthContextType>(createDefaultContext());

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const logoutTimer = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    // Check if user is logged in from localStorage
    const checkUser = () => {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
    };

    checkUser();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (!stored) return;
    let parsedStored;
    try {
      parsedStored = JSON.parse(stored);
    } catch (e) {
      return;
    }
    const token = parsedStored?.token;
    if (!token) return;

    const payload = parseJwt(token);
    if (!payload || !payload.exp) return;

    const exp = payload.exp * 1000; // JWT exp เป็นวินาที, JS ต้อง ms
    const now = Date.now();

    if (exp <= now) {
      setIsSessionExpired(true);
      return;
    }

    // ตั้ง timer auto logout
    const timeout = exp - now;
    logoutTimer.current = setTimeout(() => {
      setIsSessionExpired(true);
    }, timeout);

    // cleanup timer
    return () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };
  }, [user, t]);

  const login = async (email: string, password: string): Promise<{ role?: string; id: string }> => {
    // Check rate limiting
    if (!rateLimiter.isAllowed(RateLimitKeys.LOGIN)) {
      const remainingTime = rateLimiter.getBlockedTimeRemaining(RateLimitKeys.LOGIN);
      const formattedTime = formatRemainingTime(remainingTime);
      throw new Error(
        t('auth.rateLimitExceeded', `คุณพยายาม login ล้มเหลวหลายครั้งเกินไป กรุณารออีก ${formattedTime}`)
      );
    }

    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      // Login failed - rate limiter already recorded this attempt
      throw new Error(data.message || t('auth.loginError'));
    }

    // Login successful - reset rate limiter for this user
    rateLimiter.reset(RateLimitKeys.LOGIN);

    // Initial user info from login
    const userInfo = {
      id: data.data?.userId || data.data?.repid || '',
      email: email,
      role: data.data?.role,
      token: data.data?.token
    };
    setUser(userInfo);
    localStorage.setItem('currentUser', JSON.stringify(userInfo));

    // Parallelize Profile and Avatar fetching for faster login
    try {
      const [profileRes, avatarRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/profile`, {
          headers: { 'Authorization': `Bearer ${data.data?.token}` }
        }),
        fetch(`${API_BASE_URL}/api/avatar`, {
          headers: { 'Authorization': `Bearer ${data.data?.token}` }
        })
      ]);

      let updatedUser = { ...userInfo };

      // Process Profile
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.success) {
          const d = profileData.data;
          updatedUser = {
            ...updatedUser,
            full_name: d.name,
            position: d.position,
            department: d.department,
            email: d.email,
          };
        }
      }

      // Process Avatar
      if (avatarRes.ok) {
        const avatarData = await avatarRes.json();
        if (avatarData.success && avatarData.avatar_url) {
          updatedUser = { ...updatedUser, avatar_url: avatarData.avatar_url };
        }
      }

      // Update state once
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

    } catch (err) {
      // Non-critical errors, login still successful
      logger.error("Error fetching user details:", err);
    }
    // Return basic user info for immediate use in Login component
    return { role: userInfo.role, id: userInfo.id };
  };

const signup = async (email: string, password: string, userData: any) => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const token = currentUser?.token;

    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email: email,
        password: password,
        name: userData.full_name,
        department: userData.department,
        position: userData.position,
        role: userData.role || 'employee', 
        gender: userData.gender,
        dob: userData.dob,
        phone_number: userData.phone_number,
        start_work: userData.start_work,
        end_work: userData.end_work,
      }),
    });

    const data = await response.json(); // ตัวแปร data นี้คือ JSON ทั้งก้อนที่รับมา

    if (!response.ok) {
      // 🔍 แก้ไขจุดนี้: เช็คให้ครอบคลุมทั้ง errors ชั้นนอก และ errors ในชั้น data
      const errorMessage = 
        // 1. ลองหาใน data.data.errors (ตามโครงสร้างที่คุณส่งมา)
        (data.data && Array.isArray(data.data.errors) && data.data.errors.length > 0 ? data.data.errors[0] : null) ||
        // 2. หรือถ้ามันอยู่ที่ชั้นนอก data.errors
        (data.errors && Array.isArray(data.errors) && data.errors.length > 0 ? data.errors[0] : null) ||
        // 3. ถ้าไม่มีเลย ให้ใช้ message ปกติ
        data.message || 
        'Registration failed';

      throw new Error(errorMessage);
    }
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const updateUser = (updates: Partial<User>) => {
    setUser(prevUser => ({ ...prevUser, ...updates } as User));
  };

  const closeSessionExpiredDialog = () => {
    setIsSessionExpired(false);
    logout();
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUser, loading, isSessionExpired, closeSessionExpiredDialog }}>
      <SessionExpiredDialog open={isSessionExpired} onClose={closeSessionExpiredDialog} />
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
