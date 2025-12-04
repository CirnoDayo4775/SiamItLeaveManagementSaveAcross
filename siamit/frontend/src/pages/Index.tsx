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
  const { user, logout, showSessionExpiredDialog } = useAuth();
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

  // Consolidated function to fetch dashboard stats
  const fetchDashboardStats = async () => {
    setLoadingDashboard(true);
    try {
      let statsUrl = `${apiEndpoints.dashboard.stats}?year=${filterYear}`;
      if (filterMonth && filterMonth !== 0) {
        statsUrl += `&month=${filterMonth}`;
      }
      let backdatedUrl = `${apiEndpoints.dashboard.myBackdated}?year=${filterYear}`;
      if (filterMonth && filterMonth !== 0) {
        backdatedUrl += `&month=${filterMonth}`;
      }

      const [statsRes, backdatedRes] = await Promise.all([
        apiService.get(statsUrl, undefined, showSessionExpiredDialog),
        apiService.get(backdatedUrl, undefined, showSessionExpiredDialog)
      ]);

      if (statsRes && (statsRes.status === 'success' || statsRes.success === true) && statsRes.data) {
        setDaysUsed(statsRes.data.daysUsed || 0);
        setHoursUsed(statsRes.data.hoursUsed || 0);
        setPendingRequests(statsRes.data.pendingRequests || 0);
        setApprovalRate(statsRes.data.approvalRate || 0);
      }

      if (backdatedRes && (backdatedRes.status === 'success' || backdatedRes.success === true) && backdatedRes.data) {
        setBackdatedCount(backdatedRes.data.count || 0);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching dashboard stats:', error);
      }
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Fetch recent leave requests
  const fetchRecentLeaves = async () => {
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

  // Initial load and filter changes
  useEffect(() => {
    fetchDashboardStats();
    fetchRecentLeaves();
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
          if (data.data.avatar_url) {
            setAvatarUrl(data.data.avatar_url);
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching user profile:', error);
        }
      } finally {
        setLoadingUserProfile(false);
      }
    };

    fetchUserProfile();
    checkLineLinkStatus();
  }, [showSessionExpiredDialog]);

  // State for calendar/holidays
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
          const sortedAnnouncements = data.data
            .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 3);
          setAnnouncements(sortedAnnouncements);
        } else {
          setErrorAnnouncements(t('error.cannotLoadStats'));
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching announcements:', error);
        }
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
          setCompanyHolidaysOfMonth([]);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching company holidays:', error);
        }
        setCompanyHolidaysOfMonth([]);
      } finally {
        setLoadingCompanyHolidays(false);
      }
    };

    fetchCompanyHolidays();
  }, [selectedYear, selectedMonth, showSessionExpiredDialog]);

  // Socket.io event listeners
  useEffect(() => {
    if (socket && isConnected) {
      socket.on('leaveRequestStatusChanged', (data) => {
        toast({
          title: t('notifications.statusChanged'),
          description: `${t('notifications.request')} ${data.requestId} ${t('notifications.hasBeen')} ${data.status === 'approved' ? t('notifications.approved') : t('notifications.rejected')}`,
          variant: data.status === 'approved' ? 'default' : 'destructive'
        });
        fetchDashboardStats();
        fetchRecentLeaves();
      });

      socket.on('newAnnouncement', (data) => {
        toast({
          title: t('notifications.newAnnouncement'),
          description: data.subject,
          variant: 'default'
        });
        // Refresh announcements logic here if needed, or just rely on next page load/poll
      });

      if (user?.role === 'admin' || user?.role === 'superadmin') {
        socket.on('newLeaveRequest', (data) => {
          toast({
            title: t('notifications.newLeaveRequest'),
            description: `${data.userName} - ${data.leaveType}`,
            variant: 'default'
          });
          fetchDashboardStats();
          fetchRecentLeaves();
        });
      }

      return () => {
        socket.off('leaveRequestStatusChanged');
        socket.off('newAnnouncement');
        socket.off('newLeaveRequest');
      };
    }
  }, [socket, isConnected, toast, t, user?.role, filterMonth, filterYear]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 dark:dark-gradient-bg transition-all duration-500 relative overflow-x-hidden">
      {/* Background Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[350px] h-[350px] rounded-full bg-gradient-to-br from-blue-200 via-indigo-100 to-purple-100 opacity-30 blur-2xl animate-float-slow" />
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] rounded-full bg-gradient-to-tr from-purple-200 via-blue-100 to-indigo-100 opacity-20 blur-xl animate-float-slow2" />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full bg-blue-100 opacity-10 blur-xl animate-pulse-slow" style={{ transform: 'translate(-50%,-50%)' }} />
      </div>

      {/* Top Bar */}
      <div className="border-b bg-white/80 dark:dark-card-gradient backdrop-blur-sm sticky top-0 z-20 shadow-sm dark:dark-glow">
        <div className="flex flex-col md:flex-row h-auto md:h-14 items-center px-3 md:px-4 py-2 md:py-0 gap-2 md:gap-0">
          <div className="flex items-center w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center">
              <SidebarTrigger />
              <div className="flex-1 ml-2 md:ml-3">
                <h1 className="text-base md:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-500 to-purple-500 tracking-tight drop-shadow-lg animate-fade-in-up">
                  {t('main.leaveManagementSystem')}
                </h1>
                <p className="text-[10px] sm:text-xs text-blue-500 dark:text-blue-200 animate-fade-in-up delay-100 leading-tight truncate whitespace-nowrap max-w-[200px] sm:max-w-xs md:max-w-md">
                  {t('main.welcomeMessage')}
                </p>
              </div>
            </div>
          </div>

          {/* Calendar Filter */}
          <div className="flex gap-2 w-full md:w-auto justify-end mt-1 md:mt-0 md:ml-auto">
            <select
              className="flex-1 md:flex-none rounded-lg border px-2 py-1 text-xs md:text-sm text-blue-700 bg-white/80 shadow focus:ring-2 focus:ring-blue-400 outline-none"
              value={filterMonth}
              onChange={e => setFilterMonth(Number(e.target.value))}
            >
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              className="flex-1 md:flex-none rounded-lg border px-2 py-1 text-xs md:text-sm text-blue-700 bg-white/80 shadow focus:ring-2 focus:ring-blue-400 outline-none"
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

      <div className="p-3 md:p-5 space-y-4 md:space-y-5 animate-fade-in pb-16 md:pb-20">
        {/* Welcome Section */}
        <div className="relative rounded-2xl p-4 md:p-6 text-white overflow-hidden glass shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in-up bg-gradient-to-tr from-blue-100 via-indigo-200 to-purple-100 dark:from-indigo-900/80 dark:via-purple-900/80 dark:to-blue-900/80">
          <div className="z-10 flex-1 space-y-3 text-center md:text-left w-full">
            <h2 className="text-2xl md:text-4xl font-extrabold mb-1 drop-shadow-lg animate-slide-in-left text-blue-600 dark:text-blue-200">
              {t('main.hello')} {loadingUserProfile ? t('common.loading') : (userProfile?.name || t('main.user'))}! 👋
            </h2>
            <p className="mb-4 text-sm md:text-lg font-medium animate-slide-in-left delay-100 text-indigo-500 dark:text-indigo-300">
              {t('main.today')} {formatCurrentDate()}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link to="/leave-request" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-700 font-bold shadow-lg border-0 px-6 py-2 text-sm md:text-base rounded-xl animate-bounce-in transition-transform hover:scale-105"
                >
                  {t('main.newLeaveRequest')}
                </Button>
              </Link>

              <Button
                size="lg"
                variant="secondary"
                onClick={lineLinkStatus === 'linked' ? handleLineUnlink : handleLineLogin}
                disabled={lineLinkingLoading}
                className={`w-full sm:w-auto font-bold shadow-lg border-0 px-6 py-2 text-sm md:text-base rounded-xl animate-bounce-in flex items-center justify-center gap-2 transition-transform hover:scale-105 ${lineLinkStatus === 'linked'
                  ? 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700'
                  : 'bg-[#06C755] text-white hover:bg-[#05b34c] dark:bg-[#05b34c] dark:hover:bg-[#04a043]'
                  }`}
              >
                {lineLinkingLoading
                  ? (lineLinkStatus === 'linked' ? t('line.unlinking', 'Unlinking...') : t('line.linking', 'Linking...'))
                  : lineLinkStatus === 'linked'
                    ? t('line.unlinkAccount')
                    : t('line.linkAccount')
                }
              </Button>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-gradient-to-l from-yellow-100 dark:from-yellow-600/30 to-transparent opacity-30 blur-3xl"></div>
          <div className="flex-1 flex items-center justify-center animate-float hidden md:flex">
            <img src={`${config.upload.publicPath}/lovable-uploads/siamit.png`} alt="Logo" className="w-24 h-24 md:w-32 md:h-32 object-contain drop-shadow-2xl" />
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Backdated Requests Card */}
          <Card className="group border-0 shadow-xl bg-white/70 dark:bg-gray-800/80 dark:dark-card-gradient backdrop-blur-lg rounded-2xl flex flex-col items-center justify-center py-4 md:py-6 px-4 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden animate-fade-in-up">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-red-50 dark:bg-red-900/40 rounded-full flex items-center justify-center mb-1 shadow-md group-hover:scale-110 transition-transform duration-200 animate-pop-in">
                <Calendar className="w-6 h-6 md:w-7 md:h-7 text-red-500 dark:text-red-400" />
              </div>
              <div className="text-2xl md:text-4xl font-extrabold text-blue-900 dark:text-blue-100 mb-1">{loadingDashboard ? '-' : backdatedCount}</div>
              <div className="text-xs md:text-base font-bold text-blue-600/80 dark:text-blue-300/90 mt-1 text-center">{t('main.backdatedRequests', 'Backdated Requests')}</div>
            </div>
          </Card>
          {/* Days Used Card */}
          <Card className="group border-0 shadow-xl bg-white/70 dark:bg-gray-800/80 dark:dark-card-gradient backdrop-blur-lg rounded-2xl flex flex-col items-center justify-center py-4 md:py-6 px-4 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-green-50 dark:bg-green-900/40 rounded-full flex items-center justify-center mb-1 shadow-md group-hover:scale-110 transition-transform duration-200 animate-pop-in">
                <Clock className="w-6 h-6 md:w-7 md:h-7 text-green-500 dark:text-green-400" />
              </div>
              <div className="text-2xl md:text-4xl font-extrabold text-blue-900 dark:text-blue-100 mb-1">
                {loadingDashboard ? '-' : `${daysUsed}`}
                <span className="text-sm md:text-lg font-medium text-blue-700 dark:text-blue-300 ml-1">{t('common.days')}</span>
              </div>
              <div className="text-xs md:text-base font-bold text-blue-600/80 dark:text-blue-300/90 mt-1 text-center">{t('main.daysUsed', 'Days Used')}</div>
            </div>
          </Card>
          {/* Pending Requests Card */}
          <Card className="group border-0 shadow-xl bg-white/70 dark:bg-gray-800/80 dark:dark-card-gradient backdrop-blur-lg rounded-2xl flex flex-col items-center justify-center py-4 md:py-6 px-4 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-orange-50 dark:bg-orange-900/40 rounded-full flex items-center justify-center mb-1 shadow-md group-hover:scale-110 transition-transform duration-200 animate-pop-in">
                <Users className="w-6 h-6 md:w-7 md:h-7 text-orange-500 dark:text-orange-400" />
              </div>
              <div className="text-2xl md:text-4xl font-extrabold text-blue-900 dark:text-blue-100 mb-1">{loadingDashboard ? '-' : pendingRequests}</div>
              <div className="text-xs md:text-base font-bold text-blue-600/80 dark:text-blue-300/90 mt-1 text-center">{t('main.pendingRequests', 'Pending Requests')}</div>
            </div>
          </Card>
          {/* Approval Rate Card */}
          <Card className="group border-0 shadow-xl bg-white/70 dark:bg-gray-800/80 dark:dark-card-gradient backdrop-blur-lg rounded-2xl flex flex-col items-center justify-center py-4 md:py-6 px-4 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-purple-50 dark:bg-purple-900/40 rounded-full flex items-center justify-center mb-1 shadow-md group-hover:scale-110 transition-transform duration-200 animate-pop-in">
                <TrendingUp className="w-6 h-6 md:w-7 md:h-7 text-purple-500 dark:text-purple-400" />
              </div>
              <div className="text-2xl md:text-4xl font-extrabold text-blue-900 dark:text-blue-100 mb-1">{loadingDashboard ? '-' : approvalRate + '%'}</div>
              <div className="text-xs md:text-base font-bold text-blue-600/80 dark:text-blue-300/90 mt-1 text-center">{t('main.approvalRate', 'Approval Rate')}</div>
            </div>
          </Card>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* User Summary */}
          <Card className="glass dark:bg-gray-800/90 dark:dark-card-gradient shadow-xl dark:dark-glow border-0 flex flex-col items-center justify-center p-6 animate-fade-in-up rounded-2xl">
            <Avatar className="w-20 h-20 mb-3 ring-4 ring-blue-50 dark:ring-blue-900/50 shadow-lg">
              {avatarUrl ? (
                <AvatarImage
                  src={
                    avatarUrl.startsWith('/')
                      ? `${import.meta.env.VITE_API_BASE_URL}${avatarUrl}`
                      : `${import.meta.env.VITE_API_BASE_URL}/uploads/avatars/${avatarUrl}`
                  }
                  alt={userProfile?.name || '-'}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-200 text-xl font-bold">
                {loadingUserProfile ? '...' : (userProfile?.name ? userProfile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '--')}
              </AvatarFallback>
            </Avatar>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1 text-center">
              {loadingUserProfile ? t('common.loading') : userProfile?.name || '-'}
            </div>
            <div className="text-sm font-medium text-blue-600 dark:text-blue-300 mt-1 text-center">
              {loadingUserProfile ? t('common.loading') : (
                i18n.language.startsWith('th')
                  ? userProfile?.position?.name_th || userProfile?.position?.name_en || t('positions.noPosition')
                  : userProfile?.position?.name_en || userProfile?.position?.name_th || t('positions.noPosition')
              )}
            </div>
            <div className="text-xs text-blue-400 dark:text-blue-400 mb-2 text-center">
              {loadingUserProfile ? t('common.loading') : (
                i18n.language.startsWith('th')
                  ? userProfile?.department?.name_th || userProfile?.department?.name_en || t('departments.noDepartment')
                  : userProfile?.department?.name_en || userProfile?.department?.name_th || t('departments.noDepartment')
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60 px-3 py-1 rounded-full">
              {loadingUserProfile ? t('common.loading') : userProfile?.email || '-'}
            </div>
          </Card>

          {/* Company Holidays */}
          <Card className="glass dark:bg-gray-800/90 dark:dark-card-gradient shadow-xl dark:dark-glow border-0 p-0 animate-fade-in-up rounded-2xl overflow-hidden flex flex-col h-full">
            <CardHeader className="pb-3 bg-blue-50/50 dark:bg-blue-900/30">
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-200 text-base font-bold">
                <Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                {t('main.companyHolidays')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4 flex-1">
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-lg border dark:border-gray-600 px-2 py-1.5 text-sm text-blue-700 dark:text-blue-200 bg-white/80 dark:bg-gray-700/80 shadow-sm outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-600"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                >
                  {months.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
                <select
                  className="w-24 rounded-lg border dark:border-gray-600 px-2 py-1.5 text-sm text-blue-700 dark:text-blue-200 bg-white/80 dark:bg-gray-700/80 shadow-sm outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-600"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y + (i18n.language.startsWith('th') ? 543 : 0)}</option>
                  ))}
                </select>
              </div>
              <div className="overflow-y-auto max-h-[200px] pr-1 custom-scrollbar">
                <ul className="space-y-2">
                  {loadingCompanyHolidays ? (
                    <div className="text-center py-8 text-gray-400 animate-pulse text-sm">{t('common.loading')}</div>
                  ) : errorCompanyHolidays ? (
                    <div className="text-center py-8 text-red-400 text-sm">{errorCompanyHolidays}</div>
                  ) : companyHolidaysOfMonth.length === 0 ? (
                    <div className="text-center py-8 text-blue-400/70 italic text-sm">{t('main.noCompanyHolidays')}</div>
                  ) : (
                    companyHolidaysOfMonth.map(h => (
                      <li key={h.date} className="flex items-center gap-3 bg-white/60 dark:bg-gray-700/60 rounded-xl px-3 py-2.5 shadow-sm hover:bg-blue-50 dark:hover:bg-gray-600/60 transition-colors">
                        <div className="flex flex-col items-center justify-center bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 rounded-lg w-10 h-10 shrink-0">
                          <span className="text-xs font-bold">{new Date(h.date).getDate()}</span>
                          <span className="text-[10px] uppercase">{new Date(h.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                        </div>
                        <span className="text-blue-900 dark:text-blue-100 font-medium text-sm line-clamp-2">{h.title}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Annual Holidays */}
          <Card className="glass dark:bg-gray-800/90 dark:dark-card-gradient shadow-xl dark:dark-glow border-0 p-0 animate-fade-in-up rounded-2xl overflow-hidden flex flex-col h-full">
            <CardHeader className="pb-3 bg-indigo-50/50 dark:bg-indigo-900/30">
              <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-200 text-base font-bold">
                <Calendar className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                {t('main.annualHolidays')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4 flex-1">
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-lg border dark:border-gray-600 px-2 py-1.5 text-sm text-indigo-700 dark:text-indigo-200 bg-white/80 dark:bg-gray-700/80 shadow-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-600"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                >
                  {months.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
                <select
                  className="w-24 rounded-lg border dark:border-gray-600 px-2 py-1.5 text-sm text-indigo-700 dark:text-indigo-200 bg-white/80 dark:bg-gray-700/80 shadow-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-600"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y + (i18n.language.startsWith('th') ? 543 : 0)}</option>
                  ))}
                </select>
              </div>
              <div className="overflow-y-auto max-h-[200px] pr-1 custom-scrollbar">
                <ul className="space-y-2">
                  {holidaysOfMonth.length === 0 ? (
                    <div className="text-center py-8 text-indigo-400/70 italic text-sm">{t('main.noUpcomingHolidays')}</div>
                  ) : (
                    holidaysOfMonth.map(h => (
                      <li key={h.date} className="flex items-center gap-3 bg-white/60 dark:bg-gray-700/60 rounded-xl px-3 py-2.5 shadow-sm hover:bg-indigo-50 dark:hover:bg-gray-600/60 transition-colors">
                        <div className="flex flex-col items-center justify-center bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 rounded-lg w-10 h-10 shrink-0">
                          <span className="text-xs font-bold">{new Date(h.date).getDate()}</span>
                          <span className="text-[10px] uppercase">{new Date(h.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                        </div>
                        <span className="text-indigo-900 dark:text-indigo-100 font-medium text-sm line-clamp-2">{h.name}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card className="glass dark:bg-gray-800/90 dark:dark-card-gradient shadow-xl dark:dark-glow border-0 p-0 animate-fade-in-up rounded-2xl overflow-hidden flex flex-col h-full">
            <CardHeader className="pb-3 bg-purple-50/50 dark:bg-purple-900/30">
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-200 text-base font-bold">
                <Bell className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                {t('main.companyNews')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4 flex-1">
              <div className="overflow-y-auto max-h-[260px] pr-1 custom-scrollbar">
                {loadingAnnouncements ? (
                  <div className="text-center py-8 text-gray-400 animate-pulse text-sm">{t('common.loading')}</div>
                ) : errorAnnouncements ? (
                  <div className="text-center py-8 text-red-400 text-sm">{errorAnnouncements}</div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-8 text-purple-400/70 italic text-sm">{t('main.noAnnouncements')}</div>
                ) : (
                  announcements.map((a, idx) => (
                    <div key={a.id} className="flex items-start gap-3 p-3 mb-2 rounded-xl glass bg-gradient-to-br from-white/80 via-purple-50/50 to-indigo-50/50 dark:from-gray-700/60 dark:via-purple-900/30 dark:to-indigo-900/30 shadow-sm border border-purple-100/50 dark:border-purple-800/50 hover:shadow-md transition-all">
                      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 shrink-0 mt-0.5">
                        <Bell className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-purple-900 dark:text-purple-100 truncate mb-0.5">{a.subject}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">{a.detail}</div>
                        <div className="text-[10px] text-gray-400 mt-1 text-right">
                          {a.createdAt ? format(new Date(a.createdAt), 'dd MMM yyyy') : ''}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card className="border-0 shadow-xl bg-white/70 dark:dark-card-gradient backdrop-blur-lg rounded-2xl p-0 flex flex-col animate-fade-in-up">
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="flex items-center gap-2 text-blue-800 text-lg font-bold">
                <Calendar className="w-5 h-5 text-blue-600" />
                {t('main.quickActions')}
              </CardTitle>
              <CardDescription className="text-blue-500/80 text-xs md:text-sm">
                {t('main.quickActionsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              <Link to="/leave-request">
                <Button className="w-full justify-start h-auto py-3 px-4 text-left bg-white hover:bg-blue-50 text-blue-700 border border-blue-100 hover:border-blue-200 shadow-sm rounded-xl transition-all group" variant="outline">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3 group-hover:bg-blue-200 transition-colors">
                    <Calendar className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm md:text-base truncate">{t('main.newLeaveRequest')}</span>
                    <span className="text-xs text-gray-500 font-normal truncate">{t('main.createRequestDesc', 'Create a new request')}</span>
                  </div>
                </Button>
              </Link>
              <Link to="/leave-history">
                <Button className="w-full justify-start h-auto py-3 px-4 text-left bg-white hover:bg-green-50 text-green-700 border border-green-100 hover:border-green-200 shadow-sm rounded-xl transition-all group" variant="outline">
                  <div className="bg-green-100 p-2 rounded-lg mr-3 group-hover:bg-green-200 transition-colors">
                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm md:text-base truncate">{t('leave.leaveHistory')}</span>
                    <span className="text-xs text-gray-500 font-normal truncate">{t('main.viewHistoryDesc', 'View your leave history')}</span>
                  </div>
                </Button>
              </Link>
              <Link to="/calendar">
                <Button className="w-full justify-start h-auto py-3 px-4 text-left bg-white hover:bg-purple-50 text-purple-700 border border-purple-100 hover:border-purple-200 shadow-sm rounded-xl transition-all group" variant="outline">
                  <div className="bg-purple-100 p-2 rounded-lg mr-3 group-hover:bg-purple-200 transition-colors">
                    <Calendar className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm md:text-base truncate">{t('navigation.calendar')}</span>
                    <span className="text-xs text-gray-500 font-normal truncate">{t('main.viewCalendarDesc', 'View team calendar')}</span>
                  </div>
                </Button>
              </Link>
              <Link to="/announcements">
                <Button className="w-full justify-start h-auto py-3 px-4 text-left bg-white hover:bg-orange-50 text-orange-700 border border-orange-100 hover:border-orange-200 shadow-sm rounded-xl transition-all group" variant="outline">
                  <div className="bg-orange-100 p-2 rounded-lg mr-3 group-hover:bg-orange-200 transition-colors">
                    <Bell className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm md:text-base truncate">{t('main.companyNews')}</span>
                    <span className="text-xs text-gray-500 font-normal truncate">{t('main.viewNewsDesc', 'Read company news')}</span>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Leave Stats */}
          <Card className="border-0 shadow-xl bg-white/70 dark:dark-card-gradient backdrop-blur-lg rounded-2xl p-0 flex flex-col animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="flex items-center gap-2 text-blue-800 text-lg font-bold">
                <TrendingUp className="w-5 h-5 text-green-600" />
                {t('main.recentLeaveStats')}
              </CardTitle>
              <CardDescription className="text-blue-500/80 text-sm">
                {t('main.recentLeaveStatsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingRecentLeaves ? (
                <div className="text-center py-8 text-gray-400 animate-pulse text-sm">{t('common.loading')}</div>
              ) : errorRecentLeaves ? (
                <div className="text-center py-8 text-red-400 text-sm">{errorRecentLeaves}</div>
              ) : recentLeaves.length === 0 ? (
                <div className="text-center py-8 text-blue-400/70 text-sm">{t('main.noRecentLeaveRequests')}</div>
              ) : (
                <div className="space-y-3">
                  {recentLeaves.slice(0, 4).map((l, idx) => (
                    <div key={idx} className="bg-white/80 rounded-xl p-3 shadow-sm border border-blue-50 hover:shadow-md transition-all duration-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${l.status === 'approved' ? 'bg-green-100 text-green-600' :
                          l.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                          {l.status === 'approved' ? <TrendingUp className="w-5 h-5" /> :
                            l.status === 'pending' ? <Clock className="w-5 h-5" /> :
                              <Users className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-blue-900 text-sm">
                            {i18n.language.startsWith('th') ? (l.leavetype_th || l.leavetype) : (l.leavetype_en || l.leavetype)}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{l.startdate ? format(new Date(l.startdate), 'dd MMM yyyy') : '-'}</span>
                            <span>•</span>
                            <span>
                              {(() => {
                                if (!l.duration) return '-';
                                const match = l.duration.match(/(\d+)\s*day/);
                                if (match) return `${match[1]} ${t('common.days')}`;
                                const hourMatch = l.duration.match(/([\d.]+)\s*hour/);
                                if (hourMatch) return `${Math.floor(Number(hourMatch[1]))} ${t('leave.hours')}`;
                                return l.duration;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${l.status === 'approved' ? 'bg-green-100 text-green-700' :
                        l.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                        {l.status === 'approved' ? t('leave.approved') : l.status === 'pending' ? t('leave.pending') : t('leave.rejected')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          
          .animate-float { animation: float 3s ease-in-out infinite alternate; }
          .animate-float-slow { animation: float 8s ease-in-out infinite alternate; }
          .animate-float-slow2 { animation: float 12s ease-in-out infinite alternate; }
          .animate-fade-in { animation: fadeIn 0.8s ease-out; }
          .animate-fade-in-up { animation: fadeInUp 0.8s ease-out; }
          .animate-slide-in-left { animation: slideInLeft 0.8s ease-out; }
          .animate-pop-in { animation: popIn 0.5s cubic-bezier(0.23, 1, 0.32, 1); }
          .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.23, 1, 0.32, 1); }
          .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
          
          @keyframes float { 0% { transform: translateY(0); } 100% { transform: translateY(-10px); } }
          @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
          @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes slideInLeft { 0% { opacity: 0; transform: translateX(-20px); } 100% { opacity: 1; transform: translateX(0); } }
          @keyframes popIn { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
          @keyframes bounceIn { 0% { opacity: 0; transform: scale(0.9); } 60% { opacity: 1; transform: scale(1.05); } 100% { transform: scale(1); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
      </div>
    </div>
  );
};

export default Index;
