import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Building2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { getAllThaiHolidays } from '@/constants/getThaiHolidays';
import { monthNames } from '@/constants/common';
import { apiService } from '@/lib/api';
import { getDaysInMonth } from '@/lib/dateUtils';
import { apiEndpoints } from '@/constants/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';

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

interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  date: string;
  createdAt?: string;
  createdBy?: string;
  type: 'company' | 'annual';
  isThaiHoliday?: boolean;
  isDual?: boolean;
}

const CompanyCalendarPage = () => {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [companyEvents, setCompanyEvents] = useState<CompanyEvent[]>([]);
  const [thaiHolidays, setThaiHolidays] = useState<ThaiHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompanyHolidays, setShowCompanyHolidays] = useState(true);
  const [showAnnualHolidays, setShowAnnualHolidays] = useState(true);
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  // Get current language
  const currentLang = i18n.language.startsWith('th') ? 'th' : 'en';

  // Fetch company events and Thai holidays
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch company events
        const result = await apiService.get(apiEndpoints.customHolidaysByYear(year));
        setCompanyEvents(result.data || []);

        // Get Thai holidays for the year
        const thaiHolidaysData = getAllThaiHolidays(year, t);

        // Debug: Add test holiday for July 28th, 2025 to test dual highlighting
        if (year === 2025) {
          console.log('All Thai holidays for 2025:', thaiHolidaysData);
          const julyHolidays = thaiHolidaysData.filter(h => {
            const date = new Date(h.date);
            return date.getMonth() === 6; // July
          });
          console.log('July 2025 Thai holidays:', julyHolidays);

          // Add test holiday on July 28th
          thaiHolidaysData.push({
            date: '2025-07-28',
            name: 'Test Holiday',
            type: 'public'
          });
        }

        setThaiHolidays(thaiHolidaysData);

      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching data:', error);
        }
        setCompanyEvents([]);
        setThaiHolidays([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year, t]);

  // Get all events (company + Thai holidays) for a specific month
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

    // Debug: Log events for July 2025
    if (year === 2025 && month === 6) { // July
      console.log('Company events for July 2025:', companyEvents);
      console.log('Thai holidays for July 2025:', thaiHolidays);
      console.log('All events for July 2025:', allEvents);
    }

    return allEvents;
  };

  // Get month names based on current language
  const getMonthNames = () => {
    return currentLang === 'th' ? monthNames.th : monthNames.en;
  };

  // Get weekday names based on current language
  const getWeekdayNames = () => {
    return currentLang === 'th'
      ? ['', '', '', '', '', '', '']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
        <div className="relative z-10 flex flex-col items-center justify-center py-10 md:py-16">
          <button onClick={() => navigate(-1)} className="absolute left-4 top-4 md:left-10 md:top-10 p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 shadow">
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Language Switcher */}
          <div className="absolute right-4 top-4 md:right-10 md:top-10">
            <LanguageSwitcher />
          </div>

          <img src="/lovable-uploads/siamit.png" alt="Logo" className="w-24 h-24 rounded-full bg-white/80 shadow-2xl border-4 border-white mb-4" />
          <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-900 drop-shadow mb-2 flex items-center gap-3">
            {t('navigation.companyCalendar')}
          </h1>
          <p className="text-lg md:text-xl text-blue-900/70 mb-2 font-medium text-center max-w-2xl">
            {t('navigation.companyCalendarDescription')}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center py-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 shadow">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="text-2xl font-bold text-blue-900">{year + (currentLang === 'th' ? 543 : 0)}</span>
          <button onClick={() => setYear(now.getFullYear())} className="px-4 py-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold shadow">
            {t('calendar.currentYear')}
          </button>
          <button onClick={() => setYear(y => y + 1)} className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 shadow">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Switches */}
        <div className="flex items-center justify-center gap-6 mb-6 bg-white/60 rounded-xl p-4 shadow-lg">
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
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mb-6 bg-white/60 rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-sm text-red-700">{t('calendar.annualHolidays')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-sm text-blue-700">{t('calendar.companyHolidays')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            <span className="text-sm text-purple-700">{t('calendar.dualEvents')}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
            {getMonthNames().map((month, mIdx) => {
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

              // First pass: count events per date
              events.forEach(e => {
                eventCountMap[e.date] = (eventCountMap[e.date] || 0) + 1;
              });

              // Debug: Log events for July 2025
              if (year === 2025 && mIdx === 6) { // July
                console.log('Events for July 2025:', events);
                console.log('Event count map:', eventCountMap);
              }

              // Second pass: create event map with dual flag
              events.forEach(e => {
                if (eventCountMap[e.date] > 1) {
                  // If there are multiple events on this date, mark as dual
                  eventMap[e.date] = { ...e, isDual: true };
                } else {
                  eventMap[e.date] = e;
                }
              });

              return (
                <div key={month} className="bg-white/80 rounded-2xl shadow-xl p-4 flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-5 h-5 text-indigo-400" />
                    <button
                      className="text-lg font-bold text-blue-900 hover:underline hover:text-indigo-600 transition cursor-pointer bg-transparent border-0 p-0"
                      onClick={() => navigate(`/calendar/company/${year}/${mIdx + 1}`)}
                      title={t('calendar.viewMonth')}
                    >
                      {month}
                    </button>
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
                            const dateStr = `${year}-${(mIdx + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

                            // Check for company event using multiple date formats
                            const event = eventMap[dateStr] ||
                              eventMap[`${year}-${mIdx + 1}-${d}`] ||
                              eventMap[`${year}-${(mIdx + 1).toString().padStart(2, '0')}-${d}`] ||
                              eventMap[`${dateStr} 00:00:00`] ||
                              eventMap[`${year}-${(mIdx + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')} 00:00:00`];

                            return (
                              <td
                                key={dIdx}
                                className={`py-1 px-1 rounded-lg font-semibold transition`}
                                title={event?.title || ''}
                              >
                                {event ? (
                                  <span className={`${event.isDual
                                      ? 'bg-purple-500' // Purple for dual events
                                      : event.type === 'annual'
                                        ? 'bg-red-500'
                                        : 'bg-blue-500'
                                    } text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto font-bold shadow`}>
                                    {d}
                                  </span>
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
                  {/* Company activities list for this month */}
                  <ul className="mt-2 text-xs text-left w-full">
                    {events.length === 0 ? (
                      <li className="text-gray-500 italic text-center py-2">
                        {t('calendar.noEvents')}
                      </li>
                    ) : (
                      events.map(e => {
                        const d = new Date(e.date);
                        const day = d.getDate();
                        const monthNum = d.getMonth() + 1;
                        const eventType = e.type || 'company';
                        return (
                          <li key={e.id || `event-${e.date}`} className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${e.isDual
                                ? 'bg-purple-500'
                                : eventType === 'annual'
                                  ? 'bg-red-500'
                                  : 'bg-blue-500'
                              }`}></span>
                            <span className={
                              e.isDual
                                ? 'text-purple-600'
                                : eventType === 'annual'
                                  ? 'text-red-600'
                                  : 'text-blue-600'
                            }>
                              {e.title} ({day}/{monthNum})
                            </span>
                          </li>
                        );
                      })
                    )}
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

export default CompanyCalendarPage; 