import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { config } from '@/config';
import { apiEndpoints } from '@/constants/api';
import { getThaiHolidaysByMonth, getUpcomingThaiHolidays } from "@/constants/getThaiHolidays";
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Bell, Calendar, Clock, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { apiService } from '../lib/api';
import { showToastMessage } from '../lib/toast';


const Index = () => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Function to format date based on current language
  const formatCurrentDate = () => {
    const currentLanguage = i18n.language;
    const locale = currentLanguage === 'th' ? 'th-TH' : 'en-US';
    return new Date().toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };
  
  const [stats, setStats] = useState(() => [
    { title: t('main.daysRemaining'), value: "-", unit: t('common.days'), icon: Calendar, color: "text-blue-600", bgColor: "bg-blue-50" },
    { title: t('main.daysUsed'), value: "-", unit: t('common.days'), icon: Clock, color: "text-green-600", bgColor: "bg-green-50" },
    { title: t('main.pendingRequests'), value: "-", unit: t('main.requests'), icon: Users, color: "text-orange-600", bgColor: "bg-orange-50" },
    { title: t('main.approvalRate'), value: "-", unit: "%", icon: TrendingUp, color: "text-purple-600", bgColor: "bg-purple-50" },
  ]);
  const [leaveStats, setLeaveStats] = useState({ sick: 0, vacation: 0, business: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState("");
  const [recentLeaveStats, setRecentLeaveStats] = useState<Record<string, number>>({});
  const [loadingRecentStats, setLoadingRecentStats] = useState(true);
  const [errorRecentStats, setErrorRecentStats] = useState("");
  // Dashboard card states
  const [backdatedCount, setBackdatedCount] = useState(0);
  const [daysUsed, setDaysUsed] = useState(0);
  const [hoursUsed, setHoursUsed] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [approvalRate, setApprovalRate] = useState(0);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  // Recent leave requests state
  const [recentLeaves, setRecentLeaves] = useState<Array<{
    leavetype: string,
    leavetype_th?: string,
    leavetype_en?: string,
    duration: string,
    startdate: string,
    status: string
  }>>([]);
  const [loadingRecentLeaves, setLoadingRecentLeaves] = useState(true);
  const [errorRecentLeaves, setErrorRecentLeaves] = useState("");
  // เพิ่ม state สำหรับ days used จาก filter
  const [filteredDaysUsed, setFilteredDaysUsed] = useState<number>(0);
  // เพิ่ม state สำหรับ hours used จาก filter
  const [filteredHoursUsed, setFilteredHoursUsed] = useState<number>(0);
  // เพิ่ม state สำหรับ totalDays/totalHours จาก recent leave stats
  const [recentTotalDays, setRecentTotalDays] = useState<number>(0);
  const [recentTotalHours, setRecentTotalHours] = useState<number>(0);

  // Add state for calendar filter
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // Add state for user profile
  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
    avatar: string | null;
    role: string;
    department: {
      id: string | null;
      name_th: string;
      name_en: string;
    };
    position: {
      id: string | null;
      name_th: string;
      name_en: string;
    };
  } | null>(null);
  const [loadingUserProfile, setLoadingUserProfile] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // LINE linking states
  const [lineLinkStatus, setLineLinkStatus] = useState<'checking' | 'linked' | 'unlinked' | 'error'>('checking');
  const [lineLinkingLoading, setLineLinkingLoading] = useState(false);

  // Helper for month options
  const monthOptions = [
    { value: 0, label: t('common.allMonths') },
    { value: 1, label: t('months.1') },
    { value: 2, label: t('months.2') },
    { value: 3, label: t('months.3') },
    { value: 4, label: t('months.4') },
    { value: 5, label: t('months.5') },
    { value: 6, label: t('months.6') },
    { value: 7, label: t('months.7') },
    { value: 8, label: t('months.8') },
    { value: 9, label: t('months.9') },
    { value: 10, label: t('months.10') },
    { value: 11, label: t('months.11') },
    { value: 12, label: t('months.12') },
  ];
  // Helper for year options (current year +/- 1)
  const yearOptions = [filterYear - 1, filterYear, filterYear + 1];

  const { showSessionExpiredDialog } = useAuth();

  // LINE linking functions
  const checkLineLinkStatus = async () => {
    try {
      const data = await apiService.get(apiEndpoints.line.linkStatus, undefined, showSessionExpiredDialog);
      setLineLinkStatus(data.linked ? 'linked' : 'unlinked');
    } catch (error) {
      setLineLinkStatus('error');
    }
  };

  const handleLineLogin = async () => {
    setLineLinkingLoading(true);
    try {
      const data = await apiService.get(apiEndpoints.line.loginUrl, undefined, showSessionExpiredDialog);
      const popup = window.open(data.loginUrl, 'lineLogin', 'width=500,height=600,scrollbars=yes,resizable=yes');
      const messageListener = (event: any) => {
        if (event.origin !== window.location.origin) return;
        if (event.data && event.data.type === 'LINE_LINK_SUCCESS') {
          if (popup) popup.close();
          window.removeEventListener('message', messageListener);
          showToastMessage.auth.loginSuccess();
          setLineLinkStatus('linked');
        } else if (event.data && event.data.type === 'LINE_LINK_ERROR') {
          if (popup) popup.close();
          window.removeEventListener('message', messageListener);
          showToastMessage.auth.loginError(event.data.message);
        }
      };
      window.addEventListener('message', messageListener);
      setTimeout(() => { checkLineLinkStatus(); }, 5000);
    } catch (error) {
      showToastMessage.auth.loginError();
    } finally {
      setLineLinkingLoading(false);
    }
  };

  const handleLineUnlink = async () => {
    setLineLinkingLoading(true);
    try {
      await apiService.post(apiEndpoints.line.unlink, {}, showSessionExpiredDialog);
      showToastMessage.auth.logoutSuccess();
      setLineLinkStatus('unlinked');
    } catch (error) {
      showToastMessage.auth.loginError();
    } finally {
      setLineLinkingLoading(false);
    }
  };

  const fetchDashboardStats = async (month?: number, year?: number) => {
    setLoadingStats(true);
    try {
      let url = apiEndpoints.dashboard.stats;
      if (month && year) url += `?month=${month}&year=${year}`;
      else if (year) url += `?year=${year}`;
      
      const data = await apiService.get(url);
      if (data && (data.status === "success" || data.success === true) && data.data) {
        setStats([
          { title: t('main.daysRemaining'), value: data.data.remainingDays, unit: t('common.days'), icon: Calendar, color: "text-blue-600", bgColor: "bg-blue-50" },
          { title: t('main.daysUsed'), value: data.data.daysUsed, unit: t('common.days'), icon: Clock, color: "text-green-600", bgColor: "bg-green-50" },
          { title: t('main.pendingRequests'), value: data.data.pendingRequests, unit: t('main.requests'), icon: Users, color: "text-orange-600", bgColor: "bg-orange-50" },
          { title: t('main.approvalRate'), value: data.data.approvalRate, unit: "%", icon: TrendingUp, color: "text-purple-600", bgColor: "bg-purple-50" },
        ]);
        // อัปเดต filteredDaysUsed และ filteredHoursUsed สำหรับ Days Used card
        setFilteredDaysUsed(data.data.daysUsed || 0);
        setFilteredHoursUsed(data.data.hoursUsed || 0);
        const stats = data.data.leaveTypeStats || {};
        setLeaveStats({
          sick: stats["ลาป่วย"] || stats["sick"] || 0,
          vacation: stats["ลาพักผ่อน"] || stats["vacation"] || 0,
          business: stats["ลากิจ"] || stats["personal"] || 0,
        });
      } else {
        setErrorStats(t('error.cannotLoadStats'));
      }
    } catch (error) {
      setErrorStats(t('error.apiConnectionError'));
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch recent leave requests and generate statistics
  useEffect(() => {
    const fetchRecentLeaves = async () => {
      setLoadingRecentLeaves(true);
      setErrorRecentLeaves("");
      try {
        const data = await apiService.get(apiEndpoints.dashboard.recentLeaves);
        if (data && (data.status === "success" || data.success === true) && Array.isArray(data.data)) {
          setRecentLeaves(data.data);
          // Summarize leave types
          const stats = { sick: 0, vacation: 0, business: 0 };
          data.data.forEach((l) => {
            const type = (l.leavetype_th || l.leavetype || "").toLowerCase();
            if (type.includes("ป่วย") || type.includes("sick")) stats.sick++;
            else if (type.includes("พัก") || type.includes("vacation")) stats.vacation++;
            else if (type.includes("กิจ") || type.includes("personal")) stats.business++;
          });
          setRecentLeaveStats(stats);
        } else {
          setErrorRecentLeaves(t('error.cannotLoadStats'));
        }
      } catch (error) {
        setErrorRecentLeaves(t('error.apiConnectionError'));
      } finally {
        setLoadingRecentLeaves(false);
      }
    };
    
    fetchRecentLeaves();
  }, [t]);

  // Update fetch for recent leaves to use filterMonth/filterYear
  useEffect(() => {
    const fetchFilteredRecentLeaves = async () => {
      setLoadingRecentLeaves(true);
      setErrorRecentLeaves("");
      try {
        let url = `${apiEndpoints.dashboard.recentLeaves}?year=${filterYear}`;
        if (filterMonth && filterMonth !== 0) {
          url += `&month=${filterMonth}`;
        }
        const data = await apiService.get(url);
        if (data && (data.status === "success" || data.success === true) && Array.isArray(data.data)) {
          setRecentLeaves(data.data);
        } else {
          setErrorRecentLeaves(t('error.cannotLoadStats'));
        }
      } catch (error) {
        setErrorRecentLeaves(t('error.apiConnectionError'));
      } finally {
        setLoadingRecentLeaves(false);
      }
    };
    
    fetchFilteredRecentLeaves();
  }, [t, filterMonth, filterYear]);

  // Fetch dashboard stats and backdated count
  useEffect(() => {
    setLoadingDashboard(true);
    const token = localStorage.getItem("token");

    // Fetch dashboard stats
    let statsUrl = `${apiEndpoints.dashboard.stats}?year=${filterYear}`;
    if (filterMonth && filterMonth !== 0) {
      statsUrl += `&month=${filterMonth}`;
    }
    let backdatedUrl = `${apiEndpoints.dashboard.myBackdated}?year=${filterYear}`;
    if (filterMonth && filterMonth !== 0) {
      backdatedUrl += `&month=${filterMonth}`;
    }
    Promise.all([
      apiService.get(statsUrl, undefined, showSessionExpiredDialog),
      apiService.get(backdatedUrl, undefined, showSessionExpiredDialog)
    ]).then(([statsRes, backdatedRes]) => {
      console.log('Dashboard stats response:', statsRes);
      if (statsRes && (statsRes.status === 'success' || statsRes.success === true) && statsRes.data) {
        console.log('Setting dashboard stats:', {
          daysUsed: statsRes.data.daysUsed,
          hoursUsed: statsRes.data.hoursUsed,
          pendingRequests: statsRes.data.pendingRequests,
          approvalRate: statsRes.data.approvalRate
        });
        setDaysUsed(statsRes.data.daysUsed || 0);
        setHoursUsed(statsRes.data.hoursUsed || 0);
        setPendingRequests(statsRes.data.pendingRequests || 0);
        setApprovalRate(statsRes.data.approvalRate || 0);
      }
      if (backdatedRes && (backdatedRes.status === 'success' || backdatedRes.success === true) && backdatedRes.data) {
        setBackdatedCount(backdatedRes.data.count || 0);
      }
    }).finally(() => setLoadingDashboard(false));
  }, [filterMonth, filterYear]);

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoadingUserProfile(true);
      try {
          const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
const token = currentUser?.token;
       
        if (!token) {
          showSessionExpiredDialog();
          return;
        }

        const data = await apiService.get(apiEndpoints.auth.profile, undefined, showSessionExpiredDialog);
        if (data && (data.status === 'success' || data.success === true) && data.data) {
          setUserProfile(data.data);
          // ดึง avatar_url จาก user profile
          if (data.data.avatar_url) {
            setAvatarUrl(data.data.avatar_url);
          }
        } else {
          console.error('Failed to fetch user profile:', data?.message || 'Unknown error');
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoadingUserProfile(false);
      }
    };

    fetchUserProfile();
    checkLineLinkStatus();
  }, [showSessionExpiredDialog]);



  // Upcoming holidays (Thai calendar, 3 next)
  const upcomingHolidays = getUpcomingThaiHolidays(3, t);
  // State สำหรับเลือกเดือน/ปี
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const months = [
    t('months.1'), t('months.2'), t('months.3'), t('months.4'), t('months.5'), t('months.6'),
    t('months.7'), t('months.8'), t('months.9'), t('months.10'), t('months.11'), t('months.12')
  ];
  const holidaysOfMonth = getThaiHolidaysByMonth(selectedYear, selectedMonth, t);
  // Announcements state
  const [announcements, setAnnouncements] = useState<Array<{
    id: string;
    subject: string;
    detail: string;
    createdBy?: string;
    createdAt?: string;
  }>>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [errorAnnouncements, setErrorAnnouncements] = useState("");

  // Company holidays state
  const [companyHolidaysOfMonth, setCompanyHolidaysOfMonth] = useState<Array<{
    date: string;
    title: string;
  }>>([]);
  const [loadingCompanyHolidays, setLoadingCompanyHolidays] = useState(true);
  const [errorCompanyHolidays, setErrorCompanyHolidays] = useState("");

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoadingAnnouncements(true);
      try {
        const data = await apiService.get(apiEndpoints.announcements, undefined, showSessionExpiredDialog);
        
        if (data && (data.status === 'success' || data.success === true) && Array.isArray(data.data)) {
          // Sort by creation date (latest first) and take only the latest 3
          const sortedAnnouncements = data.data
            .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 3);
          setAnnouncements(sortedAnnouncements);
        } else {
          setErrorAnnouncements(t('error.cannotLoadStats'));
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
        setErrorAnnouncements(t('error.apiConnectionError'));
      } finally {
        setLoadingAnnouncements(false);
      }
    };

    fetchAnnouncements();
  }, [t, showSessionExpiredDialog]);

  // Fetch company holidays
  useEffect(() => {
    const fetchCompanyHolidays = async () => {
      setLoadingCompanyHolidays(true);
      try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
const token = currentUser?.token;
        if (!token) {
          showSessionExpiredDialog();
          return;
        }

        const data = await apiService.get(apiEndpoints.customHolidaysByYearMonth(selectedYear, selectedMonth + 1), undefined, showSessionExpiredDialog);

        if (data.success && Array.isArray(data.data)) {
          setCompanyHolidaysOfMonth(data.data);
        } else {
          console.error('Failed to fetch company holidays:', data.message || 'Invalid response format');
          setCompanyHolidaysOfMonth([]);
        }
      } catch (error) {
        console.error('Error fetching company holidays:', error);
        setCompanyHolidaysOfMonth([]);
      } finally {
        setLoadingCompanyHolidays(false);
      }
    };

    fetchCompanyHolidays();
  }, [selectedYear, selectedMonth, showSessionExpiredDialog]);

  // Socket.io event listeners for real-time dashboard updates
  useEffect(() => {
    if (socket && isConnected) {
      // Listen for leave request status changes
      socket.on('leaveRequestStatusChanged', (data) => {
        console.log('Received leave request status change:', data);
        
        // Show toast notification
        toast({
          title: t('notifications.statusChanged'),
          description: `${t('notifications.request')} ${data.requestId} ${t('notifications.hasBeen')} ${data.status === 'approved' ? t('notifications.approved') : t('notifications.rejected')}`,
          variant: data.status === 'approved' ? 'default' : 'destructive'
        });
        
        // Refresh dashboard stats
        fetchDashboardStats();
      });

      // Listen for new announcements
      socket.on('newAnnouncement', (data) => {
        console.log('Received new announcement:', data);
        
        // Show toast notification
        toast({
          title: t('notifications.newAnnouncement'),
          description: data.subject,
          variant: 'default'
        });
        
        // Refresh announcements - will be handled by useEffect
      });

      // Listen for new leave requests (for admin users)
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        socket.on('newLeaveRequest', (data) => {
          console.log('Received new leave request:', data);
          
          // Show toast notification
          toast({
            title: t('notifications.newLeaveRequest'),
            description: `${data.userName} - ${data.leaveType}`,
            variant: 'default'
          });
          
          // Refresh dashboard stats
          fetchDashboardStats();
        });
      }

      return () => {
        socket.off('leaveRequestStatusChanged');
        socket.off('newAnnouncement');
        socket.off('newLeaveRequest');
      };
    }
  }, [socket, isConnected, toast, t, user?.role]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 dark:dark-gradient-bg transition-all duration-500 relative overflow-x-hidden">
      {/* Parallax/Floating Background Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[350px] h-[350px] rounded-full bg-gradient-to-br from-blue-200 via-indigo-100 to-purple-100 opacity-30 blur-2xl animate-float-slow" />
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] rounded-full bg-gradient-to-tr from-purple-200 via-blue-100 to-indigo-100 opacity-20 blur-xl animate-float-slow2" />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full bg-blue-100 opacity-10 blur-xl animate-pulse-slow" style={{transform:'translate(-50%,-50%)'}} />
      </div>
      {/* Top Bar */}
      <div className="border-b bg-white/80 dark:dark-card-gradient backdrop-blur-sm sticky top-0 z-20 shadow-sm dark:dark-glow">
        <div className="flex h-14 items-center px-3 gap-3" style={{height: '10vh', minHeight: '56px'}}>
          <SidebarTrigger />
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-500 to-purple-500 tracking-tight drop-shadow-lg animate-fade-in-up">{t('main.leaveManagementSystem')}</h1>
            <p className="text-xs sm:text-sm text-blue-500 dark:text-blue-200 animate-fade-in-up delay-100 leading-tight truncate whitespace-nowrap max-w-[45vw] sm:max-w-[40vw] md:max-w-[30vw]">
              {t('main.welcomeMessage')}
            </p>
          </div>
          {/* Calendar Filter (now left of language/world icon) */}
          <div className="flex gap-2 ml-4 mr-16">
            <select
              className="rounded-lg border px-2 py-1 text-blue-700 bg-white/80 shadow"
              value={filterMonth}
              onChange={e => setFilterMonth(Number(e.target.value))}
            >
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              className="rounded-lg border px-2 py-1 text-blue-700 bg-white/80 shadow"
              value={filterYear}
              onChange={e => setFilterYear(Number(e.target.value))}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y + (i18n.language.startsWith('th') ? 543 : 0)} {t('common.year')}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      <div className="p-3 space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="relative rounded-2xl p-5 text-white overflow-hidden glass shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in-up bg-gradient-to-tr from-blue-100 via-indigo-200 to-purple-100">
          <div className="z-10 flex-1 space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold mb-1 drop-shadow-lg animate-slide-in-left" style={{ color: '#2563eb' }}>{t('main.hello')} {loadingUserProfile ? t('common.loading') : (userProfile?.name || t('main.user'))}! 👋</h2>
            <p className="mb-3 text-base font-medium animate-slide-in-left delay-100" style={{ color: '#6366f1' }}>
              {t('main.today')} {formatCurrentDate()}
            </p>
            <div className="flex gap-3">
              <Link to="/leave-request">
                <Button 
                  size="default" 
                  variant="secondary"
                  className="bg-white text-blue-600 hover:bg-blue-100 font-bold shadow-lg border-0 px-6 py-2 text-base rounded-lg animate-bounce-in"
                >
                  {t('main.newLeaveRequest')}
                </Button>
              </Link>
              
              <Button 
                size="default" 
                variant="secondary"
                onClick={lineLinkStatus === 'linked' ? handleLineUnlink : handleLineLogin}
                disabled={lineLinkingLoading}
                className={`font-bold shadow-lg border-0 px-6 py-2 text-base rounded-lg animate-bounce-in flex items-center gap-2 ${
                  lineLinkStatus === 'linked' 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                <span className="text-[8px] font-bold text-white hidden">LINE</span>
                {lineLinkingLoading 
                  ? (lineLinkStatus === 'linked' ? t('line.unlinking', 'Unlinking...') : t('line.linking', 'Linking...'))
                  : lineLinkStatus === 'linked' 
                    ? t('line.unlinkAccount') 
                    : t('line.linkAccount')
                }
              </Button>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full" style={{ background: 'linear-gradient(90deg, #fffbe6 0%, #ffe082 100%)', opacity: 0.18, transform: 'translateY(-50%) translateX(50%)' }}></div>
          <div className="flex-1 flex items-center justify-center animate-float">
            <img src={`${config.upload.publicPath}/lovable-uploads/siamit.png`} alt="Logo" className="w-28 h-28 object-contain drop-shadow-2xl animate-float" />
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Backdated Requests Card */}
          <Card className="group border-0 shadow-xl bg-white/60 dark:dark-card-gradient backdrop-blur-lg rounded-xl flex flex-col items-center justify-center py-5 px-2 transition-all duration-300 hover:shadow-2xl dark:hover:dark-glow hover:-translate-y-1 hover:bg-white/80 dark:hover:bg-purple-500/10 relative overflow-hidden animate-fade-in-up">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-1 shadow group-hover:scale-110 transition-transform duration-200 animate-pop-in">
                <Calendar className="w-6 h-6 text-red-400" />
              </div>
              <div className="text-3xl font-extrabold text-blue-800 mb-1">{loadingDashboard ? '-' : backdatedCount}</div>
              <div className="text-base font-bold text-blue-600 mt-1 text-center opacity-90 animate-pop-in delay-200">{t('main.backdatedRequests', 'Backdated Requests')}</div>
            </div>
          </Card>
          {/* Days Used Card */}
          <Card className="group border-0 shadow-xl bg-white/60 dark:dark-card-gradient backdrop-blur-lg rounded-xl flex flex-col items-center justify-center py-5 px-2 transition-all duration-300 hover:shadow-2xl dark:hover:dark-glow hover:-translate-y-1 hover:bg-white/80 dark:hover:bg-purple-500/10 relative overflow-hidden animate-fade-in-up">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-1 shadow group-hover:scale-110 transition-transform duration-200 animate-pop-in">
                <Clock className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-3xl font-extrabold text-blue-800 mb-1">
                {loadingDashboard ? '-' : `${daysUsed} ${t('common.days')}`}
              </div>
              <div className="text-base font-bold text-blue-600 mt-1 text-center opacity-90 animate-pop-in delay-200">{t('main.daysUsed', 'Days Used')}</div>
            </div>
          </Card>
          {/* Pending Requests Card */}
          <Card className="group border-0 shadow-xl bg-white/60 dark:dark-card-gradient backdrop-blur-lg rounded-xl flex flex-col items-center justify-center py-5 px-2 transition-all duration-300 hover:shadow-2xl dark:hover:dark-glow hover:-translate-y-1 hover:bg-white/80 dark:hover:bg-purple-500/10 relative overflow-hidden animate-fade-in-up">
                <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mb-1 shadow group-hover:scale-110 transition-transform duration-200 animate-pop-in">
                <Users className="w-6 h-6 text-orange-400" />
                  </div>
              <div className="text-3xl font-extrabold text-blue-800 mb-1">{loadingDashboard ? '-' : pendingRequests}</div>
              <div className="text-base font-bold text-blue-600 mt-1 text-center opacity-90 animate-pop-in delay-200">{t('main.pendingRequests', 'Pending Requests')}</div>
                  </div>
          </Card>
          {/* Approval Rate Card */}
          <Card className="group border-0 shadow-xl bg-white/60 dark:dark-card-gradient backdrop-blur-lg rounded-xl flex flex-col items-center justify-center py-5 px-2 transition-all duration-300 hover:shadow-2xl dark:hover:dark-glow hover:-translate-y-1 hover:bg-white/80 dark:hover:bg-purple-500/10 relative overflow-hidden animate-fade-in-up">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-1 shadow group-hover:scale-110 transition-transform duration-200 animate-pop-in">
                <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
              <div className="text-3xl font-extrabold text-blue-800 mb-1">{loadingDashboard ? '-' : approvalRate + '%'}</div>
              <div className="text-base font-bold text-blue-600 mt-1 text-center opacity-90 animate-pop-in delay-200">{t('main.approvalRate', 'Approval Rate')}</div>
                </div>
              </Card>
        </div>

        {/* --- NEW: User Summary, Notifications, Holidays, Announcements --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* User Summary */}
          <Card className="glass dark:dark-card-gradient shadow-xl dark:dark-glow border-0 flex flex-col items-center justify-center p-5 animate-fade-in-up">
            <Avatar className="w-16 h-16 mb-2">
              {avatarUrl ? (
                <AvatarImage
                  src={
                    avatarUrl.startsWith('/')
                      ? `${import.meta.env.VITE_API_BASE_URL}${avatarUrl}`
                      : `${import.meta.env.VITE_API_BASE_URL}/uploads/avatars/${avatarUrl}`
                  }
                  alt={userProfile?.name || '-'}
                  onError={e => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
              ) : null}
              <AvatarFallback>
                {loadingUserProfile ? '...' : (userProfile?.name ? userProfile.name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() : '--')}
              </AvatarFallback>
            </Avatar>
            <div className="text-lg font-bold text-blue-900 mt-1">
              {loadingUserProfile ? t('common.loading') : userProfile?.name || '-'}
            </div>
            <div className="text-sm text-blue-500">
              {loadingUserProfile ? t('common.loading') : (
                i18n.language.startsWith('th') 
                  ? userProfile?.position?.name_th || userProfile?.position?.name_en || t('positions.noPosition')
                  : userProfile?.position?.name_en || userProfile?.position?.name_th || t('positions.noPosition')
              )}
            </div>
            <div className="text-xs text-blue-400 mb-1">
              {loadingUserProfile ? t('common.loading') : (
                i18n.language.startsWith('th') 
                  ? userProfile?.department?.name_th || userProfile?.department?.name_en || t('departments.noDepartment')
                  : userProfile?.department?.name_en || userProfile?.department?.name_th || t('departments.noDepartment')
              )}
            </div>
            <div className="text-xs text-gray-500">
              {loadingUserProfile ? t('common.loading') : userProfile?.email || '-'}
            </div>
          </Card>
          {/* Company Holidays Table (replace notifications) */}
          <Card className="glass dark:dark-card-gradient shadow-xl dark:dark-glow border-0 p-0 animate-fade-in-up">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-blue-700 text-base font-bold animate-slide-in-left">
                <Calendar className="w-5 h-5 text-blue-500" />
                {t('main.companyHolidays')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              {/* Dropdown เลือกเดือน/ปี */}
              <div className="flex gap-2 mb-2">
                <select
                  className="rounded-lg border px-2 py-1 text-blue-700 bg-white/80 shadow"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                >
                  {months.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
                <select
                  className="rounded-lg border px-2 py-1 text-blue-700 bg-white/80 shadow"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y + 543}</option>
                  ))}
                </select>
              </div>
              <ul className="space-y-2">
                {loadingCompanyHolidays ? (
                  <div className="text-center py-4 text-gray-500 animate-pulse text-sm">{t('common.loading')}</div>
                ) : errorCompanyHolidays ? (
                  <div className="text-center py-4 text-red-500 animate-shake text-sm">{errorCompanyHolidays}</div>
                ) : companyHolidaysOfMonth.length === 0 ? (
                  <li className="text-blue-500 italic">{t('main.noCompanyHolidays')}</li>
                ) : (
                  companyHolidaysOfMonth.map(h => (
                    <li key={h.date} className="flex items-center gap-3 bg-white/60 rounded-xl px-4 py-2 shadow hover:bg-blue-50 transition animate-pop-in">
                      <span className="font-bold text-blue-700 w-24">
                        {new Date(h.date).toLocaleDateString(
                          i18n.language.startsWith('th') ? 'th-TH' : 'en-US', 
                          { day: '2-digit', month: 'short', year: 'numeric' }
                        )}
                      </span>
                      <span className="text-blue-900 font-medium">{h.title}</span>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
          {/* Upcoming Holidays/Events Section */}
          <Card className="glass dark:dark-card-gradient shadow-xl dark:dark-glow border-0 p-0 animate-fade-in-up">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-blue-700 text-base font-bold animate-slide-in-left">
                <Calendar className="w-5 h-5 text-blue-500" />
                {t('main.annualHolidays')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              {/* Dropdown เลือกเดือน/ปี */}
              <div className="flex gap-2 mb-2">
                <select
                  className="rounded-lg border px-2 py-1 text-blue-700 bg-white/80 shadow"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                >
                  {months.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
                <select
                  className="rounded-lg border px-2 py-1 text-blue-700 bg-white/80 shadow"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y + 543}</option>
                  ))}
                </select>
              </div>
              <ul className="space-y-2">
                {holidaysOfMonth.length === 0 ? (
                  <li className="text-blue-500 italic">{t('main.noUpcomingHolidays')}</li>
                ) : (
                  holidaysOfMonth.map(h => (
                    <li key={h.date} className="flex items-center gap-3 bg-white/60 rounded-xl px-4 py-2 shadow hover:bg-blue-50 transition animate-pop-in">
                      <span className="font-bold text-blue-700 w-24">
                        {new Date(h.date).toLocaleDateString(
                          i18n.language.startsWith('th') ? 'th-TH' : 'en-US', 
                          { day: '2-digit', month: 'short', year: 'numeric' }
                        )}
                      </span>
                      <span className="text-blue-900 font-medium">{h.name}</span>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
          {/* Announcements */}
          <Card className="glass dark:dark-card-gradient shadow-xl dark:dark-glow border-0 p-0 animate-fade-in-up">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-blue-700 text-base font-bold animate-slide-in-left">
                <Bell className="w-5 h-5 text-purple-500" />
                {t('main.companyNews')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              {loadingAnnouncements ? (
                <div className="text-center py-4 text-gray-500 animate-pulse text-sm">{t('common.loading')}</div>
              ) : errorAnnouncements ? (
                <div className="text-center py-4 text-red-500 animate-shake text-sm">{errorAnnouncements}</div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-4 text-blue-400 text-sm">{t('main.noAnnouncements', )}</div>
              ) : (
                announcements.map((a, idx) => (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded-xl glass bg-gradient-to-br from-white/80 via-blue-50/80 to-indigo-100/80 shadow border-0 animate-pop-in" style={{ animationDelay: `${idx * 60}ms` }}>
                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-purple-100 text-purple-600">
                      <Bell className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-blue-900 truncate">{a.subject}</div>
                      <div className="text-xs text-gray-500 line-clamp-2 overflow-hidden">{a.detail}</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
        {/* --- END NEW SECTION --- */}

        {/* Quick Actions & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Quick Actions */}
          <Card className="border-0 shadow-xl bg-white/60 dark:dark-card-gradient backdrop-blur-lg rounded-xl p-0 flex flex-col justify-between min-h-[180px] animate-fade-in-up">
            <CardHeader className="pb-2 flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-blue-700 text-lg font-bold animate-slide-in-left">
                <Calendar className="w-5 h-5 text-blue-500" />
                {t('main.quickActions')}
              </CardTitle>
              <CardDescription className="text-blue-400 text-sm animate-slide-in-left delay-100">
                {t('main.quickActionsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              <Link to="/leave-request">
                <Button className="w-full justify-start btn-blue-outline-lg text-base py-2 px-3 gap-2 animate-pop-in" variant="outline">
                  <Calendar className="w-5 h-5" />
                  {t('main.newLeaveRequest')}
                </Button>
              </Link>
              <Link to="/leave-history">
                <Button className="w-full justify-start btn-blue-outline-lg text-base py-2 px-3 gap-2 animate-pop-in delay-100" variant="outline">
                  <Clock className="w-5 h-5" />
                  {t('leave.leaveHistory')}
                </Button>
              </Link>
              <Link to="/calendar">
                <Button className="w-full justify-start btn-blue-outline-lg text-base py-2 px-3 gap-2 animate-pop-in delay-200" variant="outline">
                  <Calendar className="w-5 h-5" />
                  {t('navigation.calendar')}
                </Button>
              </Link>
              <Link to="/announcements">
                <Button className="w-full justify-start btn-blue-outline-lg text-base py-2 px-3 gap-2 animate-pop-in delay-300" variant="outline">
                  <Bell className="w-5 h-5" />
                  {t('main.companyNews')}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Leave Stats (now as a table) */}
          <Card className="border-0 shadow-xl bg-white/60 dark:dark-card-gradient backdrop-blur-lg rounded-xl p-0 flex flex-col min-h-[180px] animate-fade-in-up">
            <CardHeader className="pb-2 flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-blue-700 text-lg font-bold animate-slide-in-left">
                <TrendingUp className="w-5 h-5 text-green-500" />
                {t('main.recentLeaveStats')}
              </CardTitle>
              <CardDescription className="text-blue-400 text-sm animate-slide-in-left delay-100">
                {t('main.recentLeaveStatsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              {loadingRecentLeaves ? (
                <div className="text-center py-4 text-gray-500 animate-pulse text-sm">{t('common.loading')}</div>
              ) : errorRecentLeaves ? (
                <div className="text-center py-4 text-red-500 animate-shake text-sm">{errorRecentLeaves}</div>
              ) : recentLeaves.length === 0 ? (
                <div className="text-center py-4 text-blue-400 text-sm">{t('main.noRecentLeaveRequests')}</div>
              ) : (
                <div className="space-y-2">
                  {recentLeaves.map((l, idx) => (
                    <div key={idx} className="bg-white/80 rounded-lg p-3 shadow-sm border border-blue-100 hover:shadow-md transition-all duration-200 animate-pop-in" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-blue-900 text-sm">
                                {i18n.language.startsWith('th') ? (l.leavetype_th || l.leavetype) : (l.leavetype_en || l.leavetype)}
                              </h4>
                              <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${l.status === 'approved' ? 'bg-green-100 text-green-600' : l.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                                {l.status === 'approved' ? t('leave.approved') : l.status === 'pending' ? t('leave.pending') : t('leave.rejected')}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-blue-600 mt-1">
                              <span>
                                {(() => {
                                  if (!l.duration) return '-';
                                  // ถ้าเป็นวัน
                                  const match = l.duration.match(/(\d+)\s*day/);
                                  if (match) {
                                    return `${match[1]} ${t('common.days')}`;
                                  }
                                  // ถ้าเป็นชั่วโมง
                                  const hourMatch = l.duration.match(/([\d.]+)\s*hour/);
                                  if (hourMatch) {
                                    const hours = Math.floor(Number(hourMatch[1]));
                                    return `${hours} ${t('leave.hours')}`;
                                  }
                                  return l.duration;
                                })()}
                              </span>
                              <span>•</span>
                              <span>{l.startdate ? format(new Date(l.startdate), 'dd/MM/yyyy') : '-'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <style>{`
          .btn-blue-outline-lg {
            border: 1.5px solid #3b82f6;
            color: #2563eb;
            border-radius: 1rem;
            font-weight: 500;
            background: transparent;
            font-size: 1.1rem;
            transition: background 0.15s, color 0.15s;
          }
          .btn-blue-outline-lg:hover {
            background: #eff6ff;
            color: #1e293b;
          }
          .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .animate-float { animation: float 3s ease-in-out infinite alternate; }
          .animate-float-slow { animation: float 8s ease-in-out infinite alternate; }
          .animate-float-slow2 { animation: float 12s ease-in-out infinite alternate; }
          .animate-fade-in { animation: fadeIn 1.2s cubic-bezier(0.23, 1, 0.32, 1); }
          .animate-fade-in-up { animation: fadeInUp 1.1s cubic-bezier(0.23, 1, 0.32, 1); }
          .animate-slide-in-left { animation: slideInLeft 1.1s cubic-bezier(0.23, 1, 0.32, 1); }
          .animate-pop-in { animation: popIn 0.7s cubic-bezier(0.23, 1, 0.32, 1); }
          .animate-bounce-in { animation: bounceIn 1.2s cubic-bezier(0.23, 1, 0.32, 1); }
          .animate-shine { animation: shine 2.5s linear infinite; }
          .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
          @keyframes float { 0% { transform: translateY(0); } 100% { transform: translateY(-18px); } }
          @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
          @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(40px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes slideInLeft { 0% { opacity: 0; transform: translateX(-40px); } 100% { opacity: 1; transform: translateX(0); } }
          @keyframes popIn { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
          @keyframes bounceIn { 0% { opacity: 0; transform: scale(0.7); } 60% { opacity: 1; transform: scale(1.1); } 100% { transform: scale(1); } }
          @keyframes shine { 0% { left: -100%; } 100% { left: 100%; } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
      </div>
      

    </div>
  );
};

export default Index;
