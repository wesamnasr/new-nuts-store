'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Crown,
  Truck,
  Calculator,
  Store,
  CheckCircle2,
  XCircle,
  Save,
  RotateCcw,
  Lock,
  Unlock,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import {
  AdminPermissionId,
  NonAdminStaffRole,
  RolePermissionsConfig,
} from '@/types/store';
import {
  ALL_DASHBOARD_PERMISSIONS,
  DASHBOARD_PERMISSION_META,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/lib/permissions';
import {
  updateUrlQueryParams,
  useBrowserUrlSync,
} from '@/lib/url-sync';

interface RolePermissionsManagerProps {
  rolePermissions: RolePermissionsConfig;
  onSaveRolePermissions: (updated: RolePermissionsConfig) => Promise<void>;
  isSaving: boolean;
}

const EDITABLE_ROLES: {
  id: NonAdminStaffRole;
  title: string;
  subtitle: string;
  badgeColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'supplier',
    title: 'المورد (Supplier)',
    subtitle: 'المسؤول عن التوريد، أسعار الجملة، النواقص، وفواتير التوريد',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    borderColor: 'border-amber-500/40',
    icon: Truck,
  },
  {
    id: 'accountant',
    title: 'المحاسب (Accountant)',
    subtitle: 'المسؤول عن التقارير المالية، الأرباح، الورديات، والمصروفات',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    borderColor: 'border-indigo-500/40',
    icon: Calculator,
  },
  {
    id: 'cashier',
    title: 'الكاشير (Cashier)',
    subtitle: 'المسؤول عن نقطة البيع POS، الفواتير الفورية، وتجهيز الطلبات',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    borderColor: 'border-emerald-500/40',
    icon: Store,
  },
];

export function RolePermissionsManager({
  rolePermissions,
  onSaveRolePermissions,
  isSaving,
}: RolePermissionsManagerProps) {
  const [localConfig, setLocalConfig] = useState<RolePermissionsConfig>(rolePermissions);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | NonAdminStaffRole>('all');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useBrowserUrlSync((params) => {
    const rParam = params.get('subtab');
    if (rParam && ['all', 'supplier', 'accountant', 'cashier'].includes(rParam)) {
      setSelectedRoleFilter(rParam as 'all' | NonAdminStaffRole);
    } else if (!rParam) {
      setSelectedRoleFilter('all');
    }
  });

  useEffect(() => {
    setLocalConfig(rolePermissions);
    setHasUnsavedChanges(false);
  }, [rolePermissions]);

  const togglePermission = (role: NonAdminStaffRole, permId: AdminPermissionId) => {
    setLocalConfig((prev) => {
      const currentList = prev[role] || [];
      const exists = currentList.includes(permId);
      const nextList = exists
        ? currentList.filter((p) => p !== permId)
        : [...currentList, permId];
      return {
        ...prev,
        [role]: nextList,
      };
    });
    setHasUnsavedChanges(true);
  };

  const grantAllForRole = (role: NonAdminStaffRole) => {
    setLocalConfig((prev) => ({
      ...prev,
      [role]: [...ALL_DASHBOARD_PERMISSIONS],
    }));
    setHasUnsavedChanges(true);
  };

  const resetRoleToDefault = (role: NonAdminStaffRole) => {
    setLocalConfig((prev) => ({
      ...prev,
      [role]: [...DEFAULT_ROLE_PERMISSIONS[role]],
    }));
    setHasUnsavedChanges(true);
  };

  const resetAllRolesToDefault = () => {
    setLocalConfig({
      supplier: [...DEFAULT_ROLE_PERMISSIONS.supplier],
      accountant: [...DEFAULT_ROLE_PERMISSIONS.accountant],
      cashier: [...DEFAULT_ROLE_PERMISSIONS.cashier],
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    await onSaveRolePermissions(localConfig);
    setHasUnsavedChanges(false);
  };

  const visibleRoles =
    selectedRoleFilter === 'all'
      ? EDITABLE_ROLES
      : EDITABLE_ROLES.filter((r) => r.id === selectedRoleFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-brand-950 via-brand-900 to-brand-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-gold-500/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-500/20 border border-gold-400/40 text-gold-300 text-xs font-black mb-3">
              <ShieldCheck className="w-4 h-4" />
              <span>التحكم في الصلاحيات</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black font-serif mb-2">
              إدارة صلاحيات المستخدمين
            </h2>
            <p className="hidden">
              جميع المستخدمين يظهر لهم نفس تصميم لوحة الإدارة الموحدة، ولكن تختلف الصفحات والأدوات الظاهرة لكل مستخدم حسب الصلاحيات الممنوحة له هنا. يمكنك كأدمن منح أو حذف أي صلاحية من أي مستخدم من المستخدمين الثلاثة (المورد، المحاسب، الكاشير) بضغطة واحدة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={resetAllRolesToDefault}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>استعادة الصلاحيات الافتراضية</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gold-500 hover:bg-gold-400 text-brand-950 font-black text-sm shadow-lg shadow-gold-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'جاري حفظ الصلاحيات...'
                  : hasUnsavedChanges
                  ? 'حفظ وتطبيق تعديلات الصلاحيات الآن *'
                  : 'حفظ صلاحيات المستخدمين'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Users Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Admin Card (Always Full Access) */}
        <div className="bg-gradient-to-br from-brand-900 to-brand-950 text-white rounded-2xl p-5 border border-gold-500/40 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/20 text-gold-300 text-xs font-black">
                <Crown className="w-3.5 h-3.5" />
                الأدمن (المدير العام)
              </span>
              <span className="text-xs font-black text-emerald-400">
                {ALL_DASHBOARD_PERMISSIONS.length} / {ALL_DASHBOARD_PERMISSIONS.length} صلاحية
              </span>
            </div>
            <p className="hidden">
              يمتلك جميع صلاحيات النظام بالكامل، ويتحكم في منح أو سحب الصلاحيات من باقي المستخدمين الثلاثة.
            </p>
          </div>
          <div className="pt-3 border-t border-brand-800 flex items-center justify-between text-xs font-bold text-gold-400">
            <span>صلاحيات كاملة دائمة</span>
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* 3 Editable Staff Users Cards */}
        {EDITABLE_ROLES.map((roleMeta) => {
          const Icon = roleMeta.icon;
          const activeList = localConfig[roleMeta.id] || [];
          const isSelected = selectedRoleFilter === roleMeta.id;
          return (
            <div
              key={roleMeta.id}
              className={`bg-white rounded-2xl p-5 border-2 transition-all shadow-sm flex flex-col justify-between ${
                isSelected ? 'border-brand-900 ring-2 ring-brand-900/10' : 'border-brand-100'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black ${roleMeta.badgeColor}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {roleMeta.title}
                  </span>
                  <span className="text-xs font-black text-brand-900">
                    {activeList.length} / {ALL_DASHBOARD_PERMISSIONS.length} صفحة مفعلة
                  </span>
                </div>
                <p className="hidden">
                  {roleMeta.subtitle}
                </p>
                <div className="flex flex-wrap gap-1 mb-4">
                  {activeList.length === 0 ? (
                    <span className="text-[11px] font-bold text-rose-600">
                      لا توجد صلاحيات مفعلة حالياً
                    </span>
                  ) : (
                    activeList.slice(0, 4).map((pId) => {
                      const meta = DASHBOARD_PERMISSION_META.find((m) => m.id === pId);
                      return (
                        <span
                          key={pId}
                          className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-800 text-[11px] font-bold"
                        >
                          {meta?.label || pId}
                        </span>
                      );
                    })
                  )}
                  {activeList.length > 4 && (
                    <span className="px-2 py-0.5 rounded-md bg-brand-100 text-brand-900 text-[11px] font-black">
                      +{activeList.length - 4} أخرى
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-brand-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = isSelected ? 'all' : roleMeta.id;
                    setSelectedRoleFilter(nextVal);
                    updateUrlQueryParams({ subtab: nextVal === 'all' ? null : nextVal });
                  }}
                  className="text-xs font-black text-brand-900 hover:text-gold-600 underline cursor-pointer"
                >
                  {isSelected ? 'عرض كل المستخدمين' : 'تخصيص صلاحيات هذا المستخدم'}
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => grantAllForRole(roleMeta.id)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-black cursor-pointer"
                    title="منح كل الصلاحيات"
                  >
                    منح الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => resetRoleToDefault(roleMeta.id)}
                    className="px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11px] font-bold cursor-pointer"
                    title="استعادة الصلاحيات الافتراضية"
                  >
                    افتراضي
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Filter Bar */}
      <div className="bg-white rounded-2xl p-3 border border-brand-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedRoleFilter('all');
              updateUrlQueryParams({ subtab: null });
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              selectedRoleFilter === 'all'
                ? 'bg-brand-900 text-gold-400'
                : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
            }`}
          >
            مصفوفة الصلاحيات الكاملة (كل المستخدمين)
          </button>
          {EDITABLE_ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setSelectedRoleFilter(r.id);
                updateUrlQueryParams({ subtab: r.id });
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedRoleFilter === r.id
                  ? 'bg-brand-900 text-gold-400'
                  : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
              }`}
            >
              تخصيص: {r.title}
            </button>
          ))}
        </div>

        <span className="text-xs font-bold text-brand-500 px-2">
          اضغط على أي صلاحية لمنحها (مفعلة) أو حذفها (محجوبة) من المستخدم
        </span>
      </div>

      {/* Interactive Permissions Matrix Table */}
      <div className="bg-white rounded-3xl border border-brand-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-brand-950 text-white text-xs font-black">
              <tr>
                <th className="px-5 py-4">الصفحة / الصلاحية في لوحة الإدارة الموحدة</th>
                <th className="px-4 py-4">التصنيف</th>
                <th className="px-4 py-4 text-center">الأدمن (المدير)</th>
                {visibleRoles.map((r) => (
                  <th key={r.id} className="px-4 py-4 text-center">
                    {r.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {DASHBOARD_PERMISSION_META.map((perm) => (
                <tr key={perm.id} className="hover:bg-brand-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                        <LayoutDashboard className="w-4 h-4 text-brand-700" />
                      </div>
                      <div>
                        <p className="font-black text-brand-900 text-sm">{perm.label}</p>
                        <p className="hidden">{perm.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">
                      {perm.badgeCategory}
                    </span>
                  </td>
                  {/* Admin Always Granted */}
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold-500/15 text-amber-900 border border-gold-500/30 text-xs font-black">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ممنوحة دائماً</span>
                    </span>
                  </td>

                  {/* Toggle Buttons for Each Non-Admin Staff User */}
                  {visibleRoles.map((roleMeta) => {
                    const isGranted = (localConfig[roleMeta.id] || []).includes(perm.id);
                    return (
                      <td key={roleMeta.id} className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(roleMeta.id, perm.id)}
                          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                            isGranted
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-xs'
                              : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                          }`}
                        >
                          {isGranted ? (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                              <span>مفعلة</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-gray-400" />
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
    </div>
  );
}

export default RolePermissionsManager;
