import ImagePreviewDialog from '@/components/dialogs/ImagePreviewDialog';
import LeaveDetailDialog from '@/components/dialogs/LeaveDetailDialog';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiEndpoints } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useToast } from "@/hooks/use-toast";
import { differenceInCalendarDays, format } from "date-fns";
import { enUS, th } from "date-fns/locale";
import { AlertCircle, CalendarIcon, CheckCircle, ChevronLeft, ChevronRight, Clock, Eye, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { monthNames } from '../constants/common';
import { apiService } from '../lib/api';
import { showToastMessage } from '../lib/toast';
import { formatDateLocalized } from '../lib/utils';

// Note: Local inline types and helpers removed if unused

const ApproveLeave = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user, showSessionExpiredDialog } = useAuth();
  const { socket, isConnected } = useSocket();

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  // --- เพิ่ม state สำหรับ paging ---
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [historyRequests, setHistoryRequests] = useState<any[]>([]);
  // --- เพิ่ม state สำหรับ paging ---
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingRequest, setRejectingRequest] = useState<any | null>(null);
  const [dashboardStats, setDashboardStats] = useState<{
    pendingCount: number;
    approvedCount: number;
    userCount: number;
    averageDayOff: number;
    rejectedCount?: number;
  }>({
    pendingCount: 0,
    approvedCount: 0,
    userCount: 0,
    averageDayOff: 0,
  });
  const [departments, setDepartments] = useState<{ id: string; department_name_th: string; department_name_en: string }[]>([]);
  const [positions, setPositions] = useState<{ id: string; position_name_th: string; position_name_en: string }[]>([]);
  // --- เพิ่ม state สำหรับ filter เดือน/ปี (ใช้ filter จริง) ---
  const [filterMonth, setFilterMonth] = useState<number | ''>('');
  const [filterYear, setFilterYear] = useState<number | ''>('');
  // --- เพิ่ม state สำหรับ items per page ---
  const [historyLimit, setHistoryLimit] = useState(5);
  const [pendingLimit, setPendingLimit] = useState(5);
  const [pendingLeaveTypes, setPendingLeaveTypes] = useState<{ id: string; leave_type: string; leave_type_th: string; leave_type_en: string }[]>([]);
  const [pendingLeaveTypesLoading, setPendingLeaveTypesLoading] = useState(false);
  const [pendingLeaveTypesError, setPendingLeaveTypesError] = useState<string | null>(null);
  const [pendingFilterLeaveType, setPendingFilterLeaveType] = useState('');
  // --- state สำหรับ filter สถานะ ---
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // default เป็น all (All status)
  // รายชื่อเดือนรองรับ i18n
  const currentMonthNames = monthNames[i18n.language === 'th' ? 'th' : 'en'];

  // กำหนด locale สำหรับปฏิทินตามภาษาที่เลือก
  const calendarLocale = i18n.language.startsWith('th') ? th : enUS;

  // --- เพิ่ม state สำหรับ show more/less ของแต่ละ request ---
  const [expandedRejection, setExpandedRejection] = useState<{ [id: string]: boolean }>({});
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState<any | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [pendingDateRange, setPendingDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  // 1. เพิ่ม state
  const [pendingSingleDate, setPendingSingleDate] = useState<Date | undefined>(undefined);
  const [recentSingleDate, setRecentSingleDate] = useState<Date | undefined>(undefined);
  // --- เพิ่ม state สำหรับ filter ย้อนหลัง ---
  const [pendingBackdatedFilter, setPendingBackdatedFilter] = useState('all'); // all | backdated | normal
  const [historyBackdatedFilter, setHistoryBackdatedFilter] = useState('all'); // all | backdated | normal
  const [historyFilterLeaveType, setHistoryFilterLeaveType] = useState('');

  // --- เพิ่ม state สำหรับ pending filter (Recent History) ---
  const [pendingFilterMonth, setPendingFilterMonth] = useState<number | ''>('');
  const [pendingFilterYear, setPendingFilterYear] = useState<number | ''>(new Date().getFullYear());
  const [pendingHistoryStatusFilter, setPendingHistoryStatusFilter] = useState(historyStatusFilter);
  const [pendingHistoryFilterLeaveType, setPendingHistoryFilterLeaveType] = useState(historyFilterLeaveType);
  const [pendingRecentSingleDate, setPendingRecentSingleDate] = useState(recentSingleDate);
  const [pendingHistoryBackdatedFilter, setPendingHistoryBackdatedFilter] = useState(historyBackdatedFilter);


  // เพิ่ม state สำหรับ month/year - เริ่มต้นด้วยเดือนและปีปัจจุบัน
  const [pendingPendingMonth, setPendingPendingMonth] = useState<number | ''>('');
  const [pendingPendingYear, setPendingPendingYear] = useState<number | ''>(new Date().getFullYear());

  // เพิ่ม state สำหรับ pending filter ที่ยังไม่ได้ apply
  const [pendingPendingFilterLeaveType, setPendingPendingFilterLeaveType] = useState('');
  const [pendingPendingDateRange, setPendingPendingDateRange] = useState(pendingDateRange);
  const [pendingPendingSingleDate, setPendingPendingSingleDate] = useState(pendingSingleDate);
  const [pendingPendingBackdatedFilter, setPendingPendingBackdatedFilter] = useState(pendingBackdatedFilter);
  const [pendingPendingPage, setPendingPendingPage] = useState(pendingPage);

  const stats = [
    {
      title: t('admin.pendingRequests'),
      value: dashboardStats.pendingCount.toString(),
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: t('admin.allapproved'),
      value: approvedCount.toString(), // ใช้ค่าที่อัปเดตตาม filter
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: t('admin.rejected'),
      value: rejectedCount.toString(), // ใช้ค่าที่อัปเดตตาม filter
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: t('admin.totalEmployees'),
      value: dashboardStats.userCount.toString(),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
  ];



  const handleApprove = (id: string, employeeName: string) => {
    setApprovingRequest({ id, employeeName });
    setShowApproveDialog(true);
  };

  const confirmApprove = () => {
    if (!approvingRequest) return;
    const approverName = localStorage.getItem('user_name');

    apiService.put(apiEndpoints.leave.status(approvingRequest.id), {
      status: 'approved',
      statusby: approverName
    }, undefined, showSessionExpiredDialog)
      .then(data => {
        if (data.success) {
          showToastMessage.leave.requestApproved(approvingRequest.employeeName);
          setPendingRequests(prev => prev.filter(r => r.id !== approvingRequest.id));
          fetchHistoryRequests();
          refreshLeaveRequests();
        } else {
          showToastMessage.leave.requestError('', data.message);
        }
      })
      .catch(() => {
        showToastMessage.leave.requestError('');
      })
      .finally(() => {
        setShowApproveDialog(false);
        setApprovingRequest(null);
      });
  };

  const handleReject = (id: string, employeeName: string) => {
    setRejectingRequest({ id, employeeName });
    setRejectReason("");
    setShowRejectDialog(true);
  };

  const confirmReject = () => {
    if (!rejectingRequest) return;

    apiService.put(apiEndpoints.leave.status(rejectingRequest.id), {
      status: 'rejected',
      rejectedReason: rejectReason
    }, undefined, showSessionExpiredDialog)
      .then(data => {
        if (data.success) {
          showToastMessage.leave.requestRejected(rejectingRequest.employeeName);
          setPendingRequests(prev => prev.filter(r => r.id !== rejectingRequest.id));
          fetchHistoryRequests();
          refreshLeaveRequests();
        } else {
          showToastMessage.leave.requestError('', data.message);
        }
      })
      .catch(() => {
        showToastMessage.leave.requestError('');
      })
      .finally(() => {
        setShowRejectDialog(false);
        setRejectingRequest(null);
        setRejectReason("");
      });
  };

  const handleViewDetails = (request: any) => {
    setSelectedRequest(request);
    setShowDetailDialog(true);
  };

  // เพิ่มฟังก์ชันสำหรับรีเฟรชข้อมูล
  const refreshLeaveRequests = () => {
    setLoading(true);
    apiService.get(apiEndpoints.leave.pending, undefined, showSessionExpiredDialog)
      .then((data) => {
        if (data.status === "success") {
          setPendingRequests(data.data);
          setError(""); // clear error
        } else {
          setPendingRequests([]);
          setError(""); // ไม่ต้องแสดง error
        }
      })
      .catch(() => {
        setPendingRequests([]);
        setError(""); // ไม่ต้องแสดง error
      })
      .finally(() => setLoading(false));
  };

  // ปรับ fetchHistoryRequests
  const fetchHistoryRequests = () => {
    setLoading(true);
    let url = `${apiEndpoints.admin.leaveHistory}?page=${historyPage}&limit=${historyLimit}`;
    if (filterMonth) url += `&month=${filterMonth}`;
    if (filterYear) url += `&year=${filterYear}`;
    // ในการสร้าง url ให้ส่ง status=approved,rejected ถ้าเลือก all
    if (historyStatusFilter === 'all') {
      url += `&status=approved,rejected,backdated`;
    } else if (historyStatusFilter !== 'all') {
      url += `&status=${historyStatusFilter}`;
    }
    if (historyBackdatedFilter === 'backdated') url += `&backdated=1`;
    else if (historyBackdatedFilter === 'normal') url += `&backdated=0`;
    if (recentSingleDate) {
      url += `&date=${format(recentSingleDate, 'yyyy-MM-dd')}`;
    } else {
      if (dateRange.from) url += `&startDate=${format(dateRange.from, 'yyyy-MM-dd')}`;
      if (dateRange.to) url += `&endDate=${format(dateRange.to, 'yyyy-MM-dd')}`;
    }
    if (historyFilterLeaveType) url += `&leaveType=${historyFilterLeaveType}`;

    apiService.get(url, undefined, showSessionExpiredDialog)
      .then(data => {
        if (data.status === "success") {
          let filtered = data.data;
          // เรียงลำดับตาม createdAt จากใหม่ไปเก่า (ล่าสุดขึ้นก่อน)
          filtered = filtered.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          setHistoryRequests(filtered);
          setHistoryTotalPages(data.totalPages || 1);
          setApprovedCount(data.approvedCount || 0);
          setRejectedCount(data.rejectedCount || 0);
        } else {
          setHistoryRequests([]);
          setHistoryTotalPages(1);
          setApprovedCount(0);
          setRejectedCount(0);
        }
      })
      .catch(() => {
        setHistoryRequests([]);
        setHistoryTotalPages(1);
        setApprovedCount(0);
        setRejectedCount(0);
      })
      .finally(() => setLoading(false));
  };

  // โหลด leave request ที่ pending จาก API
  useEffect(() => {
    const fetchPending = async () => {
      setLoading(true);
      try {
        let url = `${apiEndpoints.admin.leavePending}?page=${pendingPage}&limit=${pendingLimit}`;
        if (pendingFilterLeaveType) url += `&leaveType=${pendingFilterLeaveType}`;
        if (pendingBackdatedFilter === 'backdated') url += `&backdated=1`;
        else if (pendingBackdatedFilter === 'normal') url += `&backdated=0`;
        if (pendingSingleDate) {
          url += `&date=${format(pendingSingleDate, 'yyyy-MM-dd')}`;
        } else {
          if (pendingDateRange.from) url += `&startDate=${format(pendingDateRange.from, 'yyyy-MM-dd')}`;
          if (pendingDateRange.to) url += `&endDate=${format(pendingDateRange.to, 'yyyy-MM-dd')}`;
        }
        // ใช้ filterMonth และ filterYear สำหรับ filter เดือน/ปี
        if (filterMonth) url += `&month=${filterMonth}`;
        if (filterYear) url += `&year=${filterYear}`;
        const data = await apiService.get(url, undefined, showSessionExpiredDialog);
        if (data.status === "success") {
          let filtered = data.data;
          // กรองย้อนหลังฝั่ง frontend ถ้า API ไม่กรองให้
          if (pendingBackdatedFilter === 'backdated') {
            filtered = filtered.filter(r => r.backdated === 1 || r.backdated === "1" || r.backdated === true);
          } else if (pendingBackdatedFilter === 'normal') {
            filtered = filtered.filter(r => r.backdated !== 1 && r.backdated !== "1" && r.backdated !== true);
          }
          setPendingRequests(filtered);
          setPendingTotalPages(data.totalPages || 1);
        } else {
          setPendingRequests([]);
          setPendingTotalPages(1);
          setError(t('admin.loadError'));
        }
      } catch (e) {
        setPendingRequests([]);
        setPendingTotalPages(1);
        setError(t('admin.connectionError'));
      } finally {
        setLoading(false);
      }
    };
    fetchPending();
  }, [t, pendingPage, pendingLimit, pendingFilterLeaveType, pendingDateRange, pendingSingleDate, pendingBackdatedFilter, filterMonth, filterYear]);

  // ตั้งค่าเริ่มต้นของ filter เดือนและปี
  useEffect(() => {
    const currentYear = new Date().getFullYear();

    // ตั้งค่าเริ่มต้นสำหรับ pending tab - เริ่มต้นเป็น all (ค่าว่าง)
    if (!pendingPendingMonth) {
      setPendingPendingMonth('');
    }
    if (!pendingPendingYear) {
      setPendingPendingYear(currentYear);
    }

    // ตั้งค่าเริ่มต้นสำหรับ history tab - เริ่มต้นเป็น all (ค่าว่าง)
    if (!pendingFilterMonth) {
      setPendingFilterMonth('');
    }
    if (!pendingFilterYear) {
      setPendingFilterYear(currentYear);
    }

    // ตั้งค่าเริ่มต้นสำหรับ filter จริง - เริ่มต้นเป็น all (ค่าว่าง)
    if (!filterMonth) {
      setFilterMonth('');
    }
    if (!filterYear) {
      setFilterYear(currentYear);
    }
  }, []);

  useEffect(() => {
    fetchHistoryRequests();
  }, [t, historyPage, filterMonth, filterYear, historyLimit, historyStatusFilter, dateRange, recentSingleDate, historyBackdatedFilter, historyFilterLeaveType]);

  useEffect(() => {
    let url = apiEndpoints.admin.dashboardStats;
    const params = [];
    if (filterMonth) params.push(`month=${filterMonth}`);
    if (filterYear) params.push(`year=${filterYear}`);
    if (params.length > 0) url += `?${params.join("&")}`;
    apiService.get(url)
      .then(data => {
        if (data.status === "success") {
          setDashboardStats(data.data);
        }
      });
  }, [filterMonth, filterYear]);

  useEffect(() => {
    // ดึง department
    const fetchDepartments = async () => {
      try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const token = currentUser?.token;
        if (!token) {
          showSessionExpiredDialog();
          return;
        }
        const data = await apiService.get(apiEndpoints.departments, undefined, showSessionExpiredDialog);
        if (data.status === 'success' && Array.isArray(data.data)) {
          setDepartments(data.data);
        }
      } catch { }
    };
    // ดึง position
    const fetchPositions = async () => {
      try {
        const data = await apiService.get(apiEndpoints.positions, undefined, showSessionExpiredDialog);
        if (data.status === 'success' && Array.isArray(data.data)) {
          setPositions(data.data);
        }
      } catch { }
    };
    fetchDepartments();
    fetchPositions();
  }, []);



  // Fetch leave types for pending filter
  useEffect(() => {
    const fetchLeaveTypes = async () => {
      setPendingLeaveTypesLoading(true);
      setPendingLeaveTypesError(null);
      try {
        const data = await apiService.get(apiEndpoints.leaveTypes);
        if (data.success) {
          setPendingLeaveTypes(data.data);
        } else {
          setPendingLeaveTypes([]);
          setPendingLeaveTypesError(data.message || 'Failed to fetch leave types');
        }
      } catch (err: any) {
        setPendingLeaveTypes([]);
        setPendingLeaveTypesError(err.message || 'Failed to fetch leave types');
      } finally {
        setPendingLeaveTypesLoading(false);
      }
    };
    fetchLeaveTypes();
  }, []);

  // --- ฟังก์ชัน apply filter ---
  const applyHistoryFilters = () => {
    setFilterMonth(pendingFilterMonth);
    setFilterYear(pendingFilterYear);
    setHistoryStatusFilter(pendingHistoryStatusFilter);
    setHistoryFilterLeaveType(pendingHistoryFilterLeaveType);
    setRecentSingleDate(pendingRecentSingleDate);
    setHistoryBackdatedFilter(pendingHistoryBackdatedFilter);
    setHistoryPage(1);
  };

  // --- ปรับ clearHistoryFilters ให้รีเซ็ต pending ด้วย ---
  const clearHistoryFilters = () => {
    const currentYear = new Date().getFullYear();
    setFilterMonth(''); // <-- reset เป็นค่าว่าง
    setFilterYear(currentYear);
    setHistoryStatusFilter('all');
    setDateRange({ from: undefined, to: undefined });
    setRecentSingleDate(undefined);
    setHistoryPage(1);
    setHistoryBackdatedFilter('all');
    setHistoryFilterLeaveType('');
    setPendingFilterMonth(''); // <-- reset เป็นค่าว่าง
    setPendingFilterYear(currentYear);
    setPendingHistoryStatusFilter('all');
    setPendingHistoryFilterLeaveType('');
    setPendingRecentSingleDate(undefined);
    setPendingHistoryBackdatedFilter('all');
  };

  // --- ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงของวันที่ ---
  const handleDateChange = (date: Date | undefined) => {
    setPendingPendingSingleDate(date);
    // เมื่อเลือกวันที่แล้ว ให้ล็อกเดือนและปี
    if (date) {
      setPendingPendingMonth(date.getMonth() + 1);
      setPendingPendingYear(date.getFullYear());
    } else {
      // เมื่อล้างวันที่แล้ว ให้ปลดล็อกเดือนและปี
      setPendingPendingMonth('');
      setPendingPendingYear(new Date().getFullYear());
    }
  };

  // --- ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงของเดือน ---
  const handleMonthChange = (month: number | '') => {
    setPendingPendingMonth(month);
    // เมื่อเลือกเดือนแล้ว ให้ล้างวันที่
    setPendingPendingSingleDate(undefined);
  };

  // --- ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงของปี ---
  const handleYearChange = (year: number | '') => {
    setPendingPendingYear(year);
    // เมื่อเลือกปีแล้ว ให้ล้างวันที่
    setPendingPendingSingleDate(undefined);
  };

  // --- ฟังก์ชัน apply filter ---
  const applyPendingFilters = () => {
    setPendingFilterLeaveType(pendingPendingFilterLeaveType);
    setPendingDateRange(pendingPendingDateRange);
    setPendingSingleDate(pendingPendingSingleDate);
    setPendingBackdatedFilter(pendingPendingBackdatedFilter);
    setPendingPage(1);
    // ใช้ pendingPendingMonth และ pendingPendingYear สำหรับ filter เดือน/ปี
    setFilterMonth(pendingPendingMonth);
    setFilterYear(pendingPendingYear);
  };

  // --- ปรับ clearPendingFilters ให้รีเซ็ต pending ด้วย ---
  const clearPendingFilters = () => {
    const currentYear = new Date().getFullYear();
    setPendingFilterLeaveType('');
    setPendingDateRange({ from: undefined, to: undefined });
    setPendingSingleDate(undefined);
    setPendingPage(1);
    setPendingBackdatedFilter('all');
    setPendingPendingFilterLeaveType('');
    setPendingPendingDateRange({ from: undefined, to: undefined });
    setPendingPendingSingleDate(undefined);
    setPendingPendingBackdatedFilter('all');
    setPendingPendingPage(1);
    setPendingPendingMonth(''); // <-- reset เป็นค่าว่าง
    setPendingPendingYear(currentYear);
    setFilterMonth(''); // <-- reset เป็นค่าว่าง
    setFilterYear(currentYear);
  };

  // Note: getLeaveTypeDisplay function moved to src/lib/leaveUtils.ts
  // Helper function for AdminDashboard specific leave type display
  const getAdminLeaveTypeDisplay = (typeIdOrName: string) => {
    if (!typeIdOrName) return '';

    // First, try to find in pendingLeaveTypes (active leave types)
    const found = pendingLeaveTypes.find(
      lt => lt.id === typeIdOrName || lt.leave_type === typeIdOrName || lt.leave_type_th === typeIdOrName || lt.leave_type_en === typeIdOrName
    );
    if (found) {
      return i18n.language.startsWith('th') ? found.leave_type_th : found.leave_type_en;
    }

    // If not found in active types, check if it's a UUID (inactive/deleted leave type)
    if (typeIdOrName.length > 20) {
      // This is likely a UUID of an inactive/deleted leave type
      return i18n.language.startsWith('th') ? t('leaveTypes.deletedLeaveType') : t('leaveTypes.deletedLeaveType');
    }

    // Fallback to translation or original value
    return String(t('leaveTypes.' + typeIdOrName, typeIdOrName));
  };

  // Add a function to fetch leave request details by ID for recent history
  const handleViewDetailsWithFetch = async (request: any) => {
    setSelectedRequest(request); // Set the request data immediately
    setShowDetailDialog(true);

    // Optionally fetch additional details from API
    try {
      const data = await apiService.get(apiEndpoints.leave.detail(request.id), undefined, showSessionExpiredDialog);
      if (data.success) {
        setSelectedRequest({ ...data.data, ...request });
      }
    } catch {
      if (import.meta.env.DEV) {
        console.error('Error fetching leave detail:', request.id);
      }
    }
  };

  // --- State สำหรับลบใบลา ---
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState<any | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // --- ฟังก์ชันลบใบลา ---
  const handleDelete = (request: any) => {
    setDeletingRequest(request);
    setShowDeleteDialog(true);
  };



  const confirmDelete = async () => {
    if (!deletingRequest) return;
    try {
      const data = await apiService.delete(apiEndpoints.leave.delete(deletingRequest.id), undefined, showSessionExpiredDialog);
      if (data.success || data.status === 'success') {
        showToastMessage.crud.deleteSuccess(t('leave.leaveRequest'), t);
        setShowDeleteDialog(false);
        setDeletingRequest(null);
        refreshLeaveRequests();
        fetchHistoryRequests();
      } else {
        showToastMessage.crud.deleteError(t('leave.leaveRequest'), data.message, t);
      }
    } catch (e) {
      showToastMessage.crud.deleteError(t('leave.leaveRequest'), undefined, t);
    }
  };

  // Socket.io event listeners for real-time updates
  useEffect(() => {
    if (socket && isConnected) {
      // Listen for leave request status changes
      socket.on('leaveRequestStatusChanged', (data) => {
        if (import.meta.env.DEV) {
          console.log('Received leave request status change:', data);
        }
        toast({
          title: t('notifications.statusChanged'),
          description: `${t('notifications.request')} ${data.requestId} ${t('notifications.hasBeen')} ${data.status === 'approved' ? t('notifications.approved') : t('notifications.rejected')}`,
          variant: 'default'
        });

        // Refresh dashboard data
        refreshLeaveRequests();
        fetchHistoryRequests();
      });

      return () => {
        socket.off('leaveRequestStatusChanged');
      };
    }
  }, [socket, isConnected, toast, t]);

  // --- Custom animation styles for this file only ---
  const customAnimationStyle = (
    <style>{`
      /* Glass morphism effect */
      .glass {
        background: rgba(255, 255, 255, 0.25);
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
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 dark:from-gray-900 dark:via-gray-950 dark:to-indigo-900 relative overflow-x-hidden">
      {customAnimationStyle}
      {/* Floating/Parallax Background Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[350px] h-[350px] rounded-full bg-gradient-to-br from-blue-200 via-indigo-100 to-purple-100 opacity-30 blur-2xl animate-float" />
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] rounded-full bg-gradient-to-tr from-purple-200 via-blue-100 to-indigo-100 opacity-20 blur-xl animate-float" />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full bg-blue-100 opacity-10 blur-xl animate-pulse" style={{ transform: 'translate(-50%,-50%)' }} />
      </div>
      {/* Topbar */}
      <div className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 relative shadow-lg animate-fade-in-up">
        <div className="flex h-16 items-center px-4 gap-4">
          <SidebarTrigger className="dark:bg-gray-800/90 dark:hover:bg-gray-700 dark:text-blue-300 dark:border-blue-700" />
          <div className="flex-1">
            <h1 className="text-xl md:text-3xl font-extrabold text-blue-900 dark:text-blue-100 tracking-tight drop-shadow-lg animate-slide-in-left">{t('navigation.adminDashboard')}</h1>
            <p className="text-xs md:text-sm text-blue-500 dark:text-blue-400 animate-slide-in-left" style={{ animationDelay: '0.2s' }}>{t('admin.dashboardDesc')}</p>

          </div>
          {/* Language Switcher at top right */}
        </div>
      </div>
      <div className="p-6 animate-fade-in-up">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={stat.title}
                  className={`glass dark:bg-gray-800/80 shadow-xl border-0 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 animate-fade-in-up hover-lift`}
                  style={{ animationDelay: `${(index + 1) * 0.1}s` }}
                >
                  <CardContent className="p-7 flex items-center gap-4">
                    <div className={`w-16 h-16 ${stat.bgColor} dark:bg-opacity-40 rounded-full flex items-center justify-center shadow-lg`}>
                      <Icon className={`w-8 h-8 ${stat.color} dark:brightness-150`} />
                    </div>
                    <div>
                      <p className="text-3xl font-extrabold text-blue-900 dark:text-blue-100 drop-shadow animate-bounce-in">{stat.value}</p>
                      <p className="text-base text-blue-500 dark:text-blue-300 font-medium animate-fade-in-up" style={{ animationDelay: '0.2s' }}>{stat.title}</p>

                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {/* Main Content */}
          <Tabs defaultValue="pending" className="space-y-6 animate-fade-in-up">
            <TabsList className="grid w-full grid-cols-2 max-w-md glass bg-white/60 backdrop-blur-lg rounded-xl shadow-lg mb-4">
              <TabsTrigger value="pending" className="text-blue-700 font-bold text-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-400 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl transition-all btn-press hover-glow">{t('admin.pendingRequests')}</TabsTrigger>
              <TabsTrigger value="recent" className="text-blue-700 font-bold text-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-400 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl transition-all btn-press hover-glow">{t('admin.recentHistory')}</TabsTrigger>
            </TabsList>
            {/* Pending Requests */}
            <TabsContent value="pending" className="space-y-4">
              {/* --- Filter UI --- */}
              <div className="grid grid-cols-2 md:flex md:flex-row flex-wrap gap-4 items-end mb-4 bg-gradient-to-r from-white/80 via-blue-50/30 to-indigo-50/30 dark:from-gray-800/80 dark:via-gray-900/80 dark:to-indigo-900/60 backdrop-blur rounded-2xl border border-blue-100 dark:border-gray-700 p-4 md:p-6 shadow-lg animate-fade-in-up" style={{ animationDelay: '0.2s' }}>

                {/* Leave Type Filter */}
                <div className="w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.3s' }}>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 animate-fade-in-up">{t('leave.leaveType')}</label>
                  <Select
                    value={pendingPendingFilterLeaveType || "all"}
                    onValueChange={(val) => setPendingPendingFilterLeaveType(val === "all" ? "" : val)}
                  >
                    <SelectTrigger className="w-full md:w-auto border-blue-200 rounded-xl px-3 py-2 min-w-[160px] dark:bg-slate-900 dark:text-white bg-white/80 backdrop-blur hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 transform hover:scale-105 animate-bounce-in btn-press">
                      <SelectValue placeholder={t('leave.allTypes', 'All Types')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('leave.allTypes', 'All Types')}</SelectItem>
                      {pendingLeaveTypes.map(lt => (
                        <SelectItem key={lt.id} value={lt.id}>{i18n.language.startsWith('th') ? lt.leave_type_th : lt.leave_type_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Date Filter */}
                <div className="w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.4s' }}>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 animate-fade-in-up">{t('common.date')}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full md:w-auto justify-start text-left font-normal border border-blue-200 rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white bg-white/80 backdrop-blur transition-all duration-300 transform hover:scale-105 animate-bounce-in btn-press ${pendingPendingMonth !== '' && !pendingPendingSingleDate
                          ? 'opacity-50 cursor-not-allowed bg-gray-100'
                          : 'hover:bg-blue-50 hover:border-blue-300'
                          }`}
                        disabled={pendingPendingMonth !== '' && !pendingPendingSingleDate}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pendingPendingSingleDate ? (
                          formatDateLocalized(pendingPendingSingleDate.toISOString(), i18n.language, true)
                        ) : (
                          <span>{t('leave.selectDate')}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={pendingPendingSingleDate}
                        onSelect={(date) => handleDateChange(date)}
                        initialFocus
                        className="rounded-md border"
                        locale={calendarLocale}
                        modifiers={{
                          today: new Date()
                        }}
                        modifiersStyles={{
                          today: { backgroundColor: '#e5e7eb', color: '#374151' }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Month Filter */}
                <div className="w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.5s' }}>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 animate-fade-in-up">{t('common.month')}</label>
                  <Select
                    value={pendingPendingMonth ? pendingPendingMonth.toString() : "all"}
                    onValueChange={(val) => handleMonthChange(val === "all" ? "" : Number(val))}
                    disabled={!!pendingPendingSingleDate}
                  >
                    <SelectTrigger className={`w-full md:w-32 border-blue-200 rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white bg-white/80 backdrop-blur transition-all duration-300 transform hover:scale-105 animate-bounce-in btn-press ${pendingPendingSingleDate
                      ? 'opacity-50 cursor-not-allowed bg-gray-100'
                      : 'hover:bg-blue-50 hover:border-blue-300'
                      }`}>
                      <SelectValue placeholder={t('common.allMonths')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.allMonths')}</SelectItem>
                      {currentMonthNames.map((name, idx) => (
                        <SelectItem key={idx + 1} value={(idx + 1).toString()}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Year Filter */}
                <div className="w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.6s' }}>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 animate-fade-in-up">{t('common.year')}</label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    className={`w-full md:w-28 border border-blue-200 rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white bg-white/80 backdrop-blur transition-all duration-300 transform hover:scale-105 animate-bounce-in btn-press ${pendingPendingSingleDate
                      ? 'opacity-50 cursor-not-allowed bg-gray-100'
                      : 'hover:bg-blue-50 hover:border-blue-300'
                      }`}
                    value={pendingPendingYear}
                    onChange={e => handleYearChange(e.target.value ? Number(e.target.value) : '')}
                    placeholder="YYYY"
                    disabled={!!pendingPendingSingleDate}
                  />
                </div>
                {/* Backdated Filter */}
                <div className="w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.7s' }}>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 animate-fade-in-up">{t('leave.backdatedFilter')}</label>
                  <Select
                    value={pendingPendingBackdatedFilter}
                    onValueChange={setPendingPendingBackdatedFilter}
                  >
                    <SelectTrigger className="w-full md:w-auto border-blue-200 rounded-xl px-3 py-2 min-w-[140px] dark:bg-slate-900 dark:text-white bg-white/80 backdrop-blur hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 transform hover:scale-105 animate-bounce-in btn-press">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('leave.allBackdated')}</SelectItem>
                      <SelectItem value="backdated">{t('leave.backdatedOnly')}</SelectItem>
                      <SelectItem value="normal">{t('leave.notBackdatedOnly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Buttons */}
                <div className="col-span-2 md:col-span-1 flex gap-3 mt-2 w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.8s' }}>
                  <button
                    className="flex-1 md:flex-none bg-gradient-to-r from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600 text-blue-900 dark:text-white px-6 py-2 rounded-xl shadow-lg hover:from-gray-300 hover:to-gray-400 dark:hover:from-slate-600 dark:hover:to-slate-500 transition-all duration-300 transform hover:scale-105 hover:shadow-xl animate-bounce-in btn-press hover-glow min-w-[100px]"
                    onClick={clearPendingFilters}
                    type="button"
                  >
                    {t('common.reset')}
                  </button>
                  <button
                    className="flex-1 md:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-xl shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 hover:shadow-xl animate-bounce-in btn-press hover-glow min-w-[100px]"
                    onClick={applyPendingFilters}
                    type="button"
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              </div>
              <Card className="glass shadow-2xl border-0 animate-fade-in-up">
                <CardHeader className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400 text-white rounded-t-2xl p-5 shadow-lg">
                  <CardTitle className="flex items-center gap-3 text-2xl font-bold animate-slide-in-left">
                    <AlertCircle className="w-6 h-6" />
                    {t('admin.pendingLeaveRequests')}
                  </CardTitle>
                  <CardDescription className="text-white text-sm animate-slide-in-left" style={{ animationDelay: '0.1s' }}>
                    {t('admin.pendingLeaveRequestsDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="text-lg text-center py-10 loading-pulse">{t('common.loading')}</div>
                  ) : error ? (
                    <div className="text-lg text-center py-10 text-red-500 animate-fade-in-up">{error}</div>
                  ) : (
                    <div className="space-y-4 p-6">
                      {pendingRequests.length === 0 && (
                        <div className="text-center text-gray-500 dark:text-gray-400 text-base py-8 animate-fade-in-up">
                          {t('admin.noPendingRequests')}
                        </div>
                      )}
                      {pendingRequests.map((request, idx) => (
                        <div
                          key={request.id}
                          className={`glass bg-gradient-to-br from-white/80 via-blue-50/80 to-indigo-100/80 border-0 rounded-2xl p-5 shadow-md hover:shadow-xl transition-all flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 animate-fade-in-up hover-lift`}
                          style={{ animationDelay: `${0.1 + idx * 0.07}s` }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-lg text-blue-900 dark:text-white mb-1 truncate animate-slide-in-left">
                              {(() => {
                                const userName = typeof request.user === "string" ? JSON.parse(request.user).name : request.user?.name;
                                return userName === 'deleted_user' ? t('admin.deletedUser') : (userName || "-");
                              })()}
                            </div>
                            {/* ประเภทการลา (leaveType) */}
                            <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mb-1 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                              {request.leaveTypeName_th && request.leaveTypeName_en
                                ? (i18n.language.startsWith('th') ? request.leaveTypeName_th : request.leaveTypeName_en)
                                : getAdminLeaveTypeDisplay(request.leaveType || request.leaveTypeName)
                              }
                            </span>
                            <Badge className="ml-2 bg-yellow-100 text-yellow-700 border-yellow-200 rounded-full px-3 py-1 text-xs font-bold shadow animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                              {t('admin.pending')}
                            </Badge>
                            {(request.backdated === 1 || request.backdated === "1" || request.backdated === true) && (
                              <Badge className="ml-2 bg-purple-100 text-purple-800 border-purple-200 rounded-full px-3 py-1 text-xs font-bold shadow animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
                                {t('leave.backdated')}
                              </Badge>
                            )}
                            <div className="text-sm text-gray-700 dark:text-gray-200 mb-1 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>{t('leave.date')}: {request.startDate} - {request.endDate}</div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 w-full lg:w-auto">
                            <Button
                              size="sm"
                              className="flex-1 sm:flex-none rounded-full px-4 py-2 font-bold bg-gradient-to-r from-green-500 to-emerald-400 text-white shadow hover:scale-105 transition animate-bounce-in btn-press hover-glow"
                              onClick={() => handleApprove(request.id, typeof request.user === "string" ? JSON.parse(request.user).name : request.user?.name || "")}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />{t('admin.approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1 sm:flex-none rounded-full px-4 py-2 font-bold shadow hover:scale-105 transition animate-bounce-in btn-press hover-glow"
                              onClick={() => handleReject(request.id, typeof request.user === "string" ? JSON.parse(request.user).name : request.user?.name || "")}
                            >
                              <XCircle className="w-4 h-4 mr-1" />{t('admin.reject')}
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 sm:flex-none rounded-full px-4 py-2 font-bold border-blue-200 text-blue-700 hover:bg-blue-50 shadow animate-bounce-in btn-press hover-glow" onClick={() => handleViewDetails(request)}>
                              <Eye className="w-4 h-4 mr-1" />{t('admin.viewDetails')}
                            </Button>
                          </div>
                        </div>
                      ))}
                      {/* --- ปุ่มเปลี่ยนหน้า --- */}
                      {(pendingTotalPages >= 1 || pendingRequests.length > 0) && (
                        <div className="flex flex-col lg:flex-row justify-center items-center mt-8 gap-4 p-6 bg-gradient-to-r from-white/80 via-blue-50/30 to-indigo-50/30 dark:from-gray-800/60 dark:via-gray-900/60 dark:to-indigo-900/40 backdrop-blur rounded-2xl border border-blue-100 dark:border-gray-700 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                          {/* Pagination Info */}
                          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span>{t('admin.pageInfo', { page: pendingPage || 1, totalPages: pendingTotalPages || 1 })}</span>
                            </div>
                            <div className="w-px h-4 bg-gray-300"></div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>{pendingRequests.length} {t('admin.results')}</span>
                            </div>
                          </div>

                          {/* Pagination Controls */}
                          {pendingTotalPages > 1 && (
                            <div className="flex items-center gap-2">
                              {/* Previous Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPendingPage(Math.max(1, pendingPage - 1))}
                                disabled={pendingPage === 1}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 transform hover:scale-105 hover:shadow-md btn-press"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </Button>

                              {/* Page Numbers */}
                              <div className="flex items-center gap-0.5 sm:gap-1">
                                {(() => {
                                  const pages = [];
                                  const maxPageButtons = 3; // Reduced from 5 for narrow screens
                                  let start = Math.max(1, pendingPage - 2);
                                  const end = Math.min(pendingTotalPages, start + maxPageButtons - 1);
                                  if (end - start < maxPageButtons - 1) {
                                    start = Math.max(1, end - maxPageButtons + 1);
                                  }
                                  if (start > 1) {
                                    pages.push(
                                      <Button
                                        key={1}
                                        variant={pendingPage === 1 ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setPendingPage(1)}
                                        className={`rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-md ${pendingPage === 1 ? 'bg-blue-600 text-white' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                                      >
                                        1
                                      </Button>
                                    );
                                    if (start > 2) pages.push(
                                      <span key="start-ellipsis" className="px-1 text-gray-400 text-xs">...</span>
                                    );
                                  }
                                  for (let i = start; i <= end; i++) {
                                    pages.push(
                                      <Button
                                        key={i}
                                        variant={pendingPage === i ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setPendingPage(i)}
                                        className={`rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-md ${pendingPage === i ? 'bg-blue-600 text-white' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                                      >
                                        {i}
                                      </Button>
                                    );
                                  }
                                  if (end < pendingTotalPages) {
                                    if (end < pendingTotalPages - 1) pages.push(
                                      <span key="end-ellipsis" className="px-1 text-gray-400 text-xs">...</span>
                                    );
                                    pages.push(
                                      <Button
                                        key={pendingTotalPages}
                                        variant={pendingPage === pendingTotalPages ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setPendingPage(pendingTotalPages)}
                                        className={`rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-md ${pendingPage === pendingTotalPages ? 'bg-blue-600 text-white' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                                      >
                                        {pendingTotalPages}
                                      </Button>
                                    );
                                  }
                                  return pages;
                                })()}
                              </div>

                              {/* Next Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPendingPage(Math.min(pendingTotalPages, pendingPage + 1))}
                                disabled={pendingPage === pendingTotalPages}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 transform hover:scale-105 hover:shadow-md btn-press"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          )}

                          {/* Items per page select */}
                          <div className="flex items-center gap-2">
                            <Select
                              value={pendingLimit.toString()}
                              onValueChange={(value) => {
                                setPendingLimit(Number(value));
                                setPendingPage(1);
                              }}
                            >
                              <SelectTrigger className="w-20 bg-white/80 backdrop-blur border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 rounded-xl h-9 transform hover:scale-105 hover:shadow-md">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-0 shadow-xl rounded-2xl">
                                {[5, 10, 20, 50].map(n => (
                                  <SelectItem key={n} value={n.toString()} className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">{n}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-gray-600 dark:text-gray-300">{t('admin.itemsPerPage')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            {/* History Requests */}
            <TabsContent value="recent" className="space-y-4">
              {/* --- Filter UI สำหรับประวัติการอนุมัติล่าสุด --- */}
              <div className="grid grid-cols-2 md:flex md:flex-row flex-wrap gap-4 items-end mb-4 bg-gradient-to-r from-white/80 via-blue-50/30 to-indigo-50/30 dark:from-gray-800/80 dark:via-gray-900/80 dark:to-indigo-900/60 dark:border-gray-700 backdrop-blur rounded-2xl border border-blue-100 p-4 md:p-6 shadow-lg animate-fade-in-up" style={{ animationDelay: '0.2s' }}>

                {/* Leave Type Filter */}
                <div className="w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.3s' }}>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 animate-fade-in-up">{t('leave.leaveType')}</label>
                  <Select
                    value={pendingHistoryFilterLeaveType || "all"}
                    onValueChange={(val) => setPendingHistoryFilterLeaveType(val === "all" ? "" : val)}
                  >
                    <SelectTrigger className="w-full md:w-auto border-blue-200 rounded-xl px-3 py-2 min-w-[160px] dark:bg-slate-900 dark:text-white bg-white/80 backdrop-blur hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 transform hover:scale-105 animate-bounce-in btn-press">
                      <SelectValue placeholder={t('leave.allTypes', 'All Types')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('leave.allTypes', 'All Types')}</SelectItem>
                      {pendingLeaveTypes.map(lt => (
                        <SelectItem key={lt.id} value={lt.id}>{i18n.language.startsWith('th') ? lt.leave_type_th : lt.leave_type_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Month Filter */}
                <div className="w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.5s' }}>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 animate-fade-in-up">{t('common.month')}</label>
                  <Select
                    value={pendingFilterMonth ? pendingFilterMonth.toString() : "all"}
                    onValueChange={(val) => setPendingFilterMonth(val === "all" ? "" : Number(val))}
                  >
                    <SelectTrigger className="w-full md:w-32 border-blue-200 rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white bg-white/80 backdrop-blur hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 transform hover:scale-105 animate-bounce-in btn-press">
                      <SelectValue placeholder={t('common.allMonths')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.allMonths')}</SelectItem>
                      {currentMonthNames.map((name, idx) => (
                        <SelectItem key={idx + 1} value={(idx + 1).toString()}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Year Filter */}
                <div className="w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.6s' }}>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 animate-fade-in-up">{t('common.year')}</label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    className="w-full md:w-28 border border-blue-200 rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white bg-white/80 backdrop-blur hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 transform hover:scale-105 animate-bounce-in btn-press"
                    value={pendingFilterYear}
                    onChange={e => setPendingFilterYear(e.target.value ? Number(e.target.value) : '')}
                    placeholder="YYYY"
                  />
                </div>
                {/* Backdated Filter */}
                <div className="w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.7s' }}>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 animate-fade-in-up">{t('leave.backdatedFilter')}</label>
                  <Select
                    value={pendingHistoryBackdatedFilter}
                    onValueChange={setPendingHistoryBackdatedFilter}
                  >
                    <SelectTrigger className="w-full md:w-auto border-blue-200 rounded-xl px-3 py-2 min-w-[140px] dark:bg-slate-900 dark:text-white bg-white/80 backdrop-blur hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 transform hover:scale-105 animate-bounce-in btn-press">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('leave.allBackdated')}</SelectItem>
                      <SelectItem value="backdated">{t('leave.backdatedOnly')}</SelectItem>
                      <SelectItem value="normal">{t('leave.notBackdatedOnly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Status Filter */}
                <div className="w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.8s' }}>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 animate-fade-in-up">{t('common.status')}</label>
                  <Select
                    value={pendingHistoryStatusFilter}
                    onValueChange={setPendingHistoryStatusFilter}
                  >
                    <SelectTrigger className="w-full md:w-auto border-blue-200 rounded-xl px-3 py-2 min-w-[120px] dark:bg-slate-900 dark:text-white bg-white/80 backdrop-blur hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 transform hover:scale-105 animate-bounce-in btn-press">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('leave.statusAll')}</SelectItem>
                      <SelectItem value="approved">{t('leave.approved')}</SelectItem>
                      <SelectItem value="rejected">{t('leave.rejected')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Buttons */}
                <div className="col-span-2 md:col-span-1 flex gap-3 mt-2 w-full md:w-auto animate-slide-in-left" style={{ animationDelay: '0.9s' }}>
                  <button
                    className="flex-1 md:flex-none bg-gradient-to-r from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600 text-blue-900 dark:text-white px-6 py-2 rounded-xl shadow-lg hover:from-gray-300 hover:to-gray-400 dark:hover:from-slate-600 dark:hover:to-slate-500 transition-all duration-300 transform hover:scale-105 hover:shadow-xl animate-bounce-in btn-press hover-glow min-w-[100px]"
                    onClick={clearHistoryFilters}
                    type="button"
                  >
                    {t('common.reset')}
                  </button>
                  <button
                    className="flex-1 md:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-xl shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 hover:shadow-xl animate-bounce-in btn-press hover-glow min-w-[100px]"
                    onClick={applyHistoryFilters}
                    type="button"
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              </div>
              <Card className="glass shadow-2xl border-0 animate-fade-in-up">
                <CardHeader className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400 text-white rounded-t-2xl p-5 shadow-lg">
                  <CardTitle className="flex items-center gap-3 text-2xl font-bold animate-slide-in-left">
                    <Clock className="w-6 h-6" />
                    {t('admin.recentApprovalHistory')}
                  </CardTitle>
                  <CardDescription className="text-white text-sm animate-slide-in-left" style={{ animationDelay: '0.1s' }}>
                    {t('admin.recentApprovalHistoryDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="text-lg text-center py-10 loading-pulse">{t('common.loading')}</div>
                  ) : (
                    <div className="space-y-4 p-6">
                      {historyRequests.length === 0 && (
                        <div className="text-center text-gray-500 text-base py-8 animate-fade-in-up">
                          {t('admin.noApprovalHistory')}
                        </div>
                      )}
                      {historyRequests.sort((a, b) => {
                        const dateA = new Date(a.createdAt || a.startDate || 0).getTime();
                        const dateB = new Date(b.createdAt || b.startDate || 0).getTime();
                        return dateB - dateA;
                      }).map((request, idx) => {
                        // Format date
                        const startStr = request.startDate;
                        const endStr = request.endDate;
                        const leaveDays = request.startDate && request.endDate ? differenceInCalendarDays(new Date(request.endDate), new Date(request.startDate)) + 1 : '-';
                        return (
                          <div
                            key={request.id}
                            className={`relative glass bg-gradient-to-br from-white/80 via-blue-50/80 to-indigo-100/80 border-0 rounded-2xl p-5 shadow-md hover:shadow-xl transition-all flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 animate-fade-in-up hover-lift`}
                            style={{ animationDelay: `${0.1 + idx * 0.07}s` }}
                          >
                            {/* ย้ายสถานะมาอยู่ข้างประเภทการลา */}
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-lg text-blue-900 dark:text-white mb-1 truncate animate-slide-in-left">
                                {request.user?.name === 'deleted_user' ? t('admin.deletedUser') : (request.user?.name || "-")}
                              </div>
                              {/* ประเภทการลา (leaveType) */}
                              <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mb-1 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                                {request.leaveTypeName_th && request.leaveTypeName_en
                                  ? (i18n.language.startsWith('th') ? request.leaveTypeName_th : request.leaveTypeName_en)
                                  : getAdminLeaveTypeDisplay(request.leaveType || request.leaveTypeName)
                                }
                              </span>
                              {request.status === "approved" ? (
                                <Badge className="ml-2 bg-green-100 text-green-800 border-green-200 rounded-full px-3 py-1 text-xs font-bold shadow inline-flex items-center animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> {t('admin.approved')}
                                </Badge>
                              ) : (
                                <Badge className="ml-2 bg-red-100 text-red-800 border-red-200 rounded-full px-3 py-1 text-xs font-bold shadow inline-flex items-center animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> {t('admin.rejected')}
                                </Badge>
                              )}
                              {(request.backdated === 1 || request.backdated === "1" || request.backdated === true) && (
                                <Badge className="ml-2 bg-purple-100 text-purple-800 border-purple-200 rounded-full px-3 py-1 text-xs font-bold shadow animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                                  {t('leave.backdated')}
                                </Badge>
                              )}
                              <div className="text-sm text-gray-700 dark:text-gray-200 mb-1 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>{t('leave.date')}: {startStr} - {endStr} ({leaveDays} {t('leave.days')})</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 animate-fade-in-up break-words" style={{ animationDelay: '0.4s' }}>
                                {t('leave.reason')}: {request.reason && request.reason.length > 50
                                  ? request.reason.slice(0, 50) + '...'
                                  : request.reason || '-'
                                }
                              </div>
                            </div>
                            {/* ปุ่มดูรายละเอียดและลบ */}
                            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 mt-2 lg:mt-0 w-full lg:w-auto">
                              <Button size="sm" variant="outline" className="flex-1 sm:flex-none rounded-full px-4 py-2 font-bold border-blue-200 text-blue-700 hover:bg-blue-50 shadow animate-bounce-in btn-press hover-glow" onClick={() => handleViewDetailsWithFetch(request)}>
                                <Eye className="w-4 h-4 mr-1" />{t('admin.viewDetails')}
                              </Button>
                              {user?.role === 'superadmin' && (
                                <Button size="sm" variant="destructive" className="flex-1 sm:flex-none rounded-full px-4 py-2 font-bold shadow hover:scale-105 transition animate-bounce-in btn-press hover-glow" onClick={() => handleDelete(request)}>
                                  <XCircle className="w-4 h-4 mr-1" />{t('common.delete')}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {/* --- ปุ่มเปลี่ยนหน้า --- */}
                      {(historyTotalPages >= 1 || historyRequests.length > 0) && (
                        <div className="flex flex-col lg:flex-row justify-center items-center mt-8 gap-4 p-6 bg-gradient-to-r from-white/80 via-blue-50/30 to-indigo-50/30 dark:from-gray-800/60 dark:via-gray-900/60 dark:to-indigo-900/40 backdrop-blur rounded-2xl border border-blue-100 dark:border-gray-700 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                          {/* Pagination Info */}
                          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span>{t('admin.pageInfo', { page: historyPage || 1, totalPages: historyTotalPages || 1 })}</span>
                            </div>
                            <div className="w-px h-4 bg-gray-300"></div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>{historyRequests.length} {t('admin.results')}</span>
                            </div>
                          </div>

                          {/* Pagination Controls */}
                          {historyTotalPages > 1 && (
                            <div className="flex items-center gap-2">
                              {/* Previous Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
                                disabled={historyPage === 1}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 transform hover:scale-105 hover:shadow-md btn-press"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </Button>

                              {/* Page Numbers */}
                              <div className="flex items-center gap-0.5 sm:gap-1">
                                {(() => {
                                  const pages = [];
                                  const maxPageButtons = 3; // Reduced from 5 for narrow screens
                                  let start = Math.max(1, historyPage - 2);
                                  const end = Math.min(historyTotalPages, start + maxPageButtons - 1);
                                  if (end - start < maxPageButtons - 1) {
                                    start = Math.max(1, end - maxPageButtons + 1);
                                  }
                                  if (start > 1) {
                                    pages.push(
                                      <Button
                                        key={1}
                                        variant={historyPage === 1 ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setHistoryPage(1)}
                                        className={`rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-md ${historyPage === 1 ? 'bg-blue-600 text-white' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                                      >
                                        1
                                      </Button>
                                    );
                                    if (start > 2) pages.push(
                                      <span key="start-ellipsis" className="px-1 text-gray-400 text-xs">...</span>
                                    );
                                  }
                                  for (let i = start; i <= end; i++) {
                                    pages.push(
                                      <Button
                                        key={i}
                                        variant={historyPage === i ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setHistoryPage(i)}
                                        className={`rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-md ${historyPage === i ? 'bg-blue-600 text-white' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                                      >
                                        {i}
                                      </Button>
                                    );
                                  }
                                  if (end < historyTotalPages) {
                                    if (end < historyTotalPages - 1) pages.push(
                                      <span key="end-ellipsis" className="px-1 text-gray-400 text-xs">...</span>
                                    );
                                    pages.push(
                                      <Button
                                        key={historyTotalPages}
                                        variant={historyPage === historyTotalPages ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setHistoryPage(historyTotalPages)}
                                        className={`rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-md ${historyPage === historyTotalPages ? 'bg-blue-600 text-white' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                                      >
                                        {historyTotalPages}
                                      </Button>
                                    );
                                  }
                                  return pages;
                                })()}
                              </div>

                              {/* Next Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryPage(Math.min(historyTotalPages, historyPage + 1))}
                                disabled={historyPage === historyTotalPages}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 transform hover:scale-105 hover:shadow-md btn-press"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          )}

                          {/* Items per page select */}
                          <div className="flex items-center gap-2">
                            <Select
                              value={historyLimit.toString()}
                              onValueChange={(value) => {
                                setHistoryLimit(Number(value));
                                setHistoryPage(1);
                              }}
                            >
                              <SelectTrigger className="w-20 bg-white/80 backdrop-blur border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300 rounded-xl h-9 transform hover:scale-105 hover:shadow-md">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-0 shadow-xl rounded-2xl">
                                {[5, 10, 20, 50].map(n => (
                                  <SelectItem key={n} value={n.toString()} className="rounded-lg transition-all duration-200 hover:bg-blue-50 hover:scale-105">{n}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-gray-600 dark:text-gray-300">{t('admin.itemsPerPage')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Leave Detail Dialog */}
      <LeaveDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        leaveRequest={selectedRequest}
      />

      {previewImage && (
        <ImagePreviewDialog
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          imageUrl={previewImage.url}
          imageName={previewImage.name}
          title={t('leave.attachmentPreview')}
        />
      )}

      {/* Dialog สำหรับป้อนเหตุผลไม่อนุมัติ */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.rejectReasonTitle')}</DialogTitle>
          </DialogHeader>
          <textarea
            className="w-full border rounded p-2 mt-2 break-all overflow-wrap-anywhere whitespace-pre-wrap"
            rows={3}
            placeholder={t('admin.rejectReasonPlaceholder')}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <DialogFooter className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>{t('common.back')}</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectReason.trim()}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog สำหรับยืนยันการอนุมัติ */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.approveConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.approveConfirmDesc', { name: approvingRequest?.employeeName || '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>{t('common.cancel')}</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={confirmApprove}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog สำหรับยืนยันการลบ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('system.confirmDeleteLeave')}</DialogTitle>
            <DialogDescription>
              {t('system.confirmDeleteLeaveDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={confirmDelete}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApproveLeave;