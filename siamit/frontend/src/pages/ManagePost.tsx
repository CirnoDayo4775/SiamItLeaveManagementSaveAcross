import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiEndpoints } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, ChevronLeft, Clock, Edit, Eye, FileText, Image, Newspaper, Plus, Trash2, User, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { hasAdminRole } from '../lib/authUtils';
import { apiService } from '../lib/api';
import { showToastMessage } from '../lib/toast';
import { formatDate, getImageUrl, handleFileSelect, handleImageError } from '../lib/utils';
import { logger } from '@/lib/logger';

interface NewsItem {
  id: string;
  subject: string;
  detail: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  Image?: string;
  avatar?: string;
  contact?: string;
  attachments?: any[];
}

export default function ManagePost() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = hasAdminRole(user);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [form, setForm] = useState({
    subject: '',
    detail: '',
    // createdBy, createdAt จะใส่ตอน submit
    Image: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);


  // State สำหรับ Image Preview แบบ LeaveHistory
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageOpen, setPreviewImageOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [previewImageName, setPreviewImageName] = useState<string>('');

  // State สำหรับจัดการการลบข่าวสาร
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [deleting, setDeleting] = useState(false);


  // Memoized fetch function
  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.get(apiEndpoints.announcements + '/feed');
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) {
          logger.debug('=== Fetch News Response ===');
          logger.debug('API Response:', data);
          if (data.data && data.data.length > 0) {
            logger.debug('First news item:', data.data[0]);
            logger.debug('Image field:', data.data[0].Image);
            logger.debug('Created by ID:', data.data[0].createdBy);
            logger.debug('Created by name:', data.data[0].createdByName);
          }
          logger.debug('==========================');
        }
      }

      if (data.status === 'success') {
        setNewsList(data.data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } else {
        setNewsList([]);
        setError(data.message || '');
      }
    } catch (err) {
      setNewsList([]);
      setError('โหลดข่าวสารไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // เพิ่มข่าวสารใหม่
  const handleAddNews = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if user has an ID
    if (!user?.id) {
      setError('ไม่สามารถระบุตัวตนผู้ใช้ได้ กรุณาเข้าสู่ระบบใหม่');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('subject', form.subject);
      formData.append('detail', form.detail);
      formData.append('createdBy', user.id); // Use user ID

      if (selectedFile) {
        formData.append('Image', selectedFile);
      }

      const data = await apiService.post(apiEndpoints.announcements, formData);
      if (data.status === 'success') {
        showToastMessage.crud.createSuccess('', t);
        setAddOpen(false);
        setForm({ subject: '', detail: '', Image: '' });
        setSelectedFile(null);
        setImagePreview(null);
        fetchNews();
      } else {
        showToastMessage.crud.createError('', data.message, t);
        setError(data.message || 'บันทึกข่าวสารไม่สำเร็จ');
      }
    } catch (err) {
      showToastMessage.crud.createError('', undefined, t);
      setError('บันทึกข่าวสารไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันลบข่าวสาร - จัดการการลบข่าวสารพร้อม Dialog ยืนยัน
  const handleDeleteNews = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      const data = await apiService.delete(apiEndpoints.announcement(deleteTarget.id));
      if (data.status === 'success') {
        // ลบข่าวสารออกจากรายการและแสดงข้อความสำเร็จ
        setNewsList(prev => prev.filter(news => news.id !== deleteTarget.id));
        setDeleteTarget(null);
        showToastMessage.crud.deleteSuccess('announcement', t);
      } else {
        showToastMessage.crud.deleteError('announcement', data.message, t);
        setError(data.message || 'ลบข่าวสารไม่สำเร็จ');
      }
    } catch (err) {
      showToastMessage.crud.deleteError('announcement', undefined, t);
      setError('ลบข่าวสารไม่สำเร็จ');
    } finally {
      setDeleting(false);
    }
  };

  // เปิดฟอร์มแก้ไขข่าวสาร
  const handleEditNews = (news: NewsItem) => {
    setEditingNews(news);
    setForm({
      subject: news.subject,
      detail: news.detail,
      Image: news.Image || '',
    });
    setSelectedFile(null);
    setImagePreview(news.Image ? getImageUrl(news.Image, import.meta.env.VITE_API_BASE_URL) : null);
    setEditOpen(true);
  };

  // แก้ไขข่าวสาร
  const handleUpdateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNews) return;

    // Check if user has an ID
    if (!user?.id) {
      setError('ไม่สามารถระบุตัวตนผู้ใช้ได้ กรุณาเข้าสู่ระบบใหม่');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('subject', form.subject);
      formData.append('detail', form.detail);
      formData.append('createdBy', user.id); // Use user ID instead of name

      if (selectedFile) {
        formData.append('Image', selectedFile);
      }

      const data = await apiService.put(apiEndpoints.announcement(editingNews.id), formData);
      if (data.status === 'success') {
        showToastMessage.crud.updateSuccess('', t);
        setEditOpen(false);
        setEditingNews(null);
        setForm({ subject: '', detail: '', Image: '' });
        setSelectedFile(null);
        setImagePreview(null);
        fetchNews();
      } else {
        showToastMessage.crud.updateError('', data.message, t);
        setError(data.message || t('companyNews.editNewsError'));
      }
    } catch (err) {
      showToastMessage.crud.updateError('', undefined, t);
      setError(t('companyNews.editNewsError'));
    } finally {
      setLoading(false);
    }
  };



  // ฟังก์ชันสำหรับเปิด Image Preview Dialog
  const openImagePreview = (imageName: string) => {
    const imageUrl = getImageUrl(imageName, import.meta.env.VITE_API_BASE_URL);
    setPreviewImageUrl(imageUrl);
    setPreviewImageName(imageName);
    setPreviewImageOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col">
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
          <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-900 dark:text-indigo-200 drop-shadow mb-2 flex items-center gap-3">
            <Newspaper className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            {t('companyNews.managePosts')}
          </h1>
          <p className="text-lg md:text-xl text-blue-900/70 dark:text-blue-200/70 mb-2 font-medium text-center max-w-2xl">
            {t('companyNews.managePostsDesc')}
          </p>
        </div>
      </div>
      <div className="w-full max-w-5xl mx-auto px-4 mt-0 animate-fade-in flex-1">
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <div className="text-xl font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-blue-600" />
              {t('companyNews.managePosts')}
            </div>
            {isAdmin && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200"
                  >
                    <Plus className="w-5 h-5" /> {t('companyNews.addNews')}
                  </button>
                </DialogTrigger>
                <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-blue-900 dark:text-white mb-2 flex items-center gap-2">
                      <Newspaper className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      {t('companyNews.addNews')}
                    </DialogTitle>
                  </DialogHeader>
                  <form className="space-y-4 mt-2" onSubmit={handleAddNews}>
                    <div>
                      <label className="block text-blue-800 dark:text-gray-200 font-semibold mb-1">{t('companyNews.subject')}</label>
                      <Input
                        type="text"
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder={t('companyNews.subject')}
                        required
                        className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-blue-800 dark:text-gray-200 font-semibold mb-1">
                        {t('companyNews.detail')}
                        <span className="text-sm text-gray-500 ml-2">
                          ({form.detail.length}/500)
                        </span>
                      </label>
                      <textarea
                        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-base focus:ring-2 focus:ring-blue-400 resize-none break-all overflow-wrap-anywhere whitespace-pre-wrap dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-400"
                        value={form.detail}
                        onChange={e => setForm(f => ({ ...f, detail: e.target.value }))}
                        rows={6}
                        maxLength={500}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-blue-800 dark:text-gray-200 font-semibold mb-1">
                        {t('announcementsFeed.attachedImage')}
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center justify-center w-10 h-10 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer transition-colors border border-blue-200 hover:border-blue-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-blue-300 dark:border-gray-600">
                            <Image className="w-5 h-5" />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleFileSelect(e, setSelectedFile, setImagePreview)}
                              className="hidden"
                            />
                          </label>
                          {selectedFile && (
                            <span className="text-sm text-green-600 font-medium">
                              ✓ {selectedFile.name}
                            </span>
                          )}
                        </div>
                        {imagePreview && (
                          <div className="relative">
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-gray-50"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFile(null);
                                setImagePreview(null);
                              }}
                              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                        onClick={() => setAddOpen(false)}
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                        disabled={loading}
                      >
                        {loading ? t('companyNews.saving') : t('companyNews.save')}
                      </button>
                    </div>
                    {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
                  </form>
                </DialogContent>
              </Dialog>
            )}

            {/* Edit News Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-blue-900 dark:text-white mb-2 flex items-center gap-2">
                    <Edit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    {t('companyNews.editNews')}
                  </DialogTitle>
                </DialogHeader>
                <form className="space-y-4 mt-2" onSubmit={handleUpdateNews}>
                  <div>
                    <label className="block text-blue-800 dark:text-gray-200 font-semibold mb-1">{t('companyNews.subject')}</label>
                    <Input
                      type="text"
                      value={form.subject}
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      placeholder={t('companyNews.subject')}
                      required
                      className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-800 dark:text-gray-200 font-semibold mb-1">
                      {t('companyNews.detail')}
                      <span className="text-sm text-gray-500 ml-2">
                        ({form.detail.length}/500)
                      </span>
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-blue-200 px-3 py-2 text-base focus:ring-2 focus:ring-blue-400 resize-none break-all overflow-wrap-anywhere whitespace-pre-wrap dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:placeholder-gray-400"
                      value={form.detail}
                      onChange={e => setForm(f => ({ ...f, detail: e.target.value }))}
                      rows={6}
                      maxLength={500}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-blue-800 dark:text-gray-200 font-semibold mb-1">
                      {t('announcementsFeed.attachedImage')}
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center justify-center w-10 h-10 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer transition-colors border border-blue-200 hover:border-blue-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-blue-300 dark:border-gray-600">
                          <Image className="w-5 h-5" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => handleFileSelect(e, setSelectedFile, setImagePreview)}
                            className="hidden"
                          />
                        </label>
                        {selectedFile && (
                          <span className="text-sm text-green-600 font-medium">
                            ✓ {selectedFile.name}
                          </span>
                        )}
                      </div>
                      {imagePreview && (
                        <div className="relative">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-gray-50"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFile(null);
                              setImagePreview(null);
                            }}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                      onClick={() => setEditOpen(false)}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                      disabled={loading}
                    >
                      {loading ? t('companyNews.saving') : t('companyNews.saveChanges')}
                    </button>
                  </div>
                  {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-x-auto rounded-xl">
            <Table className="min-w-full bg-white dark:bg-gray-800 rounded-xl">
              <TableHeader>
                <TableRow className="bg-blue-100 dark:bg-gray-900 text-blue-900 dark:text-blue-200 text-lg">
                  <TableHead className="p-4 text-center">{t('companyNews.subject')}</TableHead>
                  <TableHead className="p-4 text-center">{t('companyNews.detail')}</TableHead>
                  <TableHead className="p-4 text-center">{t('companyNews.createdBy')}</TableHead>
                  {isAdmin && <TableHead className="p-4 text-center">{t('companyNews.edit')}</TableHead>}
                  {isAdmin && <TableHead className="p-4 text-center">{t('companyNews.delete')}</TableHead>}
                  <TableHead className="p-4 text-center">{t('companyNews.addMore')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isAdmin ? 6 : 4} className="text-center">{t('common.loading')}</TableCell></TableRow>
                ) : newsList.length === 0 ? (
                  <TableRow><TableCell colSpan={isAdmin ? 6 : 4} className="text-center">{t('companyNews.noNews')}</TableCell></TableRow>
                ) : newsList.map((news, idx) => (
                  <TableRow key={news.id} className="hover:bg-blue-50 dark:hover:bg-gray-700/50 text-base">
                    <TableCell className="p-4 text-center font-semibold text-blue-800 dark:text-blue-300">{news.subject}</TableCell>
                    <TableCell className="p-4 text-center">
                      {news.detail.length > 25
                        ? `${news.detail.substring(0, 25)}...`
                        : news.detail
                      }
                    </TableCell>
                    <TableCell className="p-4 text-center dark:text-gray-300">{news.createdByName || news.createdBy || 'Unknown User'}</TableCell>
                    {isAdmin && (
                      <TableCell className="p-4 text-center">
                        <button
                          className="p-2 rounded-full bg-yellow-100 hover:bg-yellow-200 text-yellow-600 shadow transition"
                          onClick={() => handleEditNews(news)}
                          aria-label={t('companyNews.edit')}
                          disabled={loading}
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell className="p-4 text-center">
                        {/* ปุ่มลบข่าวสาร - เปิด Dialog ยืนยันการลบ */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-600 shadow transition"
                              onClick={() => setDeleteTarget(news)}
                              aria-label={t('companyNews.delete')}
                              disabled={loading}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="dark:text-gray-100">{t('system.confirmDelete')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                <span className="dark:text-gray-400">{t('system.confirmDeleteNewsDesc')}</span>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">{t('common.cancel')}</AlertDialogCancel>
                              {/* ปุ่มยืนยันการลบใน Dialog */}
                              <AlertDialogAction onClick={handleDeleteNews} disabled={deleting} className="bg-gradient-to-r from-red-500 to-pink-400 text-white">
                                {deleting ? t('common.loading') : t('common.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                    <TableCell className="p-4 text-center">
                      <Dialog open={openIdx === idx} onOpenChange={open => setOpenIdx(open ? idx : null)}>
                        <DialogTrigger asChild>
                          <button
                            className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold rounded-lg shadow transition"
                          >
                            {t('companyNews.viewDetail')}
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in dark:bg-gray-800 dark:border-gray-700">
                          <DialogHeader>
                            <DialogTitle className="flex items-center">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold text-blue-600">
                                  {t('common.viewDetails')}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                    <Newspaper className="w-3 h-3 mr-1" />
                                    {t('companyNews.news')}
                                  </Badge>
                                </div>
                              </div>
                            </DialogTitle>
                          </DialogHeader>

                          {news && (
                            <div className="space-y-6">
                              {/* Header Section */}
                              <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 dark:text-gray-200">
                                <CardContent className="p-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                      <div className="text-3xl font-bold text-blue-900">
                                        {news.subject}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm text-gray-500">{t('companyNews.publishedOn')}</div>
                                      <div className="text-lg font-semibold text-blue-600">
                                        {formatDate(news.createdAt, i18n.language)}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Main Information Grid */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left Column - News Details */}
                                <Card className="border-0 shadow-md dark:bg-gray-700">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-5 h-5 text-orange-600" />
                                      <h3 className="text-lg font-semibold dark:text-gray-200">{t('companyNews.detail')}</h3>
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                      <p className="text-orange-900 dark:text-orange-200 leading-relaxed break-all overflow-wrap-anywhere whitespace-pre-wrap max-w-full">
                                        {news.detail || t('companyNews.noDetailProvided')}
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Right Column - Publisher Info */}
                                <Card className="border-0 shadow-md dark:bg-gray-700">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <User className="w-5 h-5 text-indigo-600" />
                                      <h3 className="text-lg font-semibold">{t('companyNews.publisher')}</h3>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('companyNews.publishedBy')}</Label>
                                      <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                        <User className="w-4 h-4 text-indigo-500" />
                                        <span className="font-medium text-indigo-900 dark:text-indigo-200">{news.createdByName || news.createdBy || 'Unknown User'}</span>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-gray-600">{t('companyNews.publishedDate')}</Label>
                                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <Calendar className="w-4 h-4 text-green-500" />
                                        <span className="font-medium text-green-900 dark:text-green-200">
                                          {formatDate(news.createdAt, i18n.language)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium text-gray-600">{t('companyNews.publishedTime')}</Label>
                                      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                        <Clock className="w-4 h-4 text-blue-500" />
                                        <span className="font-medium text-blue-900">
                                          {formatTime(new Date(news.createdAt), i18n.language)}
                                        </span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Contact Information */}
                              {news.contact && (
                                <Card className="border-0 shadow-md dark:bg-gray-700">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <User className="w-5 h-5 text-teal-600" />
                                      <h3 className="text-lg font-semibold">{t('leave.contactInformation')}</h3>
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                                      <p className="text-teal-900 dark:text-teal-200 font-medium">{news.contact}</p>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Attachments Section */}
                              {(news.Image || news.attachments) && (
                                <Card className="border-0 shadow-md dark:bg-gray-700">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                      <Image className="w-5 h-5 text-purple-600" />
                                      <h3 className="text-lg font-semibold">{t('leave.attachments')}</h3>
                                      <Badge variant="secondary" className="ml-2">
                                        {((news.Image ? 1 : 0) + (news.attachments ? news.attachments.length : 0))} {t('leave.files')}
                                      </Badge>
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {/* Image Display */}
                                      {news.Image && (
                                        <div className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-all duration-300 hover:shadow-md dark:bg-gray-800 dark:hover:bg-gray-750 dark:border-gray-600">
                                          <div className="space-y-3">
                                            <div className="relative group cursor-pointer" onClick={() => openImagePreview(news.Image)}>
                                              <img
                                                src={getImageUrl(news.Image, import.meta.env.VITE_API_BASE_URL)}
                                                alt="News Image"
                                                className="w-full h-32 object-contain rounded-lg border transition-all duration-300 group-hover:scale-105 bg-gray-50"
                                                onError={(e) => handleImageError(e, news.Image, import.meta.env.VITE_API_BASE_URL)}
                                              />
                                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 rounded-lg flex items-center justify-center">
                                                <div className="opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                  <Eye className="w-8 h-8 text-white" />
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-2">
                                                {(() => {
                                                  const fullName = news.Image.split('/').pop() || news.Image;
                                                  if (fullName.startsWith('announcement-')) {
                                                    const parts = fullName.split('-');
                                                    if (parts.length >= 3) {
                                                      return parts.slice(2).join('-');
                                                    }
                                                  }
                                                  return fullName;
                                                })()}
                                              </span>
                                              <div className="flex gap-1">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => {
                                                    const imageUrl = getImageUrl(news.Image, import.meta.env.VITE_API_BASE_URL);
                                                    const link = document.createElement('a');
                                                    link.href = imageUrl;
                                                    link.download = news.Image.split('/').pop() || news.Image;
                                                    link.click();
                                                  }}
                                                  className="text-xs px-2 py-1 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                                >
                                                  {t('common.download')}
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* File Attachments */}
                                      {news.attachments && news.attachments.length > 0 && (
                                        <>
                                          {news.attachments.map((attachment: any, index: number) => {
                                            const fileName = attachment.filename || attachment.name || `file-${index + 1}`;
                                            const fileExtension = fileName.split('.').pop()?.toLowerCase();
                                            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '');

                                            return (
                                              <div key={index} className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-all duration-300 hover:shadow-md dark:bg-gray-800 dark:hover:bg-gray-750 dark:border-gray-600">
                                                {isImage ? (
                                                  <div className="space-y-3">
                                                    <div className="relative group cursor-pointer" onClick={() => openImagePreview(fileName)}>
                                                      <img
                                                        src={getImageUrl(fileName, import.meta.env.VITE_API_BASE_URL)}
                                                        alt={fileName}
                                                        className="w-full h-32 object-contain rounded-lg border transition-all duration-300 group-hover:scale-105 bg-gray-50"
                                                        onError={(e) => handleImageError(e, fileName, import.meta.env.VITE_API_BASE_URL)}
                                                      />
                                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 rounded-lg flex items-center justify-center">
                                                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                          <Eye className="w-8 h-8 text-white" />
                                                        </div>
                                                      </div>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-2">{fileName}</span>
                                                      <div className="flex gap-1">
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={() => openImagePreview(fileName)}
                                                          className="text-xs px-2 py-1 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                                        >
                                                          {t('common.view')}
                                                        </Button>
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={() => {
                                                            const fileUrl = getImageUrl(fileName, import.meta.env.VITE_API_BASE_URL);
                                                            const link = document.createElement('a');
                                                            link.href = fileUrl;
                                                            link.download = fileName;
                                                            link.click();
                                                          }}
                                                          className="text-xs px-2 py-1 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                                        >
                                                          {t('common.download')}
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="space-y-3">
                                                    <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                                      <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-2">{fileName}</span>
                                                      <div className="flex gap-1">
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={() => {
                                                            const fileUrl = getImageUrl(fileName, import.meta.env.VITE_API_BASE_URL);
                                                            window.open(fileUrl, '_blank');
                                                          }}
                                                          className="text-xs px-2 py-1 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                                        >
                                                          {t('common.view')}
                                                        </Button>
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={() => {
                                                            const fileUrl = getImageUrl(fileName, import.meta.env.VITE_API_BASE_URL);
                                                            const link = document.createElement('a');
                                                            link.href = fileUrl;
                                                            link.download = fileName;
                                                            link.click();
                                                          }}
                                                          className="text-xs px-2 py-1 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                                        >
                                                          {t('common.download')}
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                            </div>
                          )}
                          <DialogFooter className="pt-6 border-t dark:border-gray-700">
                            <Button variant="outline" onClick={() => setOpenIdx(null)} className="btn-press hover-glow dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
                              {t('common.close')}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {error && <div className="text-red-500 text-center mt-2">{error}</div>}
          </div>
        </div>
      </div>
      {/* Footer */}
      <footer className="w-full mt-16 py-8 bg-gradient-to-r from-blue-100 via-indigo-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-center text-gray-400 text-base font-medium shadow-inner flex flex-col items-center gap-2">
        <img src="/lovable-uploads/siamit.png" alt="Logo" className="w-10 h-10 rounded-full mx-auto mb-1" />
        <div className="font-bold text-gray-600">{t('footer.systemName')}</div>
        <div className="text-sm">{t('footer.copyright')}</div>
      </footer>

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
} 
