import SessionExpiredDialog from '@/components/dialogs/SessionExpiredDialog';
import { API_BASE_URL } from '@/constants/api';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: 'employee' | 'admin' | 'superadmin';
  department?: string;
  department_name_th?: string;
  department_name_en?: string;
  position?: string;
  position_name_th?: string;
  position_name_en?: string;
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  phone_number?: string;
  start_work?: string;
  end_work?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, userData: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  loading: boolean;
  showSessionExpiredDialog: () => void;
  avatarPreviewUrl?: string | null;
  setAvatarPreviewUrl?: (url: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.warn('useAuth must be used within an AuthProvider');
    // Return a default context to prevent crashes
    return {
      user: null,
      login: async () => {},
      signup: async () => {},
      logout: async () => {},
      updateUser: () => {},
      loading: true,
      showSessionExpiredDialog: () => {},
    };
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
  const [showSessionExpiredDialog, setShowSessionExpiredDialog] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
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
      setShowSessionExpiredDialog(true);
      return;
    }

    // ตั้ง timer auto logout
    const timeout = exp - now;
    logoutTimer.current = setTimeout(() => {
      setShowSessionExpiredDialog(true);
    }, timeout);

    // cleanup timer
    return () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };
  }, [user, t]);

  const login = async (email: string, password: string) => {
    console.log(email);
    console.log(password);
          const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || t('auth.loginError'));
    }

    // Initial user info from login
    const userInfo = {
      id: data.data?.userId || data.data?.repid || '',
      email: email,
      role: data.data?.role,
      token: data.data?.token
    };
    setUser(userInfo);
    localStorage.setItem('currentUser', JSON.stringify(userInfo));
 
    // Fetch profile info after login
    try {
      const profileRes = await fetch(`${API_BASE_URL}/api/profile`, {
        headers: { 'Authorization': `Bearer ${data.data?.token}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.success) {
          const d = profileData.data;
          const updatedUser = {
            ...userInfo,
            full_name: d.name,
            position: d.position,
            department: d.department,
            email: d.email,
          };
          setUser(updatedUser);
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
      }
    } catch (err) {
     console.log(err);
    }

    // Fetch avatar URL after login
    try {
      const avatarResponse = await fetch(`${API_BASE_URL}/api/avatar`, {
         headers: { 'Authorization': `Bearer ${data.data?.token}` }
      });
      if (avatarResponse.ok) {
        const avatarData = await avatarResponse.json();
        if (avatarData.success && avatarData.avatar_url) {
          setUser(prev => {
            if (!prev) return prev;
            const updatedUserInfo = { ...prev, avatar_url: avatarData.avatar_url };
            localStorage.setItem('currentUser', JSON.stringify(updatedUserInfo));
            return updatedUserInfo;
          });
        }
      }
    } catch (err) {
      // Avatar fetch failed, but login is still successful
    }
  };

  const signup = async (email: string, password: string, userData: Partial<User>) => {
    // เรียก API backend
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
const token = currentUser?.token;


    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' ,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: userData.full_name,
        position: userData.position,
        department: userData.department,
        email: email,         // <-- แก้ตรงนี้
        password: password,   // <-- แก้ตรงนี้
        Role: userData.role || 'employee',
        gender: userData.gender,
        dob: userData.dob,
        phone_number: userData.phone_number,
        start_work: userData.start_work,
        end_work: userData.end_work,
      }),
    });
    const data = await response.json();
    
    // Debug logging
    console.log('Registration response status:', response.status);
    console.log('Registration response data:', data);

    if (!response.ok) {
      // Check if the error is in data.data.errors (array) or data.message
      let errorMessage;
      if (data.data && data.data.errors && Array.isArray(data.data.errors)) {
        // Get the first error message from the array
        errorMessage = data.data.errors[0];
      } else {
        errorMessage = data.errors || data.message || data.error || 'สมัครสมาชิกไม่สำเร็จ';
      }
      console.log('Extracted error message:', errorMessage);
      throw new Error(errorMessage);
    }
    // สมัครสมาชิกสำเร็จ ไม่ต้อง login อัตโนมัติ ให้ user ไป login เอง
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('currentUser');

    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
  };

  const value = {
    user,
    login,
    signup,
    logout,
    updateUser,
    loading,
    showSessionExpiredDialog: () => setShowSessionExpiredDialog(true),
    avatarPreviewUrl,
    setAvatarPreviewUrl,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredDialog 
        open={showSessionExpiredDialog} 
        onOpenChange={setShowSessionExpiredDialog} 
      />
    </AuthContext.Provider>
  );
};
