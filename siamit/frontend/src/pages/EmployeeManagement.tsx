import PaginationBar from "@/components/PaginationBar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { apiEndpoints } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, Eye, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiService } from '../lib/api';
import { getImageUrl } from '../lib/utils';

// เพิ่ม type สำหรับข้อมูลพนักงาน
interface Employee {
  id: string;
  full_name: string;
  email: string;
  position: string;
  position_name_th?: string;
  position_name_en?: string;
  department: string;
  department_name_th?: string;
  department_name_en?: string;
  role: string;
  usedLeaveDays: number;
  totalLeaveDays: number;
  avatar?: string; // เพิ่ม avatar เข้าไป
}

// เพิ่มฟังก์ชันแปลงวันลาเป็นวัน+ชั่วโมง (รองรับ i18n)
function formatLeaveDays(days: number, t: (key: string) => string): string {
  const fullDays = Math.floor(days);
  const hours = Math.round((days - fullDays) * 9);
  if (hours > 0) {
    return `${fullDays} ${t('common.days')} ${hours} ${t('common.hours')}`;
  }
  return `${fullDays} ${t('common.days')}`;
}

const EmployeeManagement = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // เพิ่มจำนวนแถวต่อหน้า
  // State สำหรับจัดการการลบพนักงาน
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null); // พนักงานที่จะลบ
  const [deleting, setDeleting] = useState(false); // สถานะกำลังลบ
  const [pendingPositionFilter, setPendingPositionFilter] = useState<string>("");
  const [pendingDepartmentFilter, setPendingDepartmentFilter] = useState<string>("");
  const [pendingRoleFilter, setPendingRoleFilter] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [sortField, setSortField] = useState<string>("full_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await apiService.get(apiEndpoints.employees.list);
        if (data.success && Array.isArray(data.data)) {
          const employees = data.data.map((item) => ({
            id: item.id,
            full_name: item.name || '',
            email: item.email || '',
            position: item.position || '', // เก็บ id
            position_name_th: item.position_name_th || '',
            position_name_en: item.position_name_en || '',
            department: item.department || '', // เก็บ id
            department_name_th: item.department_name_th || '',
            department_name_en: item.department_name_en || '',
            role: item.role || '',
            usedLeaveDays: item.usedLeaveDays ?? 0,
            totalLeaveDays: item.totalLeaveDays ?? 0,
            avatar: item.avatar || undefined,
          }));

          setEmployees(employees);
        } else {
          console.error('Invalid employees data format:', data);
          setEmployees([]);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [user]);

  // ดึงตำแหน่งและแผนก
  useEffect(() => {
    const fetchData = async () => {
      try {
        // ดึงข้อมูลตำแหน่ง
        const positionsData = await apiService.get(apiEndpoints.positions);
        if (positionsData.success && Array.isArray(positionsData.data)) {
          setPositions(positionsData.data);
        } else {
          console.error('Invalid positions data format:', positionsData);
        }

        // ดึงข้อมูลแผนก
        const departmentsData = await apiService.get(apiEndpoints.departments);
        if (departmentsData.success && Array.isArray(departmentsData.data)) {
          setDepartments(departmentsData.data);
        } else {
          console.error('Invalid departments data format:', departmentsData);
        }
      } catch (error) {
        console.error('Error fetching positions/departments:', error);
        toast({
          title: t('system.error'),
          description: t('system.fetchDataError'),
          variant: "destructive",
        });
      }
    };

    fetchData();
  }, [t, toast]);

  // ฟังก์ชันแปลง id เป็นชื่อ
  const getPositionName = (id: string) => {
    // ถ้า id เป็น null, undefined, หรือค่าว่าง ให้แสดงข้อความที่เหมาะสม
    if (!id || id === 'null' || id === 'undefined' || id === '') {
      return t('system.notSpecified');
    }
    const found = positions.find((p) => p.id === id);
    if (!found) return t('system.notSpecified');
    return i18n.language === 'th' ? found.position_name_th : found.position_name_en;
  };
  const getDepartmentName = (id: string) => {
    // ถ้า id เป็น null, undefined, หรือค่าว่าง ให้แสดงข้อความที่เหมาะสม
    if (!id || id === 'null' || id === 'undefined' || id === '') {
      return t('departments.noDepartment');
    }
    const found = departments.find((d) => d.id === id);
    if (!found) return t('departments.noDepartment');
    return i18n.language === 'th' ? found.department_name_th : found.department_name_en;
  };

  // ฟังก์ชันแสดงชื่อตำแหน่งตามภาษา
  const getDisplayPositionName = (employee: Employee) => {
    // ถ้ามีชื่อภาษาไทยและอังกฤษในข้อมูลพนักงาน
    if (employee.position_name_th && employee.position_name_en) {
      return i18n.language === 'th' ? employee.position_name_th : employee.position_name_en;
    }
    // ถ้าไม่มี ให้ใช้ฟังก์ชัน lookup
    return getPositionName(employee.position);
  };

  // ฟังก์ชันแสดงชื่อแผนกตามภาษา
  const getDisplayDepartmentName = (employee: Employee) => {
    // ถ้ามีชื่อภาษาไทยและอังกฤษในข้อมูลพนักงาน
    if (employee.department_name_th && employee.department_name_en) {
      return i18n.language === 'th' ? employee.department_name_th : employee.department_name_en;
    }
    // ถ้าไม่มี ให้ใช้ฟังก์ชัน lookup
    return getDepartmentName(employee.department);
  };

  // ฟังก์ชันกรองข้อมูล
  const filteredEmployees = employees.filter(emp => {
    const positionMatch = positionFilter === "" || emp.position === positionFilter;
    const departmentMatch = departmentFilter === "" || emp.department === departmentFilter;
    const roleMatch = roleFilter === "" || emp.role === roleFilter;


    return positionMatch && departmentMatch && roleMatch;
  });

  // ฟังก์ชันเรียงลำดับข้อมูล
  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case "full_name":
        aValue = a.full_name.toLowerCase();
        bValue = b.full_name.toLowerCase();
        break;
      case "email":
        aValue = a.email.toLowerCase();
        bValue = b.email.toLowerCase();
        break;
      case "position":
        aValue = getDisplayPositionName(a).toLowerCase();
        bValue = getDisplayPositionName(b).toLowerCase();
        break;
      case "department":
        aValue = getDisplayDepartmentName(a).toLowerCase();
        bValue = getDisplayDepartmentName(b).toLowerCase();
        break;
      case "role":
        aValue = a.role.toLowerCase();
        bValue = b.role.toLowerCase();
        break;
      default:
        aValue = a.full_name.toLowerCase();
        bValue = b.full_name.toLowerCase();
    }

    if (aValue < bValue) {
      return sortDirection === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });

  // ฟังก์ชันเปลี่ยนการเรียงลำดับ
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [positionFilter, departmentFilter, roleFilter]);
  const totalPages = Math.ceil(sortedEmployees.length / itemsPerPage);
  const paginatedEmployees = sortedEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const stats = [
    {
      title: t('auth.roles.superadmin'),
      value: employees.filter(emp => emp.role === 'superadmin').length.toString(),
      icon: User,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: t('auth.roles.admin'),
      value: employees.filter(emp => emp.role === 'admin').length.toString(),
      icon: User,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: t('auth.roles.employee'),
      value: employees.filter(emp => emp.role === 'user').length.toString(),
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  // ฟังก์ชันตรวจสอบสิทธิ์ในการลบพนักงาน
  const canDeleteEmployee = (targetEmployee: Employee): boolean => {
    if (!user) return false;

    // Admin ไม่สามารถลบ Superadmin ได้
    if (user.role === 'admin' && targetEmployee.role === 'superadmin') {
      return false;
    }

    // ไม่สามารถลบตัวเองได้
    if (user.id === targetEmployee.id) {
      return false;
    }

    // Superadmin สามารถลบได้ทุกคน (ยกเว้นตัวเอง)
    if (user.role === 'superadmin') {
      return true;
    }

    // Admin สามารถลบได้เฉพาะ user และ admin อื่นๆ (ยกเว้น superadmin และตัวเอง)
    if (user.role === 'admin') {
      return targetEmployee.role === 'user' || targetEmployee.role === 'admin';
    }

    // User ไม่สามารถลบใครได้
    return false;
  };

  // ฟังก์ชันลบพนักงาน - จัดการการลบพนักงานตามบทบาท (superadmin, admin, user)
  const handleDelete = async () => {
    if (!deleteTarget || !user) return;

    // ตรวจสอบสิทธิ์ก่อนลบ
    if (!canDeleteEmployee(deleteTarget)) {
      toast({
        title: t('system.deleteFailed'),
        description: t('system.noPermissionToDelete'),
        variant: "destructive",
      });
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    let url = '';
    if (deleteTarget.role === 'superadmin') {
      url = apiEndpoints.superAdmin.delete(deleteTarget.id);
    } else if (deleteTarget.role === 'admin') {
      url = apiEndpoints.superAdmin.admins(deleteTarget.id);
    } else {
      url = apiEndpoints.superAdmin.users(deleteTarget.id);
    }
    try {
      const data = await apiService.delete(url);

      // ตรวจสอบว่า response มี success: true หรือไม่
      if (data && data.success === true) {
        // ลบพนักงานออกจาก state
        setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        setDeleteTarget(null);

        // ตรวจสอบว่าหลังจากลบแล้ว pagination จะเป็น 0 หรือไม่
        const remainingEmployees = employees.filter((e) => e.id !== deleteTarget.id);
        const filteredRemaining = remainingEmployees.filter(emp => {
          const positionMatch = positionFilter === "" || emp.position === positionFilter;
          const departmentMatch = departmentFilter === "" || emp.department === departmentFilter;
          const roleMatch = roleFilter === "" || emp.role === roleFilter;
          return positionMatch && departmentMatch && roleMatch;
        });
        const newTotalPages = Math.ceil(filteredRemaining.length / itemsPerPage);

        // ถ้า pagination เป็น 0 หรือหน้าปัจจุบันไม่มีข้อมูล ให้รีเฟรชหน้า
        if (newTotalPages === 0 || (currentPage > newTotalPages && newTotalPages > 0)) {
          window.location.reload();
        }

        toast({
          title: t('system.deleteSuccess'),
          description: t('system.deleteUserSuccessDesc'),
          className: 'border-green-500 bg-green-50 text-green-900'
        });
      } else {
        // แสดง error message เฉพาะเมื่อลบไม่สำเร็จจริง ๆ
        toast({
          title: t('system.deleteFailed'),
          description: data?.message || t('system.deleteFailed'),
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error('Delete employee error:', e);
      toast({
        title: t('system.deleteFailed'),
        description: t('system.deleteFailed'),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-white flex flex-col">
      {/* Hero Section (identical to other main pages) */}
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

        <div className="relative z-10 flex flex-col items-center justify-center py-6 md:py-16">
          <img src="/lovable-uploads/siamit.png" alt="Logo" className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/80 shadow-2xl border-4 border-white mb-3 md:mb-4" />
          <h1 className="text-2xl md:text-5xl font-extrabold text-indigo-900 drop-shadow mb-1 md:mb-2 flex items-center gap-2 md:gap-3 text-center px-4">
            {t('navigation.employeeManagement')}
          </h1>
          <p className="text-sm md:text-xl text-blue-900/70 mb-2 font-medium text-center max-w-2xl px-4">
            {t('system.manageDepartment')}
          </p>
        </div>
      </div>
      <div className="w-full max-w-6xl mx-auto px-4 mt-0 animate-fade-in flex-1">
        <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 flex flex-col h-auto overflow-visible">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={stat.title}
                  className="glass shadow-xl border-0 hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 animate-fade-in-up"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <CardContent className="p-5 md:p-7 flex items-center gap-4">
                    <div className={`w-12 h-12 md:w-16 md:h-16 ${stat.bgColor} rounded-full flex items-center justify-center shadow-lg animate-float`}>
                      <Icon className={`w-6 h-6 md:w-8 md:h-8 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl md:text-3xl font-extrabold text-blue-900 drop-shadow">{stat.value}</p>
                      <p className="text-sm md:text-base text-blue-500 font-medium">{stat.title}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {/* Employee List */}
          <Card className="glass shadow-2xl border-0 animate-fade-in-up h-auto min-h-[500px] md:h-[650px] flex flex-col">
            <CardHeader className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400 text-white rounded-t-2xl p-4 md:p-5 shadow-lg flex-shrink-0">
              <CardTitle className="flex items-center gap-2 md:gap-3 text-xl md:text-2xl font-bold animate-slide-in-left">
                <Users className="w-5 h-5 md:w-6 md:h-6" />
                {t('system.employeeList')}
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs md:text-sm animate-slide-in-left delay-100">
                {t('system.allEmployeesInterns')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              {/* Filter Bar */}
              <div className="p-4 sm:p-6 pb-2 flex-shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 md:flex md:flex-row gap-3 items-end">
                  <div className="flex flex-col w-full md:w-auto">
                    <label className="text-xs text-gray-500 font-semibold mb-1" htmlFor="position-filter">{t('auth.position')}</label>
                    <select
                      id="position-filter"
                      className="rounded-lg border border-blue-200 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white shadow-sm w-full md:w-auto"
                      value={pendingPositionFilter}
                      onChange={e => setPendingPositionFilter(e.target.value)}
                      style={{ minWidth: 40, maxWidth: '100%' }}
                    >
                      <option value="">{t('system.allPositions')}</option>
                      {positions.map(pos => {
                        const displayName = i18n.language === 'th' ? pos.position_name_th : pos.position_name_en;
                        return (
                          <option key={pos.id} value={pos.id}>{displayName}</option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="flex flex-col w-full md:w-auto">
                    <label className="text-xs text-gray-500 font-semibold mb-1" htmlFor="department-filter">{t('auth.department')}</label>
                    <select
                      id="department-filter"
                      className="rounded-lg border border-blue-200 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white shadow-sm w-full md:w-auto"
                      value={pendingDepartmentFilter}
                      onChange={e => setPendingDepartmentFilter(e.target.value)}
                      style={{ minWidth: 40, maxWidth: '100%' }}
                    >
                      <option value="">{t('system.allDepartments')}</option>
                      {departments.map(dep => {
                        const displayName = i18n.language === 'th' ? dep.department_name_th : dep.department_name_en;
                        return (
                          <option key={dep.id} value={dep.id}>{displayName}</option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="flex flex-col w-full md:w-auto">
                    <label className="text-xs text-gray-500 font-semibold mb-1" htmlFor="role-filter">{t('common.status')}</label>
                    <select
                      id="role-filter"
                      className="rounded-lg border border-blue-200 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white shadow-sm w-full md:w-auto"
                      value={pendingRoleFilter}
                      onChange={e => setPendingRoleFilter(e.target.value)}
                      style={{ minWidth: 40, maxWidth: '100%' }}
                    >
                      <option value="">{t('system.allStatus')}</option>
                      <option value="admin">{t('system.admin')}</option>
                      <option value="superadmin">{t('system.superadmin')}</option>
                      <option value="user">{t('auth.roles.user')}</option>
                    </select>
                  </div>
                  <div className="flex flex-row gap-3 items-stretch h-full w-full md:w-auto sm:col-span-3 md:col-span-auto mt-2 md:mt-0">
                    <button
                      className="min-h-[42px] flex-1 md:flex-none md:min-w-[100px] px-5 py-2.5 rounded-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-lg hover:from-blue-700 hover:to-indigo-600 hover:shadow-xl transition-all duration-200 transform hover:scale-105 text-sm"
                      onClick={() => {
                        setPositionFilter(pendingPositionFilter);
                        setDepartmentFilter(pendingDepartmentFilter);
                        setRoleFilter(pendingRoleFilter);
                      }}
                    >
                      {t('common.confirm')}
                    </button>
                    <button
                      className="min-h-[42px] flex-1 md:flex-none md:min-w-[90px] px-4 py-2.5 rounded-lg font-bold border-2 border-blue-400 text-blue-600 bg-white hover:bg-blue-50 hover:border-blue-500 hover:shadow-md transition-all duration-200 transform hover:scale-105 text-sm"
                      onClick={() => {
                        setPendingPositionFilter("");
                        setPendingDepartmentFilter("");
                        setPendingRoleFilter("");
                        setPositionFilter("");
                        setDepartmentFilter("");
                        setRoleFilter("");
                      }}
                    >
                      {t('common.reset')}
                    </button>
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="text-lg text-center py-10 flex-1 flex items-center justify-center">{t('common.loading')}</div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-auto min-h-0">
                    {paginatedEmployees.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full py-10 md:py-16">
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4 md:mb-6">
                          <Users className="w-10 h-10 md:w-12 md:h-12 text-blue-400" />
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-2">
                          {t('system.noEmployeesFound')}
                        </h3>
                        <p className="text-blue-600 text-center max-w-md text-sm md:text-base px-4">
                          {t('system.noEmployeesFoundDesc')}
                        </p>
                        <button
                          className="mt-6 px-6 py-3 rounded-lg font-bold bg-gradient-to-r from-blue-500 to-indigo-400 text-white shadow-lg hover:from-blue-600 hover:to-indigo-500 hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                          onClick={() => {
                            setPendingPositionFilter("");
                            setPendingDepartmentFilter("");
                            setPendingRoleFilter("");
                            setPositionFilter("");
                            setDepartmentFilter("");
                            setRoleFilter("");
                          }}
                        >
                          {t('common.resetFilter')}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4 p-4">
                          {paginatedEmployees.map((employee) => (
                            <div key={employee.id} className="bg-white rounded-xl shadow-md p-4 border border-blue-100 flex flex-col gap-3 animate-fade-in-up">
                              <div className="flex items-center gap-3">
                                {employee.avatar ? (
                                  <img
                                    src={getImageUrl(employee.avatar, import.meta.env.VITE_API_BASE_URL)}
                                    alt={employee.full_name}
                                    className="w-12 h-12 rounded-full object-cover shadow-sm border border-blue-200"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      target.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 flex items-center justify-center text-blue-900 font-bold text-lg shadow-sm ${employee.avatar ? 'hidden' : ''}`}>
                                  {employee.full_name ? employee.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-blue-900 text-base truncate">{employee.full_name}</h4>
                                    {user && employee.id === user.id && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 text-white font-bold shadow-sm animate-pulse shrink-0">
                                        {t('common.me')}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-blue-500 truncate">{employee.email}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-blue-50 p-2 rounded-lg">
                                  <p className="text-xs text-blue-400 font-semibold mb-0.5">{t('auth.position')}</p>
                                  <p className="text-blue-700 font-medium truncate">{getDisplayPositionName(employee)}</p>
                                </div>
                                <div className="bg-indigo-50 p-2 rounded-lg">
                                  <p className="text-xs text-indigo-400 font-semibold mb-0.5">{t('auth.department')}</p>
                                  <p className="text-indigo-700 font-medium truncate">{getDisplayDepartmentName(employee)}</p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <div>
                                  {employee.role === 'superadmin' ? (
                                    <span className="text-xs px-2 py-1 rounded-full border border-purple-300 bg-purple-50 text-purple-700 font-bold shadow-sm">
                                      {t('auth.roles.superadmin')}
                                    </span>
                                  ) : employee.role === 'admin' ? (
                                    <span className="text-xs px-2 py-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-400 text-white font-bold shadow-sm">
                                      {t('auth.roles.admin')}
                                    </span>
                                  ) : (
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-bold shadow-sm">
                                      {t('auth.roles.employee')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    asChild
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 shadow-sm"
                                  >
                                    <Link to={`/admin/employees/${employee.id}?role=${employee.role}`}>
                                      <Eye className="w-4 h-4" />
                                    </Link>
                                  </Button>
                                  {canDeleteEmployee(employee) && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          className="h-8 w-8 p-0 rounded-full bg-red-100 text-red-600 hover:bg-red-200 shadow-sm"
                                          onClick={() => setDeleteTarget(employee)}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6" /></svg>
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>{t('system.confirmDelete')}</AlertDialogTitle>
                                          <AlertDialogDescription>{t('system.confirmDeleteDesc')}</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-gradient-to-r from-red-500 to-pink-400 text-white">
                                            {deleting ? t('common.loading') : t('common.delete')}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full min-w-[600px]">
                            <thead className="sticky top-0 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 z-10">
                              <tr className="text-xs sm:text-sm">
                                <th
                                  className="px-3 py-2 text-left font-bold text-blue-900 cursor-pointer hover:bg-blue-100 transition-colors select-none"
                                  onClick={() => handleSort("full_name")}
                                >
                                  <div className="flex items-center gap-1">
                                    {t('auth.fullName')}
                                    {sortField === "full_name" && (
                                      sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                  </div>
                                </th>
                                <th
                                  className="px-3 py-2 text-left font-bold text-blue-900 cursor-pointer hover:bg-blue-100 transition-colors select-none"
                                  onClick={() => handleSort("email")}
                                >
                                  <div className="flex items-center gap-1">
                                    {t('auth.email')}
                                    {sortField === "email" && (
                                      sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                  </div>
                                </th>
                                <th
                                  className="px-3 py-2 text-left font-bold text-blue-900 cursor-pointer hover:bg-blue-100 transition-colors select-none"
                                  onClick={() => handleSort("position")}
                                >
                                  <div className="flex items-center gap-1">
                                    {t('auth.position')}
                                    {sortField === "position" && (
                                      sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                  </div>
                                </th>
                                <th
                                  className="px-3 py-2 text-left font-bold text-blue-900 cursor-pointer hover:bg-blue-100 transition-colors select-none"
                                  onClick={() => handleSort("department")}
                                >
                                  <div className="flex items-center gap-1">
                                    {t('auth.department')}
                                    {sortField === "department" && (
                                      sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                  </div>
                                </th>
                                <th
                                  className="px-3 py-2 text-left font-bold text-blue-900 cursor-pointer hover:bg-blue-100 transition-colors select-none"
                                  onClick={() => handleSort("role")}
                                >
                                  <div className="flex items-center gap-1">
                                    {t('common.status')}
                                    {sortField === "role" && (
                                      sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                    )}
                                  </div>
                                </th>
                                <th className="px-3 py-2 text-center font-bold text-blue-900">{t('system.management')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedEmployees.map((employee, idx) => (
                                <tr
                                  key={employee.id}
                                  className="transition hover:bg-blue-50/60 group animate-fade-in-up text-xs sm:text-sm"
                                  style={{ animationDelay: `${idx * 60}ms` }}
                                >
                                  <td className="px-3 py-2 whitespace-nowrap flex items-center gap-2">
                                    {/* Avatar with image or initials */}
                                    {employee.avatar ? (
                                      <img
                                        src={getImageUrl(employee.avatar, import.meta.env.VITE_API_BASE_URL)}
                                        alt={employee.full_name}
                                        className="w-8 h-8 rounded-full object-cover shadow-md border border-blue-200"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          target.nextElementSibling?.classList.remove('hidden');
                                        }}
                                      />
                                    ) : null}
                                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 flex items-center justify-center text-blue-900 font-bold text-base shadow-md ${employee.avatar ? 'hidden' : ''}`}>
                                      {employee.full_name ? employee.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-blue-900 text-sm">{employee.full_name}</span>
                                      {/* แสดง "Me" badge สำหรับผู้ใช้ปัจจุบัน */}
                                      {user && employee.id === user.id && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 text-white font-bold shadow-sm animate-pulse">
                                          {t('common.me')}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-blue-700 text-sm">{employee.email}</td>
                                  <td className="px-3 py-2 text-blue-700 text-sm">
                                    {getDisplayPositionName(employee)}
                                  </td>
                                  <td className="px-3 py-2 text-blue-700 text-sm">
                                    {getDisplayDepartmentName(employee)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {employee.role === 'superadmin' ? (
                                      <span className="text-xs px-2 py-0.5 rounded-full border border-purple-300 bg-purple-50 text-purple-700 font-bold shadow-sm" style={{ letterSpacing: 0.5 }}>
                                        {t('auth.roles.superadmin')}
                                      </span>
                                    ) : employee.role === 'admin' ? (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-400 text-white font-bold shadow-sm">
                                        {t('auth.roles.admin')}
                                      </span>
                                    ) : (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold shadow-sm">
                                        {t('auth.roles.employee')}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center flex flex-row flex-nowrap items-center gap-1.5 justify-start whitespace-nowrap">
                                    <Button
                                      asChild
                                      size="sm"
                                      variant="secondary"
                                      className="min-w-[100px] sm:min-w-[120px] rounded-lg px-2 sm:px-3 py-1.5 font-medium bg-gradient-to-r from-blue-500 to-indigo-400 text-white shadow hover:scale-105 transition text-xs"
                                    >
                                      <Link to={`/admin/employees/${employee.id}?role=${employee.role}`}>
                                        <Eye className="w-3.5 h-3.5 mr-1" />
                                        <span className="hidden sm:inline">{t('common.viewDetails')}</span>
                                        <span className="sm:hidden">{t('common.view')}</span>
                                      </Link>
                                    </Button>
                                    {/* ปุ่มลบพนักงาน - แสดงเฉพาะเมื่อมีสิทธิ์ลบ */}
                                    {canDeleteEmployee(employee) && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            className="rounded-lg px-2 sm:px-3 py-1.5 font-medium bg-gradient-to-r from-red-500 to-red-600 text-white shadow hover:scale-105 transition text-xs"
                                            onClick={() => setDeleteTarget(employee)}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6" /></svg>
                                            <span className="hidden sm:inline">{t('common.delete')}</span>
                                            <span className="sm:hidden">Del</span>
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>{t('system.confirmDelete')}</AlertDialogTitle>
                                            <AlertDialogDescription>{t('system.confirmDeleteDesc')}</AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                            {/* ปุ่มยืนยันการลบใน Dialog */}
                                            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-gradient-to-r from-red-500 to-pink-400 text-white">
                                              {deleting ? t('common.loading') : t('common.delete')}
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Pagination */}
                  {(totalPages >= 1 || paginatedEmployees.length > 0) && (
                    <PaginationBar
                      page={currentPage}
                      totalPages={totalPages}
                      totalResults={paginatedEmployees.length}
                      pageSize={itemsPerPage}
                      onPageChange={setCurrentPage}
                      compact
                      showInfo
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Footer */}
      <footer className="w-full mt-8 md:mt-16 py-6 md:py-8 bg-gradient-to-r from-blue-100 via-indigo-50 to-white text-center text-gray-400 text-base font-medium shadow-inner flex flex-col items-center gap-2">
        <img src="/lovable-uploads/siamit.png" alt="Logo" className="w-8 h-8 md:w-10 md:h-10 rounded-full mx-auto mb-1" />
        <div className="font-bold text-gray-600 text-sm md:text-base">{t('footer.systemName')}</div>
        <div className="text-xs md:text-sm">{t('footer.copyright')}</div>
      </footer>


    </div>
  );
};

export default EmployeeManagement;