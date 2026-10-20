import { NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync } from '@/lib/db';
import { SupplyInvoice, SupplyInvoiceItem } from '@/types/store';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/supply-invoices
 * RBAC Matrix:
 * - Unauthenticated: 401 Unauthorized
 * - Cashier: 403 Forbidden
 * - Supplier: 200 OK (Scoped to own invoices)
 * - Accountant: 200 OK (Full audit access to all invoices)
 * - Super Admin / Admin: 200 OK (Full access to all invoices)
 */
export async function GET(request: Request) {
  try {
    const auth = verifyAdminRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يتطلب تسجيل الدخول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    if (auth.role === 'cashier') {
      return NextResponse.json(
        { error: 'عزل الأدوار: الكاشير غير مصرح له بالاطلاع على فواتير التوريد (403 Forbidden)' },
        { status: 403 }
      );
    }

    const db = await getDbAsync();
    const invoices: SupplyInvoice[] = Array.isArray(db.supplyInvoices) ? db.supplyInvoices : [];

    // Supplier gets their own invoices
    if (auth.role === 'supplier') {
      const supplierId = db.settings?.supplierUsername || 'supplier_arafat';
      const scopedInvoices = invoices.filter(
        (inv) =>
          inv.supplierId === supplierId ||
          inv.supplierId === 'supplier_arafat' ||
          !inv.supplierId
      );
      return NextResponse.json({ success: true, invoices: scopedInvoices, supplyInvoices: scopedInvoices });
    }

    // Accountant and Admin get all invoices
    if (auth.role === 'accountant' || auth.role === 'super_admin' || auth.role === 'admin') {
      return NextResponse.json({ success: true, invoices, supplyInvoices: invoices });
    }

    return NextResponse.json(
      { error: 'عزل الأدوار: غير مصرح لهذا الدور بالوصول (403 Forbidden)' },
      { status: 403 }
    );
  } catch (err: any) {
    console.error('Error in GET /api/supply-invoices:', err);
    return NextResponse.json(
      { error: 'فشل في استرجاع فواتير التوريد', details: err?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/supply-invoices
 * RBAC Matrix:
 * - Unauthenticated: 401 Unauthorized
 * - Cashier: 403 Forbidden
 * - Accountant: 403 Forbidden (Read-only auditor)
 * - Supplier & Super Admin: 201 Created (status: 'pending', stock unchanged)
 */
export async function POST(request: Request) {
  try {
    const auth = verifyAdminRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يتطلب تسجيل الدخول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    if (auth.role === 'cashier') {
      return NextResponse.json(
        { error: 'عزل الأدوار: الكاشير غير مصرح له بإنشاء فواتير توريد (403 Forbidden)' },
        { status: 403 }
      );
    }

    if (auth.role === 'accountant') {
      return NextResponse.json(
        {
          error:
            'عزل الأدوار: المحاسب يتمتع بصلاحية تدقيق وقراءة فقط وممنوع من إنشاء فواتير توريد (403 Forbidden)',
        },
        { status: 403 }
      );
    }

    if (auth.role !== 'supplier' && auth.role !== 'super_admin' && auth.role !== 'admin') {
      return NextResponse.json(
        { error: 'عزل الأدوار: غير مصرح لهذا الدور بإنشاء فواتير توريد (403 Forbidden)' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (rawItems.length === 0) {
      return NextResponse.json(
        { error: 'يجب أن تحتوي فاتورة التوريد على صنف واحد على الأقل' },
        { status: 400 }
      );
    }

    const db = await getDbAsync();
    const validatedItems: SupplyInvoiceItem[] = [];

    for (const item of rawItems) {
      const qty = Number(item.quantityKg);
      const cost = Number(item.costPerKg);

      if (!item.productId || isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
        return NextResponse.json(
          { error: 'بيانات الأصناف غير صالحة: يجب تحديد المنتج والكمية وتكلفة الكيلو بشكل صحيح' },
          { status: 400 }
        );
      }

      const matchedProduct = db.products.find((p) => p.id === item.productId);
      const productName = item.productName || matchedProduct?.name || 'صنف توريد';
      const totalCost = Math.round(qty * cost * 100) / 100;

      validatedItems.push({
        productId: item.productId,
        productName,
        quantityKg: Math.round(qty * 1000) / 1000,
        costPerKg: Math.round(cost * 100) / 100,
        totalCost,
      });
    }

    const totalAmount = Math.round(
      validatedItems.reduce((sum, item) => sum + item.totalCost, 0) * 100
    ) / 100;

    const invoiceId = 'sup-inv-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const invoiceNumber =
      body.invoiceNumber && typeof body.invoiceNumber === 'string'
        ? body.invoiceNumber
        : 'SUP-' + Math.floor(1000 + Math.random() * 9000);

    const supplierId =
      body.supplierId || db.settings?.supplierUsername || 'supplier_arafat';
    const supplierName =
      body.supplierName || 'شركة أرافت للاستيراد والتوريد الزراعي';

    const newInvoice: SupplyInvoice = {
      id: invoiceId,
      invoiceNumber,
      supplierId,
      supplierName,
      items: validatedItems,
      totalAmount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      notes: typeof body.notes === 'string' ? body.notes.trim() : undefined,
    };

    // Crucial: Physical inventory and product costs MUST NOT change at this point.
    if (!Array.isArray(db.supplyInvoices)) {
      db.supplyInvoices = [];
    }
    db.supplyInvoices.unshift(newInvoice);

    await saveDbAsync(db);

    return NextResponse.json(
      {
        success: true,
        invoice: newInvoice,
        message: 'تم إنشاء وإرسال فاتورة التوريد بنجاح وهي قيد مراجعة واعتماد الإدارة',
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error in POST /api/supply-invoices:', err);
    return NextResponse.json(
      { error: 'فشل في إنشاء فاتورة التوريد', details: err?.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/supply-invoices
 * RBAC Matrix:
 * - Unauthenticated: 401 Unauthorized
 * - Cashier: 403 Forbidden
 * - Supplier: 403 Forbidden
 * - Accountant: 403 Forbidden
 * - Super Admin / Admin: 200 OK (Approve or Reject)
 *
 * Atomic stock increment on approval:
 * - For each item in invoice.items:
 *     product.stockKg += item.quantityKg
 *     product.inStock = true
 *     product.costPerKg = item.costPerKg
 */
export async function PATCH(request: Request) {
  try {
    const auth = verifyAdminRequest(request);

    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يتطلب تسجيل الدخول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    if (auth.role === 'cashier') {
      return NextResponse.json(
        { error: 'عزل الأدوار: الكاشير غير مصرح له بمراجعة أو اعتماد فواتير التوريد (403 Forbidden)' },
        { status: 403 }
      );
    }

    if (auth.role === 'supplier') {
      return NextResponse.json(
        { error: 'عزل الأدوار: المورد غير مصرح له باعتماد أو رفض فواتير التوريد (403 Forbidden)' },
        { status: 403 }
      );
    }

    if (auth.role === 'accountant') {
      return NextResponse.json(
        {
          error:
            'عزل الأدوار: المحاسب يتمتع بصلاحية تدقيق وقراءة فقط وممنوع من تعديل حالات فواتير التوريد (403 Forbidden)',
        },
        { status: 403 }
      );
    }

    if (auth.role !== 'super_admin' && auth.role !== 'admin') {
      return NextResponse.json(
        { error: 'عزل الأدوار: هذا الإجراء مخصص لمدير النظام فقط (403 Forbidden)' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const invoiceId = body.invoiceId || body.id;
    const targetStatus = body.status;

    if (!invoiceId || (targetStatus !== 'approved' && targetStatus !== 'rejected')) {
      return NextResponse.json(
        { error: 'طلب غير صالح: يجب تحديد معرف الفاتورة والحالة (approved أو rejected)' },
        { status: 400 }
      );
    }

    const db = await getDbAsync();

    if (!Array.isArray(db.supplyInvoices)) {
      db.supplyInvoices = [];
    }

    const invoice = db.supplyInvoices.find(
      (inv) => inv.id === invoiceId || inv.invoiceNumber === invoiceId
    );

    if (!invoice) {
      return NextResponse.json(
        { error: 'فاتورة التوريد المطلوبة غير موجودة (404 Not Found)' },
        { status: 404 }
      );
    }

    if (invoice.status === 'approved' && targetStatus === 'approved') {
      return NextResponse.json(
        { error: 'الفاتورة معتمدة بالفعل وتمت إضافة كمياتها للمخزون مسبقاً' },
        { status: 400 }
      );
    }

    if (targetStatus === 'approved') {
      // Atomic stock increment and wholesale cost update
      for (const item of invoice.items) {
        const product = db.products.find((p) => p.id === item.productId);
        if (product) {
          const currentStock = typeof product.stockKg === 'number' ? product.stockKg : 0;
          product.stockKg = Math.max(0, Math.round((currentStock + item.quantityKg) * 1000) / 1000);
          if (product.stockKg > 0) {
            product.inStock = true;
          }
          if (typeof item.costPerKg === 'number' && item.costPerKg > 0) {
            product.costPerKg = Math.round(item.costPerKg * 100) / 100;
          }
        }
      }

      invoice.status = 'approved';
      invoice.reviewedAt = new Date().toISOString();
      invoice.reviewedBy = 'super_admin';
      if (typeof body.adminNotes === 'string') {
        invoice.adminNotes = body.adminNotes.trim();
      }

      await saveDbAsync(db);

      return NextResponse.json({
        success: true,
        invoice,
        message: 'تم اعتماد فاتورة التوريد وتحديث المخزون وتكلفة الأصناف بنجاح',
      });
    }

    if (targetStatus === 'rejected') {
      // Status rejection: Do NOT touch product stock or wholesale costs
      invoice.status = 'rejected';
      invoice.reviewedAt = new Date().toISOString();
      invoice.reviewedBy = 'super_admin';
      if (typeof body.adminNotes === 'string') {
        invoice.adminNotes = body.adminNotes.trim();
      }

      await saveDbAsync(db);

      return NextResponse.json({
        success: true,
        invoice,
        message: 'تم رفض فاتورة التوريد دون تعديل المخزون',
      });
    }

    return NextResponse.json({ error: 'حالة غير مدعومة' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in PATCH /api/supply-invoices:', err);
    return NextResponse.json(
      { error: 'فشل في تحديث حالة فاتورة التوريد', details: err?.message },
      { status: 500 }
    );
  }
}
