
import { LeaveForm } from "@/components/leave/LeaveForm";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";

const LeaveRequest = () => {
  const { t } = useTranslation();


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <svg viewBox="0 0 1440 320" className="w-full h-24 md:h-28" fill="none" xmlns="http://www.w3.org/2000/svg">
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

        <div className="relative z-10 flex flex-col items-center justify-center py-4 md:py-8">
          <img
            src="/lovable-uploads/siamit.png"
            alt={t('common.logo')}
            className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-2xl border-3 border-white dark:border-gray-700 mb-3"
          />
          <h1 className="text-lg md:text-2xl font-extrabold text-indigo-900 dark:text-gray-100 drop-shadow mb-1.5 flex items-center gap-1.5 md:gap-2">
            <Send className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            {t('leave.leaveRequest')}
          </h1>
          <p className="text-xs md:text-base text-blue-900/70 dark:text-gray-300 mb-1.5 font-medium text-center max-w-2xl px-4">
            {t('main.fillCompleteInfo')}
          </p>
        </div>
      </div>

      <div className="w-full max-w-3xl md:max-w-xl mx-auto px-2 mt-6 md:mt-2 animate-fade-in flex-1">
        <div className="bg-white/80 dark:bg-gray-900/70 backdrop-blur-md rounded-2xl md:rounded-3xl shadow-2xl p-3 md:p-4">
          <LeaveForm mode="create" />
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full mt-4 md:mt-8 py-4 md:py-5 bg-gradient-to-r from-blue-100 via-indigo-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 text-center text-gray-400 dark:text-gray-500 text-sm font-medium shadow-inner flex flex-col items-center gap-1.5">
        <img
          src="/lovable-uploads/siamit.png"
          alt={t('common.logo')}
          className="w-7 h-7 md:w-9 md:h-9 rounded-full mx-auto mb-0.5"
        />
        <div className="font-bold text-gray-600 dark:text-gray-400 text-xs md:text-sm">{t('footer.systemName')}</div>
        <div className="text-xs md:text-sm">{t('footer.copyright')}</div>
      </footer>
    </div>
  );
};

export default LeaveRequest;
