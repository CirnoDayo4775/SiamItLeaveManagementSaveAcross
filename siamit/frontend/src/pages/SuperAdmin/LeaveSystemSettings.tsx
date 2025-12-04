import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { apiEndpoints } from '@/constants/api';
import { showToast, showToastMessage } from '@/lib/toast';
import { config } from '@/config';
import { QUOTA_RESET_STRATEGIES, POSITION_SETTINGS, CLEANUP_OPERATIONS } from '@/constants/business';



// Mock data for demonstration
// Remove mockDepartments

const LeaveSystemSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const lang = i18n.language.startsWith('th') ? 'th' : 'en';
  // Position state
  const [positions, setPositions] = useState<any[]>([]);
  const [positionForm, setPositionForm] = useState<{ name_en: string; name_th: string; quotas: Record<string, number>; require_enddate: boolean }>({ name_en: '', name_th: '', quotas: {}, require_enddate: false });
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);

  // Department state
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentForm, setDepartmentForm] = useState<{ name_en: string; name_th: string }>({ name_en: '', name_th: '' });
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);

  // Leave type state
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveTypeForm, setLeaveTypeForm] = useState<{ name_en: string; name_th: string; require_attachment: boolean }>({ name_en: '', name_th: '', require_attachment: false });
  const [editingLeaveTypeId, setEditingLeaveTypeId] = useState<string | null>(null);
  // Add leave type dialog state (set quotas per position)
  const [addLeaveTypeOpen, setAddLeaveTypeOpen] = useState<boolean>(false);
  const [newLeaveTypeQuotas, setNewLeaveTypeQuotas] = useState<Record<string, number>>({}); // key = positionId
  const [addLeaveTypeSubmitting, setAddLeaveTypeSubmitting] = useState<boolean>(false);

  // Add state for inline editing
  const [inlineEdit, setInlineEdit] = useState<null | {
    id: string;
    name_en: string;
    name_th: string;
    quotas: Record<string, number>;
  }>(null);
  // Quota tab state removed along with reset functionality

  const handleToggleNewYearQuota = async (pos: any) => {
    try {
      // Build quotas payload from current row
      const quotasForBackend: Record<string, number> = {};
      pos.quotas.forEach((q: any) => { if (q.leaveTypeId) quotasForBackend[q.leaveTypeId] = q.quota ?? 0; });
      const nextValue = Number(pos.new_year_quota) === POSITION_SETTINGS.NEW_YEAR_QUOTA.RESET ? POSITION_SETTINGS.NEW_YEAR_QUOTA.NO_RESET : POSITION_SETTINGS.NEW_YEAR_QUOTA.RESET; // 0=รี,1=ไม่รี
      const data = await apiService.put(`/api/positions-with-quotas/${pos.id}`, {
        position_name_en: pos.position_name_en,
        position_name_th: pos.position_name_th,
        quotas: quotasForBackend,
        new_year_quota: nextValue,
        require_enddate: pos.require_enddate,
      });
      if (!data || !data.success) throw new Error('Failed to update');
      // Refresh positions
      const positionsData = await apiService.get(apiEndpoints.positionsWithQuotas);
      if (positionsData.success && Array.isArray(positionsData.data)) {
        setPositions(positionsData.data);
      }
      showToastMessage.crud.updateSuccess('position', t);
    } catch (err: any) {
      showToastMessage.crud.updateError('position', err?.message, t);
    }
  };

  // Add state for inline editing error
  const [inlineEditError, setInlineEditError] = useState<string | null>(null);

  // Department handlers
  const [inlineDepartmentEdit, setInlineDepartmentEdit] = useState<null | { id: string; name_en: string; name_th: string }>(null);
  const [inlineDepartmentError, setInlineDepartmentError] = useState<string | null>(null);

  // Delete confirmation states
  const [deletePositionDialog, setDeletePositionDialog] = useState<{ open: boolean; position: any | null }>({ open: false, position: null });
  const [deleteDepartmentDialog, setDeleteDepartmentDialog] = useState<{ open: boolean; department: any | null }>({ open: false, department: null });
  const [deleteLeaveTypeDialog, setDeleteLeaveTypeDialog] = useState<{ open: boolean; leaveType: any | null }>({ open: false, leaveType: null });
  // Manual reset quota state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [manualResetLoading, setManualResetLoading] = useState(false);

  // Employee search and filter state
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Cleanup old records state
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const handleDepartmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDepartmentForm({ ...departmentForm, [e.target.name]: e.target.value });
  };
  // Helper to fetch departments
  const fetchDepartments = async () => {
    try {
      const data = await apiService.get(apiEndpoints.departments);
      if ((data.success || data.status === 'success') && Array.isArray(data.data)) {
        // รองรับทั้งกรณีที่ backend ส่ง array ของ string หรือ object
        setDepartments(data.data.map((d: any) =>
          typeof d === 'string'
            ? { department_name_th: d, department_name_en: d, id: d }
            : d
        ));
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching departments:', error);
      }
      setDepartments([]);
    }
  };
  const handleDepartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDepartmentId) {
        // TODO: Implement update logic
        setEditingDepartmentId(null);
      } else {
        await apiService.post(apiEndpoints.departments, {
          department_name_en: departmentForm.name_en,
          department_name_th: departmentForm.name_th
        });
        await fetchDepartments();
        showToastMessage.crud.createSuccess('department', t);
      }
      setDepartmentForm({ name_en: '', name_th: '' });
    } catch (error) {
      showToastMessage.crud.createError('department', undefined, t);
    }
  };
  const handleEditDepartment = (id: string) => {
    const dep = departments.find(dep => dep.id === id);
    if (dep) {
      setDepartmentForm({ name_en: dep.department_name_en, name_th: dep.department_name_th });
      setEditingDepartmentId(id);
    }
  };
  const handleDeleteDepartment = async (id: string) => {
    const department = departments.find(dep => dep.id === id);
    if (department) {
      setDeleteDepartmentDialog({ open: true, department });
    }
  };

  const confirmDeleteDepartment = async () => {
    if (!deleteDepartmentDialog.department) return;

    try {
      await apiService.delete(`${apiEndpoints.departments}/${deleteDepartmentDialog.department.id}`);
      await fetchDepartments();
      setDeleteDepartmentDialog({ open: false, department: null });
      showToastMessage.crud.deleteSuccess('department', t);
    } catch (error) {
      showToastMessage.crud.deleteError('department', undefined, t);
    }
  };

  // Leave type handlers
  const handleLeaveTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setLeaveTypeForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  const handleEditLeaveType = (id: string) => {
    const lt = leaveTypes.find(lt => lt.id === id);
    if (lt) {
      setLeaveTypeForm({ name_en: lt.leave_type_en, name_th: lt.leave_type_th, require_attachment: !!lt.require_attachment });
      setEditingLeaveTypeId(id);
    }
  };
  const handleDeleteLeaveType = async (id: string) => {
    const leaveType = leaveTypes.find(lt => lt.id === id);
    if (leaveType) {
      setDeleteLeaveTypeDialog({ open: true, leaveType });
    }
  };

  const confirmDeleteLeaveType = async () => {
    if (!deleteLeaveTypeDialog.leaveType) return;

    try {
      await apiService.delete(`${apiEndpoints.leaveTypes}/${deleteLeaveTypeDialog.leaveType.id}`);
      // Refresh leave types
      const data = await apiService.get(apiEndpoints.leaveTypes);
      if ((data.success || data.status === 'success') && Array.isArray(data.data)) {
        setLeaveTypes(data.data);
      }
      setDeleteLeaveTypeDialog({ open: false, leaveType: null });
      showToastMessage.crud.deleteSuccess('leaveType', t);
    } catch (error) {
      showToastMessage.crud.deleteError('leaveType', undefined, t);
    }
  };
  const handleLeaveTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLeaveTypeId) {
        // Update leave type
        await apiService.put(`${apiEndpoints.leaveTypes}/${editingLeaveTypeId}`, {
          leave_type_en: leaveTypeForm.name_en,
          leave_type_th: leaveTypeForm.name_th,
          require_attachment: leaveTypeForm.require_attachment
        });
        setEditingLeaveTypeId(null);
        // Refresh leave types
        const data = await apiService.get(apiEndpoints.leaveTypes);
        if ((data.success || data.status === 'success') && Array.isArray(data.data)) {
          setLeaveTypes(data.data);
        }
        setLeaveTypeForm({ name_en: '', name_th: '', require_attachment: false });
        showToastMessage.crud.updateSuccess('leaveType', t);
      } else {
        // เปิด dialog ให้กำหนดโควต้าต่อ position ก่อนสร้างจริง
        setNewLeaveTypeQuotas({});
        setAddLeaveTypeOpen(true);
      }
    } catch (error) {
      if (editingLeaveTypeId) {
        showToastMessage.crud.updateError('leaveType', undefined, t);
      }
    }
  };

  // ยืนยันการเพิ่ม Leave Type พร้อมกำหนดโควต้าต่อแต่ละตำแหน่ง
  const confirmCreateLeaveTypeWithQuotas = async () => {
    setAddLeaveTypeSubmitting(true);
    try {
      // 1) สร้าง leave type ใหม่ เพื่อให้ได้ id กลับมา
      const createRes = await apiService.post(apiEndpoints.leaveTypes, {
        leave_type_en: leaveTypeForm.name_en,
        leave_type_th: leaveTypeForm.name_th,
        require_attachment: leaveTypeForm.require_attachment
      });
      if (!createRes || !(createRes.success || createRes.status === 'success') || !createRes.data?.id) {
        throw new Error(createRes?.message || 'Failed to create leave type');
      }
      const newLeaveTypeId = createRes.data.id;

      // 2) อัปเดตโควต้าของแต่ละตำแหน่ง โดยรวมโควต้าเดิม + ของ leave type ใหม่นี้
      const updatePromises = positions.map((pos: any) => {
        const quotasForBackend: Record<string, number> = {};
        // โควต้าเดิมของตำแหน่ง
        pos.quotas.forEach((q: any) => {
          if (q.leaveTypeId) quotasForBackend[q.leaveTypeId] = q.quota ?? 0;
        });
        // เพิ่มค่าใหม่สำหรับ leave type ใหม่นี้ (ถ้ากรอก)
        if (typeof newLeaveTypeQuotas[pos.id] === 'number') {
          quotasForBackend[newLeaveTypeId] = Number(newLeaveTypeQuotas[pos.id]) || 0;
        }
        return apiService.put(`/api/positions-with-quotas/${pos.id}`, {
          position_name_en: pos.position_name_en,
          position_name_th: pos.position_name_th,
          quotas: quotasForBackend,
          request_quota: pos.request_quota
        });
      });
      await Promise.all(updatePromises);

      // รีเฟรชข้อมูล
      const [leaveTypesData, positionsData] = await Promise.all([
        apiService.get(apiEndpoints.leaveTypes),
        apiService.get(apiEndpoints.positionsWithQuotas)
      ]);
      if ((leaveTypesData.success || leaveTypesData.status === 'success') && Array.isArray(leaveTypesData.data)) {
        setLeaveTypes(leaveTypesData.data);
      }
      if (positionsData.success && Array.isArray(positionsData.data)) {
        setPositions(positionsData.data);
      }

      setLeaveTypeForm({ name_en: '', name_th: '', require_attachment: false });
      setAddLeaveTypeOpen(false);
      showToastMessage.crud.createSuccess('leaveType', t);
    } catch (err: any) {
      showToastMessage.crud.createError('leaveType', err?.message, t);
    } finally {
      setAddLeaveTypeSubmitting(false);
    }
  };

  const startInlineEdit = (pos: any) => {
    // Map quotas to { [leaveTypeId]: value }
    const quotas: Record<string, number> = {};
    pos.quotas.forEach((q: any) => { quotas[q.leaveTypeId] = q.quota; });
    setInlineEdit({
      id: pos.id,
      name_en: pos.position_name_en,
      name_th: pos.position_name_th,
      quotas
    });
  };
  const cancelInlineEdit = () => setInlineEdit(null);
  const handleInlineEditChange = (field: string, value: string) => {
    if (!inlineEdit) return;
    setInlineEdit({ ...inlineEdit, [field]: value });
  };
  const handleInlineQuotaChange = (leaveTypeId: string, value: string) => {
    if (!inlineEdit) return;
    setInlineEdit({ ...inlineEdit, quotas: { ...inlineEdit.quotas, [leaveTypeId]: Number(value) } });
  };
  const saveInlineEdit = async () => {
    if (!inlineEdit) return;
    setInlineEditError(null);
    try {
      // Map quotas to backend format
      const quotasForBackend: Record<string, number> = {};
      filteredLeaveTypes.forEach(lt => {
        if (inlineEdit.quotas[lt.id] !== undefined) {
          quotasForBackend[lt.id] = inlineEdit.quotas[lt.id];
        }
      });
      const data = await apiService.put(`${apiEndpoints.positionsWithQuotas}/${inlineEdit.id}`, {
        position_name_en: inlineEdit.name_en,
        position_name_th: inlineEdit.name_th,
        quotas: quotasForBackend
      });
      if (!data || !data.success) {
        setInlineEditError(data?.message || 'Unknown error');
        return;
      }
      // Refresh positions
      const positionsData = await apiService.get(apiEndpoints.positionsWithQuotas);
      if (positionsData.success && Array.isArray(positionsData.data)) {
        setPositions(positionsData.data);
      }
      setInlineEdit(null);
      showToastMessage.crud.updateSuccess('position');
    } catch (error) {
      setInlineEditError('Failed to update position');
      showToastMessage.crud.updateError('position');
    }
  };

  // Toggle Require End Date switch for a position
  const handleToggleRequestQuote = async (pos: any) => {
    const newValue = !pos.require_enddate;
    try {
      // Build quotas payload from current row
      const quotasForBackend: Record<string, number> = {};
      pos.quotas.forEach((q: any) => { if (q.leaveTypeId) quotasForBackend[q.leaveTypeId] = q.quota ?? 0; });
      const data = await apiService.put(`${apiEndpoints.positionsWithQuotas}/${pos.id}`, {
        position_name_en: pos.position_name_en,
        position_name_th: pos.position_name_th,
        quotas: quotasForBackend,
        require_enddate: newValue
      });
      if (!data || !data.success) throw new Error('Failed to update');
      // Refresh positions
      const positionsData = await apiService.get(apiEndpoints.positionsWithQuotas);
      if (positionsData.success && Array.isArray(positionsData.data)) {
        setPositions(positionsData.data);
      }
      showToastMessage.crud.updateSuccess('position', t);
    } catch (err: any) {
      showToastMessage.crud.updateError('position', err?.message, t);
    }
  };

  const startInlineDepartmentEdit = (dep: any) => {
    setInlineDepartmentEdit({ id: dep.id, name_en: dep.department_name_en, name_th: dep.department_name_th });
  };
  const cancelInlineDepartmentEdit = () => setInlineDepartmentEdit(null);
  const handleInlineDepartmentEditChange = (field: string, value: string) => {
    if (!inlineDepartmentEdit) return;
    setInlineDepartmentEdit({ ...inlineDepartmentEdit, [field]: value });
  };
  const saveInlineDepartmentEdit = async () => {
    if (!inlineDepartmentEdit) return;
    setInlineDepartmentError(null);
    try {
      const data = await apiService.put(`${apiEndpoints.departments}/${inlineDepartmentEdit.id}`, {
        department_name_en: inlineDepartmentEdit.name_en,
        department_name_th: inlineDepartmentEdit.name_th
      });
      if (!data || !data.success) {
        setInlineDepartmentError(data?.message || 'Unknown error');
        return;
      }
      await fetchDepartments();
      setInlineDepartmentEdit(null);
      showToastMessage.crud.updateSuccess('department', t);
    } catch (error) {
      setInlineDepartmentError('Failed to update department');
      showToastMessage.crud.updateError('department', undefined, t);
    }
  };

  // Add state for inline editing leave type
  const [inlineLeaveTypeEdit, setInlineLeaveTypeEdit] = useState<null | { id: string; name_en: string; name_th: string; require_attachment: boolean }>(null);
  const [inlineLeaveTypeError, setInlineLeaveTypeError] = useState<string | null>(null);

  const startInlineLeaveTypeEdit = (lt: any) => {
    setInlineLeaveTypeEdit({ id: lt.id, name_en: lt.leave_type_en, name_th: lt.leave_type_th, require_attachment: !!lt.require_attachment });
  };
  const cancelInlineLeaveTypeEdit = () => setInlineLeaveTypeEdit(null);
  const handleInlineLeaveTypeEditChange = (field: string, value: string) => {
    if (!inlineLeaveTypeEdit) return;
    setInlineLeaveTypeEdit({ ...inlineLeaveTypeEdit, [field]: value });
  };
  const saveInlineLeaveTypeEdit = async () => {
    if (!inlineLeaveTypeEdit) return;
    setInlineLeaveTypeError(null);
    try {
      const data = await apiService.put(`${apiEndpoints.leaveTypes}/${inlineLeaveTypeEdit.id}`, {
        leave_type_en: inlineLeaveTypeEdit.name_en,
        leave_type_th: inlineLeaveTypeEdit.name_th,
        require_attachment: inlineLeaveTypeEdit.require_attachment
      });
      if (!data || !data.success) {
        setInlineLeaveTypeError(data?.message || 'Unknown error');
        return;
      }
      // Refresh leave types
      const leaveTypesData = await apiService.get(apiEndpoints.leaveTypes);
      if ((leaveTypesData.success || leaveTypesData.status === 'success') && Array.isArray(leaveTypesData.data)) {
        setLeaveTypes(leaveTypesData.data);
      }
      setInlineLeaveTypeEdit(null);
      showToastMessage.crud.updateSuccess('leaveType', t);
    } catch (error) {
      setInlineLeaveTypeError('Failed to update leave type');
      showToastMessage.crud.updateError('leaveType', undefined, t);
    }
  };

  // Fetch positions with quotas on mount
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const data = await apiService.get(apiEndpoints.positionsWithQuotas);
        if (data.success && Array.isArray(data.data)) {
          setPositions(data.data);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching positions:', error);
        }
        setPositions([]);
      }
    };
    fetchPositions();
  }, []);

  // Fetch departments and leave types with new structure
  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchDepartments();
        const data = await apiService.get(apiEndpoints.leaveTypes);
        if ((data.success || data.status === 'success') && Array.isArray(data.data)) {
          setLeaveTypes(data.data.map((lt: any) => ({
            ...lt,
            leave_type_en: lt.leave_type_en || lt.leave_type,
            leave_type_th: lt.leave_type_th || lt.leave_type
          })));
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching data:', error);
        }
        setLeaveTypes([]);
      }
    };
    fetchData();
  }, []);

  // Position handlers
  const handlePositionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    setPositionForm({ ...positionForm, [name]: type === 'checkbox' ? checked : value });
  };
  // Change how quotas are built and handled for positions
  const handleQuotaChange = (leaveTypeId: string, value: string) => {
    setPositionForm({ ...positionForm, quotas: { ...positionForm.quotas, [leaveTypeId]: Number(value) } });
  };
  // Helper to filter out emergency leave types for position form/table only
  const filteredLeaveTypes = leaveTypes.filter(
    lt => lt.leave_type_en?.toLowerCase() !== 'emergency' && lt.leave_type_th !== ''
  );

  const handlePositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPositionError(null);
    try {
      if (editingPositionId) {
        // TODO: Implement update logic
        setEditingPositionId(null);
      } else {
        // Map leaveTypeId to value for backend
        const quotasForBackend: Record<string, number> = {};
        filteredLeaveTypes.forEach(lt => {
          if (positionForm.quotas[lt.id] !== undefined) {
            quotasForBackend[lt.id] = positionForm.quotas[lt.id];
          }
        });
        const data = await apiService.post(apiEndpoints.positionsWithQuotas, {
          position_name_en: positionForm.name_en,
          position_name_th: positionForm.name_th,
          quotas: quotasForBackend,
          require_enddate: positionForm.require_enddate
        });
        if (!data || !data.success) {
          setPositionError(data?.message || 'Unknown error');
          return;
        }
        // Refresh positions
        const positionsData = await apiService.get(apiEndpoints.positionsWithQuotas);
        if (positionsData.success && Array.isArray(positionsData.data)) {
          setPositions(positionsData.data);
        }
        setPositionForm({ name_en: '', name_th: '', quotas: {}, require_enddate: false });
        showToastMessage.crud.createSuccess('position', t);
      }
    } catch (err: any) {
      setPositionError(err.message || 'Unknown error');
      showToastMessage.crud.createError('position', undefined, t);
    }
  };
  const handleEditPosition = (id: string) => {
    const pos = positions.find(pos => pos.id === id);
    if (pos) {
      setPositionForm({
        name_en: pos.position_name_en,
        name_th: pos.position_name_th,
        quotas: pos.quotas,
        require_enddate: !!pos.require_enddate
      });
      setEditingPositionId(id);
    }
  };
  const handleDeletePosition = async (id: string) => {
    const position = positions.find(pos => pos.id === id);
    if (position) {
      setDeletePositionDialog({ open: true, position });
    }
  };

  const confirmDeletePosition = async () => {
    if (!deletePositionDialog.position) return;

    try {
      await apiService.delete(`${apiEndpoints.positionsWithQuotas}/${deletePositionDialog.position.id}`);
      // Refresh positions
      const data = await apiService.get(apiEndpoints.positionsWithQuotas);
      if (data.success && Array.isArray(data.data)) {
        setPositions(data.data);
      }
      setDeletePositionDialog({ open: false, position: null });
      showToastMessage.crud.deleteSuccess('position', t);
    } catch (error) {
      showToastMessage.crud.deleteError('position', undefined, t);
    }
  };

  // Add a handler for toggling require_attachment
  const handleToggleRequireAttachment = async (lt: any) => {
    const newValue = !lt.require_attachment;
    try {
      const data = await apiService.put(`${apiEndpoints.leaveTypes}/${lt.id}`, {
        leave_type_en: lt.leave_type_en,
        leave_type_th: lt.leave_type_th,
        require_attachment: newValue
      });
      if (!data || !data.success) throw new Error('Failed to update');
      setLeaveTypes(prev => prev.map(l => l.id === lt.id ? { ...l, require_attachment: newValue } : l));
      showToastMessage.crud.updateSuccess('leaveType', t);
    } catch (err: any) {
      showToastMessage.crud.updateError('leaveType', err.message, t);
    }
  };

  // ฟังก์ชันช่วยเลือกชื่อ position ตามภาษา
  const getPositionDisplayName = (position: any, lang: string) => {
    if (!position) return '';
    return lang === 'th' ? position.position_name_th : position.position_name_en;
  };
  // ฟังก์ชันช่วยเลือกชื่อ department ตามภาษา
  const getDepartmentDisplayName = (department: any, lang: string) => {
    if (!department) return '';
    return lang === 'th' ? department.department_name_th : department.department_name_en;
  };
  // ฟังก์ชันช่วยเลือกชื่อ leave type ตามภาษา
  const getLeaveTypeDisplayName = (leaveType: any, lang: string) => {
    if (!leaveType) return '';
    return lang === 'th' ? leaveType.leave_type_th : leaveType.leave_type_en;
  };

  // Fetch all employees for selection (simple list of ids+names)
  const [employeeOptions, setEmployeeOptions] = useState<{ id: string; name: string; avatar?: string | null }[]>([]);
  const fetchEmployeesForReset = async () => {
    try {
      const data = await apiService.get(apiEndpoints.employees.list);
      if ((data.success || data.status === 'success') && Array.isArray(data.data)) {
        const baseUrl = config.api.baseUrl;
        const opts = data.data.map((e: any) => ({
          id: e.id,
          name: e.name || e.email || e.id,
          avatar: e.avatar ? `${baseUrl}${e.avatar}` : null
        }));
        setEmployeeOptions(opts);
      }
    } catch (e) { setEmployeeOptions([]); }
  };
  useEffect(() => { fetchEmployeesForReset(); }, []);

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Derived list with search / selected-only filters and stabilized order
  const filteredEmployees2 = employeeOptions
    .filter(e => {
      if (showSelectedOnly && !selectedUserIds.includes(e.id)) return false;
      if (!employeeSearch.trim()) return true;
      const q = employeeSearch.trim().toLowerCase();
      return (e.name || '').toLowerCase().includes(q) || String(e.id).toLowerCase().includes(q);
    })
    .sort((a, b) => {
      // Selected first, then by name
      const aSel = selectedUserIds.includes(a.id) ? 1 : 0;
      const bSel = selectedUserIds.includes(b.id) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;
      return (a.name || '').localeCompare(b.name || '');
    });

  const selectAllFiltered = () => {
    const addIds = filteredEmployees2.map(e => e.id);
    setSelectedUserIds(prev => Array.from(new Set([...prev, ...addIds])));
  };

  const clearFilteredSelection = () => {
    const removeSet = new Set(filteredEmployees2.map(e => e.id));
    setSelectedUserIds(prev => prev.filter(id => !removeSet.has(id)));
  };

  const handleManualReset = async () => {
    if (selectedUserIds.length === 0) {
      showToast.warning(t('leave.selectUsersFirst'));
      return;
    }
    setManualResetLoading(true);
    try {
      const res = await apiService.post(apiEndpoints.leaveQuotaReset.resetByUsers, { userIds: selectedUserIds, strategy: QUOTA_RESET_STRATEGIES.ZERO });
      if (!res || !(res.success || res.status === 'success')) throw new Error(res?.message || 'Failed');
      showToast.success(t('leave.manualResetSuccess'));
    } catch (err: any) {
      showToast.error(err?.message || t('leave.manualResetFailed'));
    } finally {
      setManualResetLoading(false);
    }
  };

  const handleCleanupOldRecords = async () => {
    setCleanupLoading(true);
    try {
      const response = await apiService.post(apiEndpoints.superAdmin.cleanupOldLeaveRequests, {});

      if (response.success) {
        showToast.success(t('common.cleanupSuccess'));
      } else {
        showToast.error(t('common.cleanupError'));
      }
    } catch (error: any) {
      showToast.error(t('common.cleanupError'));
    } finally {
      setCleanupLoading(false);
    }
  };

  // Confirm dialog for manual reset
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const openConfirmReset = () => {
    if (selectedUserIds.length === 0) {
      showToast.warning(t('leave.selectUsersFirst'));
      return;
    }
    setConfirmResetOpen(true);
  };

  // Confirm dialog for cleanup old records
  const [confirmCleanupOpen, setConfirmCleanupOpen] = useState(false);
  const openConfirmCleanup = () => setConfirmCleanupOpen(true);



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

        {/* Sidebar Trigger */}
        <div className="absolute top-4 left-4 z-20">
          <SidebarTrigger className="bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-lg backdrop-blur-sm" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center py-8 md:py-16">
          <img src={config.assets.logo} alt="Logo" className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-2xl border-4 border-white dark:border-gray-700 mb-4" />
          <h1 className="text-2xl md:text-5xl font-extrabold text-indigo-900 dark:text-gray-100 drop-shadow mb-2 flex items-center gap-3">
            {t('navigation.manageAll')}
          </h1>
          <p className="text-sm md:text-xl text-blue-900/70 dark:text-gray-300 mb-2 font-medium text-center max-w-2xl px-4">
            {t('main.manageAllDesc')}
          </p>
        </div>
      </div>
      <div className="w-full max-w-7xl mx-auto px-4 py-4 md:py-8">
        <div className="bg-white/70 dark:bg-gray-900/90 backdrop-blur-md rounded-3xl shadow-2xl p-4 md:p-8">
          <Tabs defaultValue="positions" className="w-full" >
            <TabsList className="mb-6 md:mb-10 bg-indigo-50 dark:bg-gray-800/90 rounded-2xl shadow-inner grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 justify-center py-3 px-4 h-auto" >
              <TabsTrigger value="positions" className="w-full data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-indigo-700 font-bold text-lg md:text-xl py-3 px-4 md:px-6 rounded-2xl transition-all flex items-center justify-center gap-2">
                <span role="img" aria-label="positions">🧑‍💼</span> {t('positions.positions')}
              </TabsTrigger>
              <TabsTrigger value="departments" className="w-full data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-indigo-700 font-bold text-lg md:text-xl py-3 px-4 md:px-6 rounded-2xl transition-all flex items-center justify-center gap-2">
                <span role="img" aria-label="departments">🏢</span> {t('departments.departments')}
              </TabsTrigger>
              <TabsTrigger value="leaveTypes" className="w-full data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-indigo-700 font-bold text-lg md:text-xl py-3 px-4 md:px-6 rounded-2xl transition-all flex items-center justify-center gap-2">
                <span role="img" aria-label="leaveTypes">📝</span> {t('leave.leaveType')}
              </TabsTrigger>
              <TabsTrigger value="quota" className="w-full data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-indigo-700 font-bold text-lg md:text-xl py-3 px-4 md:px-6 rounded-2xl transition-all flex items-center justify-center gap-2">
                <span role="img" aria-label="quota">📊</span> {t('leave.quota')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="positions">
              <div className="rounded-2xl shadow overflow-hidden mb-8">
                <div className="bg-blue-600 px-6 py-3">
                  <h2 className="text-lg font-bold text-white">{t('positions.positions')}</h2>
                </div>
                <div className="p-6">
                  <form onSubmit={handlePositionSubmit} className="mb-6 flex flex-col gap-4 bg-blue-50 dark:bg-gray-800/90 rounded-xl p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4">
                      <Input name="name_en" value={positionForm.name_en} onChange={handlePositionChange} placeholder="Position (EN)" required className="flex-1 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:placeholder-gray-500" />
                      <Input name="name_th" value={positionForm.name_th} onChange={handlePositionChange} placeholder="Position (TH)" required className="flex-1 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:placeholder-gray-500" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredLeaveTypes.map(lt => (
                        <div key={lt.id} className="flex flex-col">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{lang === 'th' ? lt.leave_type_th : lt.leave_type_en}</label>
                          <Input
                            type="number"
                            min={0}
                            name={`quota_${lt.id}`}
                            placeholder="0"
                            value={positionForm.quotas[lt.id] || ''}
                            onChange={e => handleQuotaChange(lt.id, e.target.value)}
                            required
                            className="dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:placeholder-gray-500"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
                      <label className="flex items-center gap-3 w-full sm:w-auto">
                        <input
                          type="checkbox"
                          name="require_enddate"
                          checked={positionForm.require_enddate}
                          onChange={handlePositionChange}
                          className="accent-blue-600 h-5 w-5 rounded border-gray-300 focus:ring-2 focus:ring-blue-400 transition-all"
                        />
                        <span className="text-base font-medium select-none cursor-pointer whitespace-nowrap dark:text-gray-300">
                          {t('positions.requestQuote')}
                        </span>
                      </label>

                      <Button type="submit" className="btn-primary w-full sm:w-auto min-w-[100px]">{editingPositionId ? t('common.update') : t('common.add')}</Button>
                    </div>
                    {positionError && (
                      <div className="text-red-600 font-semibold mt-2">{positionError}</div>
                    )}
                  </form>
                  <div className="overflow-x-auto rounded-xl shadow">
                    <table className="w-full table-auto bg-white dark:bg-gray-900 rounded-xl">
                      <thead>
                        <tr className="bg-blue-100 dark:bg-gray-800 text-blue-900 dark:text-blue-100">

                          <th className="p-3">{t('positions.position')} (EN)</th>
                          <th className="p-3">{t('positions.position')} (TH)</th>
                          <th className="p-3">{t('positions.requestQuote')}</th>
                          {filteredLeaveTypes.map(lt => (
                            <th key={lt.id} className="p-3">{lang === 'th' ? lt.leave_type_th : lt.leave_type_en}</th>
                          ))}
                          <th className="p-3 text-center">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map(pos => (
                          <tr key={pos.id} className="hover:bg-blue-50">
                            {inlineEdit && inlineEdit.id === pos.id ? (
                              <>
                                <td className="p-3 font-medium">
                                  <Input value={inlineEdit.name_en} onChange={e => handleInlineEditChange('name_en', e.target.value)} className="w-32" />
                                </td>
                                <td className="p-3 font-medium">
                                  <Input value={inlineEdit.name_th} onChange={e => handleInlineEditChange('name_th', e.target.value)} className="w-32" />
                                </td>
                                <td className="p-3 font-medium text-center">
                                  <label style={{ display: 'inline-block', position: 'relative', width: 40, height: 24 }}>
                                    <input type="checkbox" checked={!!pos.require_enddate} style={{ opacity: 0, width: 0, height: 0 }} tabIndex={-1} readOnly />
                                    <span style={{ position: 'absolute', cursor: 'not-allowed', top: 0, left: 0, right: 0, bottom: 0, background: !!pos.require_enddate ? '#64b5f6' : '#ccc', borderRadius: 24, transition: 'background 0.2s', display: 'block' }}>
                                      <span style={{ position: 'absolute', left: !!pos.require_enddate ? 20 : 2, top: 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                                    </span>
                                  </label>
                                </td>
                                {filteredLeaveTypes.map(lt => (
                                  <td key={lt.id} className="p-3">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={inlineEdit.quotas[lt.id] || ''}
                                      onChange={e => handleInlineQuotaChange(lt.id, e.target.value)}
                                      className="w-20"
                                    />
                                  </td>
                                ))}
                                <td className="p-3 flex gap-2 justify-center">
                                  <Button variant="outline" onClick={saveInlineEdit}>{t('common.save')}</Button>
                                  <Button variant="destructive" onClick={cancelInlineEdit}>{t('common.cancel')}</Button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 font-medium">{pos.position_name_en}</td>
                                <td className="p-3 font-medium">{pos.position_name_th}</td>
                                <td className="p-3 font-medium text-center">
                                  <label style={{ display: 'inline-block', position: 'relative', width: 40, height: 24 }}>
                                    <input
                                      type="checkbox"
                                      checked={!!pos.require_enddate}
                                      onChange={() => handleToggleRequestQuote(pos)}
                                      style={{ opacity: 0, width: 0, height: 0 }}
                                      tabIndex={-1}
                                    />
                                    <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: !!pos.require_enddate ? '#64b5f6' : '#ccc', borderRadius: 24, transition: 'background 0.2s', display: 'block' }}>
                                      <span style={{ position: 'absolute', left: !!pos.require_enddate ? 20 : 2, top: 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                                    </span>
                                  </label>
                                </td>
                                {filteredLeaveTypes.map(lt => (
                                  <td key={lt.id} className="p-3">
                                    {pos.quotas.find((q: any) => q.leaveTypeId === lt.id)?.quota ?? ''}
                                  </td>
                                ))}
                                <td className="p-3 flex gap-2 justify-center">
                                  <Button variant="outline" onClick={() => startInlineEdit(pos)}>{t('common.edit')}</Button>
                                  <Button variant="destructive" onClick={() => handleDeletePosition(pos.id)}>{t('common.delete')}</Button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="quota">
              <div className="rounded-2xl shadow overflow-hidden mb-8">
                <div className="bg-blue-600 px-6 py-3">
                  <h2 className="text-lg font-bold text-white">{t('leave.quota')}</h2>
                </div>
                <div className="p-6 space-y-6">
                  {/* Manual reset section */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <h3 className="text-blue-900 dark:text-blue-100 font-semibold mb-3">{t('leave.manualReset')}</h3>
                    {/* Controls */}
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
                      <div className="flex-1 flex flex-col sm:flex-row gap-2">
                        <Input
                          value={employeeSearch}
                          onChange={e => setEmployeeSearch(e.target.value)}
                          placeholder={t('common.searchEmployee', 'Search employee by name or id')}
                          className="w-full md:w-80 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
                        />
                        <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded border bg-blue-50 dark:bg-gray-700 text-blue-900 dark:text-blue-100 whitespace-nowrap dark:border-gray-600">
                          <input type="checkbox" checked={showSelectedOnly} onChange={e => setShowSelectedOnly(e.target.checked)} className="accent-blue-600" />
                          {t('common.showSelectedOnly', 'Show selected only')}
                        </label>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" className="flex-1 sm:flex-none" onClick={selectAllFiltered}>{t('common.selectAllFiltered', 'Select all (filtered)')}</Button>
                        <Button variant="outline" className="flex-1 sm:flex-none" onClick={clearFilteredSelection}>{t('common.clearFiltered', 'Clear (filtered)')}</Button>
                      </div>
                    </div>
                    {/* Counter */}
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {t('common.showing', 'Showing')}: <span className="font-medium">{filteredEmployees2.length}</span> / {employeeOptions.length}
                      {' · '}
                      {t('common.selected', 'Selected')}: <span className="font-medium">{selectedUserIds.length}</span>
                    </div>
                    {/* List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-auto border dark:border-gray-700 rounded p-2">
                      {filteredEmployees2.length === 0 ? (
                        <div className="col-span-full text-center text-gray-500 py-6">{t('common.noResults', 'No results')}</div>
                      ) : (
                        filteredEmployees2.map(e => (
                          <label key={e.id} className="flex items-center gap-3 text-sm p-2 rounded hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer">
                            <input type="checkbox" className="mt-0.5" checked={selectedUserIds.includes(e.id)} onChange={() => toggleSelectUser(e.id)} />
                            <span className="flex items-center gap-2">
                              <img src={e.avatar || config.assets.defaultAvatar} alt={e.name} className="w-6 h-6 rounded-full object-cover border" />
                              <span className="font-medium text-blue-900 dark:text-blue-100 truncate max-w-[220px]" title={e.name}>{e.name}</span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Button onClick={openConfirmReset} disabled={manualResetLoading || selectedUserIds.length === 0} className="btn-primary">
                        {manualResetLoading ? t('common.loading') : t('leave.resetNow')}
                      </Button>

                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <h3 className="text-blue-900 dark:text-blue-100 font-semibold mb-3">{t('leave.note')}</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{t('leave.noteDetail')}</p>
                  </div>

                  {/* Cleanup old records section */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <h3 className="text-blue-900 dark:text-blue-100 font-semibold mb-3">{t('common.cleanupTitle')}</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{t('common.cleanupDescription')}</p>
                    <Button
                      onClick={openConfirmCleanup}
                      disabled={cleanupLoading}
                      variant="outline"
                      className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                    >
                      {cleanupLoading ? t('common.cleanupButtonLoading') : t('common.cleanupButton')}
                    </Button>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <h3 className="text-blue-900 dark:text-blue-100 font-semibold mb-3">{t('positions.positions')}</h3>
                    <div className="overflow-x-auto rounded-xl">
                      <table className="w-full table-auto bg-white dark:bg-gray-900 rounded-xl">
                        <thead>
                          <tr className="bg-blue-100 dark:bg-gray-700 text-blue-900 dark:text-blue-100">
                            <th className="p-3">{t('positions.position')} (EN)</th>
                            <th className="p-3">{t('positions.position')} (TH)</th>
                            <th className="p-3 text-center">{t('positions.newYearQuota')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {positions.map(pos => (
                            <tr key={pos.id} className="hover:bg-blue-50 dark:hover:bg-gray-700">
                              <td className="p-3 font-medium">{pos.position_name_en}</td>
                              <td className="p-3 font-medium">{pos.position_name_th}</td>
                              <td className="p-3 font-medium text-center">
                                <label style={{ display: 'inline-block', position: 'relative', width: 40, height: 24 }}>
                                  <input
                                    type="checkbox"
                                    checked={Number(pos.new_year_quota) === 1}
                                    onChange={() => handleToggleNewYearQuota(pos)}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                    tabIndex={-1}
                                  />
                                  <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: Number(pos.new_year_quota) === 1 ? '#64b5f6' : '#ccc', borderRadius: 24, transition: 'background 0.2s', display: 'block' }}>
                                    <span style={{ position: 'absolute', left: Number(pos.new_year_quota) === 1 ? 20 : 2, top: 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                                  </span>
                                </label>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="departments">
              <div className="rounded-2xl shadow overflow-hidden mb-8">
                <div className="bg-blue-600 px-6 py-3">
                  <h2 className="text-lg font-bold text-white">{t('departments.departments')}</h2>
                </div>
                <div className="p-4 md:p-6">
                  <form onSubmit={handleDepartmentSubmit} className="mb-6 flex flex-col md:flex-row gap-4 items-end bg-blue-50 dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm">
                    <Input name="name_en" value={departmentForm.name_en} onChange={handleDepartmentChange} placeholder="Department Name (EN)" required className="w-full md:w-64 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700" />
                    <Input name="name_th" value={departmentForm.name_th} onChange={handleDepartmentChange} placeholder="Department Name (TH)" required className="w-full md:w-64 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700" />
                    <Button type="submit" className="btn-primary w-full md:w-auto">{editingDepartmentId ? t('common.update') : t('common.add')}</Button>
                  </form>
                  <div className="overflow-x-auto rounded-xl shadow">
                    <table className="w-full table-auto bg-white dark:bg-gray-900 rounded-xl">
                      <thead>
                        <tr className="bg-blue-100 dark:bg-gray-800 text-blue-900 dark:text-blue-100">
                          <th className="p-3">{t('departments.departments')} (EN)</th>
                          <th className="p-3">{t('departments.departments')} (TH)</th>
                          <th className="p-3 text-center">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departments.map(dep => (
                          <tr key={dep.id} className="hover:bg-blue-50 dark:hover:bg-gray-800">
                            {inlineDepartmentEdit && inlineDepartmentEdit.id === dep.id ? (
                              <>
                                <td className="p-3 font-medium">
                                  <Input value={inlineDepartmentEdit.name_en} onChange={e => handleInlineDepartmentEditChange('name_en', e.target.value)} className="w-32 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600" />
                                </td>
                                <td className="p-3 font-medium">
                                  <Input value={inlineDepartmentEdit.name_th} onChange={e => handleInlineDepartmentEditChange('name_th', e.target.value)} className="w-32 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600" />
                                </td>
                                <td className="p-3 flex gap-2 justify-center">
                                  <Button variant="outline" onClick={saveInlineDepartmentEdit}>{t('common.save')}</Button>
                                  <Button variant="destructive" onClick={cancelInlineDepartmentEdit}>{t('common.cancel')}</Button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 font-medium">{dep.department_name_en}</td>
                                <td className="p-3 font-medium">{dep.department_name_th}</td>
                                <td className="p-3 flex gap-2 justify-center">
                                  <Button variant="outline" onClick={() => startInlineDepartmentEdit(dep)}>{t('common.edit')}</Button>
                                  <Button variant="destructive" onClick={() => handleDeleteDepartment(dep.id)}>{t('common.delete')}</Button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {inlineDepartmentEdit && inlineDepartmentError && (
                          <tr><td colSpan={3} className="text-red-600 font-semibold mt-2">{inlineDepartmentError}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="leaveTypes">
              <div className="rounded-2xl shadow overflow-hidden mb-8">
                <div className="bg-blue-600 px-6 py-3">
                  <h2 className="text-lg font-bold text-white">{t('leave.leaveType')}</h2>
                </div>
                <div className="p-4 md:p-6">
                  <form onSubmit={handleLeaveTypeSubmit} className="mb-6 flex flex-col md:flex-row items-start md:items-end bg-blue-50 dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm gap-4">
                    <div className="flex flex-col md:flex-row flex-1 gap-4 items-start md:items-end w-full">
                      <Input name="name_en" value={leaveTypeForm.name_en} onChange={handleLeaveTypeChange} placeholder="Leave Type Name (EN)" required className="w-full md:w-64 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700" />
                      <Input name="name_th" value={leaveTypeForm.name_th} onChange={handleLeaveTypeChange} placeholder="Leave Type Name (TH)" required className="w-full md:w-64 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700" />
                      <div className="flex items-center gap-3 ml-0 md:ml-2 mb-0 md:mb-2 h-10">
                        <input
                          type="checkbox"
                          name="require_attachment"
                          checked={leaveTypeForm.require_attachment}
                          onChange={e => setLeaveTypeForm(prev => ({ ...prev, require_attachment: e.target.checked }))}
                          className="accent-blue-600 h-5 w-5 rounded border-gray-300 focus:ring-2 focus:ring-blue-400 transition-all"
                          id="require-attachment-checkbox"
                        />
                        <label htmlFor="require-attachment-checkbox" className="text-base font-medium select-none cursor-pointer whitespace-nowrap dark:text-gray-300">
                          {t('leave.requiresAttachment')}
                        </label>
                      </div>
                    </div>
                    <div className="flex-1 flex justify-end w-full md:w-auto">
                      <Button type="submit" className="btn-primary w-full md:w-auto">{editingLeaveTypeId ? t('common.update') : t('common.add')}</Button>
                    </div>
                  </form>
                  <div className="overflow-x-auto rounded-xl shadow">
                    <table className="w-full table-auto bg-white dark:bg-gray-900 rounded-xl">
                      <thead>
                        <tr className="bg-blue-100 dark:bg-gray-800 text-blue-900 dark:text-blue-100">
                          <th className="p-3">{t('leave.leaveType')} (EN)</th>
                          <th className="p-3">{t('leave.leaveType')} (TH)</th>
                          <th className="p-3">{t('leave.requiresAttachment')}</th>
                          <th className="p-3 text-center">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveTypes.map(lt => (
                          <tr key={lt.id} className="hover:bg-blue-50 dark:hover:bg-gray-800">
                            {inlineLeaveTypeEdit && inlineLeaveTypeEdit.id === lt.id ? (
                              <>
                                <td className="p-3 font-medium">
                                  <Input value={inlineLeaveTypeEdit.name_en} onChange={e => handleInlineLeaveTypeEditChange('name_en', e.target.value)} className="w-32 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600" />
                                </td>
                                <td className="p-3 font-medium">
                                  <Input value={inlineLeaveTypeEdit.name_th} onChange={e => handleInlineLeaveTypeEditChange('name_th', e.target.value)} className="w-32 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600" />
                                </td>
                                <td className="p-3 font-medium text-center">
                                  <label style={{ display: 'inline-block', position: 'relative', width: 40, height: 24 }}>
                                    <input
                                      type="checkbox"
                                      checked={inlineLeaveTypeEdit?.id === lt.id ? !!inlineLeaveTypeEdit.require_attachment : !!lt.require_attachment}
                                      onChange={inlineLeaveTypeEdit?.id === lt.id ? (e => setInlineLeaveTypeEdit(edit => edit ? { ...edit, require_attachment: e.target.checked } : edit)) : undefined}
                                      style={{ opacity: 0, width: 0, height: 0 }}
                                      tabIndex={-1}
                                      readOnly={inlineLeaveTypeEdit?.id !== lt.id}
                                    />
                                    <span
                                      style={{
                                        position: 'absolute',
                                        cursor: 'pointer',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: (inlineLeaveTypeEdit?.id === lt.id ? !!inlineLeaveTypeEdit.require_attachment : !!lt.require_attachment) ? '#64b5f6' : '#ccc',
                                        borderRadius: 24,
                                        transition: 'background 0.2s',
                                        display: 'block',
                                      }}
                                    >
                                      <span
                                        style={{
                                          position: 'absolute',
                                          left: (inlineLeaveTypeEdit?.id === lt.id ? !!inlineLeaveTypeEdit.require_attachment : !!lt.require_attachment) ? 20 : 2,
                                          top: 2,
                                          width: 20,
                                          height: 20,
                                          background: '#fff',
                                          borderRadius: '50%',
                                          transition: 'left 0.2s',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                        }}
                                      />
                                    </span>
                                  </label>
                                </td>
                                <td className="p-3 flex gap-2 justify-center">
                                  <Button variant="outline" onClick={saveInlineLeaveTypeEdit}>{t('common.save')}</Button>
                                  <Button variant="destructive" onClick={cancelInlineLeaveTypeEdit}>{t('common.cancel')}</Button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 font-medium">{lt.leave_type_en}</td>
                                <td className="p-3 font-medium">{lt.leave_type_th}</td>
                                <td className="p-3 font-medium text-center">
                                  <label style={{ display: 'inline-block', position: 'relative', width: 40, height: 24 }}>
                                    <input
                                      type="checkbox"
                                      checked={!!lt.require_attachment}
                                      onChange={() => handleToggleRequireAttachment(lt)}
                                      style={{ opacity: 0, width: 0, height: 0 }}
                                      tabIndex={-1}
                                    />
                                    <span
                                      style={{
                                        position: 'absolute',
                                        cursor: 'pointer',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: lt.require_attachment ? '#64b5f6' : '#ccc',
                                        borderRadius: 24,
                                        transition: 'background 0.2s',
                                        display: 'block',
                                      }}
                                    >
                                      <span
                                        style={{
                                          position: 'absolute',
                                          left: lt.require_attachment ? 20 : 2,
                                          top: 2,
                                          width: 20,
                                          height: 20,
                                          background: '#fff',
                                          borderRadius: '50%',
                                          transition: 'left 0.2s',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                        }}
                                      />
                                    </span>
                                  </label>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex gap-2 justify-center">
                                    <Button variant="outline" onClick={() => startInlineLeaveTypeEdit(lt)}>{t('common.edit')}</Button>
                                    <Button variant="destructive" onClick={() => handleDeleteLeaveType(lt.id)}>{t('common.delete')}</Button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {inlineLeaveTypeEdit && inlineLeaveTypeError && (
                          <tr><td colSpan={4} className="text-red-600 font-semibold mt-2">{inlineLeaveTypeError}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Add Leave Type with quotas dialog */}
      <Dialog open={addLeaveTypeOpen} onOpenChange={setAddLeaveTypeOpen}>
        <DialogContent className="max-w-3xl dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle>{t('leave.addLeaveTypeQuota', 'กำหนดโควต้าต่อแต่ละตำแหน่ง')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('leave.fillQuotaForPositions', 'กรอกจำนวนโควต้าของประเภทการลาใหม่นี้สำหรับแต่ละตำแหน่ง')}
            </div>
            <div className="overflow-x-auto rounded-xl">
              <table className="w-full table-auto bg-white dark:bg-gray-800 rounded-xl">
                <thead>
                  <tr className="bg-blue-100 dark:bg-gray-700 text-blue-900 dark:text-blue-100">
                    <th className="p-3 text-left">{t('positions.position')} (EN)</th>
                    <th className="p-3 text-left">{t('positions.position')} (TH)</th>
                    <th className="p-3 text-left">{t('leave.quota', 'Quota')}</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos: any) => (
                    <tr key={pos.id} className="hover:bg-blue-50 dark:hover:bg-gray-700">
                      <td className="p-3 font-medium">{pos.position_name_en}</td>
                      <td className="p-3 font-medium">{pos.position_name_th}</td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min={0}
                          value={newLeaveTypeQuotas[pos.id] ?? ''}
                          onChange={(e) => setNewLeaveTypeQuotas(prev => ({ ...prev, [pos.id]: Number(e.target.value) }))}
                          className="w-28 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-600"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLeaveTypeOpen(false)} disabled={addLeaveTypeSubmitting}>
              {t('common.cancel', 'ยกเลิก')}
            </Button>
            <Button onClick={confirmCreateLeaveTypeWithQuotas} disabled={addLeaveTypeSubmitting} className="btn-primary">
              {addLeaveTypeSubmitting ? t('common.loading') : t('common.save', 'บันทึก')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Delete Confirmation Dialogs */}

      {/* Position Delete Confirmation */}
      <AlertDialog open={deletePositionDialog.open} onOpenChange={(open) => setDeletePositionDialog({ open, position: null })}>
        <AlertDialogContent className="dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.confirmDeletePosition')} "
              {getPositionDisplayName(deletePositionDialog.position, lang)}"
              {t('common.confirmDeleteQuestion')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePosition} className="bg-red-600 hover:bg-red-700">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm manual reset dialog */}
      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent className="dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leave.confirmManualResetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('leave.confirmManualResetDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmResetOpen(false); handleManualReset(); }} className="bg-blue-600 hover:bg-blue-700">
              {t('leave.resetNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm cleanup old records dialog */}
      <AlertDialog open={confirmCleanupOpen} onOpenChange={setConfirmCleanupOpen}>
        <AlertDialogContent className="dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.cleanupTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.cleanupDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmCleanupOpen(false); handleCleanupOldRecords(); }} className="bg-red-600 hover:bg-red-700">
              {t('common.cleanupButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Department Delete Confirmation */}
      <AlertDialog open={deleteDepartmentDialog.open} onOpenChange={(open) => setDeleteDepartmentDialog({ open, department: null })}>
        <AlertDialogContent className="dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.confirmDeleteDepartment')} "
              {getDepartmentDisplayName(deleteDepartmentDialog.department, lang)}"
              {t('common.confirmDeleteQuestion')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDepartment} className="bg-red-600 hover:bg-red-700">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Type Delete Confirmation */}
      <AlertDialog open={deleteLeaveTypeDialog.open} onOpenChange={(open) => setDeleteLeaveTypeDialog({ open, leaveType: null })}>
        <AlertDialogContent className="dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.confirmDeleteLeaveType')} "
              {getLeaveTypeDisplayName(deleteLeaveTypeDialog.leaveType, lang)}"
              {t('common.confirmDeleteQuestion')}
              <br />
              <span className="text-red-600 font-semibold">
                {t('common.warningDeleteLeaveType')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteLeaveType} className="bg-red-600 hover:bg-red-700">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer */}
      <footer className="w-full mt-16 py-8 bg-white dark:bg-gray-900 text-center text-gray-400 text-base font-medium shadow-inner flex flex-col items-center gap-2">
        <img src={config.assets.logo} alt="Logo" className="w-10 h-10 rounded-full mx-auto mb-1" />
        <div className="font-bold text-gray-600">{t('footer.systemName')}</div>
        <div className="text-sm">{t('footer.copyright')}</div>
      </footer>
    </div>
  );
};

export default LeaveSystemSettings; 