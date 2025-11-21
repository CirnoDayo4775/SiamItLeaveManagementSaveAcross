
import { LeaveForm } from "@/components/leave/LeaveForm";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";

const LeaveRequest = () => {
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-white flex flex-col">
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
        
        <div className="relative z-10 flex flex-col items-center justify-center py-10 md:py-16">
          <img 
            src="/lovable-uploads/siamit.png" 
            alt={t('common.logo')} 
            className="w-24 h-24 rounded-full bg-white/80 shadow-2xl border-4 border-white mb-4" 
          />
          <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-900 drop-shadow mb-2 flex items-center gap-3">
            <Send className="w-8 h-8 text-blue-600" aria-hidden="true" />
            {t('leave.leaveRequest')}
          </h1>
          <p className="text-lg md:text-xl text-blue-900/70 mb-2 font-medium text-center max-w-2xl">
            {t('main.fillCompleteInfo')}
          </p>
        </div>
      </div>
      
      <div className="w-full max-w-3xl mx-auto px-4 mt-0 animate-fade-in flex-1">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl p-8">
          <LeaveForm mode="create" />
        </div>
      </div>
      
      {/* Footer */}
      <footer className="w-full mt-16 py-8 bg-gradient-to-r from-blue-100 via-indigo-50 to-white text-center text-gray-400 text-base font-medium shadow-inner flex flex-col items-center gap-2">
        <img 
          src="/lovable-uploads/siamit.png" 
          alt={t('common.logo')} 
          className="w-10 h-10 rounded-full mx-auto mb-1" 
        />
        <div className="font-bold text-gray-600">{t('footer.systemName')}</div>
        <div className="text-sm">{t('footer.copyright')}</div>
      </footer>
    </div>
  );
};

export default LeaveRequest;
