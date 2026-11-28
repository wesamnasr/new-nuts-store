'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Calculator,
  CheckCircle2,
  Crown,
  Database,
  Edit3,
  KeyRound,
  LayoutDashboard,
  Lock,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Truck,
  Unlock,
  UserCheck,
  UserMinus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  AdminPermissionId,
  AdminRole,
  CustomRoleDefinition,
  NonAdminStaffRole,
  RolePermissionsConfig,
  StaffAccountPublic,
} from '@/types/store';
import {
  ALL_DASHBOARD_PERMISSIONS,
  DASHBOARD_PERMISSION_META,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/lib/permissions';
import {
  buildUrlWithParams,
  updateUrlQueryParams,
  useBrowserUrlSync,
} from '@/lib/url-sync';

interface DbHealthInfo {
  engine: 'neon_postgres' | 'local_json';
  connected: boolean;
  version?: number;
  tables: string[];
  counts?: Record<string, number>;
}

type PermissionsWorkspaceTab =
  | 'staff'
  | 'matrix_all'
  | 'matrix_accountant'
  | 'matrix_cashier'
  | 'matrix_supplier'
  | 'system_health'
  | `custom:${string}`;

interface AccountsAndPermissionsWorkspaceProps {
  adminToken?: string;
  rolePermissions: RolePermissionsConfig;
  customRoles: CustomRoleDefinition[];
  isSavingPermissions: boolean;
  onSaveRolesAndPermissions: (
    updatedPermissions: RolePermissionsConfig,
    updatedCustomRoles: CustomRoleDefinition[],
    successMessage?: string
  ) => Promise<void>;
  onNotify?: (message: string, type?: 'success' | 'error') => void;
}

const CUSTOM_ROLE_COLORS: Record<
  NonNullable<CustomRoleDefinition['color']>,
  { label: string; badgeClass: string; dotClass: string }
> = {
  amber: {
    label: 'ذهبي دافئ',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  emerald: {
    label: 'أخضر زمردي',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  sky: {
    label: 'أزرق سماوي',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-200',
    dotClass: 'bg-sky-500',
  },
  purple: {
    label: 'بنفسجي ملكي',
    badgeClass: 'bg-purple-50 text-purple-900 border-purple-200',
    dotClass: 'bg-purple-500',
  },
  rose: {
    label: 'وردي قرمزي',
    badgeClass: 'bg-rose-50 text-rose-900 border-rose-200',
    dotClass: 'bg-rose-500',
  },
  stone: {
    label: 'رمادي رسمي',
    badgeClass: 'bg-[#FAF6F0] text-[#4A3728] border-[#E8E0D5]',
    dotClass: 'bg-[#8A735E]',
  },
};

const ROLE_META: Record<
  AdminRole,
  { label: string; shortLabel: string; badgeClass: string; portalLabel: string }
> = {
  super_admin: {
    label: 'المدير العام',
    shortLabel: 'الإدارة',
    badgeClass: 'bg-[#231710] text-[#FAF6F0] border-[#231710]',
    portalLabel: 'لوحة التحكم الكاملة',
  },
  admin: {
    label: 'المدير العام',
    shortLabel: 'الإدارة',
    badgeClass: 'bg-[#231710] text-[#FAF6F0] border-[#231710]',
    portalLabel: 'لوحة التحكم الكاملة',
  },
  accountant: {
    label: 'المحاسب المالي',
    shortLabel: 'المحاسب',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    portalLabel: 'التقارير والمراجعة المالية',
  },
  cashier: {
    label: 'كاشير الفرع',
    shortLabel: 'الكاشير',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    portalLabel: 'نقطة البيع والكاشير',
  },
  supplier: {
    label: 'المورد والخامات',
    shortLabel: 'المورد',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-200',
    portalLabel: 'بوابة التوريد والمخزون',
  },
  delivery_rider: {
    label: 'مندوب التوصيل',
    shortLabel: 'المندوب',
    badgeClass: 'bg-[#FAF6F0] text-[#4A3728] border-[#E8E0D5]',
    portalLabel: 'بوابة مناديب التوصيل',
  },
};

const BUILTIN_EDITABLE_ROLES: {
  id: NonAdminStaffRole;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'accountant',
    title: 'المحاسب',
    subtitle: 'التقارير المالية، الأرباح، الورديات، والمصروفات',
    icon: Calculator,
  },
  {
    id: 'cashier',
    title: 'الكاشير',
    subtitle: 'نقطة البيع، الفواتير الفورية، وتجهيز الطلبات',
    icon: Store,
  },
  {
    id: 'supplier',
    title: 'المورد',
    subtitle: 'التوريد، أسعار الجملة، النواقص، وفواتير الشراء',
    icon: Truck,
  },
];

const CUSTOM_ROLE_TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  baseRole: NonAdminStaffRole;
  color: NonNullable<CustomRoleDefinition['color']>;
  permissions: AdminPermissionId[];
}> = [
  {
    id: 'branch_supervisor',
    name: 'مشرف فرع',
    description: 'إدارة الطلبات والكاشير والورديات والمنتجات بدون الإعدادات الحساسة',
    baseRole: 'accountant',
    color: 'purple',
    permissions: ['overview', 'orders', 'cashier_portal', 'products', 'operations', 'coupons'],
  },
  {
    id: 'warehouse_keeper',
    name: 'مدير مخزن وجرد',
    description: 'إدارة الأصناف والأقسام وفواتير التوريد وحركة المخزون',
    baseRole: 'supplier',
    color: 'sky',
    permissions: ['products', 'categories', 'supply_portal', 'supply_invoices', 'operations'],
  },
  {
    id: 'marketing_orders',
    name: 'مسؤول مبيعات وتسويق',
    description: 'متابعة طلبات الأونلاين والكوبونات والعروض وتقييمات العملاء',
    baseRole: 'accountant',
    color: 'emerald',
    permissions: ['overview', 'orders', 'coupons', 'reviews', 'shipping'],
  },
];

function getAdminAuthHeaders(overrideToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (overrideToken) {
    headers['Authorization'] = `Bearer ${overrideToken}`;
    headers['x-admin-token'] = overrideToken;
    return headers;
  }
  if (typeof window === 'undefined') return headers;
  try {
    let token = '';
    const raw =
      localStorage.getItem('nuts_admin_session') ||
      localStorage.getItem('hafsa_admin_session_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token) token = parsed.token;
    }
    if (!token) {
      token =
        sessionStorage.getItem('admin_token') ||
        localStorage.getItem('admin_token') ||
        '';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-admin-token'] = token;
    }
  } catch {}
  return headers;
}

export default function AccountsAndPermissionsWorkspace({
  adminToken,
  rolePermissions,
  customRoles,
  isSavingPermissions,
  onSaveRolesAndPermissions,
  onNotify,
}: AccountsAndPermissionsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<PermissionsWorkspaceTab>('staff');
  const [directoryOpen, setDirectoryOpen] = useState<boolean>(true);

  // Staff Accounts State
  const [staffList, setStaffList] = useState<StaffAccountPublic[]>([]);
  const [dbHealth, setDbHealth] = useState<DbHealthInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(
    null
  );

  // Create Staff Modal State (roleChoice is either built-in role or `custom:<id>`)
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRoleChoice, setNewRoleChoice] = useState<string>('cashier');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  // Edit Staff Modal State
  const [editingAccount, setEditingAccount] = useState<StaffAccountPublic | null>(null);
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editRoleChoice, setEditRoleChoice] = useState<string>('cashier');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  // Dynamic Roles & Permissions Matrix State
  const [localConfig, setLocalConfig] = useState<RolePermissionsConfig>(rolePermissions);
  const [localCustomRoles, setLocalCustomRoles] = useState<CustomRoleDefinition[]>(customRoles);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [permSearch, setPermSearch] = useState<string>('');

  // Create / Edit Custom Role Modal State
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [editingCustomRoleId, setEditingCustomRoleId] = useState<string | null>(null);
  const [roleFormName, setRoleFormName] = useState<string>('');
  const [roleFormDesc, setRoleFormDesc] = useState<string>('');
  const [roleFormBase, setRoleFormBase] = useState<NonAdminStaffRole>('accountant');
  const [roleFormColor, setRoleFormColor] =
    useState<NonNullable<CustomRoleDefinition['color']>>('purple');
  const [roleFormPerms, setRoleFormPerms] = useState<AdminPermissionId[]>([
    'overview',
    'orders',
    'products',
  ]);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<CustomRoleDefinition | null>(null);

  useBrowserUrlSync((params) => {
    const sub = params.get('subtab');
    if (
      sub === 'staff' ||
      sub === 'matrix_all' ||
      sub === 'matrix_accountant' ||
      sub === 'matrix_cashier' ||
      sub === 'matrix_supplier' ||
      sub === 'system_health'
    ) {
      setActiveTab(sub);
    } else if (sub && sub.startsWith('custom:')) {
      setActiveTab(sub as PermissionsWorkspaceTab);
    } else if (sub === 'accountant' || sub === 'cashier' || sub === 'supplier') {
      setActiveTab(`matrix_${sub}` as PermissionsWorkspaceTab);
    } else if (!sub) {
      setActiveTab('staff');
    }
  });

  useEffect(() => {
    setLocalConfig(rolePermissions);
    setLocalCustomRoles(customRoles);
    setHasUnsavedChanges(false);
  }, [rolePermissions, customRoles]);

  const notify = useCallback(
    (msg: string, type: 'success' | 'error' = 'success') => {
      setFeedback({ msg, type });
      if (onNotify) onNotify(msg, type);
      setTimeout(() => {
        setFeedback((curr) => (curr?.msg === msg ? null : curr));
      }, 4500);
    },
    [onNotify]
  );

  const loadStaffAndHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff', {
        headers: getAdminAuthHeaders(adminToken),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStaffList(Array.isArray(data.staffAccounts) ? data.staffAccounts : []);
        setDbHealth(data.dbHealth || null);
      } else {
        notify(data.error || 'تعذر تحميل حسابات الموظفين', 'error');
      }
    } catch {
      notify('خطأ في الاتصال بالخادم أثناء جلب حسابات الموظفين', 'error');
    } finally {
      setLoading(false);
    }
  }, [adminToken, notify]);

  useEffect(() => {
    loadStaffAndHealth();
  }, [loadStaffAndHealth]);

  const selectWorkspaceTab = (tabId: PermissionsWorkspaceTab) => {
    setActiveTab(tabId);
    updateUrlQueryParams({
      tab: 'permissions',
      subtab: tabId === 'staff' ? null : tabId,
    });
  };

  const customRolesMap = useMemo(() => {
    const m = new Map<string, CustomRoleDefinition>();
    for (const r of localCustomRoles) m.set(r.id, r);
    return m;
  }, [localCustomRoles]);

  // Staff Analytics (includes dynamic custom role counts)
  const staffStats = useMemo(() => {
    let activeCount = 0;
    let inactiveCount = 0;
    let primaryCount = 0;
    const roleCounts: Record<string, number> = {
      all: staffList.length,
      super_admin: 0,
      accountant: 0,
      cashier: 0,
      supplier: 0,
      delivery_rider: 0,
    };
    const customCounts: Record<string, number> = {};
    for (const acc of staffList) {
      if (acc.active !== false) activeCount += 1;
      else inactiveCount += 1;
      if (acc.isPrimary) primaryCount += 1;
      if (acc.customRoleId && customRolesMap.has(acc.customRoleId)) {
        customCounts[acc.customRoleId] = (customCounts[acc.customRoleId] || 0) + 1;
      } else {
        const r = acc.role === 'admin' ? 'super_admin' : acc.role;
        roleCounts[r] = (roleCounts[r] || 0) + 1;
      }
    }
    return { activeCount, inactiveCount, primaryCount, roleCounts, customCounts };
  }, [staffList, customRolesMap]);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return staffList.filter((s) => {
      if (roleFilter.startsWith('custom:')) {
        const targetCustomId = roleFilter.slice('custom:'.length);
        if (s.customRoleId !== targetCustomId) return false;
      } else if (roleFilter !== 'all') {
        const normalizedRole = s.role === 'admin' ? 'super_admin' : s.role;
        if (s.customRoleId && customRolesMap.has(s.customRoleId)) return false;
        if (normalizedRole !== roleFilter) return false;
      }
      if (statusFilter === 'active' && s.active === false) return false;
      if (statusFilter === 'inactive' && s.active !== false) return false;
      if (q) {
        const customName = s.customRoleId ? customRolesMap.get(s.customRoleId)?.name || '' : '';
        const hit =
          (s.displayName || '').toLowerCase().includes(q) ||
          (s.username || '').toLowerCase().includes(q) ||
          (s.phone || '').toLowerCase().includes(q) ||
          (s.notes || '').toLowerCase().includes(q) ||
          customName.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [staffList, roleFilter, statusFilter, staffSearch, customRolesMap]);

  // Helper to resolve staff role payload from select value
  const parseRoleChoice = (
    choice: string
  ): { role: AdminRole; customRoleId: string } => {
    if (choice.startsWith('custom:')) {
      const cid = choice.slice('custom:'.length);
      const matched = customRolesMap.get(cid);
      return {
        role: matched?.baseRole || 'accountant',
        customRoleId: cid,
      };
    }
    return { role: choice as AdminRole, customRoleId: '' };
  };

  // Staff CRUD Handlers
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { role, customRoleId } = parseRoleChoice(newRoleChoice);
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: getAdminAuthHeaders(adminToken),
        body: JSON.stringify({
          displayName: newDisplayName.trim(),
          username: newUsername.trim(),
          password: newPassword,
          role,
          ...(customRoleId ? { customRoleId } : {}),
          phone: newPhone.trim() || undefined,
          notes: newNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        notify(data.error || 'تعذر إنشاء حساب الموظف', 'error');
        return;
      }
      notify(`تم إنشاء حساب الموظف «${data.account.displayName}» بنجاح`);
      setNewDisplayName('');
      setNewUsername('');
      setNewPassword('');
      setNewPhone('');
      setNewNotes('');
      setShowCreateModal(false);
      await loadStaffAndHealth();
    } catch {
      notify('حدث خطأ أثناء إنشاء حساب الموظف', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (acc: StaffAccountPublic) => {
    setEditingAccount(acc);
    setEditDisplayName(acc.displayName);
    setEditUsername(acc.username);
    setEditRoleChoice(
      acc.customRoleId && customRolesMap.has(acc.customRoleId)
        ? `custom:${acc.customRoleId}`
        : acc.role === 'admin'
          ? 'super_admin'
          : acc.role
    );
    setEditPassword('');
    setEditPhone(acc.phone || '');
    setEditNotes(acc.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setSubmitting(true);
    try {
      const { role, customRoleId } = parseRoleChoice(editRoleChoice);
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: getAdminAuthHeaders(adminToken),
        body: JSON.stringify({
          id: editingAccount.id,
          displayName: editDisplayName.trim(),
          username: editUsername.trim(),
          role,
          customRoleId,
          password: editPassword.trim() || undefined,
          phone: editPhone.trim(),
          notes: editNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        notify(data.error || 'تعذر حفظ التعديلات', 'error');
        return;
      }
      if (data.rotatedToken) {
        sessionStorage.setItem('admin_token', data.rotatedToken);
        localStorage.setItem('admin_token', data.rotatedToken);
        try {
          const raw = localStorage.getItem('hafsa_admin_session_v1');
          const parsed = raw ? JSON.parse(raw) : {};
          localStorage.setItem(
            'hafsa_admin_session_v1',
            JSON.stringify({
              ...parsed,
              token: data.rotatedToken,
              username: data.account.username,
            })
          );
        } catch {}
      }
      notify(`تم تحديث بيانات حساب «${data.account.displayName}» بنجاح`);
      setEditingAccount(null);
      await loadStaffAndHealth();
    } catch {
      notify('حدث خطأ أثناء حفظ تعديلات الموظف', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (acc: StaffAccountPublic) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: getAdminAuthHeaders(adminToken),
        body: JSON.stringify({
          id: acc.id,
          active: !acc.active,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        notify(data.error || 'تعذر تحديث حالة الحساب', 'error');
        return;
      }
      notify(
        data.account.active
          ? `تم تفعيل حساب «${acc.displayName}» بنجاح`
          : `تم إيقاف حساب «${acc.displayName}» وإلغاء جلسته النشطة فوراً`
      );
      await loadStaffAndHealth();
    } catch {
      notify('حدث خطأ أثناء تغيير حالة الحساب', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (acc: StaffAccountPublic) => {
    if (acc.isPrimary) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/staff?id=${encodeURIComponent(acc.id)}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(adminToken),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        notify(data.error || 'تعذر حذف الحساب', 'error');
        return;
      }
      notify(`تم حذف حساب الموظف «${acc.displayName}» نهائياً`);
      await loadStaffAndHealth();
    } catch {
      notify('حدث خطأ أثناء حذف حساب الموظف', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Custom Role CRUD Handlers
  const openCreateRoleModal = () => {
    setEditingCustomRoleId(null);
    setRoleFormName('');
    setRoleFormDesc('');
    setRoleFormBase('accountant');
    setRoleFormColor('purple');
    setRoleFormPerms(['overview', 'orders', 'products']);
    setShowRoleModal(true);
  };

  const openEditRoleModal = (role: CustomRoleDefinition) => {
    setEditingCustomRoleId(role.id);
    setRoleFormName(role.name);
    setRoleFormDesc(role.description || '');
    setRoleFormBase(role.baseRole);
    setRoleFormColor(role.color || 'purple');
    setRoleFormPerms([...role.permissions]);
    setShowRoleModal(true);
  };

  const applyRoleTemplate = (tpl: (typeof CUSTOM_ROLE_TEMPLATES)[number]) => {
    setRoleFormName(tpl.name);
    setRoleFormDesc(tpl.description);
    setRoleFormBase(tpl.baseRole);
    setRoleFormColor(tpl.color);
    setRoleFormPerms([...tpl.permissions]);
  };

  const handleSaveCustomRoleModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = roleFormName.trim();
    if (cleanName.length < 2) {
      notify('يرجى إدخال اسم الدور الوظيفي (حرفان على الأقل)', 'error');
      return;
    }

    let nextCustomRoles: CustomRoleDefinition[];
    let targetRoleId: string;

    if (editingCustomRoleId) {
      targetRoleId = editingCustomRoleId;
      nextCustomRoles = localCustomRoles.map((r) =>
        r.id === editingCustomRoleId
          ? {
              ...r,
              name: cleanName,
              description: roleFormDesc.trim() || undefined,
              baseRole: roleFormBase,
              color: roleFormColor,
              permissions: [...roleFormPerms],
            }
          : r
      );
    } else {
      targetRoleId = `role-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const created: CustomRoleDefinition = {
        id: targetRoleId,
        name: cleanName,
        description: roleFormDesc.trim() || undefined,
        baseRole: roleFormBase,
        color: roleFormColor,
        permissions: [...roleFormPerms],
        createdAt: new Date().toISOString(),
      };
      nextCustomRoles = [...localCustomRoles, created];
    }

    setLocalCustomRoles(nextCustomRoles);
    setShowRoleModal(false);
    await onSaveRolesAndPermissions(
      localConfig,
      nextCustomRoles,
      editingCustomRoleId
        ? `تم تحديث الدور الوظيفي «${cleanName}» بنجاح`
        : `تم إنشاء الدور الوظيفي الجديد «${cleanName}» وإضافته للمصفوفة`
    );
    setHasUnsavedChanges(false);
    selectWorkspaceTab(`custom:${targetRoleId}`);
  };

  const handleConfirmDeleteCustomRole = async () => {
    if (!confirmDeleteRole) return;
    const deleted = confirmDeleteRole;
    const nextCustomRoles = localCustomRoles.filter((r) => r.id !== deleted.id);
    setLocalCustomRoles(nextCustomRoles);
    setConfirmDeleteRole(null);

    await onSaveRolesAndPermissions(
      localConfig,
      nextCustomRoles,
      `تم حذف الدور الوظيفي «${deleted.name}» وتحديث حسابات الأعضاء المرتبطة به`
    );
    setHasUnsavedChanges(false);
    if (activeTab === `custom:${deleted.id}`) {
      selectWorkspaceTab('matrix_all');
    }
    if (roleFilter === `custom:${deleted.id}`) {
      setRoleFilter('all');
    }
    await loadStaffAndHealth();
  };

  // Matrix Permission Toggles (supports both Built-in & Custom Roles!)
  const toggleBuiltInPermission = (role: NonAdminStaffRole, permId: AdminPermissionId) => {
    setLocalConfig((prev) => {
      const currentList = prev[role] || [];
      const exists = currentList.includes(permId);
      const nextList = exists
        ? currentList.filter((p) => p !== permId)
        : [...currentList, permId];
      return { ...prev, [role]: nextList };
    });
    setHasUnsavedChanges(true);
  };

  const toggleCustomRolePermission = (customId: string, permId: AdminPermissionId) => {
    setLocalCustomRoles((prev) =>
      prev.map((r) => {
        if (r.id !== customId) return r;
        const exists = r.permissions.includes(permId);
        return {
          ...r,
          permissions: exists
            ? r.permissions.filter((p) => p !== permId)
            : [...r.permissions, permId],
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  const grantAllBuiltIn = (role: NonAdminStaffRole) => {
    setLocalConfig((prev) => ({
      ...prev,
      [role]: [...ALL_DASHBOARD_PERMISSIONS],
    }));
    setHasUnsavedChanges(true);
  };

  const resetBuiltInToDefault = (role: NonAdminStaffRole) => {
    setLocalConfig((prev) => ({
      ...prev,
      [role]: [...DEFAULT_ROLE_PERMISSIONS[role]],
    }));
    setHasUnsavedChanges(true);
  };

  const grantAllCustom = (customId: string) => {
    setLocalCustomRoles((prev) =>
      prev.map((r) =>
        r.id === customId ? { ...r, permissions: [...ALL_DASHBOARD_PERMISSIONS] } : r
      )
    );
    setHasUnsavedChanges(true);
  };

  const clearAllCustom = (customId: string) => {
    setLocalCustomRoles((prev) =>
      prev.map((r) => (r.id === customId ? { ...r, permissions: [] } : r))
    );
    setHasUnsavedChanges(true);
  };

  const resetAllBuiltInToDefault = () => {
    setLocalConfig({
      supplier: [...DEFAULT_ROLE_PERMISSIONS.supplier],
      accountant: [...DEFAULT_ROLE_PERMISSIONS.accountant],
      cashier: [...DEFAULT_ROLE_PERMISSIONS.cashier],
    });
    setHasUnsavedChanges(true);
  };

  const handleSaveAllMatrix = async () => {
    await onSaveRolesAndPermissions(
      localConfig,
      localCustomRoles,
      'تم حفظ وتطبيق مصفوفة الصلاحيات والأدوار بنجاح'
    );
    setHasUnsavedChanges(false);
  };

  const isCustomRoleTab = activeTab.startsWith('custom:');
  const activeCustomRole = isCustomRoleTab
    ? localCustomRoles.find((r) => r.id === activeTab.slice('custom:'.length)) || null
    : null;
  const isMatrixView = activeTab.startsWith('matrix_') || Boolean(activeCustomRole);

  const activeBuiltInMatrixRole: 'all' | NonAdminStaffRole | null =
    activeTab === 'matrix_all'
      ? 'all'
      : activeTab === 'matrix_accountant'
        ? 'accountant'
        : activeTab === 'matrix_cashier'
          ? 'cashier'
          : activeTab === 'matrix_supplier'
            ? 'supplier'
            : null;

  // Unified list of visible columns in the Matrix Table
  type MatrixColumn = {
    key: string;
    kind: 'builtin' | 'custom';
    id: string;
    title: string;
    permissions: AdminPermissionId[];
    badgeClass?: string;
  };

  const matrixColumns: MatrixColumn[] = useMemo(() => {
    if (activeCustomRole) {
      const colStyle = CUSTOM_ROLE_COLORS[activeCustomRole.color || 'purple'];
      return [
        {
          key: `custom:${activeCustomRole.id}`,
          kind: 'custom',
          id: activeCustomRole.id,
          title: activeCustomRole.name,
          permissions: activeCustomRole.permissions,
          badgeClass: colStyle.badgeClass,
        },
      ];
    }
    if (activeBuiltInMatrixRole && activeBuiltInMatrixRole !== 'all') {
      const meta = BUILTIN_EDITABLE_ROLES.find((r) => r.id === activeBuiltInMatrixRole)!;
      return [
        {
          key: meta.id,
          kind: 'builtin',
          id: meta.id,
          title: meta.title,
          permissions: localConfig[meta.id] || [],
        },
      ];
    }
    return [
      ...BUILTIN_EDITABLE_ROLES.map((r) => ({
        key: r.id,
        kind: 'builtin' as const,
        id: r.id,
        title: r.title,
        permissions: localConfig[r.id] || [],
      })),
      ...localCustomRoles.map((cr) => ({
        key: `custom:${cr.id}`,
        kind: 'custom' as const,
        id: cr.id,
        title: cr.name,
        permissions: cr.permissions,
        badgeClass: CUSTOM_ROLE_COLORS[cr.color || 'purple'].badgeClass,
      })),
    ];
  }, [activeCustomRole, activeBuiltInMatrixRole, localConfig, localCustomRoles]);

  const filteredPermissions = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return DASHBOARD_PERMISSION_META;
    return DASHBOARD_PERMISSION_META.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.badgeCategory.toLowerCase().includes(q)
    );
  }, [permSearch]);

  // Header metadata for active tab
  const currentHeaderInfo = useMemo(() => {
    if (activeTab === 'staff') {
      return {
        title: 'دليل حسابات الموظفين والأدوار',
        description:
          'إضافة وحذف أعضاء الفريق، إسناد الأدوار الأساسية أو المخصصة، وتدوير كلمات المرور والإيقاف الفوري',
      };
    }
    if (activeTab === 'system_health') {
      return {
        title: 'حالة قاعدة البيانات والمزامنة العلائقية',
        description: 'فحص محرك التخزين وجداول النظام وسجلات الأمان والتشفير',
      };
    }
    if (activeCustomRole) {
      const assignedCount = staffStats.customCounts[activeCustomRole.id] || 0;
      return {
        title: `صلاحيات الدور المخصص: ${activeCustomRole.name}`,
        description:
          activeCustomRole.description ||
          `دور مخصص (${assignedCount} عضو مرتبط) • المستوى الأساسي: ${ROLE_META[activeCustomRole.baseRole].label}`,
      };
    }
    if (activeTab === 'matrix_accountant') {
      return {
        title: 'تخصيص صلاحيات دور المحاسب المالي',
        description: 'تحديد الصفحات المسموحة لحسابات المحاسبة والتدقيق المالي',
      };
    }
    if (activeTab === 'matrix_cashier') {
      return {
        title: 'تخصيص صلاحيات دور الكاشير',
        description: 'تحديد الصفحات المسموحة لحسابات نقطة البيع وتجهيز الطلبات',
      };
    }
    if (activeTab === 'matrix_supplier') {
      return {
        title: 'تخصيص صلاحيات دور المورد',
        description: 'تحديد الصفحات المسموحة لحسابات التوريد والمشتريات والمخزون',
      };
    }
    return {
      title: 'مصفوفة الصلاحيات الشاملة لكل الأدوار',
      description: `مقارنة وتعديل صلاحيات الأدوار الأساسية والأدوار المخصصة (${BUILTIN_EDITABLE_ROLES.length + localCustomRoles.length} دور قابل للتخصيص)`,
    };
  }, [activeTab, activeCustomRole, staffStats.customCounts, localCustomRoles.length]);

  return (
    <div className="animate-fade-in" dir="rtl">
      {/* ===================================================================== */}
      {/* CLEAN SHEET SHELL (DYNAMIC RBAC DIRECTORY + FOCUSED WORKSPACE)        */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden flex flex-col lg:flex-row min-h-[calc(100vh-110px)]">
        {/* RIGHT COLUMN: SLIM COLLAPSIBLE DYNAMIC DIRECTORY */}
        {directoryOpen && (
          <aside className="w-full lg:w-[225px] xl:w-[235px] shrink-0 bg-[#FAF6F0]/80 border-b lg:border-b-0 lg:border-l border-[#E8E0D5] flex flex-col justify-between">
            <div>
              {/* Directory Header */}
              <div className="px-3.5 py-2.5 border-b border-[#E8E0D5] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <KeyRound className="w-4 h-4 text-[#9A6836] shrink-0" />
                  <span className="text-xs font-black text-[#231710] truncate">
                    الأمان والصلاحيات
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDirectoryOpen(false)}
                  title="طي القائمة لتوسيع الجدول"
                  className="p-1.5 rounded-lg text-[#6B5A4E] hover:text-[#231710] hover:bg-white border border-transparent hover:border-[#E8E0D5] transition cursor-pointer"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              <nav className="p-2.5 space-y-3 overflow-y-auto">
                {/* GROUP 1: STAFF ACCOUNTS */}
                <div className="space-y-0.5">
                  <div className="px-2 py-1 text-[11px] font-black text-[#8A735E]">
                    طاقم العمل والحسابات
                  </div>
                  <a
                    href={buildUrlWithParams('/admin', { tab: 'permissions', subtab: null })}
                    onClick={(e) => {
                      e.preventDefault();
                      selectWorkspaceTab('staff');
                    }}
                    className={`min-h-[34px] w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                      activeTab === 'staff'
                        ? 'bg-[#231710] text-white font-bold shadow-2xs'
                        : 'text-[#231710] hover:bg-white font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Users
                        className={`w-3.5 h-3.5 shrink-0 ${
                          activeTab === 'staff' ? 'text-[#D4AF37]' : 'text-[#8A735E]'
                        }`}
                      />
                      <span className="truncate">دليل حسابات الموظفين</span>
                    </span>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold tabular-nums shrink-0 ${
                        activeTab === 'staff'
                          ? 'bg-white/15 text-white'
                          : 'bg-white text-[#6B5A4E] border border-[#E8E0D5]'
                      }`}
                    >
                      {staffList.length}
                    </span>
                  </a>
                </div>

                {/* GROUP 2: DYNAMIC PERMISSIONS MATRIX & ROLES */}
                <div className="space-y-0.5">
                  <div className="px-2 py-1 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-black text-[#8A735E]">
                      مصفوفة الصلاحيات والأدوار
                    </span>
                    <button
                      type="button"
                      onClick={openCreateRoleModal}
                      title="إنشاء دور وظيفي جديد بصلاحيات مخصصة"
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white hover:bg-[#231710] text-[#9A6836] hover:text-white border border-[#E8E0D5] text-[10px] font-black transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>دور جديد</span>
                    </button>
                  </div>

                  {/* All Roles Matrix */}
                  <a
                    href={buildUrlWithParams('/admin', {
                      tab: 'permissions',
                      subtab: 'matrix_all',
                    })}
                    onClick={(e) => {
                      e.preventDefault();
                      selectWorkspaceTab('matrix_all');
                    }}
                    className={`min-h-[34px] w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                      activeTab === 'matrix_all'
                        ? 'bg-[#231710] text-white font-bold shadow-2xs'
                        : 'text-[#231710] hover:bg-white font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <ShieldCheck
                        className={`w-3.5 h-3.5 shrink-0 ${
                          activeTab === 'matrix_all' ? 'text-[#D4AF37]' : 'text-[#8A735E]'
                        }`}
                      />
                      <span className="truncate">مصفوفة كل الأدوار</span>
                    </span>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold tabular-nums shrink-0 ${
                        activeTab === 'matrix_all'
                          ? 'bg-white/15 text-white'
                          : 'bg-white text-[#6B5A4E] border border-[#E8E0D5]'
                      }`}
                    >
                      {ALL_DASHBOARD_PERMISSIONS.length}
                    </span>
                  </a>

                  {/* Built-in Editable Roles */}
                  {BUILTIN_EDITABLE_ROLES.map((r) => {
                    const Icon = r.icon;
                    const tabId = `matrix_${r.id}` as PermissionsWorkspaceTab;
                    const isActive = activeTab === tabId;
                    const count = (localConfig[r.id] || []).length;
                    return (
                      <a
                        key={r.id}
                        href={buildUrlWithParams('/admin', { tab: 'permissions', subtab: tabId })}
                        onClick={(e) => {
                          e.preventDefault();
                          selectWorkspaceTab(tabId);
                        }}
                        className={`min-h-[34px] w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                          isActive
                            ? 'bg-[#231710] text-white font-bold shadow-2xs'
                            : 'text-[#231710] hover:bg-white font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? 'text-[#D4AF37]' : 'text-[#8A735E]'
                            }`}
                          />
                          <span className="truncate">صلاحيات {r.title}</span>
                        </span>
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold tabular-nums shrink-0 ${
                            isActive
                              ? 'bg-white/15 text-white'
                              : 'bg-white text-[#6B5A4E] border border-[#E8E0D5]'
                          }`}
                        >
                          {count}/{ALL_DASHBOARD_PERMISSIONS.length}
                        </span>
                      </a>
                    );
                  })}

                  {/* DYNAMIC CUSTOM ROLES LIST */}
                  {localCustomRoles.length > 0 && (
                    <div className="pt-1.5 mt-1.5 border-t border-[#E8E0D5]/80 space-y-0.5">
                      <div className="px-2 py-0.5 text-[10px] font-bold text-[#9A6836]">
                        أدوار مخصصة ({localCustomRoles.length})
                      </div>
                      {localCustomRoles.map((cr) => {
                        const tabId = `custom:${cr.id}` as PermissionsWorkspaceTab;
                        const isActive = activeTab === tabId;
                        const col = CUSTOM_ROLE_COLORS[cr.color || 'purple'];
                        return (
                          <div
                            key={cr.id}
                            className={`group min-h-[34px] w-full flex items-center justify-between gap-1 px-2 py-1 rounded-xl text-xs transition ${
                              isActive
                                ? 'bg-[#231710] text-white font-bold shadow-2xs'
                                : 'text-[#231710] hover:bg-white font-medium'
                            }`}
                          >
                            <a
                              href={buildUrlWithParams('/admin', {
                                tab: 'permissions',
                                subtab: tabId,
                              })}
                              onClick={(e) => {
                                e.preventDefault();
                                selectWorkspaceTab(tabId);
                              }}
                              className="flex-1 flex items-center gap-2 min-w-0 py-0.5 cursor-pointer"
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 ${col.dotClass}`} />
                              <span className="truncate">{cr.name}</span>
                            </a>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums ${
                                  isActive
                                    ? 'bg-white/15 text-white'
                                    : 'bg-white text-[#6B5A4E] border border-[#E8E0D5]'
                                }`}
                              >
                                {cr.permissions.length}/{ALL_DASHBOARD_PERMISSIONS.length}
                              </span>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRole(cr)}
                                title={`حذف الدور المخصص «${cr.name}»`}
                                className={`p-1 rounded-md opacity-70 group-hover:opacity-100 transition cursor-pointer ${
                                  isActive
                                    ? 'text-rose-300 hover:bg-white/15'
                                    : 'text-rose-600 hover:bg-rose-50'
                                }`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* GROUP 3: SYSTEM & DB HEALTH */}
                <div className="space-y-0.5">
                  <div className="px-2 py-1 text-[11px] font-black text-[#8A735E]">
                    البنية والأمان
                  </div>
                  <a
                    href={buildUrlWithParams('/admin', {
                      tab: 'permissions',
                      subtab: 'system_health',
                    })}
                    onClick={(e) => {
                      e.preventDefault();
                      selectWorkspaceTab('system_health');
                    }}
                    className={`min-h-[34px] w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                      activeTab === 'system_health'
                        ? 'bg-[#231710] text-white font-bold shadow-2xs'
                        : 'text-[#231710] hover:bg-white font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Database
                        className={`w-3.5 h-3.5 shrink-0 ${
                          activeTab === 'system_health' ? 'text-[#D4AF37]' : 'text-[#8A735E]'
                        }`}
                      />
                      <span className="truncate">قاعدة البيانات والمزامنة</span>
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        dbHealth?.connected === false ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                    />
                  </a>
                </div>
              </nav>
            </div>

            {/* Bottom Quick Actions inside Directory */}
            <div className="p-2.5 border-t border-[#E8E0D5] bg-[#FAF6F0] space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  selectWorkspaceTab('staff');
                  setShowCreateModal(true);
                }}
                className="w-full min-h-[34px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white font-bold text-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>إضافة حساب موظف</span>
              </button>
              <button
                type="button"
                onClick={openCreateRoleModal}
                className="w-full min-h-[34px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F2EAE0] text-[#231710] border border-[#E8E0D5] font-bold text-xs transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#9A6836] shrink-0" />
                <span>إنشاء دور وظيفي جديد</span>
              </button>
            </div>
          </aside>
        )}

        {/* LEFT COLUMN: FOCUSED CLEAN WHITE SHEET */}
        <div className="flex-1 min-w-0 bg-white flex flex-col">
          {/* SINGLE SLIM CONTEXTUAL COMMAND BAR */}
          <header className="px-4 py-2.5 bg-white border-b border-[#E8E0D5] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {!directoryOpen && (
                <button
                  type="button"
                  onClick={() => setDirectoryOpen(true)}
                  title="إظهار فهرس الأمان والصلاحيات"
                  className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-xs font-bold text-[#231710] transition cursor-pointer shrink-0"
                >
                  <PanelRightOpen className="w-3.5 h-3.5 text-[#9A6836]" />
                  <span>الفهرس</span>
                </button>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-[#231710] truncate">
                    {currentHeaderInfo.title}
                  </h2>
                  {isMatrixView && hasUnsavedChanges && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                      تعديلات غير محفوظة
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#6B5A4E] truncate hidden sm:block">
                  {currentHeaderInfo.description}
                </p>
              </div>
            </div>

            {/* Contextual Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              {activeTab === 'staff' && (
                <>
                  <button
                    type="button"
                    onClick={openCreateRoleModal}
                    className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-xs font-bold text-[#231710] transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#9A6836]" />
                    <span>دور وظيفي جديد</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadStaffAndHealth}
                    disabled={loading}
                    title="تحديث قائمة الحسابات"
                    className="min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-xs font-bold text-[#231710] transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-[#9A6836] ${loading ? 'animate-spin' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>موظف جديد</span>
                  </button>
                </>
              )}

              {isMatrixView && (
                <>
                  {activeCustomRole ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditRoleModal(activeCustomRole)}
                        className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-xs font-bold text-[#231710] transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#9A6836]" />
                        <span>تعديل بيانات الدور</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRole(activeCustomRole)}
                        className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف الدور</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={openCreateRoleModal}
                        className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-xs font-bold text-[#231710] transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#9A6836]" />
                        <span>دور جديد</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          activeBuiltInMatrixRole && activeBuiltInMatrixRole !== 'all'
                            ? resetBuiltInToDefault(activeBuiltInMatrixRole)
                            : resetAllBuiltInToDefault()
                        }
                        className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-xs font-bold text-[#231710] transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#6B5A4E]" />
                        <span>استعادة الافتراضي</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={isSavingPermissions}
                    onClick={handleSaveAllMatrix}
                    className="min-h-[34px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {isSavingPermissions
                        ? 'جاري الحفظ...'
                        : hasUnsavedChanges
                          ? 'حفظ التعديلات *'
                          : 'حفظ الصلاحيات'}
                    </span>
                  </button>
                </>
              )}

              {activeTab === 'system_health' && (
                <button
                  type="button"
                  onClick={loadStaffAndHealth}
                  disabled={loading}
                  className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>تحديث الفحص</span>
                </button>
              )}
            </div>
          </header>

          {/* INLINE FEEDBACK BAR */}
          {feedback && (
            <div
              className={`px-4 py-2 border-b flex items-center justify-between gap-2 text-xs font-bold ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <span className="flex items-center gap-2">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-700 shrink-0" />
                )}
                <span>{feedback.msg}</span>
              </span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-current opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* CONTEXTUAL FILTER BAR (STAFF VIEW) */}
          {activeTab === 'staff' && (
            <div className="px-4 py-2 bg-[#FAF6F0]/55 border-b border-[#E8E0D5] flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#8A735E] absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="بحث باسم الموظف، اسم المستخدم، الدور، الهاتف، أو الملاحظات..."
                  className="w-full min-h-[34px] ps-8 pe-3 py-1 rounded-lg border border-[#E8E0D5] bg-white text-xs font-medium text-[#231710] placeholder:text-[#8A735E] focus:outline-none focus:border-[#231710]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: 'all', label: `الكل (${staffStats.roleCounts.all || 0})` },
                  { id: 'super_admin', label: `الإدارة (${staffStats.roleCounts.super_admin || 0})` },
                  { id: 'accountant', label: `المحاسب (${staffStats.roleCounts.accountant || 0})` },
                  { id: 'cashier', label: `الكاشير (${staffStats.roleCounts.cashier || 0})` },
                  { id: 'supplier', label: `المورد (${staffStats.roleCounts.supplier || 0})` },
                  {
                    id: 'delivery_rider',
                    label: `المندوب (${staffStats.roleCounts.delivery_rider || 0})`,
                  },
                  ...localCustomRoles.map((cr) => ({
                    id: `custom:${cr.id}`,
                    label: `${cr.name} (${staffStats.customCounts[cr.id] || 0})`,
                  })),
                ].map((rTab) => (
                  <button
                    key={rTab.id}
                    type="button"
                    onClick={() => setRoleFilter(rTab.id)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer tabular-nums ${
                      roleFilter === rTab.id
                        ? 'bg-[#231710] text-white'
                        : 'bg-white text-[#6B5A4E] border border-[#E8E0D5] hover:text-[#231710]'
                    }`}
                  >
                    {rTab.label}
                  </button>
                ))}
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="min-h-[34px] bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-1 text-xs font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
              >
                <option value="all">كل الحالات</option>
                <option value="active">نشط فقط</option>
                <option value="inactive">موقوف فقط</option>
              </select>
            </div>
          )}

          {/* CONTEXTUAL FILTER BAR (MATRIX VIEW) */}
          {isMatrixView && (
            <div className="px-4 py-2 bg-[#FAF6F0]/55 border-b border-[#E8E0D5] flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-3.5 h-3.5 text-[#8A735E] absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="ابحث باسم الصفحة أو الصلاحية أو التصنيف..."
                  className="w-full min-h-[34px] ps-8 pe-3 py-1 rounded-lg border border-[#E8E0D5] bg-white text-xs font-medium text-[#231710] placeholder:text-[#8A735E] focus:outline-none focus:border-[#231710]"
                />
              </div>

              <span className="text-[11px] font-medium text-[#6B5A4E]">
                اضغط على أي صلاحية لمنحها أو حجبها ثم اضغط «حفظ الصلاحيات» لتطبيقها فوراً
              </span>
            </div>
          )}

          {/* FOCUSED WORKSPACE BODY */}
          <div className="flex-1 p-4 sm:p-5 bg-white space-y-4">
            {/* ============================================================= */}
            {/* VIEW 1: STAFF ACCOUNTS DIRECTORY SHEET                        */}
            {/* ============================================================= */}
            {activeTab === 'staff' && (
              <div className="space-y-4">
                {/* Compact Hairline 4-Cell Summary Ribbon */}
                <div className="rounded-2xl border border-[#E8E0D5] overflow-hidden bg-white">
                  <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-[#E8E0D5] tabular-nums">
                    <div className="p-3 space-y-0.5">
                      <span className="text-[11px] font-bold text-[#6B5A4E] block">
                        إجمالي الحسابات
                      </span>
                      <span className="text-lg font-black text-[#231710]">
                        {staffList.length} عضو
                      </span>
                    </div>
                    <div className="p-3 space-y-0.5">
                      <span className="text-[11px] font-bold text-[#6B5A4E] block">
                        الحسابات النشطة
                      </span>
                      <span className="text-lg font-black text-emerald-700">
                        {staffStats.activeCount} نشط
                      </span>
                    </div>
                    <div className="p-3 space-y-0.5">
                      <span className="text-[11px] font-bold text-[#6B5A4E] block">
                        الحسابات الموقوفة
                      </span>
                      <span className="text-lg font-black text-rose-700">
                        {staffStats.inactiveCount} موقوف
                      </span>
                    </div>
                    <div className="p-3 space-y-0.5">
                      <span className="text-[11px] font-bold text-[#6B5A4E] block">
                        الأدوار المخصصة المضافة
                      </span>
                      <span className="text-lg font-black text-[#9A6836]">
                        {localCustomRoles.length} دور مخصص
                      </span>
                    </div>
                  </div>
                </div>

                {/* Clean Accounting-Style Staff Table */}
                <div className="ds-table-wrap">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr>
                          <th>الموظف والملاحظات</th>
                          <th>اسم المستخدم</th>
                          <th>الدور الوظيفي ونطاق الدخول</th>
                          <th>الحالة</th>
                          <th>آخر تسجيل دخول</th>
                          <th className="!text-left">إجراءات التحكم والأمان</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && staffList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-[#6B5A4E] font-bold">
                              جاري تحميل حسابات الموظفين...
                            </td>
                          </tr>
                        ) : filteredStaff.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-[#6B5A4E] font-bold">
                              لا توجد حسابات مطابقة للبحث أو الفلتر المحدد
                            </td>
                          </tr>
                        ) : (
                          filteredStaff.map((acc) => {
                            const customRoleObj = acc.customRoleId
                              ? customRolesMap.get(acc.customRoleId)
                              : undefined;
                            const meta = ROLE_META[acc.role] || ROLE_META.cashier;
                            const customStyle = customRoleObj
                              ? CUSTOM_ROLE_COLORS[customRoleObj.color || 'purple']
                              : null;
                            return (
                              <tr key={acc.id}>
                                <td>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-[#231710]">
                                      {acc.displayName}
                                    </span>
                                    {acc.isPrimary && (
                                      <span className="rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[11px] font-bold text-[#9A6836]">
                                        تأسيسي
                                      </span>
                                    )}
                                  </div>
                                  {(acc.phone || acc.notes) && (
                                    <div className="mt-0.5 text-[11px] text-[#6B5A4E]">
                                      {[acc.phone, acc.notes].filter(Boolean).join(' • ')}
                                    </div>
                                  )}
                                </td>

                                <td className="font-mono font-bold text-[#231710]" dir="ltr">
                                  @{acc.username}
                                </td>

                                <td>
                                  {customRoleObj && customStyle ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          selectWorkspaceTab(`custom:${customRoleObj.id}`)
                                        }
                                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold cursor-pointer hover:opacity-85 ${customStyle.badgeClass}`}
                                        title="عرض وتعديل صلاحيات هذا الدور المخصص"
                                      >
                                        <BadgeCheck className="w-3 h-3" />
                                        <span>{customRoleObj.name}</span>
                                      </button>
                                      <span className="text-[11px] text-[#8A735E]">
                                        ({customRoleObj.permissions.length} صلاحية مخصصة)
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}
                                      >
                                        {meta.label}
                                      </span>
                                      <span className="text-[11px] text-[#8A735E]">
                                        {meta.portalLabel}
                                      </span>
                                    </div>
                                  )}
                                </td>

                                <td>
                                  {acc.active !== false ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                      نشط
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                                      موقوف
                                    </span>
                                  )}
                                </td>

                                <td className="text-[#6B5A4E] tabular-nums">
                                  {acc.lastLoginAt
                                    ? new Date(acc.lastLoginAt).toLocaleString('ar-EG', {
                                        dateStyle: 'short',
                                        timeStyle: 'short',
                                      })
                                    : 'لم يسجل دخول بعد'}
                                </td>

                                <td>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(acc)}
                                      className="min-h-[30px] inline-flex items-center gap-1 rounded-lg border border-[#E8E0D5] bg-white hover:bg-[#FAF6F0] px-2.5 py-1 text-[11px] font-bold text-[#231710] transition cursor-pointer"
                                    >
                                      <Edit3 className="h-3 w-3 text-[#9A6836]" />
                                      <span>تعديل / الدور</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={() => handleToggleActive(acc)}
                                      className={`min-h-[30px] inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                                        acc.active !== false
                                          ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {acc.active !== false ? (
                                        <>
                                          <UserMinus className="h-3 w-3" />
                                          <span>إيقاف</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="h-3 w-3" />
                                          <span>تفعيل</span>
                                        </>
                                      )}
                                    </button>

                                    {!acc.isPrimary && (
                                      <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => handleDeleteStaff(acc)}
                                        className="min-h-[30px] inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                                        title="حذف الحساب نهائياً"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* VIEW 2: DYNAMIC PERMISSIONS MATRIX (BUILT-IN + CUSTOM ROLES)  */}
            {/* ============================================================= */}
            {isMatrixView && (
              <div className="space-y-4">
                {/* Dynamic Role Summary Strip */}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5 tabular-nums">
                  {/* Admin Permanent Card */}
                  <div className="rounded-xl border border-[#E8E0D5] bg-[#FAF6F0]/55 p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#231710]">
                      <span className="inline-flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5 text-[#9A6836]" />
                        المدير العام
                      </span>
                      <span className="text-emerald-700">
                        {ALL_DASHBOARD_PERMISSIONS.length}/{ALL_DASHBOARD_PERMISSIONS.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#6B5A4E] block">
                      صلاحية كاملة دائمة
                    </span>
                  </div>

                  {/* Built-in Role Quick Cards */}
                  {BUILTIN_EDITABLE_ROLES.map((r) => {
                    const Icon = r.icon;
                    const count = (localConfig[r.id] || []).length;
                    const isFocused = activeBuiltInMatrixRole === r.id;
                    return (
                      <div
                        key={r.id}
                        className={`rounded-xl border p-3 space-y-1.5 ${
                          isFocused
                            ? 'border-[#231710] bg-[#FAF6F0]'
                            : 'border-[#E8E0D5] bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#231710]">
                          <button
                            type="button"
                            onClick={() =>
                              selectWorkspaceTab(`matrix_${r.id}` as PermissionsWorkspaceTab)
                            }
                            className="inline-flex items-center gap-1 hover:text-[#9A6836] cursor-pointer"
                          >
                            <Icon className="w-3.5 h-3.5 text-[#9A6836]" />
                            <span>{r.title}</span>
                          </button>
                          <span className="font-black">
                            {count}/{ALL_DASHBOARD_PERMISSIONS.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => grantAllBuiltIn(r.id)}
                            className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold cursor-pointer"
                          >
                            منح الكل
                          </button>
                          <button
                            type="button"
                            onClick={() => resetBuiltInToDefault(r.id)}
                            className="px-2 py-0.5 rounded-md bg-[#FAF6F0] hover:bg-[#F2ECE2] text-[#4A3728] border border-[#E8E0D5] text-[10px] font-bold cursor-pointer"
                          >
                            افتراضي
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Dynamic Custom Role Quick Cards */}
                  {localCustomRoles.map((cr) => {
                    const col = CUSTOM_ROLE_COLORS[cr.color || 'purple'];
                    const isFocused = activeCustomRole?.id === cr.id;
                    const membersCount = staffStats.customCounts[cr.id] || 0;
                    return (
                      <div
                        key={cr.id}
                        className={`rounded-xl border p-3 space-y-1.5 ${
                          isFocused
                            ? 'border-[#231710] bg-[#FAF6F0]'
                            : 'border-[#E8E0D5] bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-[#231710]">
                          <button
                            type="button"
                            onClick={() => selectWorkspaceTab(`custom:${cr.id}`)}
                            className="inline-flex items-center gap-1.5 hover:text-[#9A6836] min-w-0 cursor-pointer"
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${col.dotClass}`} />
                            <span className="truncate">{cr.name}</span>
                          </button>
                          <span className="font-black shrink-0">
                            {cr.permissions.length}/{ALL_DASHBOARD_PERMISSIONS.length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => grantAllCustom(cr.id)}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold cursor-pointer"
                            >
                              منح الكل
                            </button>
                            <button
                              type="button"
                              onClick={() => clearAllCustom(cr.id)}
                              className="px-2 py-0.5 rounded-md bg-[#FAF6F0] hover:bg-rose-50 text-[#6B5A4E] hover:text-rose-700 border border-[#E8E0D5] text-[10px] font-bold cursor-pointer"
                            >
                              تفريغ
                            </button>
                          </div>
                          <span className="text-[10px] text-[#8A735E]">{membersCount} عضو</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Quick Add New Custom Role Card */}
                  <button
                    type="button"
                    onClick={openCreateRoleModal}
                    className="rounded-xl border border-dashed border-[#C88A4B]/70 bg-[#FAF6F0]/45 hover:bg-[#FAF6F0] p-3 flex flex-col items-center justify-center gap-1 text-xs font-bold text-[#9A6836] transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة دور وظيفي جديد</span>
                  </button>
                </div>

                {/* Clean Interactive Permissions Matrix Table */}
                <div className="ds-table-wrap">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr>
                          <th>الصفحة / الصلاحية والوصف</th>
                          <th>التصنيف</th>
                          <th className="!text-center">المدير العام</th>
                          {matrixColumns.map((col) => (
                            <th key={col.key} className="!text-center">
                              <span
                                className={
                                  col.kind === 'custom' && col.badgeClass
                                    ? `inline-block px-2 py-0.5 rounded-md border ${col.badgeClass}`
                                    : ''
                                }
                              >
                                {col.title}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPermissions.map((perm) => (
                          <tr key={perm.id}>
                            <td>
                              <div className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center shrink-0 mt-0.5">
                                  <LayoutDashboard className="w-3.5 h-3.5 text-[#9A6836]" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-[#231710]">{perm.label}</div>
                                  <div className="text-[11px] text-[#6B5A4E] line-clamp-1">
                                    {perm.description}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="px-2 py-0.5 rounded-md bg-[#FAF6F0] text-[#4A3728] border border-[#E8E0D5] text-[11px] font-bold whitespace-nowrap">
                                {perm.badgeCategory}
                              </span>
                            </td>

                            <td className="text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] text-[11px] font-bold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>دائماً</span>
                              </span>
                            </td>

                            {matrixColumns.map((col) => {
                              const isGranted = col.permissions.includes(perm.id);
                              return (
                                <td key={col.key} className="text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      col.kind === 'builtin'
                                        ? toggleBuiltInPermission(
                                            col.id as NonAdminStaffRole,
                                            perm.id
                                          )
                                        : toggleCustomRolePermission(col.id, perm.id)
                                    }
                                    className={`min-h-[30px] inline-flex items-center justify-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                                      isGranted
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-[#FAF6F0] text-[#6B5A4E] border-[#E8E0D5] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                                    }`}
                                  >
                                    {isGranted ? (
                                      <>
                                        <Unlock className="w-3 h-3 text-emerald-600" />
                                        <span>مفعّلة</span>
                                      </>
                                    ) : (
                                      <>
                                        <Lock className="w-3 h-3 text-[#8A735E]" />
                                        <span>محجوبة</span>
                                      </>
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sticky Unsaved Changes Bar */}
                {hasUnsavedChanges && (
                  <div className="sticky bottom-3 rounded-xl bg-[#231710] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-lg">
                    <span className="text-xs font-bold">
                      يوجد تعديلات غير محفوظة في مصفوفة الأدوار والصلاحيات
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLocalConfig(rolePermissions);
                          setLocalCustomRoles(customRoles);
                          setHasUnsavedChanges(false);
                        }}
                        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
                      >
                        تراجع
                      </button>
                      <button
                        type="button"
                        disabled={isSavingPermissions}
                        onClick={handleSaveAllMatrix}
                        className="px-4 py-1 rounded-lg bg-[#D4AF37] hover:bg-[#e0bd4c] text-[#231710] text-xs font-black cursor-pointer disabled:opacity-50"
                      >
                        {isSavingPermissions ? 'جاري الحفظ...' : 'حفظ وتطبيق الآن'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* VIEW 3: DATABASE & SYSTEM HEALTH SHEET                        */}
            {/* ============================================================= */}
            {activeTab === 'system_health' && (
              <div className="space-y-4 tabular-nums">
                <div className="rounded-2xl border border-[#E8E0D5] overflow-hidden bg-white">
                  <div className="px-4 py-3 bg-[#FAF6F0] border-b border-[#E8E0D5] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#9A6836]" />
                      <span className="text-xs sm:text-sm font-black text-[#231710]">
                        محرك قاعدة البيانات والمزامنة
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        dbHealth?.connected !== false
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          dbHealth?.connected !== false ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      />
                      {dbHealth?.engine === 'neon_postgres'
                        ? 'قاعدة بيانات سحابية متصلة'
                        : 'تخزين محلي مؤمّن'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-[#E8E0D5]">
                    {[
                      {
                        key: 'staff_accounts',
                        label: 'حسابات الطاقم',
                        val: dbHealth?.counts?.staff_accounts ?? staffList.length,
                      },
                      {
                        key: 'products',
                        label: 'الأصناف',
                        val: dbHealth?.counts?.products ?? 0,
                      },
                      {
                        key: 'orders',
                        label: 'الطلبات والفواتير',
                        val: dbHealth?.counts?.orders ?? 0,
                      },
                      {
                        key: 'pos_shifts',
                        label: 'ورديات الكاشير',
                        val: dbHealth?.counts?.pos_shifts ?? 0,
                      },
                      {
                        key: 'supply_invoices',
                        label: 'فواتير التوريد',
                        val: dbHealth?.counts?.supply_invoices ?? 0,
                      },
                      {
                        key: 'vip_members',
                        label: 'أعضاء VIP',
                        val: dbHealth?.counts?.vip_members ?? 0,
                      },
                    ].map((stat) => (
                      <div key={stat.key} className="p-3.5 text-center space-y-0.5">
                        <div className="text-lg font-black text-[#231710]">
                          {(stat.val ?? 0).toLocaleString('en-US')}
                        </div>
                        <div className="text-[11px] font-bold text-[#6B5A4E]">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E8E0D5] p-4 bg-[#FAF6F0]/40 space-y-2 text-xs">
                  <div className="font-black text-[#231710]">بروتوكولات الأمان النشطة</div>
                  <ul className="space-y-1.5 text-[#6B5A4E]">
                    <li>• تشفير كلمات المرور بتشفير غير قابل للعكس مع مقارنة زمنية ثابتة لمنع التخمين.</li>
                    <li>• دعم كامل للأدوار الديناميكية المخصصة مع تطبيق لحظي على قوائم وجلسات المستخدمين.</li>
                    <li>• حماية الحسابات التأسيسية ومنع تعطيل آخر مدير عام نشط في النظام.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* CREATE / EDIT CUSTOM ROLE MODAL (WITH READY TEMPLATES)                */}
      {/* ===================================================================== */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-[#E8E0D5] bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-3.5 bg-[#FAF6F0] border-b border-[#E8E0D5] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#9A6836]" />
                <h3 className="text-sm font-black text-[#231710]">
                  {editingCustomRoleId ? 'تعديل الدور الوظيفي المخصص' : 'إنشاء دور وظيفي جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="p-1 rounded-lg text-[#6B5A4E] hover:text-[#231710] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCustomRoleModal}
              className="p-5 space-y-4 overflow-y-auto flex-1"
            >
              {/* Ready Enterprise Role Templates (on Create) */}
              {!editingCustomRoleId && (
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold text-[#6B5A4E]">
                    قوالب أدوار جاهزة (اضغط للتعبئة السريعة أو اكتب دوراً مخصصاً):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CUSTOM_ROLE_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyRoleTemplate(tpl)}
                        className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#F2EAE0] border border-[#E8E0D5] text-[11px] font-bold text-[#231710] transition cursor-pointer"
                      >
                        + {tpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    اسم الدور الوظيفي *
                  </label>
                  <input
                    type="text"
                    required
                    value={roleFormName}
                    onChange={(e) => setRoleFormName(e.target.value)}
                    placeholder="مثال: مشرف فرع / مدير مخزن / مسؤول تسويق"
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs font-bold text-[#231710] focus:border-[#231710] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    مستوى الوصول الأساسي بالنظام *
                  </label>
                  <select
                    value={roleFormBase}
                    onChange={(e) => setRoleFormBase(e.target.value as NonAdminStaffRole)}
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs font-bold text-[#231710] focus:border-[#231710] focus:outline-none"
                  >
                    <option value="accountant">إداري / مراجعة وتقارير (الأكثر مرونة)</option>
                    <option value="cashier">مبيعات وكاشير (نقطة البيع والطلبات)</option>
                    <option value="supplier">توريد ومخزون (المشتريات والأصناف)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    وصف مختصر للدور (اختياري)
                  </label>
                  <input
                    type="text"
                    value={roleFormDesc}
                    onChange={(e) => setRoleFormDesc(e.target.value)}
                    placeholder="مثال: يتابع الطلبات والمخزون والورديات بدون صلاحية حذف الإعدادات"
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs text-[#231710] focus:border-[#231710] focus:outline-none"
                  />
                </div>
              </div>

              {/* Color Swatches */}
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-[#231710]">لون تمييز الدور</span>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    Object.keys(CUSTOM_ROLE_COLORS) as Array<
                      NonNullable<CustomRoleDefinition['color']>
                    >
                  ).map((cKey) => {
                    const c = CUSTOM_ROLE_COLORS[cKey];
                    const active = roleFormColor === cKey;
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => setRoleFormColor(cKey)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                          active
                            ? 'border-[#231710] bg-[#231710] text-white'
                            : 'border-[#E8E0D5] bg-white text-[#231710] hover:bg-[#FAF6F0]'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${c.dotClass}`} />
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inline Permissions Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#231710]">
                    الصفحات والصلاحيات الممنوحة ({roleFormPerms.length}/{ALL_DASHBOARD_PERMISSIONS.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRoleFormPerms([...ALL_DASHBOARD_PERMISSIONS])}
                      className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-[#E8E0D5]">|</span>
                    <button
                      type="button"
                      onClick={() => setRoleFormPerms([])}
                      className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DASHBOARD_PERMISSION_META.map((perm) => {
                    const checked = roleFormPerms.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                          checked
                            ? 'border-emerald-300 bg-emerald-50/60'
                            : 'border-[#E8E0D5] bg-white hover:bg-[#FAF6F0]/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setRoleFormPerms((prev) =>
                              prev.includes(perm.id)
                                ? prev.filter((id) => id !== perm.id)
                                : [...prev, perm.id]
                            )
                          }
                          className="mt-0.5 w-3.5 h-3.5 accent-[#231710] cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-[#231710]">{perm.label}</div>
                          <div className="text-[10px] text-[#6B5A4E]">{perm.badgeCategory}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E8E0D5] pt-3.5">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="rounded-xl border border-[#E8E0D5] bg-white px-4 py-2 text-xs font-bold text-[#231710] hover:bg-[#FAF6F0] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingPermissions}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#231710] px-5 py-2 text-xs font-bold text-white hover:bg-[#3a261b] disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {isSavingPermissions
                      ? 'جاري الحفظ...'
                      : editingCustomRoleId
                        ? 'حفظ تعديلات الدور'
                        : 'إنشاء وتفعيل الدور'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CONFIRM DELETE CUSTOM ROLE MODAL                                      */}
      {/* ===================================================================== */}
      {confirmDeleteRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E8E0D5] bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <span className="text-sm font-black text-rose-900">تأكيد حذف الدور الوظيفي</span>
              <button
                type="button"
                onClick={() => setConfirmDeleteRole(null)}
                className="text-rose-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-[#231710]">
              <p className="font-bold">
                هل تريد حذف الدور المخصص «{confirmDeleteRole.name}» نهائياً؟
              </p>
              <p className="text-[#6B5A4E] leading-relaxed">
                {(staffStats.customCounts[confirmDeleteRole.id] || 0) > 0
                  ? `يوجد حالياً ${staffStats.customCounts[confirmDeleteRole.id]} عضو مرتبط بهذا الدور؛ سيتم تحويلهم تلقائياً إلى المستوى الأساسي (${ROLE_META[confirmDeleteRole.baseRole].label}) دون حذف حساباتهم.`
                  : 'لا يوجد أي موظفين مرتبطين بهذا الدور حالياً، وسيتم حذفه من فهرس الأدوار والمصفوفة فوراً.'}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E0D5]">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteRole(null)}
                  className="rounded-xl border border-[#E8E0D5] bg-white px-4 py-2 text-xs font-bold text-[#231710] hover:bg-[#FAF6F0] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isSavingPermissions}
                  onClick={handleConfirmDeleteCustomRole}
                  className="rounded-xl bg-rose-700 hover:bg-rose-800 px-4 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CREATE NEW STAFF ACCOUNT MODAL (SUPPORTS BUILT-IN & CUSTOM ROLES)     */}
      {/* ===================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-[#E8E0D5] bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAF6F0] border-b border-[#E8E0D5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#9A6836]" />
                <h3 className="text-sm font-black text-[#231710]">تسجيل حساب موظف جديد</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-[#6B5A4E] hover:text-[#231710] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-5 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    الاسم التعريفي للموظف *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="الاسم كما يظهر في الورديات"
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs text-[#231710] focus:border-[#231710] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    الدور الوظيفي *
                  </label>
                  <select
                    value={newRoleChoice}
                    onChange={(e) => setNewRoleChoice(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs font-bold text-[#231710] focus:border-[#231710] focus:outline-none"
                  >
                    <optgroup label="الأدوار الأساسية للنظام">
                      <option value="cashier">الكاشير ونقطة البيع</option>
                      <option value="accountant">المحاسب المالي والتدقيق</option>
                      <option value="supplier">المورد وإدارة التوريد</option>
                      <option value="delivery_rider">مندوب التوصيل</option>
                      <option value="super_admin">المدير العام — صلاحية كاملة</option>
                    </optgroup>
                    {localCustomRoles.length > 0 && (
                      <optgroup label="الأدوار المخصصة المضافة">
                        {localCustomRoles.map((cr) => (
                          <option key={cr.id} value={`custom:${cr.id}`}>
                            ★ {cr.name} ({cr.permissions.length} صلاحية)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    اسم المستخدم للدخول *
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="staff2"
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs font-mono text-[#231710] focus:border-[#231710] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    كلمة المرور (6 خانات فأكثر) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    dir="ltr"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs font-mono text-[#231710] focus:border-[#231710] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs text-[#231710] focus:border-[#231710] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    ملاحظات الوردية / الفرع (اختياري)
                  </label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="مثال: الوردية المسائية"
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs text-[#231710] focus:border-[#231710] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E8E0D5] pt-3.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[#E8E0D5] bg-white px-4 py-2 text-xs font-bold text-[#231710] hover:bg-[#FAF6F0] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#231710] px-5 py-2 text-xs font-bold text-white hover:bg-[#3a261b] disabled:opacity-50 cursor-pointer"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{submitting ? 'جاري الحفظ...' : 'حفظ وتفعيل الحساب'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* EDIT STAFF / ROLE / PASSWORD ROTATION MODAL                           */}
      {/* ===================================================================== */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#E8E0D5] bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FAF6F0] border-b border-[#E8E0D5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#9A6836]" />
                <h3 className="text-sm font-black text-[#231710]">
                  تعديل بيانات الموظف / الدور / كلمة المرور
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="p-1 rounded-lg text-[#6B5A4E] hover:text-[#231710] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#231710]">
                  الاسم التعريفي للموظف
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs text-[#231710] outline-none focus:border-[#231710]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    اسم المستخدم
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs font-mono text-[#231710] outline-none focus:border-[#231710]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    الدور الوظيفي
                  </label>
                  <select
                    value={editRoleChoice}
                    disabled={Boolean(editingAccount.isPrimary)}
                    onChange={(e) => setEditRoleChoice(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs font-bold text-[#231710] outline-none focus:border-[#231710] disabled:bg-[#FAF6F0]"
                  >
                    <optgroup label="الأدوار الأساسية للنظام">
                      <option value="cashier">الكاشير ونقطة البيع</option>
                      <option value="accountant">المحاسب المالي</option>
                      <option value="supplier">المورد ومسؤول الخامات</option>
                      <option value="delivery_rider">مندوب التوصيل</option>
                      <option value="super_admin">المدير العام</option>
                    </optgroup>
                    {localCustomRoles.length > 0 && (
                      <optgroup label="الأدوار المخصصة المضافة">
                        {localCustomRoles.map((cr) => (
                          <option key={cr.id} value={`custom:${cr.id}`}>
                            ★ {cr.name} ({cr.permissions.length} صلاحية)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#231710]">
                  كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)
                </label>
                <input
                  type="password"
                  dir="ltr"
                  minLength={6}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور جديدة لتغييرها وإبطال الجلسات القديمة"
                  className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs font-mono text-[#231710] outline-none focus:border-[#231710]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs text-[#231710] outline-none focus:border-[#231710]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">ملاحظات</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3 py-2 text-xs text-[#231710] outline-none focus:border-[#231710]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E8E0D5] pt-3.5">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="rounded-xl border border-[#E8E0D5] bg-white px-4 py-2 text-xs font-bold text-[#231710] hover:bg-[#FAF6F0] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#231710] px-5 py-2 text-xs font-bold text-white hover:bg-[#3a261b] disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
