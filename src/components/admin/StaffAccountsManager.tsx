'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Database,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  Edit3,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { AdminRole, StaffAccountPublic } from '@/types/store';

interface DbHealthInfo {
  engine: 'neon_postgres' | 'local_json';
  connected: boolean;
  version?: number;
  tables: string[];
  counts?: Record<string, number>;
}

interface StaffAccountsManagerProps {
  adminToken?: string;
  onNotify?: (message: string, type?: 'success' | 'error') => void;
}

const ROLE_META: Record<
  AdminRole,
  { label: string; badgeBg: string; badgeText: string; portalLabel: string }
> = {
  super_admin: {
    label: 'المدير العام (الأدمن)',
    badgeBg: 'bg-[#231710]',
    badgeText: 'text-[#FAF6F0]',
    portalLabel: 'لوحة التحكم الكاملة (/admin)',
  },
  admin: {
    label: 'المدير العام (الأدمن)',
    badgeBg: 'bg-[#231710]',
    badgeText: 'text-[#FAF6F0]',
    portalLabel: 'لوحة التحكم الكاملة (/admin)',
  },
  accountant: {
    label: 'المحاسب المالي',
    badgeBg: 'bg-[#FAF6F0] border border-[#E8E0D5]',
    badgeText: 'text-[#231710]',
    portalLabel: 'بوابة التدقيق المحاسبي (/admin)',
  },
  cashier: {
    label: 'كاشير الفرع',
    badgeBg: 'bg-[#FAF6F0] border border-[#E8E0D5]',
    badgeText: 'text-[#231710]',
    portalLabel: 'نقطة بيع المحمصة (/pos)',
  },
  supplier: {
    label: 'المورد ومسؤول الخامات',
    badgeBg: 'bg-[#FAF6F0] border border-[#E8E0D5]',
    badgeText: 'text-[#231710]',
    portalLabel: 'بوابة التوريد والمخزون (/supplier)',
  },
  delivery_rider: {
    label: 'مندوب التوصيل',
    badgeBg: 'bg-[#FAF6F0] border border-[#E8E0D5]',
    badgeText: 'text-[#231710]',
    portalLabel: 'بوابة مناديب التوصيل (/rider)',
  },
};

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

export default function StaffAccountsManager({
  adminToken,
  onNotify,
}: StaffAccountsManagerProps) {
  const [staffList, setStaffList] = useState<StaffAccountPublic[]>([]);
  const [dbHealth, setDbHealth] = useState<DbHealthInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<AdminRole>('cashier');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  // Edit modal state
  const [editingAccount, setEditingAccount] = useState<StaffAccountPublic | null>(null);
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editRole, setEditRole] = useState<AdminRole>('cashier');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

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
  }, [notify]);

  useEffect(() => {
    loadStaffAndHealth();
  }, [loadStaffAndHealth]);

  const filteredStaff = useMemo(() => {
    if (roleFilter === 'all') return staffList;
    return staffList.filter((s) => s.role === roleFilter);
  }, [staffList, roleFilter]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: staffList.length,
      super_admin: 0,
      accountant: 0,
      cashier: 0,
      supplier: 0,
      delivery_rider: 0,
    };
    for (const acc of staffList) {
      const r = acc.role === 'admin' ? 'super_admin' : acc.role;
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [staffList]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: getAdminAuthHeaders(adminToken),
        body: JSON.stringify({
          displayName: newDisplayName.trim(),
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
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
      setShowCreateForm(false);
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
    setEditRole(acc.role === 'admin' ? 'super_admin' : acc.role);
    setEditPassword('');
    setEditPhone(acc.phone || '');
    setEditNotes(acc.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: getAdminAuthHeaders(adminToken),
        body: JSON.stringify({
          id: editingAccount.id,
          displayName: editDisplayName.trim(),
          username: editUsername.trim(),
          role: editRole,
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

  return (
    <div className="mb-8 space-y-5" dir="rtl">
      {/* Database Engine Status Card (Calm White ERP) */}
      <div className="rounded-2xl border border-[#E8E0D5] bg-white p-5 text-[#231710]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#9A6836]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-base font-bold text-[#231710]">
                  حالة اتصال قاعدة البيانات والمزامنة
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                    dbHealth?.connected !== false
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {dbHealth?.engine === 'neon_postgres'
                    ? 'قاعدة بيانات سحابية متصلة'
                    : 'تخزين محلي مؤمّن'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#6B5644]">
                مزامنة ذرية لـ {dbHealth?.tables?.length || 10} جداول علائقية مفهرسة وتشفير آمن لكلمات المرور.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadStaffAndHealth}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E8E0D5] bg-[#FAF6F0] px-3.5 py-2 text-xs font-bold text-[#231710] transition hover:bg-[#F2ECE2] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-[#6B5644] ${loading ? 'animate-spin' : ''}`} />
            تحديث الفحص
          </button>
        </div>

        {dbHealth?.counts && (
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { key: 'staff_accounts', label: 'حسابات الطاقم', val: dbHealth.counts.staff_accounts },
              { key: 'products', label: 'الأصناف العلائقية', val: dbHealth.counts.products },
              { key: 'orders', label: 'الطلبات والفواتير', val: dbHealth.counts.orders },
              { key: 'pos_shifts', label: 'ورديات الكاشير', val: dbHealth.counts.pos_shifts },
              { key: 'supply_invoices', label: 'فواتير التوريد', val: dbHealth.counts.supply_invoices },
              { key: 'vip_members', label: 'أعضاء محفظة VIP', val: dbHealth.counts.vip_members },
            ].map((stat) => (
              <div
                key={stat.key}
                className="rounded-xl border border-[#E8E0D5] bg-[#FAF6F0] px-3 py-2 text-center"
              >
                <div className="text-base font-bold text-[#231710]">{stat.val ?? 0}</div>
                <div className="text-[11px] text-[#6B5644]">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Multi-Staff Directory Management Card */}
      <div className="rounded-2xl border border-[#E8E0D5] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E0D5] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#231710]">
                إدارة حسابات الموظفين وتعدد المستخدمين
              </h2>
              <p className="text-xs text-[#6B5644] mt-0.5">
                أنشئ حساباً مستقلاً لكل كاشير أو محاسب أو مورد أو مندوب توصيل لتتبع الورديات والفواتير مع إمكانية الإيقاف الفوري.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#231710] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#3A271C]"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? 'إغلاق نموذج الإضافة' : 'إضافة حساب موظف جديد'}
          </button>
        </div>

        {feedback && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
              feedback.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-red-300 bg-red-50 text-red-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-red-700" />
            )}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* Create New Staff Form */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateStaff}
            className="mt-5 rounded-2xl border border-[#E8E0D5] bg-[#FAF6F0] p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[#231710]">
              <ShieldCheck className="h-4 w-4 text-[#9A6836]" />
              <span>تسجيل حساب موظف جديد</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#231710]">
                  الاسم التعريفي للموظف *
                </label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="الاسم الثلاثي كما سيظهر في الوردية"
                  className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm text-[#231710] focus:border-[#231710] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#231710]">
                  اسم المستخدم للدخول (حروف إنجليزية/أرقام) *
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="staff_member_01"
                  className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm text-[#231710] focus:border-[#231710] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#231710]">
                  كلمة المرور السرية (6 خانات فأكثر) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm text-[#231710] focus:border-[#231710] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#231710]">
                  الدور الوظيفي والتخصص *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AdminRole)}
                  className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm font-bold text-[#231710] focus:border-[#231710] focus:outline-none"
                >
                  <option value="cashier">الكاشير ونقطة البيع</option>
                  <option value="accountant">المحاسب المالي والتدقيق</option>
                  <option value="supplier">المورد وإدارة التوريد</option>
                  <option value="delivery_rider">مندوب التوصيل — البندر والقرى</option>
                  <option value="super_admin">المدير العام — صلاحية كاملة</option>
                </select>
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
                  className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm text-[#231710] focus:border-[#231710] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#231710]">
                  ملاحظات الوردية / خط السير (اختياري)
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="مثال: الوردية المسائية — فرع مسجد الزراعيين"
                  className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm text-[#231710] focus:border-[#231710] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-xl border border-[#E8E0D5] bg-white px-4 py-2 text-xs font-bold text-[#231710]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#231710] px-5 py-2 text-xs font-bold text-white hover:bg-[#3a261b] disabled:opacity-50"
              >
                <UserCheck className="h-4 w-4" />
                {submitting ? 'جاري الحفظ...' : 'حفظ وتفعيل حساب الموظف'}
              </button>
            </div>
          </form>
        )}

        {/* Role Filter Tabs */}
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { id: 'all', label: `الكل (${roleCounts.all || 0})` },
            { id: 'super_admin', label: `الإدارة (${roleCounts.super_admin || 0})` },
            { id: 'accountant', label: `المحاسبون (${roleCounts.accountant || 0})` },
            { id: 'cashier', label: `الكاشير (${roleCounts.cashier || 0})` },
            { id: 'supplier', label: `الموردون (${roleCounts.supplier || 0})` },
            { id: 'delivery_rider', label: `مناديب التوصيل (${roleCounts.delivery_rider || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                roleFilter === tab.id
                  ? 'bg-[#231710] text-[#D4AF37] shadow-sm'
                  : 'bg-[#FAF6F0] text-[#231710]/80 hover:bg-[#231710]/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Staff Accounts Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-[#231710]/10 bg-[#FAF6F0] text-xs font-extrabold text-[#231710]/80">
                <th className="px-4 py-3">الموظف</th>
                <th className="px-4 py-3">اسم المستخدم</th>
                <th className="px-4 py-3">الدور وبوابة التوجيه</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">آخر دخول</th>
                <th className="px-4 py-3 text-left">إجراءات التحكم والأمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#231710]/10">
              {filteredStaff.map((acc) => {
                const meta = ROLE_META[acc.role] || ROLE_META.cashier;
                return (
                  <tr key={acc.id} className="hover:bg-[#FAF6F0]/60 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#231710]">{acc.displayName}</span>
                        {acc.isPrimary && (
                          <span className="rounded-md bg-[#D4AF37]/20 px-2 py-0.5 text-[10px] font-bold text-[#231710]">
                            تأسيسي
                          </span>
                        )}
                      </div>
                      {(acc.phone || acc.notes) && (
                        <div className="mt-0.5 text-xs text-[#231710]/60">
                          {[acc.phone, acc.notes].filter(Boolean).join(' • ')}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-[#231710]" dir="ltr">
                      @{acc.username}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${meta.badgeBg} ${meta.badgeText}`}
                      >
                        {meta.label}
                      </span>
                      <div className="mt-1 text-[11px] text-[#231710]/55">{meta.portalLabel}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      {acc.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          نشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-900">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                          موقوف
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs text-[#231710]/65">
                      {acc.lastLoginAt
                        ? new Date(acc.lastLoginAt).toLocaleString('ar-EG', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : 'لم يسجل دخول بعد'}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(acc)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#231710]/20 bg-white px-2.5 py-1.5 text-xs font-bold text-[#231710] hover:bg-[#FAF6F0]"
                          title="تعديل البيانات أو تدوير كلمة المرور"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-[#D4AF37]" />
                          تعديل / كلمة المرور
                        </button>

                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleToggleActive(acc)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                            acc.active
                              ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                              : 'border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                          }`}
                        >
                          {acc.active ? (
                            <>
                              <UserMinus className="h-3.5 w-3.5" />
                              إيقاف
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" />
                              تفعيل
                            </>
                          )}
                        </button>

                        {!acc.isPrimary && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleDeleteStaff(acc)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100"
                            title="حذف الحساب نهائياً"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Password Reset Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#D4AF37]/40 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#231710]/10 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#D4AF37]" />
                <h3 className="text-base font-extrabold text-[#231710]">
                  تعديل بيانات الموظف / تدوير كلمة المرور
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="text-sm font-bold text-[#231710]/60 hover:text-[#231710]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#231710]">
                  الاسم التعريفي للموظف
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm text-[#231710] outline-none focus:border-[#231710]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm text-[#231710] outline-none focus:border-[#231710]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    الدور الوظيفي
                  </label>
                  <select
                    value={editRole}
                    disabled={Boolean(editingAccount.isPrimary)}
                    onChange={(e) => setEditRole(e.target.value as AdminRole)}
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm font-bold text-[#231710] outline-none focus:border-[#231710] disabled:bg-[#FAF6F0]"
                  >
                    <option value="cashier">الكاشير ونقطة البيع</option>
                    <option value="accountant">المحاسب المالي</option>
                    <option value="supplier">المورد ومسؤول الخامات</option>
                    <option value="delivery_rider">مندوب التوصيل</option>
                    <option value="super_admin">المدير العام (الأدمن)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#231710]">
                  كلمة مرور جديدة (اتركها فارغة للإبقاء على كلمة المرور الحالية)
                </label>
                <input
                  type="password"
                  dir="ltr"
                  minLength={6}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور جديدة لتدويرها وإبطال الجلسات القديمة"
                  className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm text-[#231710] outline-none focus:border-[#231710]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm text-[#231710] outline-none focus:border-[#231710]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#231710]">
                    ملاحظات
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E0D5] bg-white px-3.5 py-2 text-sm text-[#231710] outline-none focus:border-[#231710]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#E8E0D5] pt-4">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="rounded-xl border border-[#E8E0D5] bg-white px-4 py-2 text-xs font-bold text-[#231710] hover:bg-[#FAF6F0]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#231710] px-5 py-2 text-xs font-bold text-white hover:bg-[#3a261b] disabled:opacity-50"
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
