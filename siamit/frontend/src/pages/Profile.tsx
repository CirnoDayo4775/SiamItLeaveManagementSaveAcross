import AvatarCropDialog from '@/components/dialogs/AvatarCropDialog';
import ChangePasswordDialog from "@/components/dialogs/ChangePasswordDialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiEndpoints } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotification } from '@/contexts/PushNotificationContext';
import { useSocket } from '@/contexts/SocketContext';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/lib/api';
import { withCacheBust } from '@/lib/url';
import { Bell, Building, Camera, Crown, Lock, Mail, Save, Shield } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const Profile = () => {
  const { t, i18n } = useTranslation();
  const { user, updateUser, showSessionExpiredDialog, avatarPreviewUrl, setAvatarPreviewUrl } = useAuth();
  const { toast } = useToast();
  const { enabled: pushNotificationEnabled, setEnabled: setPushNotificationEnabled } = usePushNotification();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const { socket, isConnected } = useSocket();
  const [avatarKey, setAvatarKey] = useState<number>(0);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    department: '',
    position: '',
    gender: '',
    dob: '',
    phone_number: '',
    start_work: '',
    end_work: '',
  });
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<{ id: string; position_name_en: string; position_name_th: string; require_enddate?: boolean }[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [positionsLoaded, setPositionsLoaded] = useState(false);
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [leaveQuota, setLeaveQuota] = useState<any[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [allLeaveTypes, setAllLeaveTypes] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingCroppedFile, setPendingCroppedFile] = useState<File | null>(null);


  const getKeyByLabel = (label: string, options: string[], tPrefix: string) => {
    for (const key of options) {
      if (t(`${tPrefix}.${key}`) === label) return key;
    }
    return label; // fallback: assume it's already a key
  };

  const normalizeKey = (value: string, options: string[], tPrefix: string) => {
    if (!value) return '';
    // If value is like 'positions.Employee' or 'departments.Customer Service', strip the prefix
    if (value.startsWith(`${tPrefix}.`)) {
      return value.replace(`${tPrefix}.`, '').replace(/\s/g, '');
    }
    // If value matches a label, map to key
    for (const key of options) {
      if (t(`${tPrefix}.${key}`) === value) return key;
    }
    return value; // fallback: assume it's already a key
  };

  const extractKey = (value: string, tPrefix: string) => {
    if (!value) return '';
    // If value is like 'positions.Employee' or 'departments.Customer Service', extract the part after the dot and remove spaces
    if (value.startsWith(`${tPrefix}.`)) {
      const raw = value.split('.').slice(1).join('.').replace(/\s/g, '');
      // Lowercase first letter for consistency with keys
      return raw.charAt(0).toLowerCase() + raw.slice(1);
    }
    // If value is a label, try to map to key (not implemented here, but could be added)
    return value;
  };



  // Fetch profile from backend on mount
  useEffect(() => {
    if (!positionsLoaded || !departmentsLoaded) return;
    // Fetch profile from backend
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiService.get(apiEndpoints.auth.profile);
        const data = res.data;


        // Only set form data if profile hasn't been loaded yet
        if (!profileLoaded) {
          setFormData({
            full_name: data.name || '',
            email: data.email || '',
            department: data.department_id ? String(data.department_id) : '',
            position: data.position_id ? String(data.position_id) : '',
            gender: data.gender || '',
            dob: data.dob || '',
            phone_number: data.phone_number || '',
            start_work: data.start_work || '',
            end_work: data.end_work || '',
          });
          setProfileLoaded(true);
        }

        // Update user context with latest data
        updateUser({
          full_name: data.name,
          email: data.email,
          department: data.department_name || '', // for display
          position: data.position_name || '',     // for display
        });
      } catch (err: any) {
        if (err.response?.status === 401) {
          showSessionExpiredDialog();
          return;
        }
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [positionsLoaded, departmentsLoaded]);

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const res = await apiService.get(apiEndpoints.auth.avatar);
        if (res.success && res.avatar_url) {
          setAvatarUrl(`${import.meta.env.VITE_API_BASE_URL}${res.avatar_url}`);
          if (!user?.avatar_url) {
            updateUser({ avatar_url: res.avatar_url });
          }
        } else {
          setAvatarUrl(null);
        }
      } catch (err) {
        setAvatarUrl(null);
      }
    };
    fetchAvatar();
  }, []);

  useEffect(() => {
    const fetchPositionsAndDepartments = async () => {
      try {
        const posData = await apiService.get(apiEndpoints.positions);
        const pos = posData.data.map((p: any) => ({
          id: p.id,
          position_name_en: p.position_name_en,
          position_name_th: p.position_name_th,
          require_enddate: !!p.require_enddate
        }));
        setPositions(pos);
        setPositionsLoaded(true);
      } catch {
        setPositionsLoaded(true);
      }
      try {
        const deptData = await apiService.get(apiEndpoints.departments);
        const depts = deptData.data.map((d: any) => ({
          id: d.id,
          department_name_en: d.department_name_en,
          department_name_th: d.department_name_th
        }));
        setDepartments(depts);
        setDepartmentsLoaded(true);
      } catch {
        setDepartmentsLoaded(true);
      }
    };
    fetchPositionsAndDepartments();
  }, []);

  useEffect(() => {
    const fetchLeaveQuota = async () => {
      setLeaveLoading(true);
      try {
        const res = await apiService.get(apiEndpoints.leaveQuota.me);
        if (res.success) {
          setLeaveQuota(res.data);
        } else {
          setLeaveQuota([]);
        }
      } catch (err) {
        setLeaveQuota([]);
      } finally {
        setLeaveLoading(false);
      }
    };
    fetchLeaveQuota();
  }, []);

  useEffect(() => {
    const fetchAllLeaveTypes = async () => {
      try {
        const res = await apiService.get(apiEndpoints.leaveTypes);
        const data = res.data;
        if (res.success) {
          setAllLeaveTypes(data);
        } else {
          setAllLeaveTypes([]);
        }
      } catch {
        setAllLeaveTypes([]);
      }
    };
    fetchAllLeaveTypes();
  }, []);

  useEffect(() => {
    // This effect is no longer needed as pushNotificationEnabled is managed by usePushNotification
  }, [pushNotificationEnabled]);

  // Listen for enable push notifications event
  useEffect(() => {
    const handleEnablePushNotifications = () => {
      setPushNotificationEnabled(true);
    };

    window.addEventListener('enablePushNotifications', handleEnablePushNotifications);
    return () => {
      window.removeEventListener('enablePushNotifications', handleEnablePushNotifications);
    };
  }, [setPushNotificationEnabled]);

  // Simple random color system for leave types
  const getLeaveTypeColor = (leaveTypeId: string) => {
    const colorClasses = [
      'bg-blue-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-purple-500',
      'bg-red-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-yellow-500',
      'bg-cyan-500',
      'bg-emerald-500',
      'bg-rose-500',
      'bg-violet-500',
      'bg-sky-500',
      'bg-lime-500',
    ];

    // Use the leave type ID to generate a consistent random color
    const hash = leaveTypeId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    return colorClasses[Math.abs(hash) % colorClasses.length];
  };

  // New leaveStats for new API response
  const leaveStats = leaveQuota
    .filter(item => {
      // Filter out emergency leave type
      const leaveTypeEn = item.leave_type_en?.toLowerCase() || '';
      const leaveTypeTh = item.leave_type_th?.toLowerCase() || '';
      return !leaveTypeEn.includes('emergency') && !leaveTypeTh.includes('ฉุกเฉิน');
    })
    .map(item => {
      return {
        label: i18n.language.startsWith('th') ? (item.leave_type_th || item.leave_type_en) : (item.leave_type_en || item.leave_type_th),
        used: { days: item.used_day ?? '-', hours: item.used_hour ?? '-' },
        quota: item.quota,
        color: getLeaveTypeColor(item.id), // Use dynamic color based on leave type ID
        type: item.leave_type_en,
        remaining: { days: item.remaining_day ?? '-', hours: item.remaining_hour ?? '-' },
        quotaRaw: item.quota,
        unit: 'day',
      };
    });

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  // Force reload avatar from server
  const forceReloadAvatar = async () => {
    try {
      const res = await apiService.get(apiEndpoints.auth.avatar);
      if (res.success && res.avatar_url) {
        const timestamp = Date.now();
        const random = Math.random();
        const newUrl = `${import.meta.env.VITE_API_BASE_URL}${res.avatar_url}?v=${timestamp}&t=${random}&reload=true`;

        // Clear current avatar first to force reload
        setAvatarUrl(null);
        setAvatarKey(prev => prev + 1);

        // Set new avatar after a brief delay
        setTimeout(() => {
          setAvatarUrl(newUrl);
          setAvatarKey(prev => prev + 1);
          updateUser({ avatar_url: res.avatar_url });
        }, 50);
      }
    } catch (err) {
      console.error('Failed to reload avatar:', err);
    }
  };

  // Force complete avatar refresh - clears cache and reloads
  const forceCompleteAvatarRefresh = async () => {
    try {
      // Clear current avatar
      setAvatarUrl(null);
      setAvatarKey(prev => prev + 1);

      // Wait a moment then fetch fresh avatar
      setTimeout(async () => {
        await forceReloadAvatar();
      }, 100);
    } catch (err) {
      console.error('Failed to force complete avatar refresh:', err);
    }
  };

  // Refresh page data when cancel is clicked
  const handleCancel = async () => {
    setIsEditing(false);

    // Fetch fresh profile data
    try {
      setLoading(true);
      const res = await apiService.get(apiEndpoints.auth.profile);
      const data = res.data;

      setFormData({
        full_name: data.full_name || '',
        email: data.email || '',
        department: data.department?.id || '',
        position: data.position?.id || '',
        gender: data.gender || '',
        dob: data.dob || '',
        phone_number: data.phone_number || '',
        start_work: data.start_work || '',
        end_work: data.end_work || '',
      });

      // Update user context
      updateUser({
        full_name: data.full_name,
        email: data.email,
        department: data.department,
        position: data.position,
        gender: data.gender,
        dob: data.dob,
        phone_number: data.phone_number,
        start_work: data.start_work,
        end_work: data.end_work,
      });

      setProfileLoaded(true);
    } catch (err: any) {
      console.error('Failed to refresh profile data:', err);
      if (err.response?.status === 401) {
        showSessionExpiredDialog();
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  // Upload avatar utility with optional optimistic preview URL and realtime fan-out
  const uploadAvatar = async (file: File, localUrl?: string) => {
    const previousUrl = avatarUrl;
    if (localUrl) setAvatarUrl(localUrl);
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await apiService.post(apiEndpoints.auth.avatar, formData);
      if (res?.success) {
        // Force immediate update with aggressive cache busting
        const timestamp = Date.now();
        const random = Math.random();
        const finalUrl = `${import.meta.env.VITE_API_BASE_URL}${res.avatar_url}?v=${timestamp}&t=${random}&refresh=true`;

        // Clear the avatar first, then set the new one
        setAvatarUrl(null);
        setAvatarKey(prev => prev + 1);

        // Small delay to ensure the clear takes effect
        setTimeout(() => {
          setAvatarUrl(finalUrl);
          setAvatarKey(prev => prev + 1);
          updateUser({ avatar_url: res.avatar_url });
        }, 100);

        // Force reload after a longer delay to ensure the server has processed the upload
        setTimeout(() => {
          forceReloadAvatar();
        }, 500);

        toast({ title: t('profile.uploadSuccess') });

        // Broadcast via socket and localStorage to update other tabs/clients
        if (socket && isConnected && user?.id) {
          socket.emit('avatarUpdated', { userId: user.id, avatar_url: res.avatar_url });
        }
        try {
          if (user?.id) {
            localStorage.setItem('avatarUpdated', JSON.stringify({ userId: user.id, avatar_url: res.avatar_url, ts: Date.now() }));
          }
        } catch { }

        if (localUrl) URL.revokeObjectURL(localUrl);
      } else {
        throw new Error(res?.message || t('profile.uploadError'));
      }
    } catch (err: any) {
      if (previousUrl) setAvatarUrl(previousUrl);
      toast({ title: t('profile.uploadError'), description: err?.message, variant: 'destructive' });
      if (localUrl) URL.revokeObjectURL(localUrl);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const file = e.target.files[0];
    // แสดง preview ด้วย Data URL (base64) แทน Blob URL เพื่อไม่ให้หมดอายุ
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSelectedImageSrc(dataUrl);
      if (setAvatarPreviewUrl) {
        setAvatarPreviewUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    setCropDialogOpen(true);
    setPendingAvatarFile(file); // เก็บไฟล์ไว้ก่อน
    setPendingCroppedFile(null); // reset cropped file
    if (file.type === 'image/gif') {
      (window as any).__avatarOriginalGifFile = file;
    } else {
      (window as any).__avatarOriginalGifFile = null;
    }
  };

  const handleCropped = async (file: File) => {
    const previousUrl = avatarUrl;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await apiService.post(apiEndpoints.auth.avatar, formData);
      if (res?.success) {
        // Update user context immediately
        updateUser({ avatar_url: res.avatar_url });

        // Show success message
        toast({
          title: t('profile.uploadSuccess') || 'Avatar Updated',
          description: t('profile.uploadSuccessDesc') || 'Profile picture updated successfully'
        });

        // Force complete avatar refresh to ensure the new image is displayed
        setTimeout(() => {
          forceCompleteAvatarRefresh();
        }, 200);

        // Broadcast via socket and localStorage to update other tabs/clients
        if (socket && isConnected && user?.id) {
          socket.emit('avatarUpdated', { userId: user.id, avatar_url: res.avatar_url });
        }
        try {
          if (user?.id) {
            localStorage.setItem('avatarUpdated', JSON.stringify({ userId: user.id, avatar_url: res.avatar_url, ts: Date.now() }));
          }
        } catch { }
      } else {
        throw new Error(res?.message || t('profile.uploadError'));
      }
    } catch (err: any) {
      if (previousUrl) setAvatarUrl(previousUrl);
      toast({
        title: t('profile.uploadError'),
        description: err?.message,
        variant: 'destructive'
      });
    }
  };

  // Listen to avatar updates via socket and localStorage for realtime self/other-tab refresh
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL as string;
    const onSocketUpdate = (data: { userId: string; avatar_url: string }) => {
      if (!data) return;
      if (user?.id && String(data.userId) === String(user.id)) {
        setAvatarUrl(withCacheBust(`${baseUrl}${data.avatar_url}`));
        setAvatarKey(prev => prev + 1);
        updateUser({ avatar_url: data.avatar_url });
      }
    };
    if (socket && isConnected) {
      socket.on('avatarUpdated', onSocketUpdate);
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'avatarUpdated' || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        if (user?.id && String(data.userId) === String(user.id)) {
          setAvatarUrl(withCacheBust(`${baseUrl}${data.avatar_url}`));
          setAvatarKey(prev => prev + 1);
          updateUser({ avatar_url: data.avatar_url });
        }
      } catch { }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      if (socket) socket.off('avatarUpdated', onSocketUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, [socket, isConnected, user, updateUser]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // ตรวจสอบรูปแบบอีเมล
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast({
          title: t('common.error'),
          description: t('auth.invalidEmailFormat'),
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // ตรวจสอบเพิ่มเติมว่าอีเมลไม่ใช่รูปแบบที่ไม่สมบูรณ์ เช่น @g, @gmail
      if (formData.email.includes('@') && !formData.email.includes('.')) {
        toast({
          title: t('common.error'),
          description: t('auth.invalidEmailFormat'),
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // ตรวจสอบว่าตำแหน่งต้องการ End Work Date หรือไม่
      const selectedPos = positions.find(p => String(p.id) === formData.position);
      const requiresEndWorkDate = selectedPos ? !!selectedPos.require_enddate : false;

      // Validation สำหรับ End Work Date
      if (requiresEndWorkDate && formData.start_work && formData.end_work) {
        if (formData.start_work > formData.end_work) {
          toast({
            title: t('common.error'),
            description: t('auth.dateRangeInvalid'),
            variant: 'destructive'
          });
          setSaving(false);
          return;
        }
      }

      // อัปโหลด avatar ถ้ามีไฟล์ใหม่
      let avatarUploadedUrl = null;
      if (pendingCroppedFile) {
        const formData = new FormData();
        formData.append('avatar', pendingCroppedFile);
        const res = await apiService.post(apiEndpoints.auth.avatar, formData);
        if (res?.success) {
          avatarUploadedUrl = res.avatar_url;
          // อัปเดต avatarUrl ใน Profile ด้วย URL ใหม่ (ไม่ใช้ withCacheBust)
          const newAvatarUrl = `${import.meta.env.VITE_API_BASE_URL}${res.avatar_url}`;
          setAvatarUrl(newAvatarUrl);
          // อัปเดต user context ด้วย avatar_url ใหม่
          updateUser({ avatar_url: res.avatar_url });
          toast({ title: t('profile.uploadSuccess') });
          if (socket && isConnected && user?.id) {
            socket.emit('avatarUpdated', { userId: user.id, avatar_url: res.avatar_url });
          }
          try {
            if (user?.id) {
              localStorage.setItem('avatarUpdated', JSON.stringify({ userId: user.id, avatar_url: res.avatar_url, ts: Date.now() }));
            }
          } catch { }
          if (setAvatarPreviewUrl) setAvatarPreviewUrl(null); // clear preview หลังบันทึก
        } else {
          throw new Error(res?.message || t('profile.uploadError'));
        }
      }

      const requestData = {
        name: formData.full_name,
        email: formData.email,
        position_id: formData.position || null,
        department_id: formData.department || null,
        gender: formData.gender || null,
        dob: formData.dob || null,
        phone_number: formData.phone_number || null,
        start_work: formData.start_work || null,
        end_work: (positions.find(p => String(p.id) === formData.position)?.require_enddate ? (formData.end_work || null) : null),
      };


      const res = await apiService.put(apiEndpoints.auth.profile, requestData);
      if (res.success) {
        toast({
          title: t('profile.saveSuccess'),
          description: t('profile.saveSuccessDesc'),
        });

        // อัปเดตข้อมูลในฟอร์มและ user context
        const updatedData = res.data;
        setFormData({
          full_name: updatedData.name || formData.full_name,
          email: updatedData.email || formData.email,
          department: updatedData.department_id ? String(updatedData.department_id) : '',
          position: updatedData.position_id ? String(updatedData.position_id) : '',
          gender: updatedData.gender || formData.gender,
          dob: updatedData.dob || formData.dob,
          phone_number: updatedData.phone_number || formData.phone_number,
          start_work: updatedData.start_work || formData.start_work,
          end_work: updatedData.end_work || formData.end_work,
        });

        updateUser({
          full_name: updatedData.name || formData.full_name,
          position: updatedData.position_name || '',
          department: updatedData.department_name || '',
          email: updatedData.email || formData.email,
          ...(avatarUploadedUrl ? { avatar_url: avatarUploadedUrl } : {}),
        });

        setIsEditing(false);
        setPendingAvatarFile(null);
        setPendingCroppedFile(null);
        if (setAvatarPreviewUrl) setAvatarPreviewUrl(null); // clear preview หลังบันทึก
        // window.location.reload(); <-- ลบออก
      } else {
        throw new Error(res.message || t('profile.saveError'));
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast({
        title: t('error.title'),
        description: error?.message || t('profile.saveError'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };


  // Define a color palette for leave types
  const leaveTypeColors = [
    '#4F8A8B', // teal
    '#F9A826', // orange
    '#A259F7', // purple
    '#FF6B6B', // red
    '#43BCCD', // blue
    '#F67280', // pink
    '#6C5B7B', // dark purple
    '#355C7D', // navy
    '#99B898', // green
    '#E84A5F', // coral
    '#2A363B', // dark gray
    '#FECEAB', // light orange
    '#FF847C', // salmon
    '#B5EAD7', // mint
    '#C7CEEA', // lavender
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Hero Section (replace old top bar) */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <svg viewBox="0 0 1440 320" className="w-full h-24 md:h-32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="url(#waveGradient)" fillOpacity="1" d="M0,160L60,170.7C120,181,240,203,360,197.3C480,192,600,160,720,133.3C840,107,960,85,1080,101.3C1200,117,1320,171,1380,197.3L1440,224L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z" />
            <defs>
              <linearGradient id="waveGradient" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Sidebar Trigger */}
        <div className="absolute top-3 left-3 z-20">
          <SidebarTrigger className="bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-lg backdrop-blur-sm" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center py-4 md:py-10">
          <img src="/lovable-uploads/siamit.png" alt="Logo" className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-2xl border-3 border-white dark:border-gray-700 mb-2 md:mb-3" />
          <h1 className="text-xl md:text-3xl font-extrabold text-indigo-900 dark:text-indigo-200 drop-shadow mb-1 md:mb-1.5 flex items-center gap-2 md:gap-2">
            {t('navigation.profile')}
          </h1>
          <p className="text-xs md:text-base text-blue-900/70 dark:text-blue-200/80 mb-1.5 font-medium text-center max-w-2xl px-4">
            {t('profile.profileTitle')}
          </p>
        </div>
      </div>
      <div className="max-w-3xl xl:max-w-6xl mx-auto p-3 md:p-5 space-y-4 md:space-y-6 animate-fade-in">
        {/* Profile Header */}
        <div className="flex flex-col items-center -mt-8 md:-mt-10">
          <div className="relative">

            <Avatar key={`${avatarUrl}-${avatarKey}`} className="h-20 w-20 md:h-24 md:w-24 shadow-lg border-4 border-white bg-white/80 backdrop-blur rounded-full">
              <AvatarImage
                src={avatarUrl ? avatarUrl : undefined}
                onError={(e) => {
                  // If image fails to load, set a fallback and don't retry infinitely
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
                alt="Profile picture"
                className="object-cover"
              />
              <AvatarFallback className="text-xl font-bold bg-blue-200 text-blue-900">
                {user?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            {/* ปุ่มเปลี่ยนรูป avatar: Always available */}
            <button
              type="button"
              className="absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 p-1.5 md:p-2 bg-blue-500 text-white rounded-full shadow-md border-2 border-white hover:bg-blue-600 transition-colors"
              onClick={handleCameraClick}
              aria-label="Change avatar"
            >
              <Camera className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
          <AvatarCropDialog
            open={cropDialogOpen}
            imageSrc={selectedImageSrc}
            isGif={(window as any).__avatarOriginalGifFile ? true : false}
            originalFile={(window as any).__avatarOriginalGifFile || null}
            onOpenChange={setCropDialogOpen}
            onCropped={handleCropped}
          />
          <div className="mt-2 md:mt-3 text-center">
            <h2 className="text-lg md:text-xl font-bold text-blue-900 dark:text-blue-200 tracking-tight">{user?.full_name}</h2>
            <p className="text-gray-500 mb-1.5 text-xs md:text-sm">
              {(() => {
                // Find position name from positions array
                if (!formData.position) {
                  return t('positions.noPosition');
                }
                const position = positions.find(p => String(p.id) === formData.position);
                if (position) {
                  return i18n.language.startsWith('th') ? position.position_name_th : position.position_name_en;
                }
                return t('positions.noPosition');
              })()}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mt-2">
              <Badge variant={user?.role === 'admin' || user?.role === 'superadmin' ? 'default' : 'secondary'} className={`flex items-center gap-1 px-2 py-0.5 md:px-3 md:py-1 border shadow-sm text-xs md:text-sm ${user?.role === 'superadmin'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : user?.role === 'admin'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                {user?.role === 'superadmin' ? (
                  <Crown className="h-3 w-3 md:h-4 md:w-4" />
                ) : (
                  <Shield className="h-3 w-3 md:h-4 md:w-4" />
                )}
                {(() => {
                  switch (user?.role) {
                    case 'admin':
                      return t('auth.roles.admin');
                    case 'superadmin':
                      return t('auth.roles.superadmin');
                    case 'employee':
                    default:
                      return t('auth.roles.user');
                  }
                })()}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1 px-2 py-0.5 md:px-3 md:py-1 bg-blue-50 text-blue-700 border border-blue-200 shadow-sm text-xs md:text-sm">
                <Building className="h-3 w-3 md:h-4 md:w-4" />
                {(() => {
                  // Find department name from departments array
                  if (!formData.department) {
                    return t('departments.noDepartment');
                  }
                  const department = departments.find(d => String(d.id) === formData.department);
                  if (department) {
                    return i18n.language.startsWith('th') ? department.department_name_th : department.department_name_en;
                  }
                  return t('departments.noDepartment');
                })()}
              </Badge>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-3xl shadow-xl p-0 overflow-hidden border border-white/20 dark:border-gray-700">
          <Tabs defaultValue="personal" className="">
            <TabsList className="flex w-full bg-transparent border-b border-blue-100 overflow-x-auto md:overflow-visible">
              <TabsTrigger value="personal" className="flex-1 min-w-[120px] text-base md:text-lg font-medium py-3 md:py-4 rounded-none data-[state=active]:border-b-4 data-[state=active]:border-blue-500 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 dark:text-gray-400 transition-all">{t('profile.personalInfo')}</TabsTrigger>
              <TabsTrigger value="leave" className="flex-1 min-w-[120px] text-base md:text-lg font-medium py-3 md:py-4 rounded-none data-[state=active]:border-b-4 data-[state=active]:border-blue-400 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 dark:text-gray-400 transition-all">{t('profile.leaveRights')}</TabsTrigger>
              <TabsTrigger value="settings" className="flex-1 min-w-[120px] text-base md:text-lg font-medium py-3 md:py-4 rounded-none data-[state=active]:border-b-4 data-[state=active]:border-blue-300 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 dark:text-gray-400 transition-all">{t('profile.settings')}</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="p-4 md:p-8 bg-white/90 dark:bg-gray-800/90 rounded-3xl">
              <form className="space-y-4 md:space-y-6" onSubmit={e => { e.preventDefault(); handleSave(); }}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="full_name" className="text-base text-blue-900 dark:text-blue-200 font-medium">{t('auth.fullName')}</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="input-blue"
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-base text-blue-900 dark:text-blue-200 font-medium">{t('auth.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        const email = e.target.value;
                        setFormData(prev => ({ ...prev, email }));
                      }}
                      className="input-blue"
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="position" className="text-base text-blue-900 dark:text-blue-200 font-medium">{t('auth.position')}</Label>
                    <Select
                      value={formData.position || "not_specified"}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, position: value === "not_specified" ? "" : value }))}
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="input-blue">
                        <SelectValue placeholder={t('positions.selectPosition')} />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                        {positions
                          .filter(pos => (pos.position_name_th || pos.position_name_en) && (pos.position_name_th?.trim() !== '' || pos.position_name_en?.trim() !== ''))
                          .map((pos) => (
                            <SelectItem key={pos.id} value={String(pos.id)} className="text-blue-900 dark:text-gray-200 focus:bg-blue-50 dark:focus:bg-gray-700">
                              {i18n.language.startsWith('th') ? pos.position_name_th : pos.position_name_en}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="department" className="text-base text-blue-900 dark:text-blue-200 font-medium">{t('auth.department')}</Label>
                    <Select
                      value={formData.department || "not_specified"}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, department: value === "not_specified" ? "" : value }))}
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="input-blue">
                        <SelectValue placeholder={t('departments.selectDepartment')} />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                        {departments
                          .filter(dept => (dept.department_name_th || dept.department_name_en) && (dept.department_name_th?.trim() !== '' || dept.department_name_en?.trim() !== ''))
                          .map((dept) => (
                            <SelectItem key={dept.id} value={String(dept.id)} className="text-blue-900 dark:text-gray-200 focus:bg-blue-50 dark:focus:bg-gray-700">
                              {i18n.language.startsWith('th') ? dept.department_name_th : dept.department_name_en}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="gender" className="text-base text-blue-900 dark:text-blue-200 font-medium">{t('employee.gender')}</Label>
                    <Select
                      value={formData.gender || "not_specified"}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value === "not_specified" ? "" : value }))}
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="input-blue">
                        <SelectValue placeholder={t('employee.selectGender')} />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                        <SelectItem value="male" className="text-blue-900 dark:text-gray-200 focus:bg-blue-50 dark:focus:bg-gray-700">
                          {t('employee.male')}
                        </SelectItem>
                        <SelectItem value="female" className="text-blue-900 dark:text-gray-200 focus:bg-blue-50 dark:focus:bg-gray-700">
                          {t('employee.female')}
                        </SelectItem>
                        <SelectItem value="other" className="text-blue-900 dark:text-gray-200 focus:bg-blue-50 dark:focus:bg-gray-700">
                          {t('employee.other')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="dob" className="text-base text-blue-900 dark:text-blue-200 font-medium">{t('employee.birthday')}</Label>
                    <DatePicker
                      date={formData.dob}
                      // Prevent selecting future dates: provide max/maxDate for picker and validate on change
                      max={new Date().toISOString().split('T')[0]}
                      maxDate={new Date().toISOString().split('T')[0]}
                      onDateChange={(date) => {
                        if (!date) {
                          setFormData(prev => ({ ...prev, dob: date }));
                          return;
                        }
                        const picked = new Date(date);
                        const now = new Date();
                        if (picked > now) {
                          toast({
                            title: t('common.error'),
                            description: t('employee.futureDateNotAllowed') || 'Date cannot be in the future',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setFormData(prev => ({ ...prev, dob: date }));
                      }}
                      placeholder={t('employee.selectBirthday')}
                      className="input-blue"
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="phone_number" className="text-base text-blue-900 dark:text-blue-200 font-medium">{t('employee.phoneNumber')}</Label>
                    <Input
                      id="phone_number"
                      type="tel"
                      value={formData.phone_number}
                      onChange={(e) => {
                        // อนุญาตเฉพาะตัวเลขและเครื่องหมาย + - ( ) และช่องว่าง
                        const value = e.target.value.replace(/[^0-9+\-() ]/g, '');
                        setFormData(prev => ({ ...prev, phone_number: value }));
                      }}
                      placeholder={t('employee.enterPhoneNumber')}
                      className="input-blue"
                      disabled={!isEditing}
                    />
                  </div>
                  {/* Start/End work dates: Start Work Date always shows; End Work Date shows only when position has Request Quote enabled */}
                  {(() => {
                    const selectedPos = positions.find(p => String(p.id) === formData.position);
                    const showEndWorkDate = selectedPos ? !!selectedPos.require_enddate : false;
                    return (
                      <>
                        <div className="space-y-3">
                          <Label htmlFor="start_work" className="text-base text-blue-900 dark:text-blue-200 font-medium">{t('employee.startWorkDate')}</Label>
                          <DatePicker
                            date={formData.start_work}
                            onDateChange={(date) => setFormData(prev => ({ ...prev, start_work: date }))}
                            placeholder={t('employee.selectStartWorkDate')}
                            className="input-blue"
                            disabled={!isEditing}
                          />
                        </div>
                        {showEndWorkDate && (
                          <div className="space-y-3">
                            <Label htmlFor="end_work" className="text-base text-blue-900 dark:text-blue-200 font-medium">{t('employee.endWorkDate')}</Label>
                            <DatePicker
                              date={formData.end_work}
                              onDateChange={(date) => setFormData(prev => ({ ...prev, end_work: date }))}
                              placeholder={t('employee.selectEndWorkDate')}
                              className="input-blue"
                              disabled={!isEditing}
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                {/* ปุ่มแก้ไข/บันทึก/ยกเลิก (วางไว้ใต้ Avatar หรือในฟอร์ม) */}
                <div className="flex gap-3 justify-center mt-4">
                  {!isEditing && (
                    <Button type="button" className="btn-blue px-6 py-2 text-lg" onClick={() => setIsEditing(true)}>
                      <span>{t('profile.editProfile')}</span>
                    </Button>
                  )}
                  {isEditing && (
                    <>
                      <Button type="button" className="btn-blue px-6 py-2 text-lg" onClick={handleSave} disabled={saving || loading}>
                        {saving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {t('common.saving')}
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5 mr-2" />
                            {t('common.save')}
                          </>
                        )}
                      </Button>
                      <Button type="button" variant="outline" className="btn-blue-outline px-6 py-2 text-lg" onClick={handleCancel} disabled={saving || loading}>
                        {t('common.cancel')}
                      </Button>
                    </>
                  )}
                </div>
              </form>
            </TabsContent>

            <TabsContent value="leave" className="p-4 md:p-8 bg-white/90 dark:bg-gray-800/90 rounded-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                {leaveStats.map((stat, index) => (
                  <div key={index} className="space-y-2 md:space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm md:text-base font-medium text-blue-900 dark:text-blue-200">{stat.label}</span>
                      <span className="text-sm md:text-base text-gray-500 dark:text-gray-400">
                        {(() => {
                          const usedDays = Number(stat.used.days) || 0;
                          const usedHours = Number(stat.used.hours) || 0;
                          const quota = Number(stat.quota);

                          if (usedHours > 0) {
                            return `${usedDays} ${t('common.days')} ${usedHours} ${t('common.hours')} / ${quota} ${t('common.days')}`;
                          } else {
                            return `${usedDays} ${t('common.days')} / ${quota} ${t('common.days')}`;
                          }
                        })()}
                      </span>
                    </div>
                    <div className="w-full bg-blue-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`${stat.color} h-2 rounded-full transition-all duration-500`}
                        style={{
                          width: `${Math.min(
                            ((Number(stat.used.days) + (Number(stat.used.hours) / 9)) / Number(stat.quota)) * 100,
                            100
                          )}%`
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-blue-500 dark:text-blue-400">
                      {(() => {
                        const remainingDays = Number(stat.remaining.days) || 0;

                        const remainingHours = Number(stat.remaining.hours) || 0;

                        if (remainingHours > 0) {
                          return `${t('common.remaining')} ${remainingDays} ${t('common.days')} ${remainingHours} ${t('common.hours')}`;
                        } else {
                          return `${t('common.remaining')} ${remainingDays} ${t('common.days')}`;
                        }
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="p-4 md:p-8 bg-white/90 dark:bg-gray-800/90 rounded-3xl">
              <div className="space-y-4 md:space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-6 border rounded-2xl bg-blue-50 dark:bg-gray-800 shadow-sm gap-4 border-blue-100 dark:border-gray-700">
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2 text-sm md:text-base"><Bell className="h-4 w-4 md:h-5 md:w-5 text-blue-400" /> {t('profile.pushNotifications')}</h3>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {pushNotificationEnabled ? t('profile.pushNotificationsEnabled') : t('profile.pushNotificationsDisabled')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <span className="text-sm text-gray-600 dark:text-gray-400 md:hidden">
                      {pushNotificationEnabled ? t('common.enabled') : t('common.disabled')}
                    </span>
                    <div className="flex items-center gap-3">
                      <Switch
                        id="push-notifications-switch"
                        checked={pushNotificationEnabled}
                        onCheckedChange={(checked) => {
                          setPushNotificationEnabled(checked);
                          toast({
                            title: checked ? t('profile.pushNotificationsEnabled') : t('profile.pushNotificationsDisabled'),
                            description: checked ? t('profile.pushNotificationsEnabledDesc') : t('profile.pushNotificationsDisabledDesc'),
                          });
                        }}
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400 hidden md:inline">
                        {pushNotificationEnabled ? t('common.enabled') : t('common.disabled')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-6 border rounded-2xl bg-blue-50 dark:bg-gray-800 shadow-sm gap-4 border-blue-100 dark:border-gray-700">
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2 text-sm md:text-base"><Lock className="h-4 w-4 md:h-5 md:w-5 text-blue-400" /> {t('profile.changePassword')}</h3>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">{t('profile.changePasswordDesc')}</p>
                  </div>
                  <Button variant="outline" size="sm" className="btn-blue-outline w-full md:w-auto" onClick={() => setChangePasswordOpen(true)}>{t('common.change')}</Button>
                </div>
              </div>
              <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <style>{`
        .input-blue {
          background: rgba(255,255,255,0.7);
          border: 1.5px solid #bfdbfe;
          border-radius: 1rem;
          box-shadow: 0 1px 4px 0 rgba(31, 38, 135, 0.04);
          padding: 0.75rem 1.25rem;
          font-size: 1rem;
          color: #1e293b;
          transition: border 0.2s, box-shadow 0.2s;
        }
        .input-blue:focus {
          border: 1.5px solid #3b82f6;
          box-shadow: 0 0 0 2px #3b82f644;
          outline: none;
        }
        /* Dark mode support for input-blue */
        :global(.dark) .input-blue {
          background: rgba(31, 41, 55, 0.7);
          border-color: #374151;
          color: #f3f4f6;
        }
        :global(.dark) .input-blue:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.3);
        }
        .btn-blue {
          background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
          color: #fff;
          border-radius: 1rem;
          font-weight: 600;
          box-shadow: 0 2px 8px 0 rgba(31, 38, 135, 0.08);
          border: none;
        }
        .btn-blue:hover {
          background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
          color: #fff;
          box-shadow: 0 4px 16px 0 rgba(31, 38, 135, 0.12);
        }
        .btn-blue-outline {
          border: 1.5px solid #3b82f6;
          color: #2563eb;
          border-radius: 1rem;
          font-weight: 500;
          background: transparent;
        }
        .btn-blue-outline:hover {
          background: #eff6ff;
          color: #1e293b;
        }
      `}</style>
    </div>
  );
};

export default Profile;
