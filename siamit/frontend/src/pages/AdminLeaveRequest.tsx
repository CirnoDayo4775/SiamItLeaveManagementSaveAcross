import { AdminLeaveForm } from '@/components/leave/AdminLeaveForm';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Calendar, FileText, Send, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AdminLeaveRequest = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 dark:from-gray-900 dark:via-gray-950 dark:to-indigo-900 transition-colors relative overflow-x-hidden">
      {/* Hero with Wave */}
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
          <SidebarTrigger className="bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-lg backdrop-blur-sm" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center py-10 md:py-16">
          <div className="flex items-center gap-4 mb-4">
            <img
              src="/lovable-uploads/siamit.png"
              alt={t('common.logo')}
              className="w-16 h-16 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-2xl border-4 border-white dark:border-gray-700"
            />
          </div>

          <div className="flex flex-col items-center w-full px-4">
            <h1 className="text-2xl md:text-5xl font-extrabold text-indigo-900 dark:text-indigo-200 drop-shadow mb-3 flex flex-col md:flex-row items-center justify-center gap-2 text-center md:text-left">
              <Send className="w-7 h-7 md:w-12 md:h-12 text-blue-600 dark:text-blue-400 mb-1 md:mb-0" aria-hidden="true" />
              <span>{t('leave.adminLeaveRequest')}</span>
            </h1>
            <p className="text-sm md:text-xl text-blue-900/70 dark:text-blue-200/80 font-medium text-center max-w-3xl leading-relaxed mb-4">
              {t('leave.adminLeaveRequestDesc')}
            </p>

            {/* Feature Icons */}
            <div className="flex items-center gap-2 mb-1.5 text-blue-900/80 dark:text-blue-200 bg-white/50 dark:bg-gray-800/60 px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm border border-blue-100 dark:border-blue-800">
              <Users className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-xs md:text-sm font-medium whitespace-nowrap">{t('leave.employeeSelection')}</span>
            </div>

            <div className="flex items-center gap-2 mb-1.5 text-blue-900/80 dark:text-blue-200 bg-white/50 dark:bg-gray-800/60 px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm border border-blue-100 dark:border-blue-800">
              <Calendar className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-xs md:text-sm font-medium whitespace-nowrap">{t('leave.dateManagement')}</span>
            </div>

            <div className="flex items-center gap-2 mb-1.5 text-blue-900/80 dark:text-blue-200 bg-white/50 dark:bg-gray-800/60 px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm border border-blue-100 dark:border-blue-800">
              <FileText className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-xs md:text-sm font-medium whitespace-nowrap">{t('leave.approvalControl')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-6xl md:max-w-4xl mx-auto px-2 py-4 md:py-8">
        <div className="relative">

          <AdminLeaveForm mode="create" />
        </div>
      </div>
    </div>
  );
};

export default AdminLeaveRequest;
