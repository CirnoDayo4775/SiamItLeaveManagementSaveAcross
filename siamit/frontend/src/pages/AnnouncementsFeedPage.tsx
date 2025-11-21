import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Textarea } from '@/components/ui/textarea';
import { apiEndpoints } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Image, Newspaper, Plus, Settings, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { apiService } from '../lib/api';
import { formatDate, getImageUrl, handleFileSelect, handleImageError, removeSelectedFile } from '../lib/utils';

interface Announcement {
  id: string;
  subject: string;
  detail: string;
  createdAt: string;
  createdBy: string; // This is now the user ID
  createdByName: string; // This is the display name
  Image?: string;
  avatar?: string;
}

const AnnouncementsFeedPage = () => {
  const { t, i18n } = useTranslation();
  const { user, showSessionExpiredDialog } = useAuth();
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    subject: '',
    detail: '',
    Image: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [previewImageOpen, setPreviewImageOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [previewImageName, setPreviewImageName] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isValidFile, setIsValidFile] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Socket.io event listeners for real-time announcements
  useEffect(() => {
    if (socket && isConnected) {
      // Listen for new announcements
      socket.on('newAnnouncement', (data) => {
        console.log('Received new announcement:', data);
        
        // Show toast notification
        toast({
          title: t('notification.newAnnouncement'),
          description: data.subject,
          variant: 'default'
        });
        
        // Add new announcement to the list with createdByName
        const newAnnouncement = {
          ...data,
          id: data.id || `temp-${Date.now()}`, // Ensure ID exists
          createdByName: user?.full_name || 'Unknown User' // Use current user's name for new announcements
        };
        setAnnouncements(prev => [newAnnouncement, ...prev]);
      });

      // Listen for announcement updates
      socket.on('announcementUpdated', (data) => {
        console.log('Received announcement update:', data);
        
        // Show toast notification
        toast({
          title: t('notifications.announcementUpdated'),
          description: data.subject,
          variant: 'default'
        });
        
        // Update announcement in the list
        setAnnouncements(prev => 
          prev.map(announcement => 
            announcement.id === data.id ? { ...data, createdByName: announcement.createdByName } : announcement
          )
        );
      });

      // Listen for announcement deletions
      socket.on('announcementDeleted', (data) => {
        console.log('Received announcement deletion:', data);
        
        // Show toast notification
        toast({
          title: t('notifications.announcementDeleted'),
          description: data.subject,
          variant: 'destructive'
        });
        
        // Remove announcement from the list
        setAnnouncements(prev => 
          prev.filter(announcement => announcement.id !== data.id)
        );
      });

      return () => {
        socket.off('newAnnouncement');
        socket.off('announcementUpdated');
        socket.off('announcementDeleted');
      };
    }
  }, [socket, isConnected, toast, t, user]);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiService.get(apiEndpoints.announcements + '/feed', undefined, showSessionExpiredDialog);
        if (data.status === 'success') {
          setAnnouncements(data.data);
        } else {
          setError(data.message || t('common.error'));
        }
      } catch (err: any) {
        setError(t('common.error'));
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, [t, showSessionExpiredDialog]);

  const handleAnnouncementImageClick = (imageName: string) => {
    const imageUrl = getImageUrl(imageName, import.meta.env.VITE_API_BASE_URL);
    setPreviewImageUrl(imageUrl);
    setPreviewImageName(imageName);
    setPreviewImageOpen(true);
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ตรวจสอบว่ามีไฟล์ที่เลือกและไฟล์นั้นไม่ถูกต้อง
    if (selectedFile && !isValidFile) {
      setError(t('announcementsFeed.invalidImageFile'));
      return;
    }
    
    setCreateLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('subject', createForm.subject);
      formData.append('detail', createForm.detail);
      formData.append('createdBy', user?.id || '');
      formData.append('createdAt', new Date().toISOString());
      if (selectedFile && isValidFile) {
        formData.append('Image', selectedFile);
      }
      const data = await apiService.post(apiEndpoints.announcements, formData, showSessionExpiredDialog);
      if (data.status === 'success') {
        setCreateDialogOpen(false);
        setCreateForm({ subject: '', detail: '', Image: '' });
        setSelectedFile(null);
        setImagePreview(null);
        setFileError(null);
        setIsValidFile(false);
        // Refresh the announcements list
        const fetchAnnouncements = async () => {
          try {
            const response = await apiService.get(
              apiEndpoints.announcements + '/feed',
              undefined,
              showSessionExpiredDialog
            );
            
            if (response.status === 'success') {
              setAnnouncements(response.data);
            }
          } catch (err) {
            console.error('Error refreshing announcements:', err);
          }
        };
        fetchAnnouncements();
      } else {
        setError(data.message || t('common.error'));
      }
    } catch (err: any) {
      setError(t('common.error'));
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 dark:from-gray-900 dark:via-gray-950 dark:to-indigo-900 transition-colors relative overflow-x-hidden">
      {/* Parallax/Floating Background Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[350px] h-[350px] rounded-full bg-gradient-to-br from-blue-200 via-indigo-100 to-purple-100 opacity-30 blur-2xl animate-float-slow" />
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] rounded-full bg-gradient-to-tr from-purple-200 via-blue-100 to-indigo-100 opacity-20 blur-xl animate-float-slow2" />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full bg-blue-100 opacity-10 blur-xl animate-pulse-slow" style={{transform:'translate(-50%,-50%)'}} />
      </div>

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
          <img src="/lovable-uploads/siamit.png" alt="Logo" className="w-24 h-24 rounded-full bg-white/80 shadow-2xl border-4 border-white mb-4" />
          <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-900 drop-shadow mb-2 flex items-center gap-3">
            <Newspaper className="w-10 h-10 text-blue-600" />
            {t('announcementsFeed.title')}
          </h1>
          <p className="text-lg md:text-xl text-blue-900/70 mb-2 font-medium text-center max-w-2xl">
            {t('announcementsFeed.subtitle')}
          </p>
          {/* Management Buttons for Admin/SuperAdmin */}
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <div className="mt-4 flex gap-3">
              <Link to="/announcements/manage-post">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="bg-white/90 hover:bg-white text-blue-600 border-blue-200 hover:border-blue-300 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                >
                  <Settings className="w-5 h-5 mr-2" />
                  {t('announcementsFeed.managePosts')}
                </Button>
              </Link>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="lg" 
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    {t('announcementsFeed.createPost')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-blue-900 mb-2 flex items-center gap-2">
                      <Plus className="w-6 h-6 text-blue-600" />
                      {t('announcementsFeed.createPost')}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateAnnouncement} className="space-y-4 mt-4">
                    <div>
                      <label className="block text-blue-800 font-semibold mb-2">
                        {t('companyNews.subject')}
                      </label>
                      <Input
                        type="text"
                        value={createForm.subject}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder={t('companyNews.subject')}
                        required
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-blue-800 font-semibold mb-2">
                        {t('companyNews.detail')}
                      </label>
                      <Textarea
                        value={createForm.detail}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, detail: e.target.value }))}
                        placeholder={t('companyNews.detail')}
                        required
                        rows={6}
                        className="w-full resize-none break-all overflow-wrap-anywhere whitespace-pre-wrap"
                      />
                    </div>
                    <div>
                      <label className="block text-blue-800 font-semibold mb-2">
                        {t('announcementsFeed.attachedImage')}
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center justify-center w-10 h-10 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer transition-colors border border-blue-200 hover:border-blue-300">
                            <Image className="w-5 h-5" />
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileSelect(e, setSelectedFile, setImagePreview, setFileError, setIsValidFile)}
                              className="hidden"
                            />
                          </label>
                          {selectedFile && (
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isValidFile ? 'text-green-600' : 'text-red-600'}`}>
                                {isValidFile ? '✓' : '✗'} {selectedFile.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeSelectedFile(setSelectedFile, setImagePreview, setFileError, setIsValidFile, fileInputRef)}
                                className="text-red-500 hover:text-red-700 text-sm font-medium"
                              >
                                {t('common.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                        {fileError && (
                          <div className="text-red-600 text-sm bg-red-50 p-2 rounded-lg">
                            {fileError}
                          </div>
                        )}
                        {imagePreview && isValidFile && (
                          <div className="relative">
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-gray-50"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {error && (
                      <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                        {error}
                      </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                        disabled={createLoading}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        type="submit"
                        disabled={createLoading || (selectedFile && !isValidFile)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {createLoading ? t('companyNews.saving') : t('companyNews.save')}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="relative z-10 p-6">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-blue-600 text-lg">{t('common.loading')}</span>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="text-red-600 text-lg mb-2">{error}</div>
              <p className="text-gray-600">{t('announcementsFeed.errorMessage')}</p>
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-20">
              <Newspaper className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">{t('announcementsFeed.noAnnouncements')}</h3>
              <p className="text-gray-500">{t('announcementsFeed.noAnnouncementsDesc')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {announcements.map((announcement, index) => (
                <Card key={index} className="w-full shadow-xl bg-white/80 backdrop-blur-lg border-0 rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16 border-3 border-blue-200 shadow-lg">
                        <AvatarImage 
                                                     src={announcement.avatar ? getImageUrl(announcement.avatar, import.meta.env.VITE_API_BASE_URL) : '/placeholder-avatar.png'} 
                          alt={announcement.createdByName}
                          className="object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          onLoad={() => {
                          }}
                        />
                        <AvatarFallback className="bg-blue-100 text-blue-600 font-bold text-lg">
                          {announcement.createdByName ? announcement.createdByName.charAt(0).toUpperCase() : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl font-bold text-gray-800 mb-2 truncate">
                          {announcement.createdByName}
                        </CardTitle>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span className="truncate">{formatDate(announcement.createdAt, i18n.language)}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      <h3 className="text-2xl font-bold text-gray-900 mb-3 line-clamp-2">
                        {announcement.subject}
                      </h3>
                      <div className="max-h-32 overflow-y-auto">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap break-all overflow-wrap-anywhere max-w-full">
                          {announcement.detail}
                        </p>
                      </div>
                                            {announcement.Image && (
                        <div className="relative">
                          <img
                            src={getImageUrl(announcement.Image, import.meta.env.VITE_API_BASE_URL)}
                            alt={announcement.subject}
                            className="w-full h-auto rounded-lg object-contain max-h-[500px] shadow-md bg-gray-50 cursor-pointer hover:opacity-90 transition-opacity"
                            onError={(e) => handleImageError(e, announcement.Image, import.meta.env.VITE_API_BASE_URL)}
                            onClick={() => handleAnnouncementImageClick(announcement.Image)}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .animate-fade-in-up { animation: fadeInUp 0.6s ease-out; }
        .animate-float-slow { animation: float 8s ease-in-out infinite alternate; }
        .animate-float-slow2 { animation: float 12s ease-in-out infinite alternate; }
        .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0% { transform: translateY(0); } 100% { transform: translateY(-10px); } }
      `}</style>

      {/* Image Preview Dialog */}
      <Dialog open={previewImageOpen} onOpenChange={setPreviewImageOpen}>
        <DialogContent className="w-screen h-screen max-w-none max-h-none p-0 bg-black/40 backdrop-blur-sm border-0">
          <div className="absolute top-4 right-4 z-50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewImageOpen(false)}
              className="bg-white/20 text-white border-white/30 hover:bg-white/30"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {previewImageUrl && (
            <div className="flex items-center justify-center h-full p-4">
              <img 
                src={previewImageUrl} 
                alt={previewImageName}
                style={{ maxWidth: '100vw', maxHeight: '100vh' }}
                className="object-contain rounded-lg shadow-2xl"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnnouncementsFeedPage; 