import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiEndpoints } from '@/constants/api';
import { usePushNotification } from "@/contexts/PushNotificationContext";
import { useSocket } from "@/contexts/SocketContext";
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/lib/api';
import { AlertCircle, AlertTriangle, Bell, Check, Info, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  status: string;
  startDate: string;
  endDate: string;
  leaveType?: {
    name_th: string;
    name_en: string;
  };
  reason?: string;
}

const NotificationBell = () => {
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { enabled: pushNotificationEnabled } = usePushNotification();
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();

  // Get leave type name
  const getLeaveTypeName = (leaveType: { name_th: string; name_en: string } | string | undefined) => {
    if (!leaveType) return '';
    if (typeof leaveType === 'string') return leaveType;
    return i18n.language.startsWith('th') ? leaveType.name_th : leaveType.name_en;
  };

  // Fetch notifications function
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await apiService.get(apiEndpoints.notifications);

      if (response && response.status === 'success' && Array.isArray(response.data)) {
        setNotifications(response.data);
      } else {
        logger.error('Failed to fetch notifications:', response?.message || 'Unknown error');
      }
    } catch (error) {
      logger.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notifications on mount
  useEffect(() => {
    // เฉพาะเมื่อเปิดการใช้งานแจ้งเตือนเท่านั้น
    if (pushNotificationEnabled) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [pushNotificationEnabled]);

  // Socket.io event listeners
  useEffect(() => {
    if (socket && isConnected && pushNotificationEnabled) {
      // Listen for leave request updates
      socket.on('leaveRequestUpdated', (data) => {

        // Show toast notification
        toast({
          title: data.status === 'approved' ? t('notifications.approved') : t('notifications.rejected'),
          description: data.message,
          variant: data.status === 'approved' ? 'default' : 'destructive'
        });

        // Refresh notifications
        fetchNotifications();
      });

      return () => {
        socket.off('leaveRequestUpdated');
      };
    }
  }, [socket, isConnected, pushNotificationEnabled, toast, t]);

  // Remove mark all as read logic
  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
  };

  // Mark a single notification as read
  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await apiService.post(apiEndpoints.markAsRead(id), {});

      if (response && response.status === 'success') {
        // Remove the notification from the list after marking as read
        setNotifications(prev => prev.filter(n => n.id !== id));
      } else {
        logger.error('Failed to mark notification as read:', response?.message);
      }
    } catch (error) {
      logger.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      const response = await apiService.post(apiEndpoints.markAllAsRead, {});

      if (response && response.status === 'success') {
        // Clear all notifications from the list
        setNotifications([]);
      } else {
        logger.error('Failed to mark all notifications as read:', response?.message);
      }
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
    }
  };

  // Calculate unread count - all notifications from API are unread (isRead: false)
  const unreadCount = useMemo(() => notifications.length, [notifications]);

  return (
    <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative bg-white/60 dark:bg-slate-800/80 backdrop-blur-md shadow-lg hover:scale-110 transition-all duration-200 rounded-xl border border-white/20 dark:border-slate-700"
        >
          <span className="relative">
            <Bell className="h-6 w-6 text-blue-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-5 -right-5 flex items-center justify-center h-5 w-5 rounded-full bg-gradient-to-tr from-red-400 via-pink-400 to-red-500 text-white text-xs font-bold shadow-lg border-2 border-white">
                {unreadCount}
              </span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 bg-gradient-to-br from-white/80 via-blue-50/80 to-indigo-100/80 backdrop-blur-xl shadow-2xl border-0 rounded-2xl p-0"
        align="end"
        style={{
          animation: 'fadeInUp 0.3s ease-out'
        }}
      >
        <Card className="border-0 shadow-none bg-transparent">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400 rounded-t-2xl text-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold tracking-tight">{t('notification.notifications')}</CardTitle>
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="text-white hover:bg-white/20 text-xs px-2 py-1"
                >
                  {t('notification.markAllAsRead')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-80 overflow-y-auto p-4 bg-transparent">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 py-4">{t('notification.noNotifications')}</p>
            ) : (
              notifications.map((notification, idx) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 p-4 rounded-xl shadow-md border-0 transition-all duration-200 ${notification.status === 'approved'
                    ? 'bg-gradient-to-br from-green-50/80 via-emerald-50/80 to-green-100/80 border-l-4 border-green-400'
                    : 'bg-gradient-to-br from-red-50/80 via-rose-50/80 to-red-100/80 border-l-4 border-red-400'
                    }`}
                  style={{
                    animation: 'fadeInUp 0.3s ease-out',
                    animationDelay: `${idx * 80}ms`
                  }}
                >
                  <div className="flex-shrink-0 mt-1">
                    {notification.status === 'approved' ? (
                      <Check className="h-5 w-5 text-green-600 bg-green-100 rounded-full p-1 shadow" />
                    ) : (
                      <X className="h-5 w-5 text-red-600 bg-red-100 rounded-full p-1 shadow" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold text-base mb-0.5 ${notification.status === 'approved' ? 'text-green-700' : 'text-red-700'
                      }`}>
                      {notification.status === 'approved' ? t('notification.approved') : t('notification.rejected')}
                    </h4>
                    <p className="text-xs text-gray-600 mb-1">
                      {new Date(notification.startDate).toLocaleDateString('th-TH')} - {new Date(notification.endDate).toLocaleDateString('th-TH')}
                    </p>
                    {notification.leaveType && (
                      <p className="text-xs text-blue-500">
                        {getLeaveTypeName(notification.leaveType)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMarkAsRead(notification.id)}
                    className={`ml-2 p-1 h-7 w-7 rounded-full shadow ${notification.status === 'approved'
                      ? 'bg-green-100 hover:bg-green-200 text-green-600'
                      : 'bg-red-100 hover:bg-red-200 text-red-600'
                      }`}
                    aria-label="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </PopoverContent>


    </Popover>
  );
};

export default NotificationBell;