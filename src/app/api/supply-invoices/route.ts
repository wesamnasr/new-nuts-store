import { NextResponse } from 'next/server';
import { getDbAsync, withDbTransaction } from '@/lib/db';
import {
  SupplierPaymentRecord,
  SupplyInvoice,
  SupplyInvoiceItem,
  SupplyReturnRecord,
  TreasuryAccountId,
} from '@/types/store';
import { hasRolePermission, verifyAdminRequest } from '@/lib/auth';
import { sendStoreTelegramAlert } from '@/lib/telegram';
import { recordTreasuryTransaction, TREASURY_ACCOUNT_META } from '@/lib/treasury';
import { appendAuditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

function syncInvoicePayableFields(inv: SupplyInvoice): void {
  const total = Math.max(0, Math.round((Number(inv.totalAmount) || 0) * 100) / 100);
  const paid = Math.max(0, Math.round((Number(inv.paidAmount) || 0) * 100) / 100);
  const returned = Math.max(0, Math.round((Number(inv.returnedAmount) || 0) * 100) / 100);
  const netPayable = Math.max(0, Math.round((total - returned) * 100) / 100);
  const remaining = Math.max(0, Math.round((netPayable - paid) * 100) / 100);
  inv.paidAmount = paid;
  inv.returnedAmount = returned;
  inv.remainingAmount = remaining;
  inv.paymentStatus =
    remaining <= 0.01 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
}

/**
 * GET /api/supply-invoices
 * RBAC Matrix:
 * - Unauthenticated: 401 Unauthorized
 * - Cashier / Delivery Rider: 403 Forbidden (unless granted supply_invoices / supply_portal by Admin)
 * - Supplier: 200 OK (Scoped to own supplier account; primary supplier also sees legacy 'supplier_arafat' invoices)
 * - Accountant: 200 OK (Full audit access to all invoices)
 * - Super Admin / Admin: 200 OK (Full access to all invoices)
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
        { error: 'عزل الأدوار: مندوب التوصيل غير مصرح له بالاطلاع على فواتير التوريد (403 Forbidden)' },
        { status: 403 }
      );
    }

    const canViewInvoices =
      auth.role === 'super_admin' ||
      auth.role === 'admin' ||
      hasRolePermission(auth.role, 'supply_invoices', db.settings) ||
      hasRolePermission(auth.role, 'supply_portal', db.settings) ||
      hasRolePermission(auth.role, 'accounting_portal', db.settings);

    if ((auth.role === 'cashier' || !canViewInvoices) && !canViewInvoices) {
      return NextResponse.json(
        { error: 'عزل الأدوار: هذا الدور غير مصرح له بالاطلاع على فواتير التوريد (403 Forbidden)' },
        { status: 403 }
      );
    }

    const invoices: SupplyInvoice[] = Array.isArray(db.supplyInvoices) ? db.supplyInvoices : [];

    // Supplier gets their own invoices (multi-supplier isolation)
    if (auth.role === 'supplier') {
      const primarySupplierUser = (db.settings?.supplierUsername || 'sup')
        .trim()
        .toLowerCase();
      const callerUsername = (auth.username || primarySupplierUser).trim().toLowerCase();
      const isPrimarySupplier =
        callerUsername === primarySupplierUser ||
        callerUsername === 'sup' ||
        callerUsername === 'supplier_arafat';

      const scopedInvoices = invoices.filter((inv) => {
        const invOwner = (inv.supplierId || '').trim().toLowerCase();
        if (invOwner === callerUsername) return true;
        if (
          isPrimarySupplier &&
          (!invOwner ||
            invOwner === primarySupplierUser ||
            invOwner === 'sup' ||
            invOwner === 'supplier_arafat')
        ) {
          return true;
        }
        return false;
      });
      return NextResponse.json({
        success: true,
        invoices: scopedInvoices,
        supplyInvoices: scopedInvoices,
      });
    }

    // Accountant, Admin, or any role granted supply_invoices/accounting_portal get all invoices
    return NextResponse.json({
      success: true,
      invoices,
      supplyInvoices: invoices,
      supplierPayments: db.supplierPayments || [],
    });
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
 * Supports both weight-based (kg) and unit-based (piece/jar/pack) items + optional credit due date.
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
        { error: 'عزل الأدوار: مندوب التوصيل غير مصرح له بإنشاء فواتير توريد (403 Forbidden)' },
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

    return await withDbTransaction(async (db) => {
      const canCreateSupplyInvoice =
        auth.role === 'super_admin' ||
        auth.role === 'admin' ||
        hasRolePermission(auth.role, 'supply_portal', db.settings);

      if (!canCreateSupplyInvoice) {
        if (auth.role === 'accountant') {
          return NextResponse.json(
            {
              error:
                'عزل الأدوار: المحاسب يتمتع بصلاحية تدقيق وقراءة فقط وممنوع من إنشاء فواتير توريد (403 Forbidden)',
            },
            { status: 403 }
          );
        }
        if (auth.role === 'cashier') {
          return NextResponse.json(
            { error: 'عزل الأدوار: الكاشير غير مصرح له بإنشاء فواتير توريد (403 Forbidden)' },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: 'عزل الأدوار: غير مصرح لهذا الدور بإنشاء فواتير توريد (403 Forbidden)' },
          { status: 403 }
        );
      }

      const validatedItems: SupplyInvoiceItem[] = [];

      for (const item of rawItems) {
        const matchedProduct = db.products.find((p) => p.id === item.productId);
        const isUnitMode =
          item.sellingMode === 'unit' || matchedProduct?.sellingMode === 'unit';

        const qty = Number(
          isUnitMode
            ? item.unitsCount ?? item.quantityKg
            : item.quantityKg ?? item.unitsCount
        );
        const cost = Number(
          isUnitMode
            ? item.unitCost ?? item.costPerKg ?? item.costPricePerKg
            : item.costPerKg ?? item.unitCost ?? item.costPricePerKg
        );

        if (!item.productId || isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
          return NextResponse.json(
            {
              error:
                'بيانات الأصناف غير صالحة: يجب تحديد المنتج والكمية وتكلفة الوحدة/الكيلو بشكل صحيح',
            },
            { status: 400 }
          );
        }

        const productName = item.productName || matchedProduct?.name || 'صنف توريد';
        const cleanQty = isUnitMode
          ? Math.round(qty)
          : Math.round(qty * 1000) / 1000;
        const cleanCost = Math.round(cost * 100) / 100;
        const totalCost = Math.round(cleanQty * cleanCost * 100) / 100;

        validatedItems.push({
          productId: item.productId,
          productName,
          sellingMode: isUnitMode ? 'unit' : 'weight',
          unitLabel: isUnitMode
            ? item.unitLabel || matchedProduct?.unitLabel || 'قطعة'
            : 'كجم',
          quantityKg: cleanQty,
          unitsCount: isUnitMode ? cleanQty : undefined,
          costPerKg: cleanCost,
          unitCost: isUnitMode ? cleanCost : undefined,
          totalCost,
        });
      }

      const totalAmount =
        Math.round(
          validatedItems.reduce((sum, item) => sum + item.totalCost, 0) * 100
        ) / 100;

      const invoiceId =
        'sup-inv-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const invoiceNumber =
        body.invoiceNumber && typeof body.invoiceNumber === 'string'
          ? body.invoiceNumber
          : 'SUP-' + Math.floor(1000 + Math.random() * 9000);

      const supplierId =
        body.supplierId ||
        (auth.role === 'supplier' ? auth.username : undefined) ||
        db.settings?.supplierUsername ||
        'sup';
      const supplierName =
        body.supplierName ||
        (auth.role === 'supplier' ? auth.displayName : undefined) ||
        'مورد الفرع المعتمد';

      const newInvoice: SupplyInvoice = {
        id: invoiceId,
        invoiceNumber,
        supplierId,
        supplierName,
        items: validatedItems,
        totalAmount,
        paidAmount: 0,
        returnedAmount: 0,
        remainingAmount: totalAmount,
        paymentStatus: 'unpaid',
        dueDate: typeof body.dueDate === 'string' && body.dueDate ? body.dueDate : undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
        notes: typeof body.notes === 'string' ? body.notes.trim() : undefined,
      };

      // Crucial: Physical inventory and product costs MUST NOT change at this point.
      if (!Array.isArray(db.supplyInvoices)) {
        db.supplyInvoices = [];
      }
      db.supplyInvoices.unshift(newInvoice);

      sendStoreTelegramAlert(db.settings, 'supply_invoice', newInvoice).catch((e) =>
        console.error('Telegram supply notification error:', e)
      );

      return NextResponse.json(
        {
          success: true,
          invoice: newInvoice,
          message: 'تم إنشاء وإرسال فاتورة التوريد بنجاح وهي قيد مراجعة واعتماد الإدارة',
        },
        { status: 201 }
      );
    });
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
 * Supports:
 * 1) Approving / Rejecting supply invoices (with WAC update for both weight & unit products)
 * 2) action === 'record_payment': Partial / Full supplier AP payment deducted from Treasury
 * 3) action === 'create_supply_return': Purchase return deducting stock & supplier payable balance
 */
export async function PATCH(request: Request) {
  try {
    await getDbAsync();
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
    const action = body.action as string | undefined;
    const targetStatus = body.status;

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'طلب غير صالح: يجب تحديد معرف الفاتورة' },
        { status: 400 }
      );
    }

    if (
      !action &&
      targetStatus !== 'approved' &&
      targetStatus !== 'rejected'
    ) {
      return NextResponse.json(
        { error: 'طلب غير صالح: يجب تحديد الحالة (approved أو rejected) أو نوع العملية' },
        { status: 400 }
      );
    }

    return await withDbTransaction(async (db) => {
      if (!Array.isArray(db.supplyInvoices)) {
        db.supplyInvoices = [];
      }
      if (!Array.isArray(db.supplierPayments)) {
        db.supplierPayments = [];
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

      const reviewerLabel = auth.displayName || auth.username || 'super_admin';

      // Action A: Record Supplier Payment (Partial or Full Settlement)
      if (action === 'record_payment') {
        if (invoice.status !== 'approved') {
          return NextResponse.json(
            { error: 'لا يمكن سداد دفعة لفاتورة غير معتمدة بعد' },
            { status: 400 }
          );
        }

        syncInvoicePayableFields(invoice);
        const rawAmount = Math.round((Number(body.amount) || 0) * 100) / 100;
        if (rawAmount <= 0) {
          return NextResponse.json(
            { error: 'قيمة الدفعة يجب أن تكون أكبر من صفر' },
            { status: 400 }
          );
        }
        if ((invoice.remainingAmount || 0) <= 0) {
          return NextResponse.json(
            { error: 'هذه الفاتورة مسددة بالكامل بالفعل' },
            { status: 400 }
          );
        }

        const payAmount = Math.min(invoice.remainingAmount || rawAmount, rawAmount);
        const accountId: TreasuryAccountId = TREASURY_ACCOUNT_META[
          body.accountId as TreasuryAccountId
        ]
          ? (body.accountId as TreasuryAccountId)
          : 'main_safe';

        const methodMap: Record<
          TreasuryAccountId,
          SupplierPaymentRecord['paymentMethod']
        > = {
          main_safe: 'cash',
          instapay_bank: 'instapay',
          vodafone_wallet: 'vodafone_cash',
          card_bank: 'bank_transfer',
        };

        const paymentRec: SupplierPaymentRecord = {
          id: `sup-pay-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          supplierId: invoice.supplierId,
          supplierName: invoice.supplierName,
          amount: payAmount,
          paymentMethod: body.paymentMethod || methodMap[accountId] || 'cash',
          accountId,
          reference: typeof body.reference === 'string' ? body.reference.trim() : undefined,
          notes: typeof body.notes === 'string' ? body.notes.trim() : undefined,
          recordedBy: reviewerLabel,
          createdAt: new Date().toISOString(),
        };

        invoice.paidAmount = Math.round(((invoice.paidAmount || 0) + payAmount) * 100) / 100;
        if (!Array.isArray(invoice.payments)) invoice.payments = [];
        invoice.payments.unshift(paymentRec);
        syncInvoicePayableFields(invoice);
        db.supplierPayments.unshift(paymentRec);

        recordTreasuryTransaction(db, {
          accountId,
          direction: 'out',
          category: 'supplier_payment',
          amount: payAmount,
          referenceId: invoice.invoiceNumber,
          title: `سداد دفعة للمورد "${invoice.supplierName}" عن فاتورة #${invoice.invoiceNumber}`,
          notes: paymentRec.notes,
          recordedBy: reviewerLabel,
        });

        appendAuditLog(db, {
          actorUsername: reviewerLabel,
          actorRole: auth.role || 'super_admin',
          action: 'supply_payment',
          targetType: 'supply_invoice',
          targetId: invoice.invoiceNumber,
          summary: `صرف دفعة للمورد "${invoice.supplierName}" بقيمة ${payAmount} ج.م من "${TREASURY_ACCOUNT_META[accountId].label}" (المتبقي بالفاتورة: ${invoice.remainingAmount} ج.م)`,
        });

        return NextResponse.json({
          success: true,
          invoice,
          payment: paymentRec,
          message: `تم تسجيل دفعة بمبلغ ${payAmount} ج.م للمورد بنجاح`,
        });
      }

      // Action B: Create Purchase Return to Supplier (مرتجع مشتريات للمورد)
      if (action === 'create_supply_return') {
        if (invoice.status !== 'approved') {
          return NextResponse.json(
            { error: 'لا يمكن عمل مرتجع مشتريات إلا لفاتورة توريد معتمدة' },
            { status: 400 }
          );
        }

        const rawReturnItems = Array.isArray(body.items) ? body.items : [];
        if (rawReturnItems.length === 0) {
          return NextResponse.json(
            { error: 'يرجى تحديد صنف واحد على الأقل لإرجاعه للمورد' },
            { status: 400 }
          );
        }

        syncInvoicePayableFields(invoice);
        const returnLines: SupplyReturnRecord['items'] = [];
        let totalReturnAmount = 0;

        for (const reqItem of rawReturnItems) {
          const invItem = invoice.items.find((it) => it.productId === reqItem.productId);
          if (!invItem) continue;
          const returnQty = Number(reqItem.returnQty ?? reqItem.quantity);
          if (isNaN(returnQty) || returnQty <= 0) continue;

          // Check previously returned qty for this product on this invoice
          const existingReturns = invoice.supplyReturns || invoice.returns || [];
          const prevReturnedQty = existingReturns.reduce(
            (sum: number, sr: SupplyReturnRecord) => {
              const m = sr.items.find((x) => x.productId === invItem.productId);
              return sum + (m ? (m.returnQty ?? m.quantity ?? 0) : 0);
            },
            0
          );

          const maxReturnable = Math.max(0, invItem.quantityKg - prevReturnedQty);
          if (returnQty > maxReturnable + 0.001) {
            return NextResponse.json(
              {
                error: `الكمية المرتجعة من "${invItem.productName}" (${returnQty}) تتجاوز الكمية الموردة المتاحة للإرجاع (${maxReturnable})`,
              },
              { status: 400 }
            );
          }

          const product = db.products.find((p) => p.id === invItem.productId);
          const currentStock = typeof product?.stockKg === 'number' ? product.stockKg : 0;
          if (product && currentStock < returnQty) {
            return NextResponse.json(
              {
                error: `رصيد المخزن الحالي من "${invItem.productName}" (${currentStock}) لا يكفي لإخراج مرتجع المورد (${returnQty})`,
              },
              { status: 400 }
            );
          }

          if (product) {
            product.stockKg = Math.max(
              0,
              Math.round((currentStock - returnQty) * 1000) / 1000
            );
            product.inStock = product.stockKg > 0;
          }

          const unitCost = invItem.unitCost ?? invItem.costPerKg;
          const lineTotalCost = Math.round(returnQty * unitCost * 100) / 100;
          totalReturnAmount = Math.round((totalReturnAmount + lineTotalCost) * 100) / 100;

          returnLines.push({
            productId: invItem.productId,
            productName: invItem.productName,
            sellingMode: invItem.sellingMode || (product?.sellingMode === 'unit' ? 'unit' : 'weight'),
            unitLabel: invItem.unitLabel,
            quantity: returnQty,
            returnQty,
            unitCost,
            totalCost: lineTotalCost,
          });
        }

        if (returnLines.length === 0 || totalReturnAmount <= 0) {
          return NextResponse.json(
            { error: 'يرجى تحديد كميات مرتجعة صالحة أكبر من صفر' },
            { status: 400 }
          );
        }

        const returnRec: SupplyReturnRecord = {
          id: `sup-ret-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          returnNumber: `SRET-${1001 + ((invoice.supplyReturns || invoice.returns)?.length || 0)}`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          supplierId: invoice.supplierId,
          supplierName: invoice.supplierName,
          items: returnLines,
          totalReturnAmount,
          reason: typeof body.reason === 'string' ? body.reason.trim() : undefined,
          recordedBy: reviewerLabel,
          createdAt: new Date().toISOString(),
        };

        if (!Array.isArray(invoice.supplyReturns)) invoice.supplyReturns = [];
        invoice.supplyReturns.unshift(returnRec);
        invoice.returns = invoice.supplyReturns;
        if (!Array.isArray(db.supplyReturns)) db.supplyReturns = [];
        db.supplyReturns.unshift(returnRec);

        invoice.returnedAmount =
          Math.round(((invoice.returnedAmount || 0) + totalReturnAmount) * 100) / 100;

        // If invoice was already overpaid after return, optionally record cash refund from supplier to main_safe
        const netAfterReturn = Math.max(0, invoice.totalAmount - invoice.returnedAmount);
        if ((invoice.paidAmount || 0) > netAfterReturn) {
          const cashRefundFromSupplier =
            Math.round(((invoice.paidAmount || 0) - netAfterReturn) * 100) / 100;
          invoice.paidAmount = netAfterReturn;
          recordTreasuryTransaction(db, {
            accountId: 'main_safe',
            direction: 'in',
            category: 'supplier_payment',
            amount: cashRefundFromSupplier,
            referenceId: returnRec.returnNumber,
            title: `استرداد نقدي من المورد "${invoice.supplierName}" مقابل مرتجع مشتريات #${returnRec.returnNumber}`,
            recordedBy: reviewerLabel,
          });
        }

        syncInvoicePayableFields(invoice);

        appendAuditLog(db, {
          actorUsername: reviewerLabel,
          actorRole: auth.role || 'super_admin',
          action: 'supply_return',
          targetType: 'supply_invoice',
          targetId: invoice.invoiceNumber,
          summary: `مرتجع مشتريات للمورد "${invoice.supplierName}" بقيمة ${totalReturnAmount} ج.م على فاتورة #${invoice.invoiceNumber} وخصم الكميات من المخزون`,
        });

        return NextResponse.json({
          success: true,
          invoice,
          supplyReturn: returnRec,
          message: `تم تسجيل مرتجع المورد بقيمة ${totalReturnAmount} ج.م وخصمه من المخزون وكشف حساب المورد`,
        });
      }

      // Action C: Standard Approve / Reject Flow
      if (invoice.status === 'approved' && targetStatus === 'approved') {
        return NextResponse.json(
          { error: 'الفاتورة معتمدة بالفعل وتمت إضافة كمياتها للمخزون مسبقاً' },
          { status: 400 }
        );
      }

      if (targetStatus === 'approved') {
        // Atomic stock increment and Weighted Average Cost (WAC) update
        for (const item of invoice.items) {
          const product = db.products.find((p) => p.id === item.productId);
          if (product) {
            const isUnitProd = product.sellingMode === 'unit' || item.sellingMode === 'unit';
            const currentStock =
              typeof product.stockKg === 'number' ? Math.max(0, product.stockKg) : 0;
            const currentCost = isUnitProd
              ? typeof product.unitCost === 'number' && product.unitCost > 0
                ? product.unitCost
                : typeof product.costPerKg === 'number' && product.costPerKg > 0
                  ? product.costPerKg
                  : typeof product.unitPrice === 'number'
                    ? Math.round(product.unitPrice * 0.65)
                    : 50
              : typeof product.costPerKg === 'number' && product.costPerKg > 0
                ? product.costPerKg
                : typeof product.pricePerKg === 'number'
                  ? Math.round(product.pricePerKg * 0.65)
                  : 300;
            const incomingQty = Math.max(
              0,
              Number(isUnitProd ? item.unitsCount ?? item.quantityUnits ?? item.quantityKg : item.quantityKg) || 0
            );
            const incomingCost = Math.max(
              0,
              Number(isUnitProd ? item.unitCost ?? item.costPerKg : item.costPerKg) || 0
            );

            product.stockKg = Math.max(
              0,
              isUnitProd
                ? Math.round(currentStock + incomingQty)
                : Math.round((currentStock + incomingQty) * 1000) / 1000
            );
            if (product.stockKg > 0) {
              product.inStock = true;
            }

            // Weighted Average Cost (WAC): ((currentStock * currentCost) + (incomingQty * incomingCost)) / (currentStock + incomingQty)
            if (incomingCost > 0) {
              if (currentStock > 0) {
                const totalValuation = (currentStock * currentCost) + (incomingQty * incomingCost);
                const totalStock = currentStock + incomingQty;
                product.costPerKg = totalStock > 0 ? Math.round((totalValuation / totalStock) * 100) / 100 : incomingCost;
              } else {
                product.costPerKg = Math.round(incomingCost * 100) / 100;
              }
              if (isUnitProd) {
                product.unitCost = product.costPerKg;
              }
            }
          }
        }

        invoice.status = 'approved';
        invoice.reviewedAt = new Date().toISOString();
        invoice.reviewedBy = reviewerLabel;
        if (typeof body.adminNotes === 'string') {
          invoice.adminNotes = body.adminNotes.trim();
        }
        syncInvoicePayableFields(invoice);

        // Optional immediate partial/full payment on approval
        const upfrontPaid = Math.max(0, Math.round((Number(body.paidAmount) || 0) * 100) / 100);
        if (upfrontPaid > 0) {
          const actualUpfront = Math.min(invoice.totalAmount, upfrontPaid);
          const accountId: TreasuryAccountId = TREASURY_ACCOUNT_META[
            body.accountId as TreasuryAccountId
          ]
            ? (body.accountId as TreasuryAccountId)
            : 'main_safe';
          const paymentRec: SupplierPaymentRecord = {
            id: `sup-pay-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            supplierId: invoice.supplierId,
            supplierName: invoice.supplierName,
            amount: actualUpfront,
            paymentMethod: accountId === 'main_safe' ? 'cash' : 'bank_transfer',
            accountId,
            notes: 'دفعة سداد فورية عند اعتماد التوريد',
            recordedBy: reviewerLabel,
            createdAt: new Date().toISOString(),
          };
          invoice.paidAmount = actualUpfront;
          invoice.payments = [paymentRec, ...(invoice.payments || [])];
          syncInvoicePayableFields(invoice);
          db.supplierPayments.unshift(paymentRec);
          recordTreasuryTransaction(db, {
            accountId,
            direction: 'out',
            category: 'supplier_payment',
            amount: actualUpfront,
            referenceId: invoice.invoiceNumber,
            title: `سداد دفعة عند اعتماد فاتورة توريد #${invoice.invoiceNumber} (${invoice.supplierName})`,
            recordedBy: reviewerLabel,
          });
        }

        appendAuditLog(db, {
          actorUsername: reviewerLabel,
          actorRole: auth.role || 'super_admin',
          action: 'supply_invoice_approve',
          targetType: 'supply_invoice',
          targetId: invoice.invoiceNumber,
          summary: `اعتماد فاتورة التوريد #${invoice.invoiceNumber} للمورد "${invoice.supplierName}" بقيمة ${invoice.totalAmount} ج.م وتحديث تكلفة WAC والمخزون`,
        });

        sendStoreTelegramAlert(db.settings, 'supply_invoice', invoice).catch((e) =>
          console.error('Telegram supply approval error:', e)
        );

        return NextResponse.json({
          success: true,
          invoice,
          message: 'تم اعتماد فاتورة التوريد وتحديث المخزون وتكلفة الأصناف بنجاح',
        });
      }

      if (targetStatus === 'rejected') {
        invoice.status = 'rejected';
        invoice.reviewedAt = new Date().toISOString();
        invoice.reviewedBy = reviewerLabel;
        if (typeof body.adminNotes === 'string') {
          invoice.adminNotes = body.adminNotes.trim();
        }

        appendAuditLog(db, {
          actorUsername: reviewerLabel,
          actorRole: auth.role || 'super_admin',
          action: 'supply_invoice_reject',
          targetType: 'supply_invoice',
          targetId: invoice.invoiceNumber,
          summary: `رفض فاتورة التوريد #${invoice.invoiceNumber} للمورد "${invoice.supplierName}"`,
        });

        return NextResponse.json({
          success: true,
          invoice,
          message: 'تم رفض فاتورة التوريد دون تعديل المخزون',
        });
      }

      return NextResponse.json({ error: 'حالة غير مدعومة' }, { status: 400 });
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/supply-invoices:', err);
    return NextResponse.json(
      { error: 'فشل في تحديث حالة فاتورة التوريد', details: err?.message },
      { status: 500 }
    );
  }
}
