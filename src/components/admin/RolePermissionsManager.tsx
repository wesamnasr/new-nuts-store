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
    title: 'المورد',
    subtitle: 'المسؤول عن التوريد، أسعار الجملة، النواقص، وفواتير التوريد',
    badgeColor: 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]',
    borderColor: 'border-[#E8E0D5]',
    icon: Truck,
  },
  {
    id: 'accountant',
    title: 'المحاسب',
    subtitle: 'المسؤول عن التقارير المالية، الأرباح، الورديات، والمصروفات',
    badgeColor: 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]',
    borderColor: 'border-[#E8E0D5]',
    icon: Calculator,
  },
  {
    id: 'cashier',
    title: 'الكاشير',
    subtitle: 'المسؤول عن نقطة البيع، الفواتير الفورية، وتجهيز الطلبات',
    badgeColor: 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]',
    borderColor: 'border-[#E8E0D5]',
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
    <div className="space-y-5">
      {/* Clean Light Header Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E8E0D5] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#231710] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#9A6836]" />
            <span>إدارة صلاحيات المستخدمين</span>
          </h2>
          <p className="text-xs text-[#6B5644] mt-1">
            تحكم في الصفحات والأقسام المسموحة لكل دور وظيفي في لوحة الإدارة الموحدة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={resetAllRolesToDefault}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F2ECE2] text-[#231710] border border-[#E8E0D5] font-bold text-xs transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#6B5644]" />
            <span>استعادة الصلاحيات الافتراضية</span>
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSaving
                ? 'جاري حفظ الصلاحيات...'
                : hasUnsavedChanges
                ? 'حفظ وتطبيق التعديلات *'
                : 'حفظ صلاحيات المستخدمين'}
            </span>
          </button>
        </div>
      </div>

      {/* 4 Users Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Admin Card (Always Full Access) */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8E0D5] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] text-xs font-bold">
                <Crown className="w-3.5 h-3.5 text-[#9A6836]" />
                الأدمن (المدير العام)
              </span>
              <span className="text-xs font-bold text-emerald-700">
                {ALL_DASHBOARD_PERMISSIONS.length} / {ALL_DASHBOARD_PERMISSIONS.length} صلاحية
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-[#E8E0D5] flex items-center justify-between text-xs font-bold text-[#6B5644]">
            <span>صلاحيات كاملة دائمة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
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
              className={`bg-white rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                isSelected ? 'border-[#231710]' : 'border-[#E8E0D5]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] text-xs font-bold">
                    <Icon className="w-3.5 h-3.5 text-[#6B5644]" />
                    {roleMeta.title}
                  </span>
                  <span className="text-xs font-bold text-[#231710]">
                    {activeList.length} / {ALL_DASHBOARD_PERMISSIONS.length} صفحة
                  </span>
                </div>
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
                          className="px-2 py-0.5 rounded-md bg-[#FAF6F0] text-[#4A3728] border border-[#E8E0D5] text-[11px] font-medium"
                        >
                          {meta?.label || pId}
                        </span>
                      );
                    })
                  )}
                  {activeList.length > 4 && (
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] text-[11px] font-bold">
                      +{activeList.length - 4} أخرى
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E8E0D5] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = isSelected ? 'all' : roleMeta.id;
                    setSelectedRoleFilter(nextVal);
                    updateUrlQueryParams({ subtab: nextVal === 'all' ? null : nextVal });
                  }}
                  className="text-xs font-bold text-[#231710] hover:text-[#9A6836] underline cursor-pointer"
                >
                  {isSelected ? 'عرض الكل' : 'تخصيص الصلاحيات'}
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => grantAllForRole(roleMeta.id)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold cursor-pointer"
                    title="منح كل الصلاحيات"
                  >
                    منح الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => resetRoleToDefault(roleMeta.id)}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#F2ECE2] text-[#4A3728] border border-[#E8E0D5] text-[11px] font-bold cursor-pointer"
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
      <div className="bg-white rounded-2xl p-3 border border-[#E8E0D5] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedRoleFilter('all');
              updateUrlQueryParams({ subtab: null });
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedRoleFilter === 'all'
                ? 'bg-[#231710] text-white'
                : 'bg-[#FAF6F0] text-[#4A3728] hover:bg-[#F2ECE2]'
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
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedRoleFilter === r.id
                  ? 'bg-[#231710] text-white'
                  : 'bg-[#FAF6F0] text-[#4A3728] hover:bg-[#F2ECE2]'
              }`}
            >
              تخصيص: {r.title}
            </button>
          ))}
        </div>

        <span className="text-xs font-medium text-[#6B5644] px-2">
          اضغط على أي صلاحية لمنحها أو حجبها عن المستخدم
        </span>
      </div>

      {/* Interactive Permissions Matrix Table */}
      <div className="bg-white rounded-2xl border border-[#E8E0D5] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#FAF6F0] text-[#231710] border-b border-[#E8E0D5] text-xs font-bold">
              <tr>
                <th className="px-5 py-3.5">الصفحة / الصلاحية في لوحة الإدارة الموحدة</th>
                <th className="px-4 py-3.5">التصنيف</th>
                <th className="px-4 py-3.5 text-center">الأدمن (المدير)</th>
                {visibleRoles.map((r) => (
                  <th key={r.id} className="px-4 py-3.5 text-center">
                    {r.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECE2]">
              {DASHBOARD_PERMISSION_META.map((perm) => (
                <tr key={perm.id} className="hover:bg-[#FAF6F0]/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center shrink-0">
                        <LayoutDashboard className="w-4 h-4 text-[#6B5644]" />
                      </div>
                      <p className="font-bold text-[#231710] text-sm">{perm.label}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] text-[#4A3728] border border-[#E8E0D5] text-xs font-medium">
                      {perm.badgeCategory}
                    </span>
                  </td>
                  {/* Admin Always Granted */}
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ممنوحة دائماً</span>
                    </span>
                  </td>

                  {/* Toggle Buttons for Each Non-Admin Staff User */}
                  {visibleRoles.map((roleMeta) => {
                    const isGranted = (localConfig[roleMeta.id] || []).includes(perm.id);
                    return (
                      <td key={roleMeta.id} className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(roleMeta.id, perm.id)}
                          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            isGranted
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-[#FAF6F0] text-[#6B5644] border-[#E8E0D5] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                          }`}
                        >
                          {isGranted ? (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                              <span>مفعلة</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-[#8A735E]" />
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
