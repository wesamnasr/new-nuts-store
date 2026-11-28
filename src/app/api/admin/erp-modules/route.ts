import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, withDbTransaction } from '@/lib/db';
import { verifyAdminRequest, hasRolePermission } from '@/lib/auth';
import { appendAuditLog } from '@/lib/audit-log';
import { generateWeightsFromKiloPrice, isUnitProduct } from '@/lib/pricing';
import { WarehouseTransfer } from '@/types/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = await getDbAsync();
    const auth = verifyAdminRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 401 });
    }

    return NextResponse.json({
      warehouses: db.warehouses || [],
      warehouseTransfers: db.warehouseTransfers || [],
      bomRecipes: db.bomRecipes || [],
      prepMethods: db.prepMethods || [],
      productAddons: db.productAddons || [],
      deliveryCompanies: db.deliveryCompanies || [],
      employees: db.employees || [],
      diningHalls: db.diningHalls || [],
      expenseCategories: db.expenseCategories || [],
    });
  } catch (err) {
    console.error('GET /api/admin/erp-modules error:', err);
    return NextResponse.json({ error: 'تعذر تحميل وحدات الـ ERP' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await getDbAsync();
    const auth = verifyAdminRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 401 });
    }

    const role = auth.role || 'cashier';
    const body = await request.json();
    const action = String(body.action || '');

    return await withDbTransaction(async (db) => {
      const canEditOps =
        role === 'super_admin' ||
        role === 'admin' ||
        hasRolePermission(role, 'operations', db.settings) ||
        hasRolePermission(role, 'products', db.settings);

      if (!canEditOps) {
        return NextResponse.json(
          { error: 'عزل الأدوار: هذا الدور غير مصرح له بتعديل البيانات التشغيلية (403)' },
          { status: 403 }
        );
      }

      // 1. Atomic Multi-Warehouse Stock Transfer ("تحويل مخزني")
      if (action === 'transfer_stock') {
        const fromWarehouseId = String(body.fromWarehouseId || '');
        const toWarehouseId = String(body.toWarehouseId || '');
        const productId = String(body.productId || '');
        const qty = Number(body.quantityKg || 0);
        const notes = String(body.notes || '').trim();

        if (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId || !productId || qty <= 0) {
          return NextResponse.json(
            { error: 'يرجى تحديد مخزنين مختلفين وصنف وكمية صحيحة أكبر من صفر' },
            { status: 400 }
          );
        }

        const warehouses = db.warehouses || [];
        const fromWh = warehouses.find((w) => w.id === fromWarehouseId);
        const toWh = warehouses.find((w) => w.id === toWarehouseId);
        const prod = db.products.find((p) => p.id === productId);
        if (!fromWh || !toWh || !prod) {
          return NextResponse.json({ error: 'المخزن أو الصنف غير موجود' }, { status: 404 });
        }

        const totalStock = typeof prod.stockKg === 'number' ? prod.stockKg : 0;
        const stocks: Record<string, number> = { ...(prod.warehouseStocks || {}) };
        if (Object.keys(stocks).length === 0) {
          // Seed initial split if product hasn't been split across warehouses yet
          const posWh = warehouses.find((w) => w.isPosBranch) || warehouses[0];
          if (posWh) stocks[posWh.id] = totalStock;
        }

        const fromBefore = Number(stocks[fromWarehouseId] || 0);
        const toBefore = Number(stocks[toWarehouseId] || 0);
        stocks[fromWarehouseId] = Math.max(0, Math.round((fromBefore - qty) * 1000) / 1000);
        stocks[toWarehouseId] = Math.round((toBefore + qty) * 1000) / 1000;
        prod.warehouseStocks = stocks;

        const transfer: WarehouseTransfer = {
          id: `trf-${Date.now()}`,
          transferNumber: `TRF-${String((db.warehouseTransfers?.length || 0) + 1001)}`,
          fromWarehouseId: fromWh.id,
          fromWarehouseName: fromWh.name,
          toWarehouseId: toWh.id,
          toWarehouseName: toWh.name,
          productId: prod.id,
          productName: prod.name,
          quantityKg: qty,
          unitLabel: isUnitProduct(prod) ? prod.unitLabel || 'قطعة' : 'كجم',
          notes,
          transferredBy: auth.displayName || auth.username || 'الإدارة',
          createdAt: new Date().toISOString(),
        };

        db.warehouseTransfers = [transfer, ...(db.warehouseTransfers || [])];
        appendAuditLog(db, {
          action: 'warehouse_transfer',
          actorUsername: auth.username || 'admin',
          actorDisplayName: auth.displayName || auth.username || 'الإدارة',
          actorRole: role,
          targetType: 'product',
          targetId: prod.id,
          summary: `تحويل مخزني #${transfer.transferNumber}: نقل ${qty} ${transfer.unitLabel} من «${prod.name}» من (${fromWh.name}) إلى (${toWh.name})`,
        });

        return NextResponse.json({
          success: true,
          transfer,
          warehouseTransfers: db.warehouseTransfers,
          product: prod,
        });
      }

      // 2. Bulk Percentage / Fixed Price Update ("تعديل الأسعار الجماعي")
      if (action === 'bulk_price_update') {
        const mode = body.mode === 'fixed' ? 'fixed' : 'percent';
        const value = Number(body.value || 0);
        const categoryId = String(body.categoryId || 'all');
        const targetField = body.targetField === 'cost' ? 'cost' : 'price';

        if (!Number.isFinite(value) || value === 0) {
          return NextResponse.json({ error: 'يرجى إدخال قيمة تعديل غير صفرية' }, { status: 400 });
        }

        let updatedCount = 0;
        for (const prod of db.products) {
          if (categoryId !== 'all' && prod.categoryId !== categoryId) continue;

          if (isUnitProduct(prod)) {
            if (targetField === 'cost') {
              const curr = Number(prod.unitCost ?? prod.costPerKg ?? 0);
              const next = Math.max(0, Math.round(mode === 'percent' ? curr * (1 + value / 100) : curr + value));
              prod.unitCost = next;
              prod.costPerKg = next;
            } else {
              const curr = Number(prod.unitPrice ?? prod.pricePerKg ?? prod.weights?.[0]?.price ?? 0);
              const next = Math.max(1, Math.round(mode === 'percent' ? curr * (1 + value / 100) : curr + value));
              prod.unitPrice = next;
              prod.pricePerKg = next;
              if (Array.isArray(prod.weights) && prod.weights.length > 0) {
                prod.weights = prod.weights.map((w) => ({
                  ...w,
                  price: Math.max(1, Math.round((w.unitsCount || 1) * next)),
                }));
              }
            }
          } else {
            if (targetField === 'cost') {
              const curr = Number(prod.costPerKg ?? 0);
              prod.costPerKg = Math.max(0, Math.round(mode === 'percent' ? curr * (1 + value / 100) : curr + value));
            } else {
              const curr = Number(prod.pricePerKg ?? prod.weights?.find((w) => (w.weightGrams || w.grams) === 1000)?.price ?? 0);
              const next = Math.max(1, Math.round(mode === 'percent' ? curr * (1 + value / 100) : curr + value));
              prod.pricePerKg = next;
              prod.weights = generateWeightsFromKiloPrice(next, Math.round(next * 1.12));
            }
          }
          updatedCount++;
        }

        appendAuditLog(db, {
          action: 'price_change',
          actorUsername: auth.username || 'admin',
          actorDisplayName: auth.displayName || auth.username || 'الإدارة',
          actorRole: role,
          targetType: 'products',
          summary: `تعديل أسعار جماعي (${targetField === 'cost' ? 'التكلفة' : 'البيع'}) بقيمة ${value > 0 ? '+' : ''}${value}${mode === 'percent' ? '%' : ' ج.م'} على عدد (${updatedCount}) صنف`,
        });

        return NextResponse.json({ success: true, updatedCount });
      }

      // 3. Generic Save for any of the 8 ERP Master Collections
      if (action === 'save_collection') {
        const collection = String(body.collection || '');
        const items = body.items;
        if (!Array.isArray(items)) {
          return NextResponse.json({ error: 'قائمة العناصر غير صالحة' }, { status: 400 });
        }

        const allowed = new Set([
          'warehouses',
          'bomRecipes',
          'prepMethods',
          'productAddons',
          'deliveryCompanies',
          'employees',
          'diningHalls',
          'expenseCategories',
        ]);
        if (!allowed.has(collection)) {
          return NextResponse.json({ error: 'مجموعة بيانات غير معروفة' }, { status: 400 });
        }

        (db as unknown as Record<string, unknown>)[collection] = items;

        appendAuditLog(db, {
          action: collection === 'bomRecipes' ? 'bom_update' : 'erp_master_update',
          actorUsername: auth.username || 'admin',
          actorDisplayName: auth.displayName || auth.username || 'الإدارة',
          actorRole: role,
          targetType: collection,
          summary: `تحديث بيانات وحدة (${collection}) — عدد السجلات: ${items.length}`,
        });

        return NextResponse.json({ success: true, collection, items });
      }

      // 4. Toggle feature flags (e.g. enableHallsAndTables, enableBlindShiftClose) directly
      if (action === 'toggle_feature_flags') {
        db.settings = {
          ...db.settings,
          featureFlags: {
            ...(db.settings.featureFlags || {}),
            ...(typeof body.enableHallsAndTables === 'boolean'
              ? { enableHallsAndTables: body.enableHallsAndTables }
              : {}),
            ...(typeof body.enableBlindShiftClose === 'boolean'
              ? { enableBlindShiftClose: body.enableBlindShiftClose }
              : {}),
          },
        };
        return NextResponse.json({ success: true, featureFlags: db.settings.featureFlags });
      }

      return NextResponse.json({ error: 'عملية غير مدعومة' }, { status: 400 });
    });
  } catch (err) {
    console.error('POST /api/admin/erp-modules error:', err);
    return NextResponse.json({ error: 'تعذر حفظ البيانات' }, { status: 500 });
  }
}
