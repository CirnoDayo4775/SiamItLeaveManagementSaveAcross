import LanguageSwitcher from '@/components/LanguageSwitcher';
import { RegisterConfirmDialog } from '@/components/dialogs/RegisterConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiEndpoints } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/lib/api';
import { showToastMessage } from '@/lib/toast';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

const Register = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('th') ? 'th' : 'en';
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    department: '',
    position: '',
    role: 'employee' as 'employee' | 'admin' | 'intern',
    gender: '' as '' | 'male' | 'female' | 'other',
    dob: '',
    phone_number: '',
    start_work: '',
    end_work: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; department_name_en: string; department_name_th: string }[]>([]);
  const [positions, setPositions] = useState<{ id: string; position_name_en: string; position_name_th: string; require_enddate?: boolean }[]>([]);
  const [newDepartment, setNewDepartment] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [error, setError] = useState<{ email?: string; full_name?: string; general?: string }>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { signup } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Password strength logic
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

  const getPasswordStrength = (password: string) => {
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
      strength = 'strong';
    } else if (password.length >= 6 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      strength = 'medium';
    }
    return strength;
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength === 'weak') return 'text-red-500';
    if (passwordStrength === 'medium') return 'text-yellow-500';
    return 'text-green-600';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength === 'weak') return t('auth.passwordWeak');
    if (passwordStrength === 'medium') return t('auth.passwordMedium');
    return t('auth.passwordStrong');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setFormData(prev => ({ ...prev, password }));
    setPasswordStrength(getPasswordStrength(password));
  };

  // ดึงข้อมูลจาก API
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch departments
        const deptData = await apiService.get(apiEndpoints.departments);
        if (deptData && deptData.data && Array.isArray(deptData.data)) {
          const depts = deptData.data.map((d: any) => ({ id: d.id, department_name_th: d.department_name_th, department_name_en: d.department_name_en }));
          const noDepartmentItem = depts.find(d => d.department_name_en === 'No Department');
          const otherDepts = depts.filter(d => d.department_name_en !== 'No Department');
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
          const pos = posData.data.map((p: any) => ({ id: p.id, position_name_th: p.position_name_th, position_name_en: p.position_name_en, require_enddate: !!p.require_enddate }));
          const noPositionItem = pos.find(p => p.position_name_en === 'No Position');
          const otherPos = pos.filter(p => p.position_name_en !== 'No Position');
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
      } catch (error) {
        console.error('Error fetching data:', error);
        setDepartments([]);
        setPositions([]);
      }
    };

    fetchData();
  }, [lang]);

  // เพิ่ม department ใหม่
  const handleAddDepartment = async () => {
    if (!newDepartment) return;
    try {
      await apiService.post(apiEndpoints.departments, { department_name: newDepartment });
      setDepartments(prev => [...prev, { id: 'new', department_name_en: newDepartment, department_name_th: newDepartment }]);
      setNewDepartment('');
      showToastMessage.crud.createSuccess('');
    } catch (error) {
      showToastMessage.crud.createError('');
    }
  };

  // เพิ่ม position ใหม่
  const handleAddPosition = async () => {
    if (!newPosition) return;
    try {
      await apiService.post(apiEndpoints.positions, { position_name: newPosition });
      setPositions(prev => [...prev, { id: 'new', position_name_en: newPosition, position_name_th: newPosition }]);
      setNewPosition('');
      showToastMessage.crud.createSuccess('');
    } catch (error) {
      showToastMessage.crud.createError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError({});
    
    // ตรวจสอบรูปแบบอีเมล
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: t('common.error'),
        description: t('auth.invalidEmailFormat'),
        variant: "destructive",
      });
      setError({ email: t('auth.invalidEmailFormat') });
      return;
    }
    
    // ตรวจสอบเพิ่มเติมว่าอีเมลไม่ใช่รูปแบบที่ไม่สมบูรณ์ เช่น @g, @gmail
    if (formData.email.includes('@') && !formData.email.includes('.')) {
      toast({
        title: t('common.error'),
        description: t('auth.invalidEmailFormat'),
        variant: "destructive",
      });
      setError({ email: t('auth.invalidEmailFormat') });
      return;
    }
    
    // ตรวจสอบว่าโดเมนต้องมีอย่างน้อย 2 ตัวอักษรหลังจุด (เช่น .com, .co.th)
    const domainMatch = formData.email.match(/@[^@]+\.([^.]+)$/);
    if (domainMatch && domainMatch[1].length < 2) {
      toast({
        title: t('common.error'),
        description: t('auth.invalidEmailFormat'),
        variant: "destructive",
      });
      setError({ email: t('auth.invalidEmailFormat') });
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t('auth.passwordMismatch'),
        description: t('auth.checkPasswordMatch'),
        variant: "destructive",
      });
      return;
    }

    // ตรวจว่าตำแหน่งต้องการ End Work Date หรือไม่
    const selectedPos = positions.find(p => p.id === formData.position);
    const requiresEndWorkDate = selectedPos ? !!selectedPos.require_enddate : false;

    if (requiresEndWorkDate) {
      if (!formData.start_work || !formData.end_work) {
        toast({ title: t('common.error'), description: t('auth.pleaseFillEndWorkDate'), variant: 'destructive' });
        return;
      }
      if (formData.start_work > formData.end_work) {
        toast({ title: t('common.error'), description: t('auth.dateRangeInvalid'), variant: 'destructive' });
        return;
      }
    }

    // แสดง dialog ยืนยันการสมัครสมาชิก
    setShowConfirmDialog(true);
  };

  const handleConfirmRegistration = async () => {
    setLoading(true);

    try {
      // Convert intern role to employee for signup, but keep position info
      const signupRole = formData.role === 'intern' ? 'employee' : formData.role as 'employee' | 'admin';
      
      await signup(formData.email, formData.password, {
        full_name: formData.full_name,
        department: formData.department,
        position: formData.position,
        role: signupRole,
        gender: formData.gender || undefined,
        dob: formData.dob,
        phone_number: formData.phone_number,
        start_work: formData.start_work || undefined,
        end_work: formData.end_work || undefined,
      });
      
      toast({
        title: t('auth.registerSuccess'),
        description: t('auth.checkEmailVerification'),
      });
      // Redirect to root login page (unauthenticated view)
      navigate('/');
    } catch (error: any) {
      const errMsg = error.message || t('common.error');
      
      const newError: { email?: string; full_name?: string; general?: string } = {};
      const lowerMsg = errMsg.toLowerCase();
      
      // Better error categorization and translation
      let translatedMessage = errMsg;
      
      // Check for specific error patterns first
      if (lowerMsg.includes('อีเมล') && lowerMsg.includes('ถูกใช้ไปแล้ว')) {
        // Email already exists error - must contain both email and "already used"
        translatedMessage = lang === 'th' 
          ? 'อีเมลนี้ถูกใช้ไปแล้ว กรุณาใช้อีเมลอื่น' 
          : 'This email is already in use. Please use a different email.';
        newError.email = translatedMessage;
      } else if (lowerMsg.includes('ชื่อ') && (lowerMsg.includes('ถูกใช้ไปแล้ว') || lowerMsg.includes('มีอยู่แล้ว'))) {
        // Name already exists error
        translatedMessage = lang === 'th' 
          ? 'ชื่อนี้ถูกใช้ไปแล้ว กรุณาใช้ชื่ออื่น' 
          : 'This name is already in use. Please use a different name.';
        newError.full_name = translatedMessage;
      } else if (lowerMsg.includes('ชื่อ') || lowerMsg.includes('name') || lowerMsg.includes('user')) {
        // General name-related error
        translatedMessage = lang === 'th' 
          ? 'ข้อมูลชื่อไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' 
          : 'Name information is invalid. Please check again.';
        newError.full_name = translatedMessage;
      } else if (lowerMsg.includes('แผนก') || lowerMsg.includes('department')) {
        translatedMessage = lang === 'th' 
          ? 'ข้อมูลแผนกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' 
          : 'Department information is invalid. Please check again.';
        newError.general = translatedMessage;
      } else if (lowerMsg.includes('ตำแหน่ง') || lowerMsg.includes('position')) {
        translatedMessage = lang === 'th' 
          ? 'ข้อมูลตำแหน่งไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' 
          : 'Position information is invalid. Please check again.';
        newError.general = translatedMessage;
      } else if (lowerMsg.includes('รหัสผ่าน') || lowerMsg.includes('password')) {
        translatedMessage = lang === 'th' 
          ? 'ข้อมูลรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' 
          : 'Password information is invalid. Please check again.';
        newError.general = translatedMessage;
      } else {
        // Generic error - keep original message but translate if needed
        translatedMessage = errMsg;
        newError.general = translatedMessage;
      }
      
      setError(newError);
      toast({
        title: t('auth.registerError'),
        description: translatedMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md lg:max-w-lg space-y-8 animate-fade-in">
        <div className="text-center">
          <img
            src="/lovable-uploads/IMG_4486-removebg-preview.png"
            alt="Siam IT Logo"
            className="mx-auto h-16 w-auto mb-6"
          />
          <h2 className="text-3xl font-bold text-gray-900">
            {t('auth.register')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t('main.onlineLeaveSystemCompany')}
          </p>
        </div>

        <Card className="shadow-lg border-0">
          {/* Removed duplicate Register title and description in the card header */}
          <CardContent className="pt-6 px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2 mb-4 mt-4">
                <Label htmlFor="full_name" className="mb-2 block">{t('auth.fullName')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="full_name"
                    placeholder={t('auth.fullName')}
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="pl-12 pr-4 py-3 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 rounded-xl"
                    required
                  />
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
              </div>

              {/* Gender */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="gender" className="mb-2 block">{t('employee.gender')}</Label>
                <Select value={formData.gender} onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value as any }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('employee.selectGender')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t('employee.male')}</SelectItem>
                    <SelectItem value="female">{t('employee.female')}</SelectItem>
                    <SelectItem value="other">{t('employee.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date of Birth */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="dob" className="mb-2 block">{t('employee.birthdate')}</Label>
                <DatePicker 
                  date={formData.dob} 
                  onDateChange={(date) => setFormData(prev => ({ ...prev, dob: date }))}
                  placeholder={t('employee.selectDate')}
                />
              </div>

              <div className="space-y-2 mb-4">
                <Label htmlFor="position" className="mb-2 block">{t('auth.position')}</Label>
                <Select onValueChange={(value) => setFormData(prev => ({ ...prev, position: value }))}>
                  <SelectTrigger className="border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 rounded-xl py-3">
                    <SelectValue placeholder={t('positions.selectPosition')} />
                  </SelectTrigger>
                  <SelectContent>
                    {positions
                      .filter(pos => (pos.position_name_th || pos.position_name_en) && (pos.position_name_th?.trim() !== '' || pos.position_name_en?.trim() !== ''))
                      .map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>
                          {lang === 'th' ? pos.position_name_th : pos.position_name_en}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department Field */}
              <div className="space-y-2">
                <Label htmlFor="department" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                 
                  {t('auth.department')}
                </Label>
                <Select onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}>
                  <SelectTrigger className="border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 rounded-xl py-3">
                    <SelectValue placeholder={t('departments.selectDepartment')} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments
                      .filter(dept => (dept.department_name_th || dept.department_name_en) && (dept.department_name_th?.trim() !== '' || dept.department_name_en?.trim() !== ''))
                      .map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {lang === 'th' ? dept.department_name_th : dept.department_name_en}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Phone number */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="phone" className="mb-2 block">{t('employee.phoneNumber')}</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  placeholder={t('employee.enterPhoneNumber')} 
                  value={formData.phone_number} 
                  onChange={(e) => {
                    // อนุญาตเฉพาะตัวเลขและเครื่องหมาย + - ( ) และช่องว่าง
                    const value = e.target.value.replace(/[^0-9+\-() ]/g, '');
                    setFormData(prev => ({ ...prev, phone_number: value }));
                  }} 
                />
              </div>

              {/* Start/End work dates: Start Work Date always shows; End Work Date shows only when position has Request Quote enabled */}
              {(() => {
                const selectedPos = positions.find(p => p.id === formData.position);
                const showEndWorkDate = selectedPos ? !!selectedPos.require_enddate : false;
                return (
                  <div className={`grid grid-cols-1 ${showEndWorkDate ? 'md:grid-cols-2' : ''} gap-4`}>
                    <div className="space-y-2">
                      <Label htmlFor="start_work" className="mb-2 block">{t('employee.startWorkDate')}</Label>
                      <DatePicker 
                        date={formData.start_work} 
                        onDateChange={(date) => setFormData(prev => ({ ...prev, start_work: date }))}
                        placeholder={t('employee.selectDate')}
                      />
                    </div>
                    {showEndWorkDate && (
                      <div className="space-y-2">
                        <Label htmlFor="end_work" className="mb-2 block">{t('employee.endWorkDate')}</Label>
                        <DatePicker 
                          date={formData.end_work} 
                          onDateChange={(date) => setFormData(prev => ({ ...prev, end_work: date }))}
                          placeholder={t('employee.selectDate')}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-2 mb-4">
                <Label htmlFor="email" className="mb-2 block">{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.email')}
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                    required
                  />
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
              </div>
              
              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {t('auth.password')}
                </Label>
                <div className="relative group">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handlePasswordChange}
                    className="pl-12 pr-12 py-3 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 rounded-xl"
                    required
                  />
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {formData.password && (
                  <div className={`flex items-center gap-2 text-sm mt-1 ${getPasswordStrengthColor()}`}>
                    <div className={`w-2 h-2 rounded-full ${
                      passwordStrength === 'weak' ? 'bg-red-500' : 
                      passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}></div>
                    {getPasswordStrengthText()}
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {t('auth.confirmPassword')}
                </Label>
                <div className="relative group">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password && (
                  <div className={`flex items-center gap-2 text-sm mt-1 ${
                    formData.password === formData.confirmPassword ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {formData.password === formData.confirmPassword ? (
                      <>
                        {/* <CheckCircle className="h-4 w-4" /> */}
                        {t('auth.passwordsMatch')}
                      </>
                    ) : (
                      <>
                        {/* <AlertCircle className="h-4 w-4" /> */}
                        {t('auth.passwordsDoNotMatch')}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    {t('common.loading')}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    {/* <Sparkles className="h-5 w-5" /> */}
                    {t('auth.register')}
                    {/* <ArrowRight className="h-5 w-5" /> */}
                  </div>
                )}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link 
                  to="/login" 
                  className="font-semibold text-blue-600 hover:text-blue-700 transition-colors underline decoration-2 underline-offset-2"
                >
                  {t('auth.login')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Dialog ยืนยันการสมัครสมาชิก */}
      <RegisterConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmRegistration}
      />
    </div>
  );
};

export default Register;
