import { NextResponse } from 'next/server';
import { getDbAsync, withDbTransaction } from '@/lib/db';
import { hasRolePermission, verifyAdminRequest } from '@/lib/auth';
import { sendStoreTelegramAlert } from '@/lib/telegram';
import {
  InventoryAdjustment,
  InventoryAdjustmentReason,
} from '@/types/store';

export const dynamic = 'force-dynamic';

const REASON_LABELS: Record<InventoryAdjustmentReason, string> = {
  physical_count_discrepancy: 'تسوية جرد دوري (عجز / زيادة)',
  roasting_shrinkage: 'هالك تحميص طبيعي (تبخر رطوبة)',
  damaged_spoilage: 'تالف / كسر / منتهي الصلاحية',
  sample_hospitality: 'ضيافة وتذوق بالفرع',
  correction: 'تصحيح خطأ إدخال رصيد سابق',
};

/**
 * GET /api/admin/inventory-adjustments
 * RBAC Matrix:
 * - Unauthenticated: 401 Unauthorized
 * - Cashier / Delivery Rider: 403 Forbidden
 * - Accountant: 200 OK (Read-Only Audit Ledger)
 * - Super Admin / Admin: 200 OK (Full Access)
 */
export async function GET(request: Request) {
  try {
    const db = await getDbAsync();
    const auth = verifyAdminRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يتطلب تسجيل الدخول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    if (auth.role === 'delivery_rider') {
      return NextResponse.json(
        { error: 'عزل الأدوار: مندوب التوصيل غير مصرح له بالاطلاع على تسويات الجرد (403 Forbidden)' },
        { status: 403 }
      );
    }

    if (auth.role === 'cashier') {
      return NextResponse.json(
        { error: 'عزل الأدوار: كاشير الصالة غير مصرح له بالاطلاع على دفتر تسويات الجرد (403 Forbidden)' },
        { status: 403 }
      );
    }

    const canView =
      auth.role === 'super_admin' ||
      auth.role === 'admin' ||
      auth.role === 'accountant' ||
      hasRolePermission(auth.role, 'accounting_portal', db.settings) ||
      hasRolePermission(auth.role, 'operations', db.settings);

    if (!canView) {
      return NextResponse.json(
        { error: 'عزل الأدوار: هذا الحساب غير مصرح له باستعراض دفتر تسويات الجرد (403 Forbidden)' },
        { status: 403 }
      );
    }

    const adjustments: InventoryAdjustment[] = Array.isArray(db.inventoryAdjustments)
      ? db.inventoryAdjustments
      : [];

    return NextResponse.json({
      success: true,
      adjustments,
      totalCount: adjustments.length,
      netCostImpact: Math.round(
        adjustments.reduce((sum, a) => sum + (a.totalCostImpact || 0), 0) * 100
      ) / 100,
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/inventory-adjustments:', err);
    return NextResponse.json(
      { error: 'فشل في استرجاع سجلات تسوية الجرد', details: err?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/inventory-adjustments
 * RBAC Matrix:
 * - Unauthenticated: 401 Unauthorized
 * - Cashier / Delivery Rider / Supplier: 403 Forbidden
 * - Accountant: 403 Forbidden (Accountant is strictly Read-Only Auditor)
 * - Super Admin / Admin: 201 Created (Atomic Stock Adjustment)
 */
export async function POST(request: Request) {
  try {
    await getDbAsync();
    const auth = verifyAdminRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يتطلب تسجيل الدخول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    if (auth.role === 'delivery_rider') {
      return NextResponse.json(
        { error: 'عزل الأدوار: مندوب التوصيل غير مصرح له بإجراء تسويات جرد (403 Forbidden)' },
        { status: 403 }
      );
    }

    if (auth.role === 'cashier') {
      return NextResponse.json(
        { error: 'عزل الأدوار: كاشير الصالة غير مصرح له بتعديل أرصدة الجرد (403 Forbidden)' },
        { status: 403 }
      );
    }

    if (auth.role === 'accountant') {
      return NextResponse.json(
        {
          error:
            'عزل الأدوار: المحاسب يتمتع بصلاحية تدقيق وقراءة فقط وممنوع من إنشاء تسويات جرد للمخزون (403 Forbidden)',
        },
        { status: 403 }
      );
    }

    if (auth.role === 'supplier') {
      return NextResponse.json(
        { error: 'عزل الأدوار: المورد غير مصرح له بإجراء تسويات جرد المخزون الداخلي (403 Forbidden)' },
        { status: 403 }
      );
    }

    if (auth.role !== 'super_admin' && auth.role !== 'admin') {
      return NextResponse.json(
        { error: 'عزل الأدوار: تسوية الجرد مخصصة لمدير النظام فقط (403 Forbidden)' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
    const newStockKg = Number(body.newStockKg);
    const reason = body.reason as InventoryAdjustmentReason;

    if (!productId) {
      return NextResponse.json(
        { error: 'طلب غير صالح: يجب تحديد الصنف المراد تسوية جرده' },
        { status: 400 }
      );
    }

    if (isNaN(newStockKg) || newStockKg < 0) {
      return NextResponse.json(
        { error: 'طلب غير صالح: يجب أن يكون الرصيد الجديد رقماً موجباً بالكيلوجرام (>= 0)' },
        { status: 400 }
      );
    }

    if (!reason || !REASON_LABELS[reason]) {
      return NextResponse.json(
        {
          error:
            'طلب غير صالح: يجب اختيار سبب مشروع لتسوية الجرد (عجز جرد، هالك تحميص، تالف، ضيافة، أو تصحيح)',
        },
        { status: 400 }
      );
    }

    return await withDbTransaction(async (db) => {
      const product = db.products.find((p) => p.id === productId);
      if (!product) {
        return NextResponse.json(
          { error: 'الصنف المطلوب تسوية جرده غير موجود في قاعدة البيانات (404 Not Found)' },
          { status: 404 }
        );
      }

      const previousStockKg =
        typeof product.stockKg === 'number' ? Math.max(0, product.stockKg) : 0;
      const targetStockKg = Math.round(newStockKg * 1000) / 1000;
      const differenceKg = Math.round((targetStockKg - previousStockKg) * 1000) / 1000;

      const unitCostPerKg =
        typeof product.costPerKg === 'number' && product.costPerKg > 0
          ? product.costPerKg
          : typeof product.pricePerKg === 'number'
            ? Math.round(product.pricePerKg * 0.65)
            : 300;

      const totalCostImpact = Math.round(differenceKg * unitCostPerKg * 100) / 100;

      // Atomic mutation of physical product stock
      product.stockKg = targetStockKg;
      product.inStock = targetStockKg > 0;

      const adjustmentNumber = `ADJ-${Math.floor(1000 + Math.random() * 9000)}`;
      const adjustedBy = auth.displayName || auth.username || 'إدارة المحمصة';

      const newAdjustment: InventoryAdjustment = {
        id: `adj-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        adjustmentNumber,
        productId: product.id,
        productName: product.name,
        previousStockKg,
        newStockKg: targetStockKg,
        differenceKg,
        unitCostPerKg,
        totalCostImpact,
        reason,
        reasonLabel: REASON_LABELS[reason],
        notes: typeof body.notes === 'string' ? body.notes.trim() : undefined,
        adjustedBy,
        adjustedByRole: auth.role || 'super_admin',
        createdAt: new Date().toISOString(),
      };

      if (!Array.isArray(db.inventoryAdjustments)) {
        db.inventoryAdjustments = [];
      }
      db.inventoryAdjustments.unshift(newAdjustment);

      // Instant Telegram Alert (non-blocking)
      sendStoreTelegramAlert(db.settings, 'inventory_adjustment', newAdjustment).catch((e) =>
        console.error('Telegram inventory adjustment alert error:', e)
      );

      return NextResponse.json(
        {
          success: true,
          adjustment: newAdjustment,
          product: {
            id: product.id,
            name: product.name,
            stockKg: product.stockKg,
            inStock: product.inStock,
            costPerKg: product.costPerKg,
          },
          message: `تم تسجيل حركة تسوية الجرد #${adjustmentNumber} لصنف «${product.name}» وتحديث الرصيد الفعلي إلى ${targetStockKg} كجم بنجاح`,
        },
        { status: 201 }
      );
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/inventory-adjustments:', err);
    return NextResponse.json(
      { error: 'فشل في تنفيذ تسوية الجرد', details: err?.message },
      { status: 500 }
    );
  }
}
