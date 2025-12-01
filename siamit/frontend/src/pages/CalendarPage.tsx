import { SidebarTrigger } from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { getAllThaiHolidays } from '@/constants/getThaiHolidays';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useToast } from '@/hooks/use-toast';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../lib/api';
import { getDaysInMonth } from '@/lib/dateUtils';
import { apiEndpoints } from '@/constants/api';

const CalendarPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [companyEvents, setCompanyEvents] = useState<CompanyEvent[]>([]);
  const [thaiHolidays, setThaiHolidays] = useState<ThaiHoliday[]>([]);
  const [employeeLeaves, setEmployeeLeaves] = useState<EmployeeLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompanyHolidays, setShowCompanyHolidays] = useState(true);
  const [showAnnualHolidays, setShowAnnualHolidays] = useState(true);
  const [showEmployeeLeaves, setShowEmployeeLeaves] = useState(true); // Show for all users
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [leaveFilters, setLeaveFilters] = useState<LeaveFilters>({
    departments: [],
    leaveTypes: [],
    statuses: [],
    employees: []
  });
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>({
    departments: [],
    leaveTypes: [],
    statuses: [],
    employees: []
  });
  const navigate = useNavigate();

  // Month names based on current language
  const monthNames = [
    t('calendar.months.january'),
    t('calendar.months.february'),
    t('calendar.months.march'),
    t('calendar.months.april'),
    t('calendar.months.may'),
    t('calendar.months.june'),
    t('calendar.months.july'),
    t('calendar.months.august'),
    t('calendar.months.september'),
    t('calendar.months.october'),
    t('calendar.months.november'),
    t('calendar.months.december')
  ];

  // Weekday names based on current language
  const weekdayNames = [
    t('calendar.weekdays.sunday'),
    t('calendar.weekdays.monday'),
    t('calendar.weekdays.tuesday'),
    t('calendar.weekdays.wednesday'),
    t('calendar.weekdays.thursday'),
    t('calendar.weekdays.friday'),
    t('calendar.weekdays.saturday')
  ];

  // Update month names and weekday names when language changes
  useEffect(() => {
    // This will trigger a re-render when the language changes
    // The monthNames and weekdayNames arrays will be recreated with new translations
  }, [i18n.language, t]);

  // getDaysInMonth moved to src/lib/dateUtils

  interface CompanyEvent {
    id: string;
    title: string;
    description: string;
    date: string;
    createdAt: string;
    createdBy: string;
    type?: 'company' | 'annual';
  }

  interface ThaiHoliday {
    date: string;
    name: string;
    type: string;
  }

  interface EmployeeLeave {
    id: string;
    userId: string;
    userName: string;
    department: string;
    position: string;
    leaveType: string;
    leaveTypeEn: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    duration: string;
    durationType: string;
    reason: string;
    status: string;
    createdAt: string;
  }

  interface LeaveFilters {
    departments: string[];
    leaveTypes: string[];
    statuses: string[];
    employees: string[];
  }

  interface AvailableFilters {
    departments: string[];
    leaveTypes: string[];
    statuses: string[];
    employees: string[];
  }

  interface CalendarEvent {
    id?: string;
    title: string;
    description?: string;
    date: string;
    createdAt?: string;
    createdBy?: string;
    type: 'company' | 'annual' | 'employee';
    isThaiHoliday?: boolean;
    employeeInfo?: {
      userName: string;
      leaveType: string;
      startDate: string;
      endDate: string;
      duration: string;
      durationType: string;
    };
  }

  // Socket.io event listeners for real-time calendar updates
  useEffect(() => {
    if (socket && isConnected) {
      // Listen for new leave requests
      socket.on('newLeaveRequest', (data) => {
        console.log('Received new leave request:', data);

        // Show toast notification
        toast({
          title: t('notifications.newLeaveRequest'),
          description: `${data.userName} - ${data.leaveType}`,
          variant: 'default'
        });

        // Refresh calendar data by triggering the fetchData effect
        setYear(prevYear => prevYear);
      });

      // Listen for leave request status changes
      socket.on('leaveRequestStatusChanged', (data) => {
        console.log('Received leave request status change:', data);

        // Show toast notification
        toast({
          title: t('notifications.leaveStatusChanged'),
          description: `${t('notifications.request')} ${data.requestId} ${t('notifications.hasBeen')} ${data.status === 'approved' ? t('notifications.approved') : t('notifications.rejected')}`,
          variant: data.status === 'approved' ? 'default' : 'destructive'
        });

        // Refresh calendar data by triggering the fetchData effect
        setYear(prevYear => prevYear);
      });

      // Listen for new company events
      socket.on('newCompanyEvent', (data) => {
        console.log('Received new company event:', data);

        // Show toast notification
        toast({
          title: t('notifications.newCompanyEvent'),
          description: data.title,
          variant: 'default'
        });

        // Refresh calendar data by triggering the fetchData effect
        setYear(prevYear => prevYear);
      });

      return () => {
        socket.off('newLeaveRequest');
        socket.off('leaveRequestStatusChanged');
        socket.off('newCompanyEvent');
      };
    }
  }, [socket, isConnected, toast, t]);

  // Fetch company events, Thai holidays, and employee leaves
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch company events
        const result = await apiService.get(apiEndpoints.customHolidaysByYear(year));
        setCompanyEvents(result.data || []);
        // Get Thai holidays for the year
        const thaiHolidaysData = getAllThaiHolidays(year, t);
        setThaiHolidays(thaiHolidaysData);
        // Fetch employee leaves
        let leaveResult;
        // ดึง leave ทั้งปีสำหรับทุก role (API จะคืนของ user เองถ้าไม่ใช่ admin/superadmin)
        leaveResult = await apiService.get(apiEndpoints.leave.calendar(year));
        setEmployeeLeaves(leaveResult.data || []);
      } catch (error) {
        setCompanyEvents([]);
        setThaiHolidays([]);
        setEmployeeLeaves([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [year, t, isAdmin]);

  // Get all events (company + Thai holidays + employee leaves) for a specific month
  const getEventsByMonth = (year: number, month: number): CalendarEvent[] => {
    const allEvents: CalendarEvent[] = [];

    // Add company events if enabled
    if (showCompanyHolidays && Array.isArray(companyEvents)) {
      const monthCompanyEvents = companyEvents.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.getFullYear() === year && eventDate.getMonth() === month;
      });
      allEvents.push(...monthCompanyEvents.map(event => ({
        ...event,
        type: event.type || 'company',
        isThaiHoliday: false
      })));
    }

    // Add Thai holidays if enabled
    if (showAnnualHolidays && Array.isArray(thaiHolidays)) {
      const monthThaiHolidays = thaiHolidays.filter(holiday => {
        const holidayDate = new Date(holiday.date);
        return holidayDate.getFullYear() === year && holidayDate.getMonth() === month;
      });
      allEvents.push(...monthThaiHolidays.map(holiday => ({
        id: `thai-${holiday.date}`,
        title: holiday.name,
        description: '',
        date: holiday.date,
        createdAt: holiday.date,
        createdBy: 'system',
        type: 'annual' as const,
        isThaiHoliday: true
      })));
    }

    // Add employee leaves if enabled
    if (showEmployeeLeaves && Array.isArray(employeeLeaves)) {
      // กรอง leave เฉพาะ user ที่ล็อกอิน ถ้าไม่ใช่ admin/superadmin
      const filteredLeaves = isAdmin
        ? employeeLeaves
        : employeeLeaves.filter(leave => leave.userId === user?.id);

      // For all users, show their own leaves (API already filters for users)
      const monthEmployeeLeaves = filteredLeaves.filter(leave => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        return (startDate.getFullYear() === year && startDate.getMonth() === month) ||
          (endDate.getFullYear() === year && endDate.getMonth() === month) ||
          (startDate <= new Date(year, month + 1, 0) && endDate >= new Date(year, month, 1));
      });

      // Create events for each day of the leave period
      monthEmployeeLeaves.forEach(leave => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          if (currentDate.getFullYear() === year && currentDate.getMonth() === month) {
            allEvents.push({
              id: `leave-${leave.id}-${currentDate.toISOString().split('T')[0]}`,
              title: leave.userName,
              description: leave.reason,
              date: currentDate.toISOString().split('T')[0],
              createdAt: leave.createdAt,
              createdBy: leave.userId,
              type: 'employee' as const,
              employeeInfo: {
                userName: leave.userName,
                leaveType: i18n.language.startsWith('th') ? leave.leaveType : leave.leaveTypeEn,
                startDate: leave.startDate,
                endDate: leave.endDate,
                duration: leave.duration,
                durationType: leave.durationType
              }
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
    }

    return allEvents;
  };

  // Get color for event type
  const getEventColor = (event: CalendarEvent) => {
    switch (event.type) {
      case 'annual': return 'bg-red-500';
      case 'company': return 'bg-blue-500';
      case 'employee': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Get tooltip content for event
  const getEventTooltip = (event: CalendarEvent) => {
    if (event.type === 'employee' && event.employeeInfo) {
      const { userName, leaveType, startDate, endDate, duration, durationType } = event.employeeInfo;
      const start = new Date(startDate).toLocaleDateString(i18n.language.startsWith('th') ? 'th-TH' : 'en-US');
      const end = new Date(endDate).toLocaleDateString(i18n.language.startsWith('th') ? 'th-TH' : 'en-US');
      const durationText = durationType === 'day' ?
        (i18n.language.startsWith('th') ? `${duration} วัน` : `${duration} days`) :
        (i18n.language.startsWith('th') ? `${duration} ชั่วโมง` : `${duration} hours`);

      return `${userName}\n${leaveType}\n${i18n.language.startsWith('th') ? '' : 'Period'}: ${start} - ${end}\n${i18n.language.startsWith('th') ? '' : 'Duration'}: ${durationText}`;
    }
    return event.title;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 flex flex-col">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <svg viewBox="0 0 1440 320" className="w-full h-32 md:h-48" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <div className="absolute top-4 left-4 z-20">
          <SidebarTrigger className="bg-white/90 hover:bg-white text-blue-700 border border-blue-200 hover:border-blue-300 shadow-lg backdrop-blur-sm" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center py-8 md:py-16 px-4">
          <img src="/lovable-uploads/siamit.png" alt="Logo" className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/80 shadow-2xl border-4 border-white mb-4" />
          <h1 className="text-2xl md:text-5xl font-extrabold text-indigo-900 drop-shadow mb-2 flex items-center gap-2 md:gap-3 text-center">
            {t('calendar.title')}
          </h1>
          <p className="text-sm md:text-xl text-blue-900/70 mb-2 font-medium text-center max-w-2xl">
            {t('calendar.subtitle')}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center py-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 shadow">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="text-2xl font-bold text-blue-900">{year + (i18n.language.startsWith('th') ? 543 : 0)}</span>
          <button onClick={() => setYear(now.getFullYear())} className="px-4 py-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold shadow">
            {t('calendar.currentYear')}
          </button>
          <button onClick={() => setYear(y => y + 1)} className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 shadow">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Switches and Legend */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-6 mb-6 bg-white/60 rounded-xl p-4 shadow-lg w-full max-w-5xl">
          <div className="flex flex-wrap justify-center gap-3 md:gap-6">
            <div className="flex items-center gap-2 md:gap-3 bg-white/50 px-3 py-1.5 rounded-lg shadow-sm">
              <Switch
                checked={showAnnualHolidays}
                onCheckedChange={setShowAnnualHolidays}
                className="data-[state=checked]:bg-red-500 scale-90 md:scale-100"
              />
              <span className="text-xs md:text-sm font-medium text-red-700">{t('calendar.annualHolidays')}</span>
            </div>
            <div className="flex items-center gap-2 md:gap-3 bg-white/50 px-3 py-1.5 rounded-lg shadow-sm">
              <Switch
                checked={showCompanyHolidays}
                onCheckedChange={setShowCompanyHolidays}
                className="data-[state=checked]:bg-blue-500 scale-90 md:scale-100"
              />
              <span className="text-xs md:text-sm font-medium text-blue-700">{t('calendar.companyHolidays')}</span>
            </div>
            <div className="flex items-center gap-2 md:gap-3 bg-white/50 px-3 py-1.5 rounded-lg shadow-sm">
              <Switch
                checked={showEmployeeLeaves}
                onCheckedChange={setShowEmployeeLeaves}
                className="data-[state=checked]:bg-green-500 scale-90 md:scale-100"
              />
              <span className="text-xs md:text-sm font-medium text-green-700">
                {isAdmin ? t('calendar.employeeLeaves') : t('calendar.myLeaves')}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex hidden md:flex flex-wrap justify-center items-center gap-3 md:gap-4 mt-2 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-300 lg:pl-6 w-full lg:w-auto">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-red-500 rounded-full"></div>
              <span className="text-[10px] md:text-xs text-red-700">{t('calendar.legend.annualHoliday')}</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-blue-500 rounded-full"></div>
              <span className="text-[10px] md:text-xs text-blue-700">{t('calendar.legend.companyHoliday')}</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
              <span className="text-[10px] md:text-xs text-green-700">
                {isAdmin ? t('calendar.legend.employeeLeave') : t('calendar.legend.myLeave')}
              </span>
            </div>

          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-blue-600">{t('calendar.loading')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 w-full max-w-6xl">
            {monthNames.map((month, mIdx) => {
              const days = getDaysInMonth(year, mIdx);
              const firstDay = new Date(year, mIdx, 1).getDay();
              // Sunday = 0, Monday = 1, ...
              const weeks: Array<Array<number | null>> = [];
              let week: Array<number | null> = Array(firstDay).fill(null);
              for (let d = 1; d <= days; d++) {
                week.push(d);
                if (week.length === 7) {
                  weeks.push(week);
                  week = [];
                }
              }
              if (week.length > 0) weeks.push([...week, ...Array(7 - week.length).fill(null)]);

              // Get all events for this month
              const events = getEventsByMonth(year, mIdx);
              const eventDates = events.map(e => e.date);
              const eventMap: Record<string, CalendarEvent> = {};
              const eventCountMap: Record<string, number> = {};

              // Create event map
              events.forEach(e => {
                eventMap[e.date] = e;
              });

              return (
                <div key={month} className="bg-white/80 rounded-2xl shadow-xl p-4 flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-indigo-400" />
                    <button
                      className="text-lg font-bold text-blue-900 hover:underline hover:text-indigo-600 transition cursor-pointer bg-transparent border-0 p-0"
                      onClick={() => navigate(`/calendar/${year}/${mIdx + 1}`)}
                    >
                      {month}
                    </button>
                  </div>
                  <table className="w-full text-center">
                    <thead>
                      <tr className="text-blue-500">
                        <th className="py-1">{weekdayNames[0]}</th>
                        <th className="py-1">{weekdayNames[1]}</th>
                        <th className="py-1">{weekdayNames[2]}</th>
                        <th className="py-1">{weekdayNames[3]}</th>
                        <th className="py-1">{weekdayNames[4]}</th>
                        <th className="py-1">{weekdayNames[5]}</th>
                        <th className="py-1">{weekdayNames[6]}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((week, wIdx) => (
                        <tr key={wIdx}>
                          {week.map((d, dIdx) => {
                            if (!d) return <td key={dIdx} className="py-1"> </td>;
                            const dateStr = `${year}-${(mIdx + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

                            // Check for events using multiple date formats
                            const event = eventMap[dateStr] ||
                              eventMap[`${year}-${mIdx + 1}-${d}`] ||
                              eventMap[`${year}-${(mIdx + 1).toString().padStart(2, '0')}-${d}`] ||
                              eventMap[`${dateStr} 00:00:00`] ||
                              eventMap[`${year}-${(mIdx + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')} 00:00:00`];

                            return (
                              <td
                                key={dIdx}
                                className={`py-1 px-1 rounded-lg font-semibold transition`}
                              >
                                {event ? (
                                  <div className="relative group">
                                    <span
                                      className={`${getEventColor(event)} text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto font-bold shadow cursor-pointer hover:scale-110 transition-transform`}
                                      title={getEventTooltip(event)}
                                    >
                                      {d}
                                    </span>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-pre-line z-10 max-w-xs">
                                      {getEventTooltip(event)}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                ) : (
                                  <span>{d}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* แสดงรายการกิจกรรมของเดือนนี้ */}
                  <ul className="mt-2 text-xs text-left w-full max-h-32 overflow-y-auto">
                    {events.map(e => {
                      const d = new Date(e.date);
                      const day = d.getDate();
                      const monthNum = d.getMonth() + 1;
                      const eventType = e.type || 'company';
                      return (
                        <li key={e.id || `event-${e.date}`} className="flex items-center gap-2 mb-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${eventType === 'annual'
                              ? 'bg-red-500'
                              : eventType === 'employee'
                                ? 'bg-green-500'
                                : 'bg-blue-500'
                            }`}></span>
                          <span className={
                            eventType === 'annual'
                              ? 'text-red-600'
                              : eventType === 'employee'
                                ? 'text-green-600'
                                : 'text-blue-600'
                          }>
                            {eventType === 'employee' && e.employeeInfo
                              ? `${e.employeeInfo.userName} (${e.employeeInfo.leaveType})`
                              : e.title
                            } ({day}/{monthNum})
                            {eventType === 'employee' && e.employeeInfo && (
                              <span className="text-gray-500 ml-1">
                                {new Date(e.employeeInfo.startDate).toLocaleDateString(i18n.language.startsWith('th') ? 'th-TH' : 'en-US')} - {new Date(e.employeeInfo.endDate).toLocaleDateString(i18n.language.startsWith('th') ? 'th-TH' : 'en-US')}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};

export default CalendarPage; 