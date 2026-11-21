import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, withDbTransaction } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/auth';
import { appendAuditLog } from '@/lib/audit-log';
import { DatabaseSchema } from '@/types/store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/backup
 * Downloads a complete, unredacted JSON snapshot of the entire operational database
 * (strictly restricted to super_admin).
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDbAsync();
    const auth = verifyAdminRequest(request, ['super_admin']);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error || 'غير مصرح بالوصول — يتطلب صلاحية المدير العام لتصدير النسخة الاحتياطية الكاملة' },
        { status: auth.statusCode || 401 }
      );
    }

    const exportedAt = new Date().toISOString();
    const dateSlug = exportedAt.split('T')[0];

    await withDbTransaction(async (liveDb) => {
      appendAuditLog(liveDb, {
        action: 'system_backup',
        actorUsername: auth.username || 'admin',
        actorDisplayName: auth.displayName || auth.username || 'المدير العام',
        actorRole: 'super_admin',
        targetType: 'database',
        summary: `تصدير نسخة احتياطية كاملة للنظام (${liveDb.products.length} صنف • ${liveDb.orders.length} طلب)`,
      });
    });

    const latestDb = await getDbAsync();
    const payload = {
      backupVersion: 2,
      exportedAt,
      data: latestDb,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="mizan-full-backup-${dateSlug}.json"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('GET /api/admin/backup error:', error);
    return NextResponse.json(
      { error: `فشل تصدير النسخة الاحتياطية: ${error?.message || error}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/backup
 * Validates and restores a full JSON snapshot into the operational database
 * while protecting active super_admin credentials from accidental lockout.
 */
export async function POST(request: NextRequest) {
  try {
    await getDbAsync();
    const auth = verifyAdminRequest(request, ['super_admin']);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error || 'غير مصرح بالوصول — يتطلب صلاحية المدير العام لاستعادة النسخة الاحتياطية' },
        { status: auth.statusCode || 401 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json(
        { error: 'ملف النسخة الاحتياطية غير صالح (JSON تالف أو فارغ)' },
        { status: 400 }
      );
    }

    const candidate: Partial<DatabaseSchema> =
      rawBody.data && typeof rawBody.data === 'object' ? rawBody.data : rawBody;

    if (
      !candidate.settings ||
      typeof candidate.settings !== 'object' ||
      !Array.isArray(candidate.products) ||
      !Array.isArray(candidate.categories)
    ) {
      return NextResponse.json(
        { error: 'بنية ملف النسخة الاحتياطية غير مكتملة (يلزم وجود الإعدادات والأقسام والمنتجات)' },
        { status: 400 }
      );
    }

    const summaryStats = await withDbTransaction(async (db) => {
      // Preserve current super_admin login credentials if backup omitted them
      const safeAdminUsername =
        candidate.settings?.adminUsername?.trim() || db.settings.adminUsername || 'admin_hafsa';
      const safeAdminPassword =
        candidate.settings?.adminPassword?.trim() || db.settings.adminPassword || 'Hafsa@Admin2026';

      db.settings = {
        ...db.settings,
        ...candidate.settings,
        adminUsername: safeAdminUsername,
        adminPassword: safeAdminPassword,
      };
      db.categories = candidate.categories || [];
      db.products = candidate.products || [];
      if (Array.isArray(candidate.shippingRates)) db.shippingRates = candidate.shippingRates;
      if (Array.isArray(candidate.coupons)) db.coupons = candidate.coupons;
      if (Array.isArray(candidate.orders)) db.orders = candidate.orders;
      if (Array.isArray(candidate.vipMembers)) db.vipMembers = candidate.vipMembers;
      if (Array.isArray(candidate.promotions)) db.promotions = candidate.promotions;
      if (Array.isArray(candidate.flashPromotions)) db.flashPromotions = candidate.flashPromotions;
      if (Array.isArray(candidate.posShifts)) db.posShifts = candidate.posShifts;
      if (Array.isArray(candidate.posExpenses)) db.posExpenses = candidate.posExpenses;
      if (Array.isArray(candidate.posReturns)) db.posReturns = candidate.posReturns;
      if (Array.isArray(candidate.supplyInvoices)) db.supplyInvoices = candidate.supplyInvoices;
      if (Array.isArray(candidate.supplierPayments)) db.supplierPayments = candidate.supplierPayments;
      if (Array.isArray(candidate.supplyReturns)) db.supplyReturns = candidate.supplyReturns;
      if (Array.isArray(candidate.treasuryTransactions)) {
        db.treasuryTransactions = candidate.treasuryTransactions;
      }
      if (Array.isArray(candidate.inventoryAdjustments)) {
        db.inventoryAdjustments = candidate.inventoryAdjustments;
      }
      if (Array.isArray(candidate.staffAccounts) && candidate.staffAccounts.length > 0) {
        db.staffAccounts = candidate.staffAccounts;
      }

      appendAuditLog(db, {
        action: 'system_restore',
        actorUsername: auth.username || 'admin',
        actorDisplayName: auth.displayName || auth.username || 'المدير العام',
        actorRole: 'super_admin',
        targetType: 'database',
        summary: `استعادة نسخة احتياطية كاملة (${db.products.length} صنف • ${db.orders.length} طلب • ${(db.posShifts || []).length} وردية)`,
      });

      return {
        productsCount: db.products.length,
        categoriesCount: db.categories.length,
        ordersCount: db.orders.length,
        shiftsCount: (db.posShifts || []).length,
      };
    });

    return NextResponse.json({
      success: true,
      restored: summaryStats,
      message: 'تمت استعادة النسخة الاحتياطية الكاملة بنجاح',
    });
  } catch (error: any) {
    console.error('POST /api/admin/backup error:', error);
    return NextResponse.json(
      { error: `تعذر استعادة النسخة الاحتياطية: ${error?.message || error}` },
      { status: 500 }
    );
  }
}
