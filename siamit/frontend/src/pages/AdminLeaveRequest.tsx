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
          <SidebarTrigger className="bg-white/90 hover:bg-white text-blue-700 border border-blue-200 hover:border-blue-300 shadow-lg backdrop-blur-sm" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center py-10 md:py-16">
          <div className="flex items-center gap-4 mb-4">
            <img
              src="/lovable-uploads/siamit.png"
              alt={t('common.logo')}
              className="w-16 h-16 rounded-full bg-white/80 shadow-2xl border-4 border-white"
            />
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-900 drop-shadow mb-2 flex items-center gap-3">
            <Send className="w-10 h-10 text-blue-600" aria-hidden="true" />
            {t('leave.adminLeaveRequest')}
          </h1>
          <p className="text-lg md:text-xl text-blue-900/70 font-medium text-center max-w-3xl leading-relaxed">
            {t('leave.adminLeaveRequestDesc')}
          </p>

          {/* Feature Icons */}
          <div className="flex items-center gap-8 mt-6">
            <div className="flex items-center gap-2 text-blue-900/70">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">{t('leave.employeeSelection')}</span>
            </div>
            <div className="flex items-center gap-2 text-blue-900/70">
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-medium">{t('leave.dateManagement')}</span>
            </div>
            <div className="flex items-center gap-2 text-blue-900/70">
              <FileText className="w-5 h-5" />
              <span className="text-sm font-medium">{t('leave.approvalControl')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="relative">
          
          <AdminLeaveForm mode="create" />
        </div>
      </div>
    </div>
  );
};

export default AdminLeaveRequest;
