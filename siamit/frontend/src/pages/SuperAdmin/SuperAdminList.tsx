import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarTrigger } from '@/components/ui/sidebar';

import { apiEndpoints } from '@/constants/api';
import { NO_DEPARTMENT, NO_POSITION, PasswordStrength, Tab, TABS } from '@/constants/roles';
import { apiService } from '@/lib/api';
import { showToastMessage } from '@/lib/toast';
import { AlertCircle, Building, Calendar, CheckCircle, Crown, Eye, EyeOff, Info, Lock, Mail, Phone, Plus, Shield, User, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SuperAdminList: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>('employee');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    position: '',
    gender: '',
    date_of_birth: '',
    start_work: '',
    end_work: '',
    role: 'employee', // ตั้งค่าเริ่มต้นให้ตรงกับ activeTab
    phone_number: '', // เพิ่มตรงนี้
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [error, setError] = useState<{ email?: string; full_name?: string; general?: string }>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>('weak');
  const [selectedPositionRequireEnddate, setSelectedPositionRequireEnddate] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const lang = i18n.language.startsWith('th') ? 'th' : 'en';

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch departments
        const deptData = await apiService.get(apiEndpoints.departments);
        if (deptData && deptData.data && Array.isArray(deptData.data)) {
          const depts = deptData.data.map((d: any) => ({ id: d.id, department_name_th: d.department_name_th, department_name_en: d.department_name_en }));
          const noDepartmentItem = depts.find(d => d.department_name_en === NO_DEPARTMENT);
          const otherDepts = depts.filter(d => d.department_name_en !== NO_DEPARTMENT);
          otherDepts.sort((a, b) => {
            const nameA = lang === 'th' ? a.department_name_th : a.department_name_en;
            const nameB = lang === 'th' ? b.department_name_th : b.department_name_en;
            return (nameA || '').localeCompare(nameB || '');
          });
          const sortedDepts = [...otherDepts];
          if (noDepartmentItem) {
            sortedDepts.push(noDepartmentItem);
          }
          setDepartments(sortedDepts);
        }
        // Fetch positions
        const posData = await apiService.get(apiEndpoints.positions);
        if (posData && posData.data && Array.isArray(posData.data)) {
          const pos = posData.data.map((p: any) => ({
            id: p.id,
            position_name_th: p.position_name_th,
            position_name_en: p.position_name_en,
            require_enddate: !!p.require_enddate
          }));
          const noPositionItem = pos.find(p => p.position_name_en === NO_POSITION);
          const otherPos = pos.filter(p => p.position_name_en !== NO_POSITION);
          otherPos.sort((a, b) => {
            const nameA = lang === 'th' ? a.position_name_th : a.position_name_en;
            const nameB = lang === 'th' ? b.position_name_th : b.position_name_en;
            return (nameA || '').localeCompare(nameB || '');
          });
          const sortedPositions = [...otherPos];
          if (noPositionItem) {
            sortedPositions.push(noPositionItem);
          }
          setPositions(sortedPositions);
        }
        // Skip fetching genders (no backend endpoint). Use static options defined in UI.
        setGenders([]);
      } catch {
        setDepartments([]);
        setPositions([]);
        setGenders([]);
      }
    };
    fetchData();
  }, [lang]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    // Password strength checker
    if (name === 'password') {
      const hasLower = /[a-z]/.test(value);
      const hasUpper = /[A-Z]/.test(value);
      const hasNumber = /\d/.test(value);
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
      const length = value.length;

      if (length >= 8 && hasLower && hasUpper && hasNumber && hasSpecial) {
        setPasswordStrength('strong');
      } else if (length >= 6 && ((hasLower && hasUpper) || (hasNumber && hasSpecial))) {
        setPasswordStrength('medium');
      } else {
        setPasswordStrength('weak');
      }
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setForm({ ...form, role: tab });
  };

  const handlePositionChange = (positionId: string) => {
    setForm(f => ({ ...f, position: positionId }));
    const selectedPos = positions.find(p => p.id === positionId);
    setSelectedPositionRequireEnddate(selectedPos ? !!selectedPos.require_enddate : false);
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'strong': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'weak': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 'strong': return '';
      case 'medium': return '';
      case 'weak': return '';
      default: return '';
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError({});

    // Validation    
    if (!form.full_name.trim()) {
      showToastMessage.validation.requiredField('fullName', t);
      return;
    }

    if (!form.email.trim()) {
      showToastMessage.validation.requiredField('email', t);
      return;
    }

    if (!form.phone_number.trim()) {
      showToastMessage.validation.requiredField('phoneNumber', t);
      return;
    }

    if (!form.department) {
      showToastMessage.validation.requiredField('department', t);
      return;
    }

    if (!form.position) {
      showToastMessage.validation.requiredField('position', t);
      return;
    }

    if (form.password.length < 6) {
      showToastMessage.validation.passwordTooShort(t);
      return;
    }

    if (form.password !== form.confirmPassword) {
      showToastMessage.validation.passwordMismatch(t);
      return;
    }

    if (!form.role) {
      showToastMessage.validation.requiredField('role', t);
      return;
    }

    // Check if end_work is required based on position's require_enddate
    if (selectedPositionRequireEnddate && !form.end_work) {
      showToastMessage.validation.requiredField('endWork', t);
      return;
    }

    setLoading(true);
    try {
      // Map frontend role to backend role
      const roleMapping: { [key: string]: string } = {
        'employee': 'user',
        'admin': 'admin',
        'superadmin': 'superadmin'
      };

      const payload = {
        role: roleMapping[form.role] || form.role,
        name: form.full_name,
        department: form.department,
        position: form.position,
        email: form.email,
        password: form.password,
        gender_name_th: form.gender,
        date_of_birth: form.date_of_birth,
        start_work: form.start_work,
        end_work: selectedPositionRequireEnddate ? form.end_work : null,
        phone_number: form.phone_number,
      };

      const data = await apiService.post('/api/create-user-with-role', payload);
      if (data && (data.success || data.token)) {
        showToastMessage.crud.createSuccess('user', t);
        setForm({
          full_name: '',
          email: '',
          password: '',
          confirmPassword: '',
          department: '',
          position: '',
          role: form.role,
          gender: '',
          start_work: '',
          end_work: '',
          date_of_birth: '',
          phone_number: '',
        });
        setPasswordStrength('weak');
        setSelectedPositionRequireEnddate(false);
      } else {
        showToastMessage.crud.createError('user', data?.message, t);
      }
    } catch (err: any) {
      showToastMessage.network.connectionError(t);
    } finally {
      setLoading(false);
    }
  };

  const getTabConfig = (tab: Tab) => {
    const configs = {
      employee: {
        icon: Users,
        title: t('employee.employee'),
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-700',
        hoverColor: 'hover:bg-blue-100',
        activeColor: 'bg-blue-600',
        activeTextColor: 'text-white',
        gradient: 'from-blue-400 via-blue-500 to-blue-600',
        shadow: 'shadow-blue-500/25'
      },
      admin: {
        icon: Shield,
        title: t('employee.admin'),
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        textColor: 'text-purple-700',
        hoverColor: 'hover:bg-purple-100',
        activeColor: 'bg-purple-600',
        activeTextColor: 'text-white',
        gradient: 'from-purple-400 via-purple-500 to-purple-600',
        shadow: 'shadow-purple-500/25'
      },
      superadmin: {
        icon: Crown,
        title: t('employee.superadmin'),
        color: 'from-indigo-500 to-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        textColor: 'text-indigo-700',
        hoverColor: 'hover:bg-indigo-100',
        activeColor: 'bg-indigo-600',
        activeTextColor: 'text-white',
        gradient: 'from-indigo-400 via-indigo-500 to-indigo-600',
        shadow: 'shadow-indigo-500/25'
      }
    };
    return configs[tab];
  };

  const currentConfig = getTabConfig(activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white">
      {/* Enhanced Hero Section with Wave */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <svg viewBox="0 0 1440 320" className="w-full h-32 md:h-48 animate-wave" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="url(#waveGradient)" fillOpacity="1" d="M0,160L60,170.7C120,181,240,203,360,197.3C480,192,600,160,720,133.3C840,107,960,85,1080,101.3C1200,117,1320,171,1380,197.3L1440,224L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z" />
            <defs>
              <linearGradient id="waveGradient" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6" />
                <stop offset="0.5" stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Sidebar Trigger */}
        <div className="absolute top-4 left-4 z-20">
          <SidebarTrigger className="bg-white/90 hover:bg-white text-blue-700 border border-blue-200 hover:border-blue-300 shadow-lg backdrop-blur-sm" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center py-8 md:py-20 animate-slide-down">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full blur-xl opacity-30 animate-pulse-slow"></div>
            <img
              src="/lovable-uploads/siamit.png"
              alt="Logo"
              className="relative w-20 h-20 md:w-28 md:h-28 rounded-full bg-white/90 shadow-2xl border-4 border-white mb-4 md:mb-6 hover:scale-110 transition-all duration-500 hover:shadow-3xl"
            />
          </div>
          <h2 className="text-3xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 drop-shadow mb-2 md:mb-3 flex items-center gap-2 md:gap-3 animate-fade-in-up text-center px-4">
            {t('admin.createUser')}
          </h2>
          <p className="text-base md:text-2xl text-blue-900/80 mb-2 font-medium text-center max-w-3xl animate-fade-in-up-delay px-4">
            {t('main.onlineLeaveSystemCompany', 'Siam IT Leave Management System')}
          </p>
          <div className="flex items-center gap-2 text-blue-700/70 animate-fade-in-up-delay">
            <Info className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-xs md:text-sm">{t('admin.selectUserType')}</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pb-8 animate-fade-in-up-slow">
        {/* Enhanced Role Selection Tabs */}
        <div className="mb-6 md:mb-8 animate-fade-in-up-delay-1">
          <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-3 flex flex-col md:flex-row gap-3 border border-white/20">
            {TABS.map((tab) => {
              const config = getTabConfig(tab);
              const IconComponent = config.icon;
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`flex-1 flex items-center justify-center gap-3 md:gap-4 py-4 px-6 md:py-6 md:px-8 rounded-2xl transition-all duration-500 transform hover:scale-105 relative overflow-hidden ${isActive
                      ? `bg-gradient-to-r ${config.gradient} ${config.activeTextColor}  shadow-lg`
                      : `${config.bgColor} ${config.textColor} ${config.hoverColor} ${config.borderColor} border hover:shadow-lg`
                    }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-white/10 animate-pulse-slow"></div>
                  )}
                  <IconComponent className={`w-5 h-5 md:w-6 md:h-6 transition-all duration-300 ${isActive ? 'animate-bounce' : ''}`} />
                  <span className="font-bold text-base md:text-lg">{config.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Enhanced Form Container */}
        <div className={`bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-5 md:p-10 animate-slide-up hover:shadow-3xl transition-all duration-500 hover:scale-[1.01] border-2 ${currentConfig.borderColor} relative overflow-hidden max-w-3xl mx-auto`}>
          {/* Section: ข้อมูลส่วนตัว */}
          <h4 className="text-lg md:text-xl font-bold mb-4 text-blue-700">{t('admin.personalInfo')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 mb-6 md:mb-8">
            {/* Full Name */}
            <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-3">
              <Label htmlFor="full_name" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                <User className="w-4 h-4 md:w-5 md:h-5" />
                {t('auth.fullName')}
                <span className="text-red-500">*</span>
              </Label>
              <div className="relative group">
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder={t('admin.enterFullName')}
                  value={form.full_name}
                  onChange={handleChange}
                  className={`pl-6 py-3 md:py-4 text-base md:text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm`}
                  required
                  autoComplete="name"
                />
                {form.full_name && (
                  <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-4">
              <Label htmlFor="email" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                <Mail className="w-4 h-4 md:w-5 md:h-5" />
                {t('auth.email')}
                <span className="text-red-500">*</span>
              </Label>
              <div className="relative group">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t('admin.enterEmail')}
                  value={form.email}
                  onChange={handleChange}
                  className={`pl-6 py-3 md:py-4 text-base md:text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm`}
                  required
                  autoComplete="email"
                />
                {form.email && (
                  <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
            </div>
            {/* Phone Number */}
            <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-4">
              <Label htmlFor="phone_number" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                <Phone className="w-4 h-4 md:w-5 md:h-5" />
                {t('admin.phoneNumber')}
                <span className="text-red-500">*</span>
              </Label>
              <div className="relative group">
                <Input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  placeholder={t('admin.enterPhoneNumber')}
                  value={form.phone_number}
                  onChange={handleChange}
                  className={`pl-6 py-3 md:py-4 text-base md:text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm`}
                  required
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Gender */}
            <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-7">
              <Label htmlFor="gender" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                <User className="w-4 h-4 md:w-5 md:h-5" />
                {t('admin.gender')}
              </Label>
              <Select value={form.gender} onValueChange={value => setForm(f => ({ ...f, gender: value }))}>
                <SelectTrigger id="gender" className={`rounded-xl shadow-sm text-base md:text-lg transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm py-3 md:py-4`}>
                  <SelectValue placeholder={t('admin.selectGender')} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-md border-2 border-gray-200 rounded-xl">
                  {genders && genders.length > 0 ? (
                    genders.map((g: any) => (
                      <SelectItem key={g.id || g.value || g.gender_name_th} value={g.gender_name_th || g.value} className="hover:bg-indigo-50 transition-colors duration-200 rounded-lg">
                        {lang === 'th' ? (g.gender_name_th || g.label || g.value) : (g.gender_name_en || g.label || g.value)}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="male">{t('admin.male')}</SelectItem>
                      <SelectItem value="female">{t('admin.female')}</SelectItem>
                      <SelectItem value="other">{t('admin.other')}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Date of Birth */}
            <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-6">
              <Label htmlFor="date_of_birth" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                {t('admin.dateOfBirth')}
                <span className="text-red-500">*</span>
              </Label>
              <DatePicker
                date={form.date_of_birth}
                onDateChange={(date) => setForm(f => ({ ...f, date_of_birth: date }))}
                placeholder={t('admin.enterDateOfBirth')}
                className={`py-3 md:py-4 text-base md:text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm`}
              />
            </div>
          </div>
          <hr className="my-6" />
          {/* Section: ข้อมูลการทำงาน */}
          <h4 className="text-lg md:text-xl font-bold mb-4 text-purple-700">{t('admin.workInfo')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 mb-6 md:mb-8">
            {/* Department */}
            <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-6">
              <Label htmlFor="department" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                <Building className="w-4 h-4 md:w-5 md:h-5" />
                {t('auth.department')}
                <span className="text-red-500">*</span>
              </Label>
              <Select value={form.department} onValueChange={value => setForm(f => ({ ...f, department: value }))}>
                <SelectTrigger id="department" className={`rounded-xl shadow-sm text-base md:text-lg transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm py-3 md:py-4`}>
                  <SelectValue placeholder={t('admin.selectDepartment')} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-md border-2 border-gray-200 rounded-xl">
                  {departments.map((dep) => (
                    <SelectItem key={dep.id} value={dep.id} className="hover:bg-indigo-50 transition-colors duration-200 rounded-lg">
                      {lang === 'th' ? dep.department_name_th : dep.department_name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Position */}
            <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-5">
              <Label htmlFor="position" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                <Building className="w-4 h-4 md:w-5 md:h-5" />
                {t('auth.position')}
                <span className="text-red-500">*</span>
              </Label>
              <Select value={form.position} onValueChange={handlePositionChange}>
                <SelectTrigger id="position" className={`rounded-xl shadow-sm text-base md:text-lg transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm py-3 md:py-4`}>
                  <SelectValue placeholder={t('admin.selectPosition')} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-md border-2 border-gray-200 rounded-xl">
                  {positions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id} className="hover:bg-indigo-50 transition-colors duration-200 rounded-lg">
                      {lang === 'th' ? pos.position_name_th : pos.position_name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Work */}
            <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-7">
              <Label htmlFor="start_work" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                {t('admin.startWork')}
                <span className="text-red-500">*</span>
              </Label>
              <DatePicker
                date={form.start_work}
                onDateChange={(date) => setForm(f => ({ ...f, start_work: date }))}
                placeholder={t('admin.enterStartWork')}
                className={`py-3 md:py-4 text-base md:text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm`}
              />
            </div>
            {/* End Work (conditionally rendered) */}
            {selectedPositionRequireEnddate && (
              <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-7">
                <Label htmlFor="end_work" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                  <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                  {t('admin.endWork')}
                  <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  date={form.end_work}
                  onDateChange={(date) => setForm(f => ({ ...f, end_work: date }))}
                  placeholder={t('admin.enterEndWork')}
                  className={`py-3 md:py-4 text-base md:text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm`}
                />
              </div>
            )}
          </div>
          <hr className="my-6" />
          {/* Section: ข้อมูลเข้าสู่ระบบ */}
          <h4 className="text-lg md:text-xl font-bold mb-4 text-indigo-700">{t('admin.loginInfo')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 mb-6 md:mb-8">
            {/* Password */}
            <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-7">
              <Label htmlFor="password" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                <Lock className="w-4 h-4 md:w-5 md:h-5" />
                {t('auth.password')}
                <span className="text-red-500">*</span>
              </Label>
              <div className="relative group">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  className={`pl-6 pr-12 py-3 md:py-4 text-base md:text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm`}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 ${currentConfig.textColor} hover:scale-110 transition-all duration-300`}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {/* Password Strength Indicator */}
              {form.password && (
                <div className="flex items-center gap-2 text-sm">
                  <span className={getPasswordStrengthColor()}>
                    {t(`admin.passwordStrength.${passwordStrength}`)}
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${passwordStrength === 'weak' && level === 1
                            ? 'bg-red-500'
                            : passwordStrength === 'medium' && level <= 2
                              ? 'bg-yellow-500'
                              : passwordStrength === 'strong' && level <= 3
                                ? 'bg-green-500'
                                : 'bg-gray-300'
                          }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2 md:space-y-3 animate-fade-in-up-delay-8">
              <Label htmlFor="confirmPassword" className={`mb-2 md:mb-3 block ${currentConfig.textColor} font-bold text-base md:text-lg transition-all duration-300 hover:text-opacity-80 flex items-center gap-2`}>
                <Lock className="w-4 h-4 md:w-5 md:h-5" />
                {t('auth.confirmPassword')}
                <span className="text-red-500">*</span>
              </Label>
              <div className="relative group">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className={`pl-6 pr-12 py-3 md:py-4 text-base md:text-lg rounded-xl transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-opacity-50 ${currentConfig.borderColor} border-2 bg-white/80 backdrop-blur-sm`}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 ${currentConfig.textColor} hover:scale-110 transition-all duration-300`}
                >
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {/* Password Match Indicator */}
              {form.confirmPassword && (
                <div className="flex items-center gap-2 text-sm">
                  {form.password === form.confirmPassword ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-600">{t('admin.passwordMatch')}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-600">{t('admin.passwordMismatch')}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Enhanced Submit Button */}
          <div className="flex justify-center mt-6 md:mt-8 animate-fade-in-up-delay-9">
            <Button
              type="button"
              className={`w-full md:w-1/2 py-4 md:py-6 text-lg md:text-xl font-bold rounded-2xl shadow-2xl bg-gradient-to-r ${currentConfig.gradient} hover:shadow-3xl text-white transition-all duration-500 hover:scale-105 active:scale-95 transform relative overflow-hidden group`}
              disabled={loading}
              onClick={() => setShowConfirmModal(true)}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-white mr-3 md:mr-4"></div>
                  <span>{t('admin.creatingUser')}</span>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <span className="flex items-center justify-center gap-2 md:gap-3 relative z-10">
                    <Plus className="w-5 h-5 md:w-6 md:h-6" />
                    {t('admin.createUser')}
                  </span>
                </>
              )}
            </Button>
          </div>
          {/* Confirm Create User Dialog */}
          <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
            <DialogContent>
              <DialogTitle>{t('admin.confirmCreateUserTitle')}</DialogTitle>
              <div>{t('admin.confirmCreateUserMessage')}</div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                  {t('admin.cancel')}
                </Button>
                <Button
                  onClick={(e) => {
                    setShowConfirmModal(false);
                    handleSubmit();
                  }}
                  disabled={loading}
                >
                  {t('admin.confirm')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Enhanced Footer */}
      <footer className="w-full mt-10 md:mt-20 py-8 md:py-12 bg-gradient-to-r from-blue-50 via-indigo-50 to-white text-center text-gray-500 text-base font-medium shadow-inner flex flex-col items-center gap-3 md:gap-4 animate-fade-in-up-slow">
        <div className="flex items-center gap-3">
          <img
            src="/lovable-uploads/siamit.png"
            alt="Logo"
            className="w-10 h-10 md:w-12 md:h-12 rounded-full hover:scale-110 transition-all duration-300"
          />
          <span className="text-base md:text-lg font-semibold text-gray-700">
            {t('footer.systemName')}
          </span>
        </div>
        <span className="transition-all duration-300 hover:text-indigo-600 text-xs md:text-sm">
          {t('footer.copyright')}
        </span>
      </footer>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-down {
          from { transform: translateY(-50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes slide-up {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes fade-in-up {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes wave {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-10px); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
          40%, 43% { transform: translate3d(0, -8px, 0); }
          70% { transform: translate3d(0, -4px, 0); }
          90% { transform: translate3d(0, -2px, 0); }
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        
        .animate-slide-down {
          animation: slide-down 1.2s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 1s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out;
        }
        
        .animate-fade-in-up-slow {
          animation: fade-in-up 1.5s ease-out;
        }
        
        .animate-fade-in-up-delay {
          animation: fade-in-up 1s ease-out 0.3s both;
        }
        
        .animate-fade-in-up-delay-1 {
          animation: fade-in-up 0.8s ease-out 0.1s both;
        }
        
        .animate-fade-in-up-delay-2 {
          animation: fade-in-up 0.8s ease-out 0.2s both;
        }
        
        .animate-fade-in-up-delay-3 {
          animation: fade-in-up 0.8s ease-out 0.3s both;
        }
        
        .animate-fade-in-up-delay-4 {
          animation: fade-in-up 0.8s ease-out 0.4s both;
        }
        
        .animate-fade-in-up-delay-5 {
          animation: fade-in-up 0.8s ease-out 0.5s both;
        }
        
        .animate-fade-in-up-delay-6 {
          animation: fade-in-up 0.8s ease-out 0.6s both;
        }
        
        .animate-fade-in-up-delay-7 {
          animation: fade-in-up 0.8s ease-out 0.7s both;
        }
        
        .animate-fade-in-up-delay-8 {
          animation: fade-in-up 0.8s ease-out 0.8s both;
        }
        
        .animate-fade-in-up-delay-9 {
          animation: fade-in-up 0.8s ease-out 0.9s both;
        }
        
        .animate-wave {
          animation: wave 6s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        
        .animate-bounce {
          animation: bounce 1s ease-in-out;
        }
        
        .hover\\:shadow-3xl:hover {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        
        .shadow-3xl {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        
        .shadow-2xl {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
        }
        
        .shadow-xl {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
      `}</style>
    </div>
  );
};

export default SuperAdminList; 