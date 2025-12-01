import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiEndpoints } from '@/constants/api';
import { monthNames } from '@/constants/common';
import { getThaiHolidaysByMonth } from '@/constants/getThaiHolidays';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { showToastMessage } from '@/lib/toast';
import { Building2, ChevronLeft, Edit2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { getDaysInMonth } from '@/lib/dateUtils';
 

// getDaysInMonth moved to src/lib/dateUtils

interface CompanyEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  createdAt: string;
  createdBy: string;
  type?: 'company' | 'annual';
  createdByName?: string;
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

interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  date: string;
  createdAt?: string;
  createdBy?: string;
  type: 'company' | 'annual' | 'employee';
  isThaiHoliday?: boolean;
  isDual?: boolean;
  employeeInfo?: {
    userName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    duration: string;
    durationType: string;
  };
  createdByName?: string;
}

const CompanyMonthDetailPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { year, month } = useParams();
  const currentYear = parseInt(year || new Date().getFullYear().toString());
  const currentMonth = parseInt(month || (new Date().getMonth() + 1).toString()) - 1;
  
  // Get current language
  const currentLang = i18n.language.startsWith('th') ? 'th' : 'en';
  const currentMonthNames = monthNames[currentLang];
  
  const [companyEvents, setCompanyEvents] = useState<CompanyEvent[]>([]);
  const [thaiHolidays, setThaiHolidays] = useState<ThaiHoliday[]>([]);
  const [employeeLeaves, setEmployeeLeaves] = useState<EmployeeLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CompanyEvent | null>(null);
  const [showCompanyHolidays, setShowCompanyHolidays] = useState(true);
  const [showAnnualHolidays, setShowAnnualHolidays] = useState(true);
  const [showEmployeeLeaves, setShowEmployeeLeaves] = useState(true);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  // Fetch company events, Thai holidays, and employee leaves for the specific month
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch company events
        const result = await apiService.get(apiEndpoints.customHolidaysByYear(currentYear));
        const allEvents = result.data || [];
        // Filter events for the current month
        const monthEvents = allEvents.filter((event: CompanyEvent) => {
          const eventDate = new Date(event.date);
          return eventDate.getFullYear() === currentYear && eventDate.getMonth() === currentMonth;
        });
        setCompanyEvents(monthEvents);
        
        // Get Thai holidays for the current month
        const thaiHolidaysData = getThaiHolidaysByMonth(currentYear, currentMonth, t);
        setThaiHolidays(thaiHolidaysData);
        
        // Fetch employee leaves
        const leaveResult = await apiService.get(apiEndpoints.leave.calendarWithMonth(currentYear, currentMonth + 1));
        setEmployeeLeaves(leaveResult.data || []);
        
      } catch (error) {
        console.error('Error fetching data:', error);
        setCompanyEvents([]);
        setThaiHolidays([]);
        setEmployeeLeaves([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentYear, currentMonth, t]);

  // Create calendar grid
  const days = getDaysInMonth(currentYear, currentMonth);
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
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

  // Combine and filter events based on switches
  const allEvents: CalendarEvent[] = [];
  
  // Add company events if enabled
  if (showCompanyHolidays) {
    allEvents.push(...companyEvents.map(event => ({
      ...event,
      type: event.type || 'company',
      isThaiHoliday: false
    })));
  }
  
  // Add Thai holidays if enabled
  if (showAnnualHolidays) {
    allEvents.push(...thaiHolidays.map(holiday => ({
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
  if (showEmployeeLeaves) {
    // Create events for each day of the leave period
    employeeLeaves.forEach(leave => {
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        if (currentDate.getFullYear() === currentYear && currentDate.getMonth() === currentMonth) {
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
              leaveType: currentLang === 'th' ? leave.leaveType : leave.leaveTypeEn,
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

  // Create event map for highlighting
  const eventMap: Record<string, CalendarEvent> = {};
  const eventCountMap: Record<string, number> = {};
  
  // First pass: count events per date
  allEvents.forEach(event => {
    const eventDate = new Date(event.date);
    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${eventDate.getDate().toString().padStart(2, '0')}`;
    eventCountMap[dateStr] = (eventCountMap[dateStr] || 0) + 1;
  });
  
  // Second pass: create event map with dual flag
  allEvents.forEach(event => {
    const eventDate = new Date(event.date);
    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${eventDate.getDate().toString().padStart(2, '0')}`;
    
    if (eventCountMap[dateStr] > 1) {
      // If there are multiple events on this date, mark as dual
      eventMap[dateStr] = { ...event, isDual: true };
    } else {
      eventMap[dateStr] = event;
    }
  });

  // Filter allEvents for the current month for the detail list
  const eventsThisMonth = allEvents.filter(event => {
    const d = new Date(event.date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

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
      const start = new Date(startDate).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US');
      const end = new Date(endDate).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US');
      const durationText = durationType === 'day' ? 
        (currentLang === 'th' ? `${duration} ${t('calendar.days')}` : `${duration} ${t('calendar.days')}`) :
        (currentLang === 'th' ? `${duration} ${t('calendar.hours')}` : `${duration} ${t('calendar.hours')}`);
      
      return `${userName}\n${leaveType}\n${t('calendar.period')}: ${start} - ${end}\n${t('calendar.duration')}: ${durationText}`;
    }
    return event.title;
  };

  // Get display title for list: strip trailing UUID in parentheses or use createdByName
  const getDisplayTitle = (event: CalendarEvent): string => {
    // Employee leave uses composed title elsewhere
    if (event.type === 'employee' && event.employeeInfo) {
      return `${event.employeeInfo.userName} (${event.employeeInfo.leaveType})`;
    }
    const title = event.title || '';
    // Match a trailing space and UUID in parentheses, e.g. " (2dcd81d9-669c-4aac-84fa-0fc42e1ef36b)"
    const uuidParenPattern = /\s*\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)\s*$/i;
    if (uuidParenPattern.test(title)) {
      const cleaned = title.replace(uuidParenPattern, '').trim();
      if (cleaned.length > 0) return cleaned;
      if (event.createdByName) return event.createdByName;
    }
    // Fallback to createdByName if title is missing
    if (!title && event.createdByName) return event.createdByName;
    return title;
  };

  // Get weekday names based on current language
  const getWeekdayNames = () => {
    return currentLang === 'th' 
      ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  };

  // Handlers
  const handleAdd = async () => {
    if (!newEvent.title || !newEvent.date) return;
    
    try {
      const result = await apiService.post(apiEndpoints.customHolidays, {
        title: newEvent.title,
        description: newEvent.description,
        date: newEvent.date,
        type: 'company'
      });

      // Handle the API response structure: { status: 'success', data: {...} }
      const createdEvent = result.data || result;
      setCompanyEvents([...companyEvents, createdEvent]);
      setShowAdd(false);
      setNewEvent({ title: '', description: '', date: '' });
      showToastMessage.crud.createSuccess(t('companyEvent.event'));
    } catch (error) {
      console.error('Error creating company event:', error);
      showToastMessage.crud.createError(t('companyEvent.event'));
    }
  };

  const handleEdit = (event: CompanyEvent) => {
    setEditingEvent(event);
    setShowEdit(true);
  };

  const handleEditSave = async () => {
    if (!editingEvent) return;
    
    try {
      const result = await apiService.put(apiEndpoints.customHoliday(editingEvent.id), {
        title: editingEvent.title,
        description: editingEvent.description,
        date: editingEvent.date
      });

      // Handle the API response structure: { status: 'success', data: {...} }
      const updatedEvent = result.data || result;
      setCompanyEvents(companyEvents.map(event => 
        event.id === editingEvent.id ? updatedEvent : event
      ));
      setShowEdit(false);
      setEditingEvent(null);
      showToastMessage.crud.updateSuccess(t('companyEvent.event'));
    } catch (error) {
      console.error('Error updating company event:', error);
      showToastMessage.crud.updateError(t('companyEvent.event'));
    }
  };

  const handleDelete = async (eventId: string) => {
    setEventToDelete(eventId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    
    try {
      await apiService.delete(apiEndpoints.customHoliday(eventToDelete));
      setCompanyEvents(companyEvents.filter(event => event.id !== eventToDelete));
      showToastMessage.crud.deleteSuccess(t('companyEvent.event'));
    } catch (error) {
      console.error('Error deleting company event:', error);
      showToastMessage.crud.deleteError(t('companyEvent.event'));
    } finally {
      setShowDeleteConfirm(false);
      setEventToDelete(null);
    }
  };

  // Add Event Dialog: open with default date for current month
  const handleOpenAdd = () => {
    const defaultDate = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`;
    setNewEvent({ title: '', description: '', date: defaultDate });
    setShowAdd(true);
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
        {/* Navigation Controls with Sidebar Trigger */}
        <div className="relative z-20 flex justify-start items-center px-6 py-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="bg-white/90 hover:bg-white text-blue-700 border border-blue-200 hover:border-blue-300 shadow-lg backdrop-blur-sm" />
            <button
              onClick={() => navigate(-1)}
              className="bg-white/90 hover:bg-white text-blue-700 border border-blue-200 hover:border-blue-300 shadow-lg backdrop-blur-sm p-2 rounded-full transition-all duration-200"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center py-10 md:py-16">
          
          
          
          <img src="/lovable-uploads/siamit.png" alt="Logo" className="w-24 h-24 rounded-full bg-white/80 shadow-2xl border-4 border-white mb-4" />
          <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-900 drop-shadow mb-2 flex items-center gap-3">
            {currentMonthNames[currentMonth]} {currentYear + (currentLang === 'th' ? 543 : 0)}
          </h1>
          <p className="text-lg md:text-xl text-blue-900/70 mb-2 font-medium text-center max-w-2xl">
            {t('navigation.companyCalendarDescription')}
          </p>
        </div>
      </div>
      
      <div className="flex flex-col items-center py-6">
        {/* Filter Switches */}
        <div className="flex items-center justify-center gap-6 flex-wrap md:flex-nowrap mb-6 bg-white/60 rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <Switch 
              checked={showAnnualHolidays}
              onCheckedChange={setShowAnnualHolidays}
              className="data-[state=checked]:bg-red-500"
            />
            <span className="text-sm font-medium text-red-700">{t('calendar.annualHolidays')}</span>
          </div>
          <div className="flex items-center gap-3">
            <Switch 
              checked={showCompanyHolidays}
              onCheckedChange={setShowCompanyHolidays}
              className="data-[state=checked]:bg-blue-500"
            />
            <span className="text-sm font-medium text-blue-700">{t('calendar.companyHolidays')}</span>
          </div>
          <div className="flex items-center gap-3">
            <Switch 
              checked={showEmployeeLeaves}
              onCheckedChange={setShowEmployeeLeaves}
              className="data-[state=checked]:bg-green-500"
            />
            <span className="text-sm font-medium text-green-700">
              {user?.role === 'admin' || user?.role === 'superadmin' ? t('calendar.employeeLeaves') : t('calendar.myLeaves')}
            </span>
          </div>
          
          {/* Legend (hidden on small/portrait screens) */}
          <div className="hidden md:flex items-center gap-4 ml-6 pl-6 border-l border-gray-300">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-xs text-red-700">{t('calendar.annualHolidays')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-blue-700">{t('calendar.companyHolidays')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-700">
                {user?.role === 'admin' || user?.role === 'superadmin' ? t('calendar.employeeLeaves') : t('calendar.myLeaves')}
              </span>
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 rounded-2xl shadow-xl p-4 flex flex-col items-center w-full max-w-lg mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <span className="text-lg font-bold text-blue-900">{currentMonthNames[currentMonth]}</span>
            {user?.role === 'superadmin' && (
              <Button size="sm" className="ml-2" onClick={handleOpenAdd}>
                <Plus className="w-4 h-4 mr-1" /> {t('companyEvent.add')}
              </Button>
            )}
          </div>
          <table className="w-full text-center">
            <thead>
              <tr className="text-blue-500">
                {getWeekdayNames().map((day, idx) => (
                  <th key={idx} className="py-1">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wIdx) => (
                <tr key={wIdx}>
                  {week.map((d, dIdx) => {
                    if (!d) return <td key={dIdx} className="py-1"> </td>;
                    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                    const event = eventMap[dateStr];
                    
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
        </div>
        
        {/* Company activities detail list */}
        <div className="w-full max-w-lg bg-white/90 rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold text-blue-900 mb-4">{t('companyEvent.monthlyActivities')}</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : eventsThisMonth.length === 0 ? (
            <div className="text-blue-400 text-base">{t('calendar.noEvents')}</div>
          ) : (
            <div className="max-h-96 overflow-y-auto pr-2">
              <ul className="space-y-3">
              {eventsThisMonth.map(event => {
                const d = new Date(event.date);
                const day = d.getDate();
                const monthNum = d.getMonth() + 1;
                const yearNum = d.getFullYear() + (currentLang === 'th' ? 543 : 0);
                const eventType = event.type || 'company';
                return (
                  <li key={event.id || `event-${event.date}`} className={`flex items-start gap-3 text-base rounded-lg p-3 ${
                    event.isDual
                      ? 'text-purple-700 bg-purple-50'
                      : eventType === 'annual' 
                        ? 'text-red-700 bg-red-50' 
                        : eventType === 'employee'
                          ? 'text-green-700 bg-green-50'
                          : 'text-blue-700 bg-blue-50'
                  }`}>
                    <span className={`inline-block w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                      event.isDual
                        ? 'bg-purple-400'
                        : eventType === 'annual' 
                          ? 'bg-red-400' 
                          : eventType === 'employee'
                            ? 'bg-green-400'
                            : 'bg-blue-400'
                    }`}></span>
                    <div className="flex-1">
                      <div className="font-semibold">{getDisplayTitle(event)}</div>
                      {event.description && (
                        <div className={`text-sm mt-1 ${
                          event.isDual
                            ? 'text-purple-600'
                            : eventType === 'annual' 
                              ? 'text-red-600' 
                              : eventType === 'employee'
                                ? 'text-green-600'
                                : 'text-blue-600'
                        } break-all overflow-wrap-anywhere whitespace-pre-wrap max-w-full`}>{event.description}</div>
                      )}
                      <div className={`text-sm mt-1 ${
                        event.isDual
                          ? 'text-purple-500'
                          : eventType === 'annual' 
                            ? 'text-red-500' 
                            : eventType === 'employee'
                              ? 'text-green-500'
                              : 'text-blue-500'
                      }`}>({day}/{monthNum}/{yearNum})</div>
                      {eventType === 'employee' && event.employeeInfo && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(event.employeeInfo.startDate).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US')} - {new Date(event.employeeInfo.endDate).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US')}
                        </div>
                      )}
                    </div>
                    {user?.role === 'superadmin' && !event.isThaiHoliday && eventType !== 'employee' && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(event as CompanyEvent)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="destructive" onClick={() => handleDelete(event.id!)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            </div>
          )}
        </div>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('companyEvent.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input 
              placeholder={t('companyEvent.name')} 
              value={newEvent.title} 
              onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))} 
            />
            <Textarea 
              placeholder={t('companyEvent.description')} 
              value={newEvent.description} 
              onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))} 
              className="break-all overflow-wrap-anywhere whitespace-pre-wrap"
            />
            <DatePicker 
              date={newEvent.date}
              onDateChange={(date) => setNewEvent(prev => ({ ...prev, date }))}
              placeholder={t('companyEvent.datePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAdd}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('companyEvent.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input 
              placeholder={t('companyEvent.name')}
              value={editingEvent?.title || ''} 
              onChange={e => setEditingEvent(prev => prev ? { ...prev, title: e.target.value } : null)} 
            />
            <Textarea 
              placeholder={t('companyEvent.description')}
              value={editingEvent?.description || ''} 
              onChange={e => setEditingEvent(prev => prev ? { ...prev, description: e.target.value } : null)} 
              className="break-all overflow-wrap-anywhere whitespace-pre-wrap"
            />
            <DatePicker 
              date={editingEvent?.date || ''}
              onDateChange={(date) => setEditingEvent(prev => prev ? { ...prev, date } : null)}
              placeholder={t('companyEvent.datePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleEditSave}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('companyEvent.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('companyEvent.deleteConfirmMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanyMonthDetailPage; 