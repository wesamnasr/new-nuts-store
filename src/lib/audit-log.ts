import { AdminRole, AuditActionType, AuditLogEntry, DatabaseSchema } from '@/types/store';
import { escapeCsvField } from '@/lib/csv';

export const AUDIT_ACTION_LABELS_AR: Record<AuditActionType, string> = {
  auth_login: 'تسجيل دخول ناجح',
  auth_failed: 'محاولة دخول فاشلة',
  settings_update: 'تحديث إعدادات المتجر',
  product_update: 'تحديث بيانات صنف',
  price_change: 'تعديل أسعار بيع/تكلفة',
  inventory_adjustment: 'تسوية جرد / هالك مخزون',
  pos_shift_open: 'فتح وردية كاشير',
  pos_shift_close: 'إغلاق وتوريد وردية كاشير',
  pos_return: 'مرتجع مبيعات كاشير',
  order_cancel: 'إلغاء طلب واسترداد مخزون',
  supply_invoice_approve: 'اعتماد فاتورة توريد',
  supply_invoice_reject: 'رفض فاتورة توريد',
  supply_payment: 'سداد دفعة لمورد',
  supply_return: 'مرتجع مشتريات لمورد',
  treasury_tx: 'حركة خزينة / حساب مالي',
  credit_settlement: 'تحصيل مديونية عميل آجل',
  system_reset: 'تصفير العمليات التجريبية',
  system_backup: 'تصدير نسخة احتياطية كاملة',
  system_restore: 'استعادة نسخة احتياطية للنظام',
  warehouse_transfer: 'تحويل مخزني بين المخازن',
  bom_update: 'تحديث شجرة المكونات (BOM)',
  erp_master_update: 'تحديث البيانات الأساسية (ERP)',
  partner_withdrawal: 'مسحوب شريك بسعر التكلفة',
  pos_sell_by_amount: 'بيع بالمبلغ (وسم رقابي)',
};

const SENSITIVE_KEY_PATTERN = /password|secret|token|hash|pin/i;

function scrubAuditValue(val: unknown, depth = 0): unknown {
  if (val === null || val === undefined) return undefined;
  if (depth > 3) return '[...]';
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.slice(0, 25).map((item) => scrubAuditValue(item, depth + 1));
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) continue;
    clean[k] = scrubAuditValue(v, depth + 1);
  }
  return clean;
}

export interface AppendAuditLogParams {
  action: AuditActionType;
  actorUsername: string;
  actorDisplayName?: string;
  actorRole: AdminRole | string;
  targetType: string;
  targetId?: string;
  summary: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  ipAddress?: string;
}

const MAX_IN_MEMORY_AUDIT_LOGS = 2000;

export function appendAuditLog(
  db: DatabaseSchema,
  params: AppendAuditLogParams
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    action: params.action,
    actorUsername: params.actorUsername || 'system',
    actorDisplayName: params.actorDisplayName || params.actorUsername || 'النظام',
    actorRole: params.actorRole || 'super_admin',
    targetType: params.targetType,
    targetId: params.targetId,
    summary: params.summary,
    beforeValue:
      params.beforeValue !== undefined ? scrubAuditValue(params.beforeValue) : undefined,
    afterValue:
      params.afterValue !== undefined ? scrubAuditValue(params.afterValue) : undefined,
    ipAddress: params.ipAddress,
    createdAt: new Date().toISOString(),
  };

  if (!Array.isArray(db.auditLogs)) {
    db.auditLogs = [];
  }
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > MAX_IN_MEMORY_AUDIT_LOGS) {
    db.auditLogs = db.auditLogs.slice(0, MAX_IN_MEMORY_AUDIT_LOGS);
  }

  return entry;
}

export function generateAuditLogsCsv(logs: AuditLogEntry[]): string {
  const headers = [
    'رقم السجل',
    'التوقيت',
    'نوع الإجراء',
    'اسم المستخدم',
    'الاسم الوظيفي',
    'الدور',
    'الكيان المستهدف',
    'معرف الكيان',
    'ملخص العملية',
    'عنوان IP',
  ];

  const rows = logs.map((log) => [
    escapeCsvField(log.id),
    escapeCsvField(new Date(log.createdAt).toLocaleString('ar-EG')),
    escapeCsvField(AUDIT_ACTION_LABELS_AR[log.action] || log.action),
    escapeCsvField(log.actorUsername),
    escapeCsvField(log.actorDisplayName || ''),
    escapeCsvField(String(log.actorRole)),
    escapeCsvField(log.targetType),
    escapeCsvField(log.targetId || ''),
    escapeCsvField(log.summary),
    escapeCsvField(log.ipAddress || ''),
  ]);

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
