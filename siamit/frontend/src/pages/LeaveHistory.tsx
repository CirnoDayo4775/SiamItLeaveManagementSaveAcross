import LeaveDetailDialog from '@/components/dialogs/LeaveDetailDialog';
import PaginationBar from "@/components/PaginationBar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { apiEndpoints } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from "date-fns";
import { enUS, th } from "date-fns/locale";
import { AlertCircle, Calendar, CheckCircle, Clock, Eye, FileText, Filter, History, Trash2, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from 'react-router-dom';
import { getRetroactiveBadge, getStatusBadge } from '../components/leave/LeaveBadges';
import { monthNames } from '../constants/common';
import { apiService } from '../lib/api';
import { calcHours, getLeaveTypeLabel, getTypeColor, isRetroactiveLeave, translateLeaveType } from '../lib/leaveUtils';
import { formatDateLocalized } from '../lib/utils';
import { logger } from '@/lib/logger';

const LeaveHistory = () => {

  const { t, i18n } = useTranslation();

  const { toast } = useToast();

  const navigate = useNavigate();

  // กำหนด locale สำหรับปฏิทินตามภาษาที่เลือก
  const calendarLocale = i18n.language.startsWith('th') ? th : enUS;



  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // --- เพิ่ม state สำหรับ paging ---

  const [page, setPage] = useState(1);

  const [totalPages, setTotalPages] = useState(1);

  // --- เพิ่ม state สำหรับ summary ---

  const [summary, setSummary] = useState<{ totalLeaveDays: number; totalLeaveHours: number; approvedCount: number; pendingCount: number; rejectedCount?: number; retroactiveCount?: number } | null>(null);

  // --- เพิ่ม state สำหรับ show more/less ---

  const [expandedReason, setExpandedReason] = useState<string | null>(null);

  const [expandedReject, setExpandedReject] = useState<string | null>(null);

  const [filterMonth, setFilterMonth] = useState<number | ''>('');

  const [filterYear, setFilterYear] = useState<number | ''>('');

  const [selectedLeave, setSelectedLeave] = useState<any | null>(null);

  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // --- เพิ่ม state สำหรับ items per page ---

  const [limit, setLimit] = useState(5);

  const [filterLeaveType, setFilterLeaveType] = useState('');

  // --- เพิ่ม state สำหรับ leave types dropdown ---

  const [leaveTypes, setLeaveTypes] = useState<{ id: string; leave_type: string; leave_type_th: string; leave_type_en: string }[]>([]);

  const [leaveTypesLoading, setLeaveTypesLoading] = useState(false);

  const [leaveTypesError, setLeaveTypesError] = useState<string | null>(null);



  // --- เพิ่ม state สำหรับปฏิทินและ filter ใหม่ ---

  const [filterStatus, setFilterStatus] = useState('');

  const [filterRetroactive, setFilterRetroactive] = useState('');

  const [showFilters, setShowFilters] = useState(false);

  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  const [yearOptions, setYearOptions] = useState<number[]>([]);

  const [monthOptions, setMonthOptions] = useState<number[]>([]);

  const [singleDate, setSingleDate] = useState<Date | undefined>(undefined);



  // --- เพิ่ม state สำหรับการลบ ---

  const [deleteLeaveId, setDeleteLeaveId] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);



  const { showSessionExpiredDialog } = useAuth();



  // Calculate summary statistics from summary data (all pages)

  const totalLeaveDays = summary ? summary.totalLeaveDays : 0;

  const totalLeaveHours = summary ? summary.totalLeaveHours : 0;

  const approvedCount = summary ? summary.approvedCount : 0;

  const pendingCount = summary ? summary.pendingCount : 0;

  const rejectedCount = summary && typeof summary.rejectedCount === 'number' ? summary.rejectedCount : 0;

  const retroactiveCount = summary?.retroactiveCount || 0;

  // รายชื่อเดือนรองรับ i18n

  const currentMonthNames = monthNames[i18n.language === 'th' ? 'th' : 'en'];



  const fetchLeaveHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${apiEndpoints.leaveHistory.list}?page=${page}&limit=${limit}`;


      if (filterLeaveType && filterLeaveType !== 'all') {
        url += `&leaveType=${filterLeaveType}`;
      }

      // แก้ไขการส่งค่า month และ year ให้ถูกต้อง
      if (filterMonth !== '' && filterMonth !== null && filterMonth !== undefined) {
        url += `&month=${filterMonth}`;
      }

      if (filterYear !== '' && filterYear !== null && filterYear !== undefined) {
        url += `&year=${filterYear}`;
      }

      if (filterStatus && filterStatus !== 'all') {
        url += `&status=${filterStatus}`;
      }

      if (filterRetroactive && filterRetroactive !== 'all') {
        url += `&retroactive=${filterRetroactive}`;
      }

      if (singleDate) {
        url += `&date=${format(singleDate, 'yyyy-MM-dd')}`;
      }


      // Use apiService.get
      const data = await apiService.get(url, undefined, showSessionExpiredDialog);

      if (data && data.status === "success") {
        setLeaveHistory(data.data);
        setTotalPages(data.totalPages || 1);
        setSummary(data.summary || null);
      } else {
        setError(data?.message || "Unknown error");
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, filterMonth, filterYear, limit, filterLeaveType, filterStatus, filterRetroactive, singleDate, showSessionExpiredDialog]);



  useEffect(() => {

    fetchLeaveHistory();

  }, [fetchLeaveHistory]);







  // เพิ่มฟังก์ชันใหม่สำหรับดึงรายละเอียดใบลาจาก backend

  const handleViewDetails = async (leaveId: string) => {

    const leaveData = leaveHistory.find(leave => leave.id === leaveId);

    if (leaveData) {

      setSelectedLeave(leaveData);

      setShowDetailDialog(true);

      return;

    }

    // If not found in current data, fetch from API
    setSelectedLeave(null);

    setShowDetailDialog(true);

    try {

      const data = await apiService.get(apiEndpoints.leave.detail(leaveId), undefined, showSessionExpiredDialog);

      if (data && data.success) {

        const leaveDetail = {

          ...data.data,

          startDate: data.data.startDate || data.data.leaveDate || '-',

          submittedDate: data.data.createdAt || data.data.submittedDate || '-',

        };

        setSelectedLeave(leaveDetail);

      }

    } catch (e) {

      if (import.meta.env.DEV) {
        logger.error('Error fetching leave detail:', e);
      }

    }

  };

  // Fetch leave types and filter options from backend

  useEffect(() => {

    const fetchFilters = async () => {

      setLeaveTypesLoading(true);

      setLeaveTypesError(null);

      try {

        const data = await apiService.get(apiEndpoints.leaveHistory.filters, undefined, showSessionExpiredDialog);

        if (data && data.status === 'success') {

          setLeaveTypes(data.leaveTypes || []);

          setStatusOptions(data.statuses || []);

          setYearOptions(data.years || []);

          setMonthOptions(data.months || []);

        } else {

          setLeaveTypes([]);

          setLeaveTypesError(data?.message || 'Failed to fetch filter data');

        }

      } catch (err: any) {

        setLeaveTypes([]);

        setLeaveTypesError(err.message || 'Failed to fetch filter data');

      } finally {

        setLeaveTypesLoading(false);

      }

    };

    fetchFilters();

  }, [showSessionExpiredDialog]);



  // ฟังก์ชันล้าง filter ทั้งหมด

  const clearAllFilters = () => {
    setFilterLeaveType('');
    setFilterMonth('');
    setFilterYear('');
    setFilterStatus('');
    setFilterRetroactive('');
    setSingleDate(undefined);
    setPage(1);
  };



  // ฟังก์ชันตรวจสอบว่ามี filter ใช้งานอยู่หรือไม่

  const hasActiveFilters = () => {
    const hasFilters = filterLeaveType || filterMonth || filterYear || filterStatus || filterRetroactive || singleDate;
    return hasFilters;
  };



  // Note: isRetroactiveLeave, getStatusBadge, getRetroactiveBadge functions moved to src/lib/leaveUtils.ts







  // Note: getTypeColor function moved to src/lib/leaveUtils.ts



  // Note: translateLeaveType function moved to src/lib/leaveUtils.ts



  // Note: calcHours function moved to src/lib/leaveUtils.ts

  // กำหนดหน่วยชั่วโมงตามภาษา

  const hourUnit = i18n.language === 'th' ? t('common.hoursShort') : t('common.hoursShort');



  // สร้างตัวเลือกเดือนและปีทั้งหมด

  const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);

  const currentYear = new Date().getFullYear();

  const allYears = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);



  // Note: getLeaveTypeLabel function moved to src/lib/leaveUtils.ts



  // เพิ่มฟังก์ชันการลบใบลา

  const handleDeleteLeave = (leaveId: string) => {

    setDeleteLeaveId(leaveId);

    setShowDeleteDialog(true);

  };



  const confirmDeleteLeave = async () => {

    if (!deleteLeaveId) return;

    setDeleting(true);

    try {

      const data = await apiService.delete(apiEndpoints.leave.delete(deleteLeaveId), undefined, showSessionExpiredDialog);

      if (data && (data.success || data.status === 'success')) {

        toast({

          title: t('system.deleteSuccess'),

          description: t('system.deleteSuccessDesc'),

          className: 'border-green-500 bg-green-50 text-green-900',

        });

        setDeleteLeaveId(null);

        setShowDeleteDialog(false);

        // Refresh ข้อมูลหลังจากลบสำเร็จ

        fetchLeaveHistory();

      } else {

        toast({

          title: t('system.deleteError'),

          description: data?.message || t('system.deleteErrorDesc'),

          variant: 'destructive',

        });

      }

    } catch (e) {

      toast({

        title: t('system.deleteError'),

        description: t('system.deleteErrorDesc'),

        variant: 'destructive',

      });

    } finally {

      setDeleting(false);

    }

  };

  // ฟังก์ชันตรวจสอบว่าสามารถลบใบลาได้หรือไม่
  const canDeleteLeave = (leave: any) => {
    // ตรวจสอบสถานะต้องเป็น pending
    if (leave.status !== 'pending') {
      return false;
    }

    // Allow deletion of pending requests regardless of date
    // (Backend will handle any additional date restrictions if needed)
    return true;
  };

  // เพิ่มฟังก์ชันสำหรับกำหนดประเภทไฟล์
  const getFileType = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension || '')) {
      return 'image/' + extension;
    } else if (extension === 'pdf') {
      return 'application/pdf';
    } else if (['doc', 'docx'].includes(extension || '')) {
      return 'application/msword';
    } else if (['xls', 'xlsx'].includes(extension || '')) {
      return 'application/vnd.ms-excel';
    } else if (['ppt', 'pptx'].includes(extension || '')) {
      return 'application/vnd.ms-powerpoint';
    } else if (extension === 'txt') {
      return 'text/plain';
    }
    return 'application/octet-stream';
  };



  return (

    <div className="bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 relative overflow-x-hidden">

      {/* Floating/Parallax Background Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[350px] h-[350px] rounded-full bg-gradient-to-br from-blue-200 via-indigo-100 to-purple-100 opacity-30 blur-2xl animate-float" />
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] rounded-full bg-gradient-to-tr from-purple-200 via-blue-100 to-indigo-100 opacity-20 blur-xl animate-float" />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full bg-blue-100 opacity-10 blur-xl animate-pulse" style={{ transform: 'translate(-50%,-50%)' }} />
      </div>

      {/* Topbar */}
      <div className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 relative shadow-lg animate-fade-in-up">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-lg backdrop-blur-sm" />
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">{t('leave.leaveHistory')}</h1>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{t('history.leaveHistoryTitle')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 animate-fade-in">

        <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">

          {/* Summary Stats */}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">

            <Card className="glass shadow-xl border-0 dark:bg-gray-800/80 dark:border-gray-700 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 animate-fade-in-up hover-lift">

              <CardContent className="p-3 sm:p-4 md:p-5 flex items-center gap-2 sm:gap-3 md:gap-4">

                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110">

                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white transition-all duration-300" />

                </div>

                <div>

                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 dark:text-blue-200 transition-all duration-300 group-hover:scale-110">{totalLeaveDays}</p>

                  <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-300 font-medium leading-tight">{t('history.totalLeaveDays')}</p>

                </div>

              </CardContent>

            </Card>

            <Card className="glass shadow-xl border-0 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 animate-fade-in-up hover-lift">

              <CardContent className="p-3 sm:p-4 md:p-5 flex items-center gap-2 sm:gap-3 md:gap-4">

                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110">

                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white transition-all duration-300" />

                </div>

                <div>

                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-indigo-800 dark:text-indigo-200 transition-all duration-300 group-hover:scale-110">{totalLeaveHours}</p>

                  <p className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-300 font-medium leading-tight">{t('history.totalLeaveHours')}</p>

                </div>

              </CardContent>

            </Card>

            <Card className="glass shadow-xl border-0 dark:bg-gray-800/80 dark:border-gray-700 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 animate-fade-in-up hover-lift">

              <CardContent className="p-3 sm:p-4 md:p-5 flex items-center gap-2 sm:gap-3 md:gap-4">

                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110">

                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white transition-all duration-300" />

                </div>

                <div>

                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-700 dark:text-green-200 transition-all duration-300 group-hover:scale-110">{approvedCount}</p>

                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-300 font-medium leading-tight">{t('history.approvedRequests')}</p>

                </div>

              </CardContent>

            </Card>

            <Card className="glass shadow-xl border-0 dark:bg-gray-800/80 dark:border-gray-700 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 animate-fade-in-up hover-lift">

              <CardContent className="p-3 sm:p-4 md:p-5 flex items-center gap-2 sm:gap-3 md:gap-4">

                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110">

                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white transition-all duration-300" />

                </div>

                <div>

                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-700 dark:text-yellow-200 transition-all duration-300 group-hover:scale-110">{pendingCount}</p>

                  <p className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-300 font-medium leading-tight">{t('history.pendingRequests')}</p>

                </div>

              </CardContent>

            </Card>

            <Card className="glass shadow-xl border-0 dark:bg-gray-800/80 dark:border-gray-700 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 animate-fade-in-up hover-lift">

              <CardContent className="p-3 sm:p-4 md:p-5 flex items-center gap-2 sm:gap-3 md:gap-4">

                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110">

                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white transition-all duration-300" />

                </div>

                <div>

                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-700 dark:text-red-200 transition-all duration-300 group-hover:scale-110">{rejectedCount}</p>

                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-300 font-medium leading-tight">{t('history.rejectedRequests')}</p>

                </div>

              </CardContent>

            </Card>

            <Card className="glass shadow-xl border-0 dark:bg-gray-800/80 dark:border-gray-700 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 animate-fade-in-up hover-lift">

              <CardContent className="p-3 sm:p-4 md:p-5 flex items-center gap-2 sm:gap-3 md:gap-4">

                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110">

                  <History className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white transition-all duration-300" />

                </div>

                <div>

                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-700 dark:text-purple-200 transition-all duration-300 group-hover:scale-110">{retroactiveCount}</p>

                  <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-300 font-medium leading-tight">{t('history.retroactiveLeave')}</p>

                </div>

              </CardContent>

            </Card>

          </div>



          {/* Enhanced Filter Section */}

          <Card className="glass shadow-2xl border-0 animate-fade-in-up filter-toggle">

            <CardHeader className="pb-4">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md transition-all duration-300 ${showFilters ? 'scale-110' : 'scale-100'

                    }`}>

                    <Filter className={`w-5 h-5 text-white transition-all duration-300 ${showFilters ? 'animate-pulse' : ''

                      }`} />

                  </div>

                  <div>

                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('history.filters')}</h3>

                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('history.filterDesc')}</p>

                  </div>

                </div>

                <Button

                  variant="outline"

                  size="sm"

                  onClick={() => setShowFilters(!showFilters)}

                  className={`border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30 dark:hover:border-blue-600 transition-all duration-300 rounded-lg px-4 py-2 font-medium transform hover:scale-105 btn-press hover-glow ${showFilters ? 'bg-blue-50 border-blue-300 shadow-md dark:bg-blue-900/20 dark:border-blue-600' : ''

                    }`}

                >

                  {showFilters ? (

                    <>

                      <X className="w-4 h-4 mr-2" />

                      {t('history.hideFilters')}

                    </>

                  ) : (

                    <>

                      <Filter className="w-4 h-4 mr-2" />

                      {t('history.showFilters')}

                    </>

                  )}

                </Button>

              </div>

            </CardHeader>

            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showFilters ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'

              }`}>

              <CardContent className="space-y-6 animate-slide-down filter-toggle">

                {/* Filter Grid */}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">

                  {/* Single Date Filter */}

                  <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">

                      <Calendar className="w-4 h-4 text-blue-600" />

                      {t('history.singleDate')}

                    </Label>

                    <Popover>

                      <PopoverTrigger asChild>

                        <Button

                          variant="outline"

                          className="w-full justify-start text-left font-normal bg-white/80 dark:bg-gray-800/80 backdrop-blur border-blue-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 hover:border-blue-300 dark:hover:border-gray-600 dark:text-gray-200 transition-all duration-200 rounded-lg h-11 text-sm"

                        >

                          <Calendar className="mr-2 h-4 w-4 text-blue-600" />

                          {singleDate ? format(singleDate, "dd/MM/yyyy", { locale: calendarLocale }) : t('history.selectSingleDate')}

                        </Button>

                      </PopoverTrigger>

                      <PopoverContent className="w-auto p-0 border-0 shadow-xl rounded-xl dark:bg-gray-800 dark:text-gray-100" align="start">

                        <CalendarComponent

                          mode="single"

                          selected={singleDate}

                          onSelect={date => setSingleDate(date)}

                          className="rounded-xl"

                          locale={calendarLocale}

                        />

                      </PopoverContent>

                    </Popover>

                  </div>



                  {/* Leave Type Filter */}

                  <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>

                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">

                      <FileText className="w-4 h-4 text-green-600" />

                      {t('leave.type')}

                    </Label>

                    <Select value={filterLeaveType || "all"} onValueChange={v => setFilterLeaveType(v === "all" ? "" : v)} disabled={leaveTypesLoading}>

                      <SelectTrigger className="bg-white/80 dark:bg-gray-800/80 backdrop-blur border-green-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-gray-700 hover:border-green-300 dark:hover:border-gray-600 dark:text-gray-200 transition-all duration-200 rounded-lg h-11 text-sm">

                        <SelectValue placeholder={

                          leaveTypesLoading

                            ? t('common.loading')

                            : leaveTypesError

                              ? t('common.error')

                              : t('leaveTypes.all')

                        } />

                      </SelectTrigger>

                      <SelectContent className="border-0 shadow-xl rounded-xl dark:bg-gray-800 dark:text-gray-100">

                        <SelectItem value="all" className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">

                          {t('leaveTypes.all')}

                        </SelectItem>

                        {leaveTypesLoading ? (

                          <SelectItem value="loading" disabled className="rounded-lg">

                            <div className="flex items-center gap-2">

                              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>

                              {t('common.loading')}

                            </div>

                          </SelectItem>

                        ) : leaveTypesError ? (

                          <SelectItem value="error" disabled className="rounded-lg text-red-600">

                            <div className="flex items-center gap-2">

                              <XCircle className="w-4 h-4" />

                              {t('common.error')}

                            </div>

                          </SelectItem>

                        ) : (

                          leaveTypes.map((lt) => (

                            <SelectItem key={lt.id} value={lt.id} className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">

                              {i18n.language.startsWith('th') ? lt.leave_type_th : lt.leave_type_en}

                            </SelectItem>

                          ))

                        )}

                      </SelectContent>

                    </Select>

                    {leaveTypesError && (

                      <p className="text-xs text-red-600 mt-1">{leaveTypesError}</p>

                    )}

                  </div>



                  {/* Status Filter */}

                  <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>

                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">

                      <AlertCircle className="w-4 h-4 text-yellow-600" />

                      {t('leave.status')}

                    </Label>

                    <Select value={filterStatus || "all"} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>

                      <SelectTrigger className="bg-white/80 dark:bg-gray-800/80 backdrop-blur border-yellow-200 dark:border-gray-700 hover:bg-yellow-50 dark:hover:bg-gray-700 hover:border-yellow-300 dark:hover:border-gray-600 dark:text-gray-200 transition-all duration-200 rounded-lg h-11 text-sm">

                        <SelectValue placeholder={t('history.allStatuses')} />

                      </SelectTrigger>

                      <SelectContent className="border-0 shadow-xl rounded-xl dark:bg-gray-800 dark:text-gray-100">

                        <SelectItem value="all" className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">{t('leave.statusAll')}</SelectItem>

                        {statusOptions.map(status => {

                          // Map status values to translation keys
                          const getStatusTranslation = (statusValue: string) => {
                            switch (statusValue.toLowerCase()) {
                              case 'pending':
                                return t('leave.pending');
                              case 'approved':
                                return t('leave.approved');
                              case 'rejected':
                                return t('leave.rejected');
                              default:
                                return statusValue; // fallback to original value
                            }
                          };

                          return (
                            <SelectItem key={status} value={status} className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">
                              {getStatusTranslation(status)}
                            </SelectItem>
                          );
                        })}

                      </SelectContent>

                    </Select>

                  </div>



                  {/* Retroactive Leave Filter - ปรับปรุงให้ใช้งานได้จริง */}

                  <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>

                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">

                      <History className="w-4 h-4 text-purple-600" />

                      {t('history.retroactiveLeave')}

                    </Label>

                    <Select value={filterRetroactive || "all"} onValueChange={v => setFilterRetroactive(v === "all" ? "" : v)}>

                      <SelectTrigger className="bg-white/80 dark:bg-gray-800/80 backdrop-blur border-purple-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-gray-700 hover:border-purple-300 dark:hover:border-gray-600 dark:text-gray-200 transition-all duration-200 rounded-lg h-11 text-sm">
                        <SelectValue placeholder={t('leave.allTypes')} />
                      </SelectTrigger>
                      <SelectContent className="border-0 shadow-xl rounded-xl dark:bg-gray-800 dark:text-gray-100">
                        <SelectItem value="all" className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">
                          {t('leave.allTypes')}
                        </SelectItem>
                        <SelectItem value="normal" className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">
                          {t('leave.notBackdated')}
                        </SelectItem>
                        <SelectItem value="retroactive" className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">
                          {t('leave.backdatedOnly')}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                  </div>



                  {/* Month/Year Filter */}

                  <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>

                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">

                      <Clock className="w-4 h-4 text-indigo-600" />

                      {t('history.monthYear')}

                    </Label>

                    <div className="flex gap-2">

                      <Select
                        value={filterMonth ? filterMonth.toString() : "all"}
                        onValueChange={v => {
                          const newValue = v === "all" ? '' : Number(v);
                          setFilterMonth(newValue);
                        }}
                        disabled={!!singleDate}
                      >

                        <SelectTrigger className="w-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur border-indigo-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-gray-700 hover:border-indigo-300 dark:hover:border-gray-600 dark:text-gray-200 transition-all duration-200 rounded-lg h-11 text-sm">

                          <SelectValue placeholder={t('history.month')} />

                        </SelectTrigger>

                        <SelectContent className="border-0 shadow-xl rounded-xl dark:bg-gray-800 dark:text-gray-100">

                          <SelectItem value="all" className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">{t('history.allMonths')}</SelectItem>

                          {allMonths.map(m => (

                            <SelectItem key={m} value={m.toString()} className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">{currentMonthNames[m - 1]}</SelectItem>

                          ))}

                        </SelectContent>

                      </Select>

                      <Select
                        value={filterYear ? filterYear.toString() : "all"}
                        onValueChange={v => {
                          const newValue = v === "all" ? '' : Number(v);
                          setFilterYear(newValue);
                        }}
                        disabled={!!singleDate}
                      >

                        <SelectTrigger className="w-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur border-indigo-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-gray-700 hover:border-indigo-300 dark:hover:border-gray-600 dark:text-gray-200 transition-all duration-200 rounded-lg h-11 text-sm">

                          <SelectValue placeholder={t('history.year')} />

                        </SelectTrigger>

                        <SelectContent className="border-0 shadow-xl rounded-xl dark:bg-gray-800 dark:text-gray-100">

                          <SelectItem value="all" className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">{t('history.allYears')}</SelectItem>

                          {allYears.map(y => (

                            <SelectItem key={y} value={y.toString()} className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">{y}</SelectItem>

                          ))}

                        </SelectContent>

                      </Select>

                    </div>

                  </div>

                </div>



                {/* Filter Actions */}

                <div className="flex justify-between items-center pt-4 border-t border-gray-200 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>

                  <div className="flex items-center gap-3">

                    {hasActiveFilters() && (

                      <Button

                        variant="outline"

                        size="sm"

                        onClick={clearAllFilters}

                        className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-700 transition-all duration-300 rounded-lg px-4 py-2 font-medium transform hover:scale-105 hover:shadow-md btn-press hover-glow"

                      >

                        <X className="w-4 h-4 mr-2" />

                        {t('history.clearAllFilters')}

                      </Button>

                    )}

                    {hasActiveFilters() && (

                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">

                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>

                        {filterRetroactive === 'retroactive' ? (

                          <span className="flex items-center gap-1">

                            <History className="w-4 h-4 text-purple-600" />

                            {t('history.showingRetroactive')}

                          </span>

                        ) : filterRetroactive === 'normal' ? (

                          <span className="flex items-center gap-1">

                            <CheckCircle className="w-4 h-4 text-green-600" />

                            {t('history.showingNormal')}

                          </span>

                        ) : (

                          t('history.activeFilters')

                        )}

                      </div>

                    )}

                  </div>

                  <div className="flex items-center gap-3">

                    <div className="text-sm text-gray-600 dark:text-gray-300">

                      {leaveHistory.length} {t('history.results')}

                    </div>

                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">

                      {leaveHistory.length}

                    </div>

                  </div>

                </div>

              </CardContent>

            </div>

          </Card>



          {/* Leave History List */}

          <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>

            {loading ? (

              <div className="flex justify-center items-center py-12 animate-fade-in">

                <div className="text-center">

                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3 loading-pulse"></div>

                  <p className="text-base font-medium text-blue-600 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>{t('common.loading')}</p>

                  <p className="text-xs text-gray-500 mt-1 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>{t('history.loadingData')}</p>

                </div>

              </div>

            ) : error ? (

              <div className="flex justify-center items-center py-12 animate-fade-in">

                <div className="text-center">

                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce-in">

                    <XCircle className="w-6 h-6 text-red-500" />

                  </div>

                  <p className="text-base font-medium text-red-600 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>{t('common.error')}</p>

                  <p className="text-xs text-gray-500 mt-1 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>{error}</p>

                </div>

              </div>

            ) : leaveHistory.length === 0 ? (

              <div className="flex justify-center items-center py-12 animate-fade-in">

                <div className="text-center">

                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce-in">

                    <FileText className="w-6 h-6 text-gray-400" />

                  </div>

                  <p className="text-base font-medium text-gray-600 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>{t('history.noLeaveHistory')}</p>

                  <p className="text-xs text-gray-500 mt-1 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>{t('history.noLeaveHistoryDesc')}</p>

                </div>

              </div>

            ) : leaveHistory.length === 0 ? (

              <div className="flex justify-center items-center py-12 animate-fade-in">

                <div className="text-center">

                  <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg animate-bounce-in">

                    <Filter className="w-6 h-6 text-gray-500" />

                  </div>

                  <p className="text-base font-medium text-gray-700 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>{t('history.noResultsForFilter')}</p>

                  <p className="text-xs text-gray-500 mt-1 mb-3 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>{t('history.tryDifferentFilter')}</p>

                  <Button

                    variant="outline"

                    size="sm"

                    onClick={clearAllFilters}

                    className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 rounded-lg px-3 py-1.5 font-medium btn-press hover-glow animate-fade-in-up"

                    style={{ animationDelay: '0.6s' }}

                  >

                    <X className="w-3 h-3 mr-1" />

                    {t('history.clearAllFilters')}

                  </Button>

                </div>

              </div>

            ) : (

              leaveHistory.map((leave, index) => (

                <Card
                  key={leave.id}
                  className="glass shadow-xl border-0 hover:scale-[1.02] transition-all duration-300 hover-lift card-entrance"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >

                  <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                    <div className="flex items-center gap-4">

                      <div className={`text-xl font-bold ${getTypeColor(leave.leaveTypeName_th || leave.leaveTypeName_en || leave.type)}`}>

                        {leave.leaveTypeName_th && leave.leaveTypeName_en
                          ? (i18n.language.startsWith('th') ? leave.leaveTypeName_th : leave.leaveTypeName_en)
                          : (getLeaveTypeLabel(leave.type, leaveTypes, i18n, t) || translateLeaveType(leave.type, leaveTypes, i18n, t))
                        }

                      </div>

                      <div className="flex flex-wrap gap-2">

                        {getStatusBadge(leave.status, t)}

                        {getRetroactiveBadge(leave, t)}

                      </div>

                    </div>

                    <div className="text-sm text-blue-400 dark:text-gray-200 font-medium sm:text-right">

                      {formatDateLocalized(leave.submittedDate, i18n.language)}

                    </div>

                  </CardHeader>

                  <CardContent className="pt-0 pb-4">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

                      <div className="space-y-3">

                        <div className="flex items-center gap-3 text-base text-blue-900 dark:text-white">

                          <Calendar className="w-5 h-5 text-blue-400" />

                          <span className="font-medium">{t('leave.startDate')}:</span>

                          <span>{formatDateLocalized(leave.startDate, i18n.language)}</span>

                        </div>

                        <div className="flex items-center gap-3 text-base text-blue-900 dark:text-white">

                          <Calendar className="w-5 h-5 text-blue-400" />

                          <span className="font-medium">{t('leave.endDate')}:</span>

                          <span>{formatDateLocalized(leave.endDate, i18n.language)}</span>

                        </div>

                        {/* แสดงระยะเวลาตามประเภทการลา */}

                        {leave.startTime && leave.endTime ? (

                          // ถ้ามีเวลาเริ่มและสิ้นสุด แสดงเป็นชั่วโมง

                          <div className="space-y-2">

                            <div className="flex items-center gap-3 text-base text-blue-900 dark:text-white">

                              <Clock className="w-5 h-5 text-blue-400" />

                              <span className="font-medium">{t('leave.duration')}:</span>

                              <span>{calcHours(leave.startTime, leave.endTime)} {hourUnit}</span>

                            </div>

                            <div className="flex items-center gap-3 text-sm text-blue-700 dark:text-gray-200">

                              <Clock className="w-4 h-4 text-blue-400" />

                              <span className="font-medium">{t('leave.startTime')}:</span>

                              <span>{leave.startTime}</span>

                              <span className="mx-1">-</span>

                              <span className="font-medium">{t('leave.endTime')}:</span>

                              <span>{leave.endTime}</span>

                            </div>

                          </div>

                        ) : (

                          // ถ้าไม่มีเวลา แสดงเป็นวัน

                          <div className="flex items-center gap-3 text-base text-blue-900 dark:text-white">

                            <Clock className="w-5 h-5 text-blue-400" />

                            <span className="font-medium">{t('leave.duration')}:</span>

                            <span>{leave.days} {t('history.days')}</span>

                          </div>

                        )}

                        {isRetroactiveLeave(leave) && (

                          <div className="flex items-center gap-3 text-base text-purple-700">

                          </div>

                        )}



                      </div>

                      <div className="space-y-3">

                        <div className="flex items-start gap-3 text-base text-blue-900 dark:text-white">

                          <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{t('leave.reason')}:</span>
                            <div className="mt-1">
                              {leave.reason && leave.reason.length > 100 ? (
                                <div>
                                  <p className="text-blue-500 dark:text-gray-200 text-sm break-all overflow-wrap-anywhere whitespace-pre-wrap max-w-full">
                                    {expandedReason === leave.id
                                      ? leave.reason
                                      : leave.reason.slice(0, 100) + '...'
                                    }
                                  </p>
                                  <button
                                    onClick={() => setExpandedReason(expandedReason === leave.id ? null : leave.id)}
                                    className="text-blue-600 hover:text-blue-800 text-xs font-medium mt-1 transition-colors"
                                  >
                                    {expandedReason === leave.id
                                      ? t('common.showLess')
                                      : t('common.showMore')
                                    }
                                  </button>
                                </div>
                              ) : (
                                <p className="text-blue-500 dark:text-gray-200 text-sm break-all overflow-wrap-anywhere whitespace-pre-wrap max-w-full">{leave.reason || '-'}</p>
                              )}
                            </div>
                          </div>

                        </div>

                        {/* Approved by: และ Rejected by: แยกออกมาอยู่ล่างสุดของ Card */}

                        {leave.status === "approved" && leave.approvedBy && (

                          <div className="flex items-center gap-3 text-base text-green-700">

                            <CheckCircle className="w-5 h-5 text-green-500" />

                            <span className="font-medium">{t('leave.approvedBy')}:</span>

                            <span>{leave.approvedBy}</span>

                          </div>

                        )}

                        {leave.status === "rejected" && (

                          <div className="space-y-4">

                            <div className="space-y-2">

                              <Label className="text-sm font-medium text-gray-600">{t('leave.rejectedBy')}</Label>

                              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">

                                <XCircle className="w-4 h-4 text-red-500" />
                                <span className="font-medium text-red-900 text-sm break-all overflow-wrap-anywhere whitespace-pre-wrap max-w-full">{leave.rejectedBy || '-'}</span>
                              </div>

                            </div>

                            {leave.rejectionReason && (

                              <div className="space-y-2">

                                <Label className="text-sm font-medium text-gray-600">{t('leave.rejectionReason')}</Label>

                                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">

                                  <FileText className="w-4 h-4 text-red-500 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    {leave.rejectionReason && leave.rejectionReason.length > 100 ? (
                                      <div>
                                        <span className="text-red-900 leading-relaxed text-sm break-all overflow-wrap-anywhere whitespace-pre-wrap max-w-full">
                                          {expandedReject === leave.id
                                            ? leave.rejectionReason
                                            : leave.rejectionReason.slice(0, 100) + '...'
                                          }
                                        </span>
                                        <button
                                          onClick={() => setExpandedReject(expandedReject === leave.id ? null : leave.id)}
                                          className="text-red-600 hover:text-red-800 text-xs font-medium mt-1 transition-colors block"
                                        >
                                          {expandedReject === leave.id
                                            ? t('common.showLess')
                                            : t('common.showMore')
                                          }
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-red-900 leading-relaxed text-sm break-all overflow-wrap-anywhere whitespace-pre-wrap max-w-full">{leave.rejectionReason}</span>
                                    )}
                                  </div>
                                </div>

                              </div>

                            )}

                          </div>

                        )}

                        <div className="flex flex-col sm:flex-row justify-end mt-6 gap-2">

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(leave.id)}
                            className="transition-all duration-300 transform hover:scale-105 hover:shadow-md hover:bg-blue-50 hover:border-blue-300 btn-press hover-glow text-sm px-4 py-2"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {t('common.viewDetails')}
                          </Button>

                          {canDeleteLeave(leave) && (
                            <AlertDialog open={showDeleteDialog && deleteLeaveId === leave.id} onOpenChange={setShowDeleteDialog}>

                              <AlertDialogTrigger asChild>

                                <Button

                                  size="sm"

                                  variant="destructive"

                                  onClick={() => handleDeleteLeave(leave.id)}

                                  className="transition-all duration-300 transform hover:scale-105 hover:shadow-md btn-press hover-glow text-sm px-4 py-2"

                                >

                                  <Trash2 className="w-4 h-4 mr-1" />

                                  {t('common.delete')}

                                </Button>

                              </AlertDialogTrigger>

                              <AlertDialogContent>

                                <AlertDialogHeader>

                                  <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>

                                  <AlertDialogDescription>

                                    {t('system.deleteConfirmMessage')}

                                  </AlertDialogDescription>

                                </AlertDialogHeader>

                                <AlertDialogFooter>

                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>

                                  <AlertDialogAction

                                    onClick={confirmDeleteLeave}

                                    disabled={deleting}

                                    className="bg-red-600 hover:bg-red-700"

                                  >

                                    {deleting ? t('common.deleting') : t('common.delete')}

                                  </AlertDialogAction>

                                </AlertDialogFooter>

                              </AlertDialogContent>

                            </AlertDialog>

                          )}

                          {/* Show disabled delete button with tooltip when deletion is not allowed */}
                          {!canDeleteLeave(leave) && (
                            <div className="relative group">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className="transition-all duration-300 transform hover:scale-105 hover:shadow-md btn-press hover-glow text-sm px-4 py-2 opacity-50 cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                {t('common.delete')}
                              </Button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                {leave.status !== 'pending'
                                  ? t('history.cannotDeleteNonPending')
                                  : t('history.cannotDeleteNearDate')
                                }
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          )}

                        </div>

                      </div>

                    </div>

                  </CardContent>

                </Card>

              ))

            )}

            {/* Enhanced Pagination (replaced with reusable component) */}
            {(totalPages >= 1 || leaveHistory.length > 0) && (
              <PaginationBar
                page={page}
                totalPages={totalPages}
                totalResults={leaveHistory.length}
                pageSize={limit}
                onPageChange={setPage}
                onPageSizeChange={(n) => setLimit(n)}
              />
            )}

          </div>

        </div>

      </div>

      {/* Leave Detail Dialog */}
      <LeaveDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        leaveRequest={selectedLeave}
      />



      <style>{`

        .glass {
          background: rgba(255,255,255,0.8);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.10);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 2rem;
          border: 1px solid rgba(255,255,255,0.18);
        }



        @keyframes slide-down {

          from {

            opacity: 0;

            transform: translateY(-20px);

          }

          to {

            opacity: 1;

            transform: translateY(0);

          }

        }



        @keyframes fade-in-up {

          from {

            opacity: 0;

            transform: translateY(30px);

          }

          to {

            opacity: 1;

            transform: translateY(0);

          }

        }



        @keyframes fade-in {

          from {

            opacity: 0;

          }

          to {

            opacity: 1;

          }

        }



        @keyframes scale-in {

          from {

            opacity: 0;

            transform: scale(0.95);

          }

          to {

            opacity: 1;

            transform: scale(1);

          }

        }



        @keyframes slide-in-left {

          from {

            opacity: 0;

            transform: translateX(-30px);

          }

          to {

            opacity: 1;

            transform: translateX(0);

          }

        }



        @keyframes slide-in-right {

          from {

            opacity: 0;

            transform: translateX(30px);

          }

          to {

            opacity: 1;

            transform: translateX(0);

          }

        }



        @keyframes bounce-in {

          0% {

            opacity: 0;

            transform: scale(0.3);

          }

          50% {

            opacity: 1;

            transform: scale(1.05);

          }

          70% {

            transform: scale(0.9);

          }

          100% {

            opacity: 1;

            transform: scale(1);

          }

        }



        @keyframes float {

          0%, 100% {

            transform: translateY(0px);

          }

          50% {

            transform: translateY(-10px);

          }

        }



        @keyframes shimmer {

          0% {

            background-position: -200px 0;

          }

          100% {

            background-position: calc(200px + 100%) 0;

          }

        }



        @keyframes gradient-shift {

          0% {

            background-position: 0% 50%;

          }

          50% {

            background-position: 100% 50%;

          }

          100% {

            background-position: 0% 50%;

          }

        }



        .animate-slide-down {

          animation: slide-down 0.5s ease-out forwards;

        }



        .animate-fade-in-up {

          animation: fade-in-up 0.6s ease-out forwards;

          opacity: 0;

        }



        .animate-fade-in {

          animation: fade-in 0.8s ease-out forwards;

        }



        .animate-scale-in {

          animation: scale-in 0.6s ease-out forwards;

        }



        .animate-slide-in-left {

          animation: slide-in-left 0.7s ease-out forwards;

        }



        .animate-slide-in-right {

          animation: slide-in-right 0.7s ease-out forwards;

        }



        .animate-bounce-in {

          animation: bounce-in 0.8s ease-out forwards;

        }



        .animate-float {

          animation: float 3s ease-in-out infinite;

        }



        .animate-shimmer {

          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);

          background-size: 200px 100%;

          animation: shimmer 2s infinite;

        }



        .animate-gradient-shift {

          background-size: 200% 200%;

          animation: gradient-shift 3s ease infinite;

        }



        .animate-fade-in-up:nth-child(1) { animation-delay: 0.1s; }

        .animate-fade-in-up:nth-child(2) { animation-delay: 0.2s; }

        .animate-fade-in-up:nth-child(3) { animation-delay: 0.3s; }

        .animate-fade-in-up:nth-child(4) { animation-delay: 0.4s; }

        .animate-fade-in-up:nth-child(5) { animation-delay: 0.5s; }

        .animate-fade-in-up:nth-child(6) { animation-delay: 0.6s; }



        /* Stagger animation for cards */

        .animate-stagger-1 { animation-delay: 0.1s; }

        .animate-stagger-2 { animation-delay: 0.2s; }

        .animate-stagger-3 { animation-delay: 0.3s; }

        .animate-stagger-4 { animation-delay: 0.4s; }

        .animate-stagger-5 { animation-delay: 0.5s; }



        /* Hover effects */

        .hover-lift {

          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

        }



        .hover-lift:hover {

          transform: translateY(-8px);

          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);

        }



        .hover-glow {

          transition: all 0.3s ease;

        }



        .hover-glow:hover {

          box-shadow: 0 0 30px rgba(59, 130, 246, 0.3);

        }



        /* Loading animation */

        .loading-pulse {

          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

        }



        @keyframes pulse {

          0%, 100% {

            opacity: 1;

          }

          50% {

            opacity: 0.5;

          }

        }



        /* Wave animation for hero section */

        .wave-animation {

          animation: wave 6s ease-in-out infinite;

        }



        @keyframes wave {

          0%, 100% {

            transform: translateY(0);

          }

          50% {

            transform: translateY(-10px);

          }

        }



        /* Card entrance animation */

        .card-entrance {

          animation: cardEntrance 0.8s ease-out forwards;

          opacity: 0;

          transform: translateY(20px);

        }



        @keyframes cardEntrance {

          to {

            opacity: 1;

            transform: translateY(0);

          }

        }



        /* Filter toggle animation */

        .filter-toggle {

          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);

        }



        /* Button press animation */

        .btn-press {

          transition: transform 0.1s ease;

        }



        .btn-press:active {

          transform: scale(0.95);

        }



        /* Smooth page transitions */

        .page-transition {

          animation: pageTransition 0.6s ease-out forwards;

        }



        @keyframes pageTransition {

          from {

            opacity: 0;

            transform: translateY(20px);

          }

          to {

            opacity: 1;

            transform: translateY(0);

          }

        }

      `}</style>

    </div>

  );

};



export default LeaveHistory;
