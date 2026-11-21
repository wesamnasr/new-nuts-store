import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync } from '@/lib/db';
import { hasRolePermission, verifyAdminRequest } from '@/lib/auth';
import { AUDIT_ACTION_LABELS_AR, generateAuditLogsCsv } from '@/lib/audit-log';
import { AuditActionType, AuditLogEntry } from '@/types/store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit-logs
 * Strictly accessible to Super Admin / Admin and Accountant (or roles explicitly granted accounting_portal/settings).
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDbAsync();
    const auth = verifyAdminRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يلزم تسجيل الدخول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    const canAudit =
      auth.role === 'super_admin' ||
      auth.role === 'admin' ||
      auth.role === 'accountant' ||
      (auth.role &&
        auth.role !== 'delivery_rider' &&
        (hasRolePermission(auth.role, 'accounting_portal', db.settings) ||
          hasRolePermission(auth.role, 'settings', db.settings)));

    if (!canAudit) {
      return NextResponse.json(
        { error: 'عزل الأدوار: سجل الرقابة الأمني متاح للإدارة والمحاسب فقط (403 Forbidden)' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const actionFilter = (url.searchParams.get('action') || '').trim();
    const queryFilter = (url.searchParams.get('q') || '').trim().toLowerCase();
    const format = (url.searchParams.get('format') || '').trim().toLowerCase();
    const limitParam = Number(url.searchParams.get('limit') || 300);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 2000) : 300;

    let logs: AuditLogEntry[] = Array.isArray(db.auditLogs) ? db.auditLogs : [];

    if (actionFilter && actionFilter !== 'all') {
      logs = logs.filter((l) => l.action === (actionFilter as AuditActionType));
    }

    if (queryFilter) {
      logs = logs.filter(
        (l) =>
          l.summary?.toLowerCase().includes(queryFilter) ||
          l.actorUsername?.toLowerCase().includes(queryFilter) ||
          l.actorDisplayName?.toLowerCase().includes(queryFilter) ||
          l.targetId?.toLowerCase().includes(queryFilter) ||
          l.targetType?.toLowerCase().includes(queryFilter)
      );
    }

    const sliced = logs.slice(0, limit);

    if (format === 'csv') {
      const csv = generateAuditLogsCsv(sliced);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      logs: sliced,
      totalCount: logs.length,
      actionLabels: AUDIT_ACTION_LABELS_AR,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/audit-logs:', err);
    return NextResponse.json(
      { error: 'فشل في تحميل سجل الرقابة الأمني', details: err?.message },
      { status: 500 }
    );
  }
}
