import AvatarCropDialog from '@/components/dialogs/AvatarCropDialog';
import { LeaveDetailDialog } from "@/components/dialogs/LeaveDetailDialog";
import PaginationBar from "@/components/PaginationBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiEndpoints } from '@/constants/api';
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { withCacheBust } from '@/lib/url';
import { LeaveRequest } from '@/types';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Calendar, Camera, ChevronLeft, Edit, Eye, Mail, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { API_BASE_URL, apiService } from '../lib/api';
import { logger } from '@/lib/logger';

const EmployeeDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user, showSessionExpiredDialog } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    full_name: '',
    email: '',
    password: '',
    department: '',
    position: '',
    role: '',
    gender: '',
    birthdate: '',
    phone: '',
    startWorkDate: '',
    internStartDate: '',
    internEndDate: ''
  });

  // เพิ่ม state สำหรับข้อมูลจริง
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [leaveSummary, setLeaveSummary] = useState<{ days: number, hours: number, totalLeaveDays: number } | null>(null); // <--- เพิ่ม state
  // เพิ่ม state สำหรับ processCheckId
  const [processCheckId, setProcessCheckId] = useState(null);
  const [departments, setDepartments] = useState<{ id: string; department_name: string; department_name_en?: string; department_name_th?: string }[]>([]);
  const [positions, setPositions] = useState<{ id: string; position_name: string; position_name_en?: string; position_name_th?: string }[]>([]);
  // --- เพิ่ม state สำหรับ paging ---
  const [leavePage, setLeavePage] = useState(1);
  const [leaveTotalPages, setLeaveTotalPages] = useState(1);

  // --- State สำหรับ Filter ---
  // state สำหรับค่าที่เลือกในฟิลเตอร์ (pending)
  const [pendingFilterType, setPendingFilterType] = useState("all");
  const [pendingFilterMonth, setPendingFilterMonth] = useState("all");
  const [pendingFilterYear, setPendingFilterYear] = useState("all");
  const [pendingFilterStatus, setPendingFilterStatus] = useState("all");
  const [pendingFilterBackdated, setPendingFilterBackdated] = useState("all"); // เพิ่ม state สำหรับ backdated
  // state สำหรับค่าฟิลเตอร์ที่ใช้งานจริง (active)
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBackdated, setFilterBackdated] = useState("all"); // เพิ่ม state สำหรับ backdated
  // state สำหรับ error ของ filter
  const [filterError, setFilterError] = useState("");
  // state สำหรับแสดง * สีแดงแต่ละ filter
  const [showTypeError, setShowTypeError] = useState(false);
  const [showMonthError, setShowMonthError] = useState(false);
  const [showYearError, setShowYearError] = useState(false);
  const [showStatusError, setShowStatusError] = useState(false);
  // state สำหรับข้อความแจ้งเตือน filter
  const [filterWarning, setFilterWarning] = useState("");

  // Avatar edit states
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarPreviewSrc, setAvatarPreviewSrc] = useState<string | null>(null);
  const [avatarLocalGif, setAvatarLocalGif] = useState<File | null>(null);
  const [avatarKey, setAvatarKey] = useState(0); // Add key to force re-render
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now()); // Add timestamp for cache busting

  // เพิ่ม state สำหรับ force render เมื่อเปลี่ยนภาษา
  const [langVersion, setLangVersion] = useState(0);

  // --- สร้างรายการปี (ย้อนหลัง 3 ปี) ---
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  // --- กรอง leaveHistory ตาม filter ---
  // ลบ useMemo เดิมออก ไม่ต้อง filter ฝั่ง frontend แล้ว

  // --- Move fetch leave history logic to a function ---
  const fetchLeaveHistory = async () => {
    if (!id) return;
    const params = [];
    if (filterType && filterType !== "all") params.push(`leaveType=${encodeURIComponent(filterType)}`);
    if (filterMonth && filterMonth !== "all" && filterYear && filterYear !== "all") {
      params.push(`month=${filterMonth}`);
      params.push(`year=${filterYear}`);
    } else if (filterYear && filterYear !== "all") {
      params.push(`year=${filterYear}`);
    }
    if (filterStatus && filterStatus !== "all") params.push(`status=${filterStatus}`);
    if (filterBackdated && filterBackdated !== "all") params.push(`backdated=${filterBackdated}`); // เพิ่ม backdated เข้า params
    params.push(`page=${leavePage}`);
    params.push(`limit=6`);
    const query = params.length > 0 ? `?${params.join("&")}` : "";

    // เพิ่ม debug log
    if (import.meta.env.DEV) {
      logger.debug('🔍 Fetching leave history with params:', params);
      logger.debug('🔍 filterBackdated value:', filterBackdated);
      logger.debug('🔍 Full URL:', `${API_BASE_URL}${apiEndpoints.employees.leaveHistory(id, query)}`);
    }

    try {
      const data = await apiService.get(apiEndpoints.employees.leaveHistory(id, query));
      // เพิ่ม log เพื่อตรวจสอบ response
      if (import.meta.env.DEV) {
        logger.debug('🟢 Leave history API response:', data);
      }
      if (data.success) {
        // แก้ตรงนี้: data.data.data
        const leaveData = Array.isArray(data.data?.data) ? data.data.data : [];
        setLeaveHistory(leaveData);
        setLeaveTotalPages(data.data?.totalPages || 1);
        setLeaveSummary(data.data?.summary || null); // <--- เก็บ summary
      } else {
        // เพิ่ม log กรณี error
        if (import.meta.env.DEV) {
          logger.error('🔴 Leave history API error:', data);
        }
        setLeaveHistory([]);
        setLeaveTotalPages(1);
        setLeaveSummary(null); // <--- reset summary
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.error('Error fetching leave history:', error);
      }
      setLeaveHistory([]);
      setLeaveTotalPages(1);
      setLeaveSummary(null); // <--- reset summary
    }
  };

  // useEffect สำหรับ fetch leaveHistory เฉพาะเมื่อ filter จริง (active) เปลี่ยน
  useEffect(() => {
    // เพิ่ม debug log
    if (import.meta.env.DEV) {
      logger.debug('🔄 useEffect triggered');
      logger.debug('🔄 filterBackdated:', filterBackdated);
      logger.debug('🔄 filterType:', filterType);
      logger.debug('🔄 filterStatus:', filterStatus);
    }

    fetchLeaveHistory();
    // eslint-disable-next-line
  }, [id, t, filterType, filterMonth, filterYear, filterStatus, filterBackdated, leavePage]);

  // ลบ filteredLeaveHistory ออก

  const resetFilters = () => {
    setPendingFilterType("all");
    setPendingFilterMonth("all");
    setPendingFilterYear("all");
    setPendingFilterStatus("all");
    setPendingFilterBackdated("all"); // reset backdated
    setShowTypeError(false);
    setShowMonthError(false);
    setShowYearError(false);
    setShowStatusError(false);
    setFilterError("");
    setFilterWarning(""); // reset warning
    setFilterType("all");
    setFilterMonth("all");
    setFilterYear("all");
    setFilterStatus("all");
    setFilterBackdated("all"); // reset backdated
  };

  useEffect(() => {
    const fetchDeps = async () => {
      try {
        const deptData = await apiService.get(apiEndpoints.departments, undefined, showSessionExpiredDialog);
        setDepartments(Array.isArray(deptData.data) ? deptData.data : []);
        const posData = await apiService.get(apiEndpoints.positions, undefined, showSessionExpiredDialog);
        setPositions(Array.isArray(posData.data) ? posData.data : []);
      } catch {
        setDepartments([]);
        setPositions([]);
      }
    };
    fetchDeps();
  }, []);

  // --- เพิ่ม state สำหรับ leave types dropdown ---
  const [leaveTypes, setLeaveTypes] = useState<{ id: string; leave_type: string; leave_type_th: string; leave_type_en: string }[]>([]);
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(false);
  const [leaveTypesError, setLeaveTypesError] = useState<string | null>(null);

  // Fetch leave types from backend
  useEffect(() => {
    const fetchLeaveTypes = async () => {
      setLeaveTypesLoading(true);
      setLeaveTypesError(null);
      try {
        const data = await apiService.get(apiEndpoints.leaveTypes);
        if (data.success) {
          setLeaveTypes(data.data);
        } else {
          setLeaveTypes([]);
          setLeaveTypesError(data.message || t('common.error'));
        }
      } catch (err: any) {
        setLeaveTypes([]);
        setLeaveTypesError(err.message || t('common.error'));
      } finally {
        setLeaveTypesLoading(false);
      }
    };
    fetchLeaveTypes();
  }, []);

  // useEffect สำหรับเปลี่ยนภาษาแล้ว force render dropdown label
  useEffect(() => {
    setLangVersion(v => v + 1);
  }, [i18n.language]);

  // อ่าน role จาก query string
  const queryParams = new URLSearchParams(location.search);
  const role = queryParams.get("role");

  const handleEdit = () => {
    // Prevent admin from editing superadmin
    if (user?.role === 'admin' && (employee?.role === 'superadmin' || role === 'superadmin')) {
      toast({
        title: t('error.title'),
        description: t('employee.adminCannotEditSuperadmin'),
        variant: 'destructive',
      });
      return;
    }
    setEditData({
      full_name: employee?.name || '',
      email: employee?.email || '',
      password: '', // Always blank when editing
      department: (employee?.department_id || employee?.department?.id || '') + '',
      position: (employee?.position_id || employee?.position?.id || '') + '',
      role: employee?.role || '',
      gender: employee?.gender || '',
      birthdate: employee?.dob || '', // <-- เปลี่ยนจาก birthdate เป็น dob
      phone: employee?.phone_number || '', // <-- เปลี่ยนจาก phone เป็น phone_number
      startWorkDate: employee?.start_work || '', // <-- ใช้คอลัมน์จริงจาก DB
      internStartDate: employee?.start_work || '', // Intern ใช้ start_work เป็นวันเริ่มฝึกงาน
      internEndDate: employee?.end_work || '' // Intern ใช้ end_work เป็นวันสิ้นสุดฝึกงาน
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const payload: any = {
        name: editData.full_name,
        position_id: editData.position, // id
        department_id: editData.department, // id
        email: editData.email,
        gender: editData.gender,
        birthdate: editData.birthdate,
        phone: editData.phone,
        // ถ้าเป็น Intern ให้ส่ง startWorkDate จาก internStartDate และแนบ endWorkDate ด้วย
        startWorkDate: isInternPosition() ? editData.internStartDate : editData.startWorkDate,
        ...(isInternPosition() ? { endWorkDate: editData.internEndDate } : {}),
      };
      if (editData.password && editData.password.trim() !== '') payload.password = editData.password;
      const data = await apiService.put(apiEndpoints.employees.detail(id), payload);
      if (data.success) {
        toast({
          title: t('employee.saveSuccess'),
          description: t('employee.updateSuccess'),
        });
        setIsEditing(false);
        // Refresh profile data
        const empData = await apiService.get(apiEndpoints.employees.detail(id));
        if (empData.success) setEmployee(empData.data);
      } else {
        toast({ title: t('error.title'), description: data.message || t('employee.saveError') });
      }
    } catch (err) {
      toast({ title: t('error.title'), description: t('employee.saveError') });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({
      full_name: '',
      email: '',
      password: '',
      department: '',
      position: '',
      role: '',
      gender: '',
      birthdate: '',
      phone: '',
      startWorkDate: '',
      internStartDate: '',
      internEndDate: ''
    });
  };

  const handleViewLeaveDetails = async (leave) => {
    if (import.meta.env.DEV) {
      logger.debug('View Details clicked. leave:', leave, 'leave.id:', leave.id);
    }

    // First try to use the existing leave data
    const leaveData = leaveHistory.find(l => l.id === leave.id);
    if (leaveData) {
      setSelectedLeave(leaveData);
      setLeaveDialogOpen(true);
      return;
    }

    // If not found in existing data, try to fetch from API
    setSelectedLeave(null);
    setLeaveDialogOpen(true);

    try {
      const data = await apiService.get(apiEndpoints.leave.detail(leave.id), undefined, showSessionExpiredDialog);
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

  // เพิ่มฟังก์ชันนี้ด้านบน component
  const getLeaveTypeLabel = (typeId: string) => {
    const found = leaveTypes.find(lt => lt.id === typeId || lt.leave_type === typeId);
    if (!found) return typeId;
    return i18n.language.startsWith('th') ? found.leave_type_th : found.leave_type_en;
  };

  // ฟังก์ชันตรวจสอบว่าลาย้อนหลังหรือไม่
  const isBackdatedLeave = (leave) => {
    // ใช้ค่า backdated จาก backend แทนการคำนวณจากวันที่
    return Number(leave.backdated) === 1;
  };

  const [deleteLeaveId, setDeleteLeaveId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- Add delete handler ---
  const handleDeleteLeave = async () => {
    if (!deleteLeaveId) return;
    setDeleting(true);
    try {
      const data = await apiService.delete(apiEndpoints.leave.delete(deleteLeaveId), undefined, showSessionExpiredDialog);
      if (data && (data.success || data.status === 'success')) {
        setDeleteLeaveId(null);
        toast({
          title: t('system.deleteSuccess'),
          description: t('system.deleteSuccessDesc'),
          className: 'border-green-500 bg-green-50 text-green-900',
        });
        fetchLeaveHistory(); // fetch leave history again
      } else {
        toast({
          title: t('system.deleteFailed'),
          description: data?.message || t('system.deleteFailedDesc'),
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: t('system.deleteFailed'),
        description: t('system.deleteFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // เพิ่ม useEffect สำหรับ fetch employee
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiService.get(apiEndpoints.employees.detail(id))
      .then(data => {
        if (data.success) {
          setEmployee(data.data);
        } else {
          setEmployee(null);
          setError(t('employee.notFound'));
        }
        setLoading(false);
      })
      .catch(() => {
        setEmployee(null);
        setError(t('employee.loadError'));
        setLoading(false);
      });
  }, [id, t]);

  // ฟังก์ชันช่วยแสดงชื่อแผนก/ตำแหน่งตามภาษา
  const getPositionLabel = (positionIdOrName: string) => {
    if (!positionIdOrName || positionIdOrName === "not_specified") {
      return t("positions.noPosition");
    }
    const found = positions.find(
      (pos) => pos.id === positionIdOrName || pos.position_name === positionIdOrName
    );
    if (!found) return t("positions.noPosition");
    return i18n.language.startsWith("th")
      ? found.position_name_th || found.position_name
      : found.position_name_en || found.position_name;
  };


  const getDepartmentLabel = (departmentIdOrName: string) => {
    if (!departmentIdOrName || departmentIdOrName === "not_specified") {
      return t("departments.noDepartment");
    }
    const found = departments.find(
      (dept) => dept.id === departmentIdOrName || dept.department_name === departmentIdOrName
    );
    if (!found) return t("departments.noDepartment");
    return i18n.language.startsWith("th")
      ? found.department_name_th || found.department_name
      : found.department_name_en || found.department_name;
  };

  // ตรวจสอบว่าเป็น Intern หรือไม่ โดยพิจารณาจาก role และชื่อ/ไอดีของตำแหน่ง (รองรับทั้ง TH/EN และตัวพิมพ์ใหญ่-เล็ก)
  const isInternPosition = (): boolean => {
    const roleLower = String(employee?.role || editData.role || '').toLowerCase();
    if (roleLower === 'intern') return true;

    const positionIdOrName = employee?.position_id || employee?.position || '';
    if (!positionIdOrName) return false;

    const found = positions.find(
      (pos) => pos.id === positionIdOrName || pos.position_name === positionIdOrName
    );

    const namesToCheck = [
      found?.position_name,
      found?.position_name_en,
      found?.position_name_th,
      typeof positionIdOrName === 'string' ? positionIdOrName : ''
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());

    const combined = namesToCheck.join(' ');
    return (
      combined.includes('intern') ||
      combined.includes(t('employeeTypes.intern').toLowerCase())
    );
  };

  if (loading) return <div>{t('common.loading')}</div>;
  if (error) return <div>{error}</div>;
  if (!employee) return <div>{t('employee.notFound')}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-x-hidden">
      {/* Floating/Parallax Background Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[350px] h-[350px] rounded-full bg-gradient-to-br from-blue-200 via-indigo-100 to-purple-100 dark:from-blue-900/30 dark:via-indigo-900/20 dark:to-purple-900/20 opacity-30 blur-2xl animate-float-slow" />
        <div className="absolute bottom-0 right-0 w-[250px] h-[250px] rounded-full bg-gradient-to-tr from-purple-200 via-blue-100 to-indigo-100 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-indigo-900/20 opacity-20 blur-xl animate-float-slow2" />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 opacity-10 blur-xl animate-pulse-slow" style={{ transform: 'translate(-50%,-50%)' }} />
      </div>
      {/* Topbar */}
      <div className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 relative shadow-lg">
        <div className="flex h-14 items-center px-3 md:px-4 gap-2 md:gap-3">
          <SidebarTrigger />
          <button
            onClick={() => navigate(-1)}
            className="bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-lg backdrop-blur-sm p-1.5 md:p-2 rounded-full transition-all duration-200"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-blue-900 dark:text-blue-100 tracking-tight drop-shadow-lg animate-slide-in-left">{t('employee.details')}</h1>
            <p className="text-xs md:text-sm text-blue-500 dark:text-blue-300 animate-slide-in-left delay-100">{employee.name}</p>
          </div>
        </div>
      </div>
      <div className="p-4 md:p-6 animate-fade-in">
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
          {/* Personal Info Card */}
          <Card className="glass dark:bg-gray-800/90 shadow-2xl border-0 animate-fade-in-up">
            <CardHeader className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400 text-white rounded-t-2xl p-4 md:p-5 shadow-lg">
              <CardTitle className="flex items-center gap-2 md:gap-3 text-lg md:text-xl font-bold animate-slide-in-left">
                <User className="h-5 w-5 md:h-6 md:w-6" />
                {t('employee.personalInfo')}
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs md:text-sm animate-slide-in-left delay-100">
                {t('employee.personalInfoDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col items-center p-4 md:p-6">
                {/* Profile Picture - Centered with enhanced styling */}
                <div className="relative w-24 h-24 md:w-32 md:h-32 mb-6 md:mb-8">
                  {employee.avatar ? (
                    <img
                      key={`avatar-${employee.id}-${avatarKey}`}
                      src={withCacheBust(`${API_BASE_URL}${employee.avatar}`)}
                      alt={employee.name}
                      className="w-full h-full rounded-full object-cover shadow-2xl border-4 border-white"
                      onError={(e) => {
                        // ถ้าโหลดรูปไม่สำเร็จ ให้แสดง fallback
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full rounded-full bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 flex items-center justify-center text-blue-900 font-bold text-3xl md:text-4xl shadow-2xl border-4 border-white ${employee.avatar ? 'hidden' : ''}`}>
                    {employee.name ? employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      className="absolute -bottom-3 right-1 p-2 bg-blue-500 text-white rounded-full shadow-md border-2 border-white hover:bg-blue-600"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          const file: File = e.target.files?.[0];
                          if (!file) return;
                          const url = URL.createObjectURL(file);
                          setAvatarPreviewSrc(url);
                          if (file.type === 'image/gif') setAvatarLocalGif(file); else setAvatarLocalGif(null);
                          setAvatarDialogOpen(true);
                        };
                        input.click();
                      }}
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <AvatarCropDialog
                  open={avatarDialogOpen}
                  imageSrc={avatarPreviewSrc}
                  isGif={!!avatarLocalGif}
                  originalFile={avatarLocalGif}
                  onOpenChange={setAvatarDialogOpen}
                  onCropped={async (file) => {
                    const form = new FormData();
                    form.append('avatar', file);
                    const res = await apiService.post(apiEndpoints.employees.avatar(String(id)), form);
                    if (res?.success) {

                      // Update employee data with new avatar URL immediately
                      setEmployee((prev: any) => {
                        if (!prev) return prev;
                        return { ...prev, avatar: res.avatar_url };
                      });

                      // Force cache bust to ensure new image loads
                      setAvatarKey(prev => prev + 1);
                      setAvatarTimestamp(Date.now());

                      // Show success message
                      toast({
                        title: t('employee.avatarUpdateSuccess') || 'Avatar Updated',
                        description: t('employee.avatarUpdateSuccessDesc') || 'Profile picture updated successfully',
                      });
                    } else {
                      toast({
                        title: t('error.title') || 'Error',
                        description: res?.message || t('employee.avatarUpdateError') || 'Failed to update avatar',
                        variant: 'destructive'
                      });
                    }
                    setAvatarPreviewSrc(null);
                    setAvatarLocalGif(null);
                  }}
                />

                {/* Information Grid - Enhanced 2 columns for better usability */}
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
                  {/* Column 1: Personal Info */}
                  <div className="space-y-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 p-6 rounded-2xl border border-blue-100 dark:border-gray-600">
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-6 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {t('employee.personalInfo')}
                    </h3>
                    {/* Full Name */}
                    <div>
                      <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 block">{t('employee.fullName')}</Label>
                      {isEditing ? (
                        <input
                          className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                          value={editData.full_name}
                          onChange={e => setEditData({ ...editData, full_name: e.target.value })}
                          placeholder={t('employee.fullName')}
                        />
                      ) : (
                        <p className="text-xl font-bold text-blue-900 dark:text-white">{employee.name}</p>
                      )}
                    </div>
                    {/* Position */}
                    <div>
                      <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 block">{t('employee.position')}</Label>
                      {isEditing ? (
                        <select
                          className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                          value={editData.position}
                          onChange={e => setEditData({ ...editData, position: e.target.value })}
                        >
                          <option value="not_specified">{t('positions.noPosition')}</option>
                          {positions
                            .filter(pos => pos.id !== 'not_specified')
                            .map(pos => (
                              <option key={pos.id} value={pos.id}>
                                {i18n.language.startsWith('th') ? pos.position_name_th : pos.position_name_en}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <p className="text-lg text-blue-700 dark:text-blue-200">{getPositionLabel(employee.position_id || employee.position)}</p>
                      )}
                    </div>
                    {/* Department */}
                    <div>
                      <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 block">{t('employee.department')}</Label>
                      {isEditing ? (
                        <select
                          className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                          value={editData.department}
                          onChange={e => setEditData({ ...editData, department: e.target.value })}
                        >
                          <option value="not_specified">{t('departments.noDepartment')}</option>
                          {departments
                            .filter(dept => dept.id !== 'not_specified')
                            .map(dept => (
                              <option key={dept.id} value={dept.id}>
                                {i18n.language.startsWith('th') ? dept.department_name_th : dept.department_name_en}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <p className="text-lg text-blue-700 dark:text-blue-200">{getDepartmentLabel(employee.department_id || employee.department)}</p>
                      )}
                    </div>
                    {/* Gender */}
                    <div>
                      <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 block">{t('employee.gender')}</Label>
                      {isEditing ? (
                        <select
                          className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                          value={editData.gender}
                          onChange={e => setEditData({ ...editData, gender: e.target.value })}
                        >
                          <option value="male">{t('employee.male')}</option>
                          <option value="female">{t('employee.female')}</option>
                          <option value="other">{t('employee.other')}</option>
                        </select>
                      ) : (
                        <p className="text-lg text-blue-700 dark:text-blue-200">
                          {employee.gender === 'male' ? t('employee.male') : employee.gender === 'female' ? t('employee.female') : employee.gender === 'other' ? t('employee.other') : '-'}
                        </p>
                      )}
                    </div>
                    {/* Birthdate */}
                    <div>
                      <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 block">{t('employee.birthdate')}</Label>
                      {isEditing ? (
                        <DatePicker
                          date={editData.birthdate}
                          onDateChange={(date) => setEditData({ ...editData, birthdate: date })}
                          placeholder={t('admin.enterBirthdate')}
                          className="w-full py-3 text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 border-blue-200 border-2 bg-white/80 backdrop-blur-sm"
                        />
                      ) : (
                        <p className="text-lg text-blue-700 dark:text-blue-200">{employee.dob ? format(new Date(employee.dob), 'dd/MM/yyyy') : '-'}</p>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Contact & Actions */}
                  <div className="space-y-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 p-6 rounded-2xl border border-indigo-100 dark:border-gray-600">
                    <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-200 mb-6 flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      {t('employee.contactInfo')}
                    </h3>
                    {/* Email */}
                    <div>
                      <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2 block">{t('employee.email')}</Label>
                      {isEditing ? (
                        <input
                          className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white"
                          type="email"
                          value={editData.email}
                          onChange={e => setEditData({ ...editData, email: e.target.value })}
                          placeholder={t('employee.email')}
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-indigo-400" />
                          <p className="text-lg text-indigo-700 dark:text-indigo-200">{employee.email}</p>
                        </div>
                      )}
                    </div>
                    {/* Password */}
                    <div>
                      <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2 block">{t('employee.password')}</Label>
                      {isEditing ? (
                        <input
                          className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white"
                          type="password"
                          value={editData.password}
                          onChange={e => setEditData({ ...editData, password: e.target.value })}
                          placeholder={t('employee.password')}
                        />
                      ) : (
                        <p className="text-lg text-indigo-700 dark:text-indigo-200">********</p>
                      )}
                    </div>
                    {/* Phone */}
                    <div>
                      <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2 block">{t('employee.phone')}</Label>
                      {isEditing ? (
                        <input
                          type="tel"
                          className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white"
                          value={editData.phone}
                          onChange={e => setEditData({ ...editData, phone: e.target.value })}
                        />
                      ) : (
                        <p className="text-lg text-indigo-700 dark:text-indigo-200">{employee.phone_number || '-'}</p>
                      )}
                    </div>
                    {/* Start Work Date (แสดงเมื่อไม่ใช่ Intern) */}
                    {!isInternPosition() && (
                      <div>
                        <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2 block">{t('employee.startWorkDate')}</Label>
                        {isEditing ? (
                          <input
                            type="date"
                            className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white"
                            value={editData.startWorkDate}
                            onChange={e => setEditData({ ...editData, startWorkDate: e.target.value })}
                          />
                        ) : (
                          <p className="text-lg text-indigo-700 dark:text-indigo-200">{employee.start_work ? format(new Date(employee.start_work), 'dd/MM/yyyy') : '-'}</p>
                        )}
                      </div>
                    )}
                    {/* Intern Dates (แสดงเมื่อเป็น Intern) */}
                    {isInternPosition() && (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2 block">{t('employee.internStartDate')}</Label>
                          {isEditing ? (
                            <DatePicker
                              date={editData.internStartDate}
                              onDateChange={(date) => setEditData({ ...editData, internStartDate: date })}
                              placeholder={t('admin.enterInternStartDate')}
                              className="w-full py-3 text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 border-indigo-200 border-2 bg-white/80 backdrop-blur-sm"
                            />
                          ) : (
                            <p className="text-lg text-indigo-700">{employee.internStartDate ? format(new Date(employee.internStartDate), 'dd/MM/yyyy') : '-'}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2 block">{t('employee.internEndDate')}</Label>
                          {isEditing ? (
                            <DatePicker
                              date={editData.internEndDate}
                              onDateChange={(date) => setEditData({ ...editData, internEndDate: date })}
                              placeholder={t('admin.enterInternEndDate')}
                              className="w-full py-3 text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 border-indigo-200 border-2 bg-white/80 backdrop-blur-sm"
                            />
                          ) : (
                            <p className="text-lg text-indigo-700">{employee.internEndDate ? format(new Date(employee.internEndDate), 'dd/MM/yyyy') : '-'}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons - Moved to bottom center */}
                <div className="flex justify-center gap-3 mt-8">
                  {isEditing ? (
                    <>
                      <Button onClick={handleSave} size="lg" className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl px-8 py-3 font-bold shadow-lg hover:shadow-xl transition-all duration-200">
                        {t('common.save')}
                      </Button>
                      <Button onClick={handleCancel} size="lg" variant="outline" className="rounded-xl px-8 py-3 font-bold border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow transition-all duration-200">
                        {t('common.cancel')}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleEdit} size="lg" variant="outline" className="rounded-xl px-8 py-3 font-bold border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow transition-all duration-200">
                      <Edit className="w-5 h-5 mr-2" />{t('common.edit')}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Leave History Card */}
          <Card className="glass dark:bg-gray-800/90 shadow-2xl border-0 animate-fade-in-up">
            <CardHeader className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400 text-white rounded-t-2xl p-5 shadow-lg">
              <CardTitle className="flex items-center gap-3 text-2xl font-bold animate-slide-in-left">
                <Calendar className="h-6 w-6" />
                {t('leave.leaveHistory')}
              </CardTitle>
              <CardDescription className="text-blue-100 text-sm animate-slide-in-left delay-100">
                {t('employee.leaveHistoryDesc')}
              </CardDescription>
            </CardHeader>
            {leaveSummary && (
              <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-6 py-4">
                <div className="flex justify-end items-center gap-3">
                  <Calendar className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                  <span className="text-base font-semibold text-gray-800 dark:text-white">
                    {t('leave.usedLeaveDays')}: {leaveSummary.days || 0} {t('leave.days')} {leaveSummary.hours > 0 ? `${leaveSummary.hours} ${t('leave.hours')}` : ''}
                  </span>
                </div>
              </div>
            )}
            <CardContent className="p-0">
              {/* Filter Section */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3">
                <div className="grid grid-cols-8 gap-2 items-end">
                  {/* Leave Type Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('leave.type')}
                    </label>
                    <select
                      className="w-full py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      value={pendingFilterType}
                      onChange={(e) => setPendingFilterType(e.target.value)}
                    >
                      <option value="all">{t('common.all')}</option>
                      {leaveTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {i18n.language.startsWith('th') ? type.leave_type_th : type.leave_type_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Month Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('common.month')}
                    </label>
                    <select
                      className="w-full py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      value={pendingFilterMonth}
                      onChange={(e) => setPendingFilterMonth(e.target.value)}
                    >
                      <option value="all">{t('common.all')}</option>
                      <option value="1">{t('common.january')}</option>
                      <option value="2">{t('common.february')}</option>
                      <option value="3">{t('common.march')}</option>
                      <option value="4">{t('common.april')}</option>
                      <option value="5">{t('common.may')}</option>
                      <option value="6">{t('common.june')}</option>
                      <option value="7">{t('common.july')}</option>
                      <option value="8">{t('common.august')}</option>
                      <option value="9">{t('common.september')}</option>
                      <option value="10">{t('common.october')}</option>
                      <option value="11">{t('common.november')}</option>
                      <option value="12">{t('common.december')}</option>
                    </select>
                  </div>

                  {/* Year Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t('common.year')}
                    </label>
                    <select
                      className="w-full py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      value={pendingFilterYear}
                      onChange={(e) => setPendingFilterYear(e.target.value)}
                    >
                      <option value="all">{t('common.all')}</option>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t('common.status')}
                    </label>
                    <select
                      className="w-full py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      value={pendingFilterStatus}
                      onChange={(e) => setPendingFilterStatus(e.target.value)}
                    >
                      <option value="all">{t('common.all')}</option>
                      <option value="pending">{t('leave.pending')}</option>
                      <option value="approved">{t('leave.approved')}</option>
                      <option value="rejected">{t('leave.rejected')}</option>
                    </select>
                  </div>

                  {/* Backdated Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t('leave.backdatedOnly')}
                    </label>
                    <select
                      className="w-full py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      value={pendingFilterBackdated}
                      onChange={(e) => setPendingFilterBackdated(e.target.value)}
                    >
                      <option value="all">{t('common.all')}</option>
                      <option value="1">{t('leave.backdated')}</option>
                      <option value="0">{t('leave.notBackdated')}</option>
                    </select>
                  </div>

                  {/* Filter Buttons */}
                  <div className="flex gap-3 items-end h-full shrink-0">
                    <button
                      className="min-h-[42px] min-w-[100px] px-5 py-2.5 rounded-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-lg hover:from-blue-700 hover:to-indigo-600 hover:shadow-xl transition-all duration-200 transform hover:scale-105 text-sm"
                      onClick={() => {
                        // ตรวจสอบว่าถ้าเลือกเดือนแต่ไม่เลือกปี
                        if (pendingFilterMonth !== "all" && pendingFilterYear === "all") {
                          setFilterWarning(t('validation.selectYearWhenSelectMonth'));
                          return;
                        }

                        // ล้างข้อความแจ้งเตือน
                        setFilterWarning("");

                        // เพิ่ม debug log
                        if (import.meta.env.DEV) {
                          logger.debug('🔘 Confirm button clicked');
                          logger.debug('🔘 pendingFilterBackdated:', pendingFilterBackdated);
                          logger.debug('🔘 pendingFilterType:', pendingFilterType);
                          logger.debug('🔘 pendingFilterStatus:', pendingFilterStatus);
                        }

                        setFilterType(pendingFilterType);
                        setFilterMonth(pendingFilterMonth);
                        setFilterYear(pendingFilterYear);
                        setFilterStatus(pendingFilterStatus);
                        setFilterBackdated(String(pendingFilterBackdated)); // บังคับเป็น string เสมอ
                        setLeavePage(1);
                      }}
                      type="button"
                    >
                      {t('common.confirm')}
                    </button>
                    <button
                      className="min-h-[42px] min-w-[100px] px-5 py-2.5 rounded-lg font-bold border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 shadow transition-all duration-200 text-sm"
                      onClick={resetFilters}
                      type="button"
                    >
                      {t('common.reset')}
                    </button>
                  </div>
                </div>
                {/* ข้อความแจ้งเตือนด้านล่าง filter */}
                {filterWarning && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-yellow-800 font-medium text-sm">{filterWarning}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3">
                <Table className="w-full">
                  <TableHeader className="bg-gray-50">
                    <TableRow className="border-b border-gray-200">
                      <TableHead className="w-[15%] font-semibold text-gray-700 whitespace-nowrap px-4">{t('leave.type')}</TableHead>
                      <TableHead className="w-[18%] font-semibold text-gray-700 whitespace-nowrap px-4">{t('leave.date')}</TableHead>
                      <TableHead className="w-[12%] font-semibold text-gray-700 whitespace-nowrap px-4">{t('leave.duration')}</TableHead>
                      <TableHead className="w-[22%] font-semibold text-gray-700 whitespace-nowrap px-4">{t('leave.reason')}</TableHead>
                      <TableHead className="w-[12%] font-semibold text-gray-700 whitespace-nowrap px-4">{t('leave.status')}</TableHead>
                      <TableHead className="w-[12%] font-semibold text-gray-700 whitespace-nowrap px-4">{t('leave.submittedDate')}</TableHead>
                      <TableHead className="w-[9%] text-center font-semibold text-gray-700 whitespace-nowrap px-4">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(leaveHistory) && leaveHistory.map((leave, idx) => {


                      return (
                        <TableRow key={leave.id} className="hover:bg-blue-50/60 group animate-fade-in-up border-b border-gray-100" style={{ animationDelay: `${idx * 60}ms` }}>
                          <TableCell className="font-medium text-blue-900 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm whitespace-nowrap">
                                {i18n.language.startsWith('th')
                                  ? (leave.leaveTypeName_th || leave.leaveTypeName_en || getLeaveTypeLabel(leave.leaveType))
                                  : (leave.leaveTypeName_en || leave.leaveTypeName_th || getLeaveTypeLabel(leave.leaveType))
                                }
                              </span>
                              {isBackdatedLeave(leave) && (
                                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs px-1.5 py-0.5 w-fit whitespace-nowrap">
                                  {t('leave.backdated')}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-blue-700 px-4 py-3">
                            {(() => {
                              if (leave.startDate && leave.endDate) {
                                const start = new Date(leave.startDate);
                                const end = new Date(leave.endDate);
                                const isSameDay = start.toDateString() === end.toDateString();
                                const locale = i18n.language.startsWith('th') ? th : undefined;
                                if (isSameDay) {
                                  return <span className="font-medium text-sm whitespace-nowrap">{format(start, 'dd MMM yyyy', { locale })}</span>;
                                } else {
                                  return (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-medium text-sm">{format(start, 'dd MMM', { locale })} -</span>
                                      <span className="font-medium text-sm">{format(end, 'dd MMM yyyy', { locale })}</span>
                                    </div>
                                  );
                                }
                              } else if (leave.startDate) {
                                const start = new Date(leave.startDate);
                                const locale = i18n.language.startsWith('th') ? th : undefined;
                                return <span className="font-medium text-sm whitespace-nowrap">{format(start, 'dd MMM yyyy', { locale })}</span>;
                              } else {
                                return <span className="text-gray-400">-</span>;
                              }
                            })()}
                          </TableCell>
                          <TableCell className="text-blue-700 px-4 py-3">
                            {(() => {
                              if (leave.durationType === 'day') {
                                const days = Math.floor(Number(leave.duration));
                                const hours = Math.round((Number(leave.duration) - days) * 24);
                                if (days > 0 && hours > 0) {
                                  return <span className="font-medium text-sm whitespace-nowrap">{days} {t(days === 1 ? 'leave.day' : 'leave.days')} {hours} {t(hours === 1 ? 'leave.hour' : 'leave.hours')}</span>;
                                } else if (days > 0) {
                                  return <span className="font-medium text-sm whitespace-nowrap">{days} {t(days === 1 ? 'leave.day' : 'leave.days')}</span>;
                                } else if (hours > 0) {
                                  return <span className="font-medium text-sm whitespace-nowrap">{hours} {t(hours === 1 ? 'leave.hour' : 'leave.hours')}</span>;
                                } else {
                                  return <span className="text-gray-400">-</span>;
                                }
                              } else if (leave.durationType === 'hour') {
                                // ใช้ durationHours แทน duration เมื่อเป็นชั่วโมง
                                const hours = Number(leave.durationHours || leave.duration);
                                if (hours > 0) {
                                  return <span className="font-medium text-sm whitespace-nowrap">{hours} {t(hours === 1 ? 'leave.hour' : 'leave.hours')}</span>;
                                } else {
                                  return <span className="text-gray-400">-</span>;
                                }
                              } else {
                                return <span className="text-gray-400">-</span>;
                              }
                            })()}
                          </TableCell>
                          <TableCell className="text-blue-700 px-4 py-3">
                            <div className="pr-2">
                              <div
                                className="truncate text-sm leading-relaxed max-w-[180px]"
                                title={leave.reason}
                                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              >
                                {leave.reason && leave.reason.length > 50
                                  ? leave.reason.slice(0, 50) + '...'
                                  : (leave.reason || <span className="text-gray-400">-</span>)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge className={
                              leave.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200 text-xs px-2 py-0.5 whitespace-nowrap' :
                                leave.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 text-xs px-2 py-0.5 whitespace-nowrap' :
                                  'bg-red-100 text-red-700 border-red-200 text-xs px-2 py-0.5 whitespace-nowrap'
                            }>
                              {leave.status === 'approved' ? t('leave.approved') : leave.status === 'pending' ? t('leave.pending') : t('leave.rejected')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-blue-700 px-4 py-3">
                            {leave.submittedDate ? (
                              (() => {
                                const locale = i18n.language.startsWith('th') ? th : undefined;
                                return (
                                  <span className="font-medium text-sm whitespace-nowrap">
                                    {format(new Date(leave.submittedDate), "dd MMM yyyy", { locale })}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center px-4 py-3">
                            <div className="flex justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="rounded-lg px-3 py-1.5 font-medium bg-gradient-to-r from-blue-500 to-indigo-400 text-white shadow hover:scale-105 transition text-xs"
                                onClick={() => handleViewLeaveDetails(leave)}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                {t('common.viewDetails')}
                              </Button>

                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!Array.isArray(leaveHistory) || leaveHistory.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <Calendar className="w-6 h-6 text-gray-300" />
                            <span className="text-sm">{t('leave.noHistory')}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {(leaveTotalPages >= 1 || leaveHistory.length > 0) && (
              <PaginationBar
                page={leavePage}
                totalPages={leaveTotalPages}
                totalResults={leaveHistory.length}
                pageSize={6}
                onPageChange={setLeavePage}
              />
            )}
          </Card>
        </div>
      </div>
      <LeaveDetailDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        leaveRequest={selectedLeave}
      />


    </div>
  );
}

export default EmployeeDetail;
