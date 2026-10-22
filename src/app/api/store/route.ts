import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync } from '@/lib/db';
import {
  verifyAdminRequest,
  sanitizePublicStoreData,
  sanitizeStoreDataForRole,
  generateAdminToken,
  getResolvedRolePermissions,
  hasRolePermission,
} from '@/lib/auth';
import { getResolvedPageContent, getResolvedThemeConfig } from '@/lib/defaults';
import { Product } from '@/types/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const db = await getDbAsync();
  if (request) {
    const auth = verifyAdminRequest(request);
    if (auth.isAuthenticated && auth.role) {
      return NextResponse.json(sanitizeStoreDataForRole(db, auth.role));
    }
  }

  // Public visitors (Role 5: Customer) get sanitized data without passwords, wholesale costs, or orders
  return NextResponse.json(sanitizePublicStoreData(db));
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDbAsync();
    const auth = verifyAdminRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول (401 Unauthorized)' },
        { status: 401 }
      );
    }

    const role = auth.role || 'super_admin';
    const body = await request.json();

    // Non-admin role permission checks for PUT /api/store
    if (role !== 'super_admin') {
      // Check if any requested mutation key is unauthorized for this role
      if (
        (role === 'accountant' || role === 'cashier' || role === 'supplier' || role === 'admin') &&
        body.settings &&
        !hasRolePermission(role, 'settings', db.settings)
      ) {
        return NextResponse.json(
          {
            error:
              'عزل الأدوار: هذا الدور غير مصرح له بتعديل إعدادات المتجر (403 Forbidden)',
          },
          { status: 403 }
        );
      }

      if (body.rolePermissions) {
        return NextResponse.json(
          {
            error:
              'عزل الأدوار: تعديل صلاحيات المستخدمين متاح للأدمن فقط (403 Forbidden)',
          },
          { status: 403 }
        );
      }

      if (body.categories && !hasRolePermission(role, 'categories', db.settings)) {
        return NextResponse.json(
          {
            error:
              'عزل الأدوار: هذا الدور غير مصرح له بتعديل الأقسام (403 Forbidden)',
          },
          { status: 403 }
        );
      }

      if (body.shippingRates && !hasRolePermission(role, 'shipping', db.settings)) {
        return NextResponse.json(
          {
            error:
              'عزل الأدوار: هذا الدور غير مصرح له بتعديل أسعار الشحن (403 Forbidden)',
          },
          { status: 403 }
        );
      }

      if (body.coupons && !hasRolePermission(role, 'coupons', db.settings)) {
        return NextResponse.json(
          {
            error:
              'عزل الأدوار: هذا الدور غير مصرح له بتعديل الكوبونات (403 Forbidden)',
          },
          { status: 403 }
        );
      }

      if (
        (body.vipMembers || body.promotions) &&
        !hasRolePermission(role, 'operations', db.settings)
      ) {
        return NextResponse.json(
          {
            error:
              'عزل الأدوار: هذا الدور غير مصرح له بتعديل العمليات أو العروض (403 Forbidden)',
          },
          { status: 403 }
        );
      }

      if (body.orders && !hasRolePermission(role, 'orders', db.settings)) {
        return NextResponse.json(
          {
            error:
              'عزل الأدوار: هذا الدور غير مصرح له بتعديل الطلبات (403 Forbidden)',
          },
          { status: 403 }
        );
      }

      if (body.products) {
        const hasFullProductsPerm = hasRolePermission(role, 'products', db.settings);
        const hasSupplyPerm = hasRolePermission(role, 'supply_portal', db.settings);

        if (!hasFullProductsPerm && !hasSupplyPerm) {
          return NextResponse.json(
            {
              error:
                'عزل الأدوار: هذا الدور غير مصرح له بتعديل بيانات المتجر أو الكتالوج (403 Forbidden)',
            },
            { status: 403 }
          );
        }

        // If user only has supply_portal permission (not full products catalog permission),
        // verify they are not altering retail pricePerKg or injecting new products
        if (!hasFullProductsPerm && hasSupplyPerm) {
          const incomingProducts: Product[] = Array.isArray(body.products) ? body.products : [];
          const existingMap = new Map(db.products.map((p) => [p.id, p]));
          for (const inc of incomingProducts) {
            const existing = existingMap.get(inc.id);
            if (!existing || Number(inc.pricePerKg) !== Number(existing.pricePerKg)) {
              return NextResponse.json(
                {
                  error:
                    'عزل الأدوار: المورد مصرح له بتحديث تكلفة الجملة والمخزون فقط وليس سعر البيع للجمهور (403 Forbidden)',
                },
                { status: 403 }
              );
            }
          }

          // Merge only supply-related fields
          db.products = db.products.map((existing) => {
            const updated = incomingProducts.find((p) => p.id === existing.id);
            if (!updated) return existing;
            return {
              ...existing,
              costPerKg:
                typeof updated.costPerKg === 'number' ? updated.costPerKg : existing.costPerKg,
              packagingCost:
                typeof updated.packagingCost === 'number'
                  ? updated.packagingCost
                  : existing.packagingCost,
              origin: typeof updated.origin === 'string' ? updated.origin : existing.origin,
              inStock: typeof updated.inStock === 'boolean' ? updated.inStock : existing.inStock,
            };
          });
          delete body.products;
        }
      }
    }

    let rotatedToken: string | null = null;

    if (body.rolePermissions && role === 'super_admin') {
      db.settings = {
        ...db.settings,
        rolePermissions: getResolvedRolePermissions({
          ...db.settings,
          rolePermissions: body.rolePermissions,
        }),
      };
    }

    if (body.settings && (role === 'super_admin' || hasRolePermission(role, 'settings', db.settings))) {
      const incomingPageContent = body.settings.pageContent
        ? {
            ...getResolvedPageContent(db.settings),
            ...body.settings.pageContent,
          }
        : getResolvedPageContent(db.settings);

      const incomingThemeConfig = body.settings.themeConfig
        ? {
            ...getResolvedThemeConfig(db.settings),
            ...body.settings.themeConfig,
          }
        : getResolvedThemeConfig(db.settings);

      const incomingRolePermissions =
        role === 'super_admin' && body.settings.rolePermissions
          ? getResolvedRolePermissions({
              ...db.settings,
              rolePermissions: body.settings.rolePermissions,
            })
          : getResolvedRolePermissions(db.settings);

      const newAdminUsername =
        role === 'super_admin' &&
        typeof body.settings.adminUsername === 'string' &&
        body.settings.adminUsername.trim()
          ? body.settings.adminUsername.trim()
          : db.settings.adminUsername || 'admin_hafsa';

      const newPassword =
        role === 'super_admin' &&
        typeof body.settings.adminPassword === 'string' &&
        body.settings.adminPassword.trim()
          ? body.settings.adminPassword.trim()
          : db.settings.adminPassword || 'Hafsa@Admin2026';

      const newSupplierUsername =
        role === 'super_admin' &&
        typeof body.settings.supplierUsername === 'string' &&
        body.settings.supplierUsername.trim()
          ? body.settings.supplierUsername.trim()
          : db.settings.supplierUsername || 'supplier_arafat';

      const newSupplierPassword =
        role === 'super_admin' &&
        typeof body.settings.supplierPassword === 'string' &&
        body.settings.supplierPassword.trim()
          ? body.settings.supplierPassword.trim()
          : db.settings.supplierPassword || 'Sup#Arafat2026';

      const newCashierUsername =
        role === 'super_admin' &&
        typeof body.settings.cashierUsername === 'string' &&
        body.settings.cashierUsername.trim()
          ? body.settings.cashierUsername.trim()
          : db.settings.cashierUsername || 'cashier_pos';

      const newCashierPassword =
        role === 'super_admin' &&
        typeof body.settings.cashierPassword === 'string' &&
        body.settings.cashierPassword.trim()
          ? body.settings.cashierPassword.trim()
          : db.settings.cashierPassword || 'Cash#Pos2026';

      const newAccountantUsername =
        role === 'super_admin' &&
        typeof body.settings.accountantUsername === 'string' &&
        body.settings.accountantUsername.trim()
          ? body.settings.accountantUsername.trim()
          : db.settings.accountantUsername || 'accountant_fin';

      const newAccountantPassword =
        role === 'super_admin' &&
        typeof body.settings.accountantPassword === 'string' &&
        body.settings.accountantPassword.trim()
          ? body.settings.accountantPassword.trim()
          : db.settings.accountantPassword || 'Acc#Fin2026';

      if (role === 'super_admin' && newPassword !== (db.settings.adminPassword || 'Hafsa@Admin2026')) {
        rotatedToken = generateAdminToken(newPassword).token;
      }

      db.settings = {
        ...db.settings,
        ...body.settings,
        adminUsername: newAdminUsername,
        adminPassword: newPassword,
        supplierUsername: newSupplierUsername,
        supplierPassword: newSupplierPassword,
        cashierUsername: newCashierUsername,
        cashierPassword: newCashierPassword,
        accountantUsername: newAccountantUsername,
        accountantPassword: newAccountantPassword,
        pageContent: incomingPageContent,
        themeConfig: incomingThemeConfig,
        rolePermissions: incomingRolePermissions,
      };
    }
    if (body.categories) {
      db.categories = body.categories;
    }
    if (body.products) {
      db.products = body.products;
    }
    if (body.shippingRates) {
      db.shippingRates = body.shippingRates;
    }
    if (body.coupons) {
      db.coupons = body.coupons;
    }
    if (body.orders) {
      db.orders = body.orders;
    }
    if (body.vipMembers) {
      db.vipMembers = body.vipMembers;
    }
    if (body.promotions) {
      db.promotions = body.promotions;
    }

    await saveDbAsync(db);
    const response = NextResponse.json(sanitizeStoreDataForRole(db, role));

    if (rotatedToken) {
      response.headers.set('x-new-admin-token', rotatedToken);
      response.cookies.set({
        name: 'admin_session',
        value: rotatedToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json({ error: 'فشل تحديث بيانات المتجر' }, { status: 500 });
  }
}
