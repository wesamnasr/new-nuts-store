import {
  AdminPermissionId,
  AdminRole,
  NonAdminStaffRole,
  RolePermissionsConfig,
  StoreSettings,
  SystemRole,
} from '@/types/store';

export const ROLE_LABELS_AR: Record<SystemRole, string> = {
  super_admin: 'الأدمن (المدير العام)',
  admin: 'الأدمن (المدير العام)',
  supplier: 'المورد (إدارة التوريد والمخزون)',
  cashier: 'الكاشير (نقطة البيع وتجهيز الطلبات)',
  accountant: 'المحاسب (المراجعة المالية والورديات)',
  store_manager: 'مدير التشغيل والطلبات',
  promo_partner: 'شريك العروض والتسويق',
};

export const ALL_DASHBOARD_PERMISSIONS: AdminPermissionId[] = [
  'overview',
  'orders',
  'products',
  'categories',
  'supply_portal',
  'supply_invoices',
  'accounting_portal',
  'cashier_portal',
  'operations',
  'shipping',
  'coupons',
  'reviews',
  'settings',
];

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsConfig = {
  supplier: ['supply_portal', 'supply_invoices', 'categories'],
  accountant: [
    'accounting_portal',
    'orders',
    'supply_invoices',
    'operations',
    'products',
    'coupons',
  ],
  cashier: ['cashier_portal', 'orders'],
};

export interface DashboardPermissionMeta {
  id: AdminPermissionId;
  label: string;
  description: string;
  badgeCategory: string;
}

export const DASHBOARD_PERMISSION_META: DashboardPermissionMeta[] = [
  {
    id: 'overview',
    label: 'نظرة عامة والإحصائيات',
    description: 'لوحة المؤشرات العامة ومبيعات المتجر وصافي الأرباح والتقارير السريعة',
    badgeCategory: 'الإدارة العامة',
  },
  {
    id: 'orders',
    label: 'الطلبات والعملاء',
    description: 'استعراض ومتابعة طلبات الأونلاين والكاشير وتحديث حالات التجهيز والتوصيل',
    badgeCategory: 'المبيعات والطلبات',
  },
  {
    id: 'products',
    label: 'المنتجات والمخزون',
    description: 'إضافة وتعديل المنتجات وأسعار البيع للجمهور والعروض وتوافر الأصناف',
    badgeCategory: 'المنتجات والمخزون',
  },
  {
    id: 'categories',
    label: 'الأقسام والتصنيفات',
    description: 'إدارة أقسام المتجر وتصنيفات المحمصة وترتيب ظهورها',
    badgeCategory: 'المنتجات والمخزون',
  },
  {
    id: 'supply_portal',
    label: 'بوابة التوريد والمخزون (المورد)',
    description: 'تحديث أسعار التكلفة بالجملة، التغليف، بلد المنشأ، النواقص، وإرسال دفعات التوريد',
    badgeCategory: 'التوريد والمشتريات',
  },
  {
    id: 'supply_invoices',
    label: 'فواتير التوريد (عرفات)',
    description: 'استعراض سجل فواتير التوريد، إنشاء فواتير توريد جديدة، ومتابعة حالة الاعتماد',
    badgeCategory: 'التوريد والمشتريات',
  },
  {
    id: 'accounting_portal',
    label: 'بوابة المحاسبة والتدقيق المالي (المحاسب)',
    description: 'التقارير المالية الشاملة، أرباح القنوات، مراجعة ورديات الكاشير (Z-Report)، المصروفات، وتصدير Excel',
    badgeCategory: 'المالية والمحاسبة',
  },
  {
    id: 'cashier_portal',
    label: 'نقطة البيع والورديات (الكاشير POS)',
    description: 'شاشة كاشير الفرع التفاعلية، الميزان، البوكسات، توليفة البن، الفواتير الفورية، وإغلاق الوردية',
    badgeCategory: 'نقطة البيع POS',
  },
  {
    id: 'operations',
    label: 'العمليات والـ VIP والعروض',
    description: 'إدارة عملاء محفظة VIP الكاش باك، العروض الخاطفة، وسجل الورديات والمصروفات',
    badgeCategory: 'الإدارة والتسويق',
  },
  {
    id: 'shipping',
    label: 'الشحن والتوصيل (بني مزار)',
    description: 'إدارة مناطق الشحن وأسعار التوصيل للبندر والقرى والحد الأدنى للطلبات',
    badgeCategory: 'الإعدادات والتشغيل',
  },
  {
    id: 'coupons',
    label: 'كوبونات الخصم',
    description: 'إنشاء وتفعيل وإيقاف أكواد وكوبونات الخصم التسويقية',
    badgeCategory: 'الإدارة والتسويق',
  },
  {
    id: 'reviews',
    label: 'تقييمات العملاء',
    description: 'مراجعة وإدارة تعليقات وتقييمات المشترين على المنتجات',
    badgeCategory: 'الإدارة والتسويق',
  },
  {
    id: 'settings',
    label: 'إعدادات المتجر والمظهر',
    description: 'تعديل بيانات المتجر، الثيمات، محتوى الصفحات، وأرقام الدفع والتواصل',
    badgeCategory: 'الإعدادات والتشغيل',
  },
];

export function normalizeClientAdminRole(
  role?: string | null
): 'super_admin' | 'supplier' | 'cashier' | 'accountant' | 'store_manager' | 'promo_partner' {
  if (!role || role === 'admin' || role === 'super_admin') {
    return 'super_admin';
  }
  if (role === 'supplier') return 'supplier';
  if (role === 'cashier') return 'cashier';
  if (role === 'accountant') return 'accountant';
  if (role === 'store_manager') return 'store_manager';
  if (role === 'promo_partner') return 'promo_partner';
  return 'super_admin';
}

export function getResolvedRolePermissions(
  settings?: StoreSettings | null
): RolePermissionsConfig {
  const raw = settings?.rolePermissions;
  const sanitizeList = (
    list: unknown,
    fallback: AdminPermissionId[]
  ): AdminPermissionId[] => {
    if (!Array.isArray(list)) return [...fallback];
    const valid = list.filter(
      (item): item is AdminPermissionId =>
        typeof item === 'string' &&
        ALL_DASHBOARD_PERMISSIONS.includes(item as AdminPermissionId)
    );
    return Array.from(new Set(valid));
  };

  const rawAccountant = sanitizeList(raw?.accountant, DEFAULT_ROLE_PERMISSIONS.accountant).filter(
    (p) => p !== 'overview'
  );
  const isLegacyThreeTabAccountant =
    rawAccountant.length <= 3 &&
    rawAccountant.every((p) =>
      ['accounting_portal', 'orders', 'supply_invoices'].includes(p)
    );

  return {
    supplier: sanitizeList(raw?.supplier, DEFAULT_ROLE_PERMISSIONS.supplier),
    accountant: isLegacyThreeTabAccountant
      ? [...DEFAULT_ROLE_PERMISSIONS.accountant]
      : rawAccountant.length > 0
        ? rawAccountant
        : [...DEFAULT_ROLE_PERMISSIONS.accountant],
    cashier: sanitizeList(raw?.cashier, DEFAULT_ROLE_PERMISSIONS.cashier),
  };
}

export function hasRolePermission(
  role: AdminRole | string | null | undefined,
  permission: AdminPermissionId,
  settings?: StoreSettings | null
): boolean {
  const normalized = normalizeClientAdminRole(role);
  if (normalized === 'super_admin') {
    return true;
  }
  const resolved = getResolvedRolePermissions(settings);
  if (
    normalized === 'supplier' ||
    normalized === 'accountant' ||
    normalized === 'cashier'
  ) {
    return resolved[normalized].includes(permission);
  }
  if (normalized === 'store_manager') {
    return permission === 'orders' || permission === 'cashier_portal';
  }
  if (normalized === 'promo_partner') {
    return permission === 'coupons' || permission === 'reviews';
  }
  return false;
}

export function getAllowedRolesForPermission(
  permission: AdminPermissionId,
  settings?: StoreSettings | null
): AdminRole[] {
  const allowed: AdminRole[] = ['super_admin', 'admin'];
  const nonAdminRoles: NonAdminStaffRole[] = ['supplier', 'accountant', 'cashier'];
  for (const r of nonAdminRoles) {
    if (hasRolePermission(r, permission, settings)) {
      allowed.push(r);
    }
  }
  return allowed;
}
