import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync, initialDatabase } from '@/lib/db';
import {
  verifyAdminRequest,
  sanitizePublicStoreData,
  sanitizeStoreDataForRole,
  generateAdminToken,
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

    // Role 3 (Cashier) & Role 4 (Accountant) cannot modify catalog, settings, coupons, or shipping rates via PUT /api/store
    if (role === 'cashier' || role === 'accountant') {
      return NextResponse.json(
        {
          error:
            'عزل الأدوار: هذا الدور غير مصرح له بتعديل إعدادات المتجر أو الكتالوج العام (403 Forbidden)',
        },
        { status: 403 }
      );
    }

    // Role 2 (Supplier): Isolated strictly to updating product supply costs (costPerKg, packagingCost), stock status (inStock), and origin
    if (role === 'supplier') {
      if (!Array.isArray(body.products)) {
        return NextResponse.json(
          {
            error:
              'عزل الأدوار: صلاحية المورد تقتصر على تحديث تكاليف التوريد وحالة المخزون فقط (403 Forbidden)',
          },
          { status: 403 }
        );
      }

      const incomingById = new Map<string, Product>(
        body.products.map((p: Product) => [p.id, p])
      );

      db.products = db.products.map((existingProd) => {
        const incoming = incomingById.get(existingProd.id);
        if (!incoming) return existingProd;
        return {
          ...existingProd,
          costPerKg:
            typeof incoming.costPerKg === 'number' && incoming.costPerKg >= 0
              ? incoming.costPerKg
              : existingProd.costPerKg,
          packagingCost:
            typeof incoming.packagingCost === 'number' && incoming.packagingCost >= 0
              ? incoming.packagingCost
              : existingProd.packagingCost,
          inStock:
            typeof incoming.inStock === 'boolean'
              ? incoming.inStock
              : existingProd.inStock,
          origin:
            typeof incoming.origin === 'string'
              ? incoming.origin
              : existingProd.origin,
        };
      });

      await saveDbAsync(db);
      return NextResponse.json(sanitizeStoreDataForRole(db, 'supplier'));
    }

    if (body.action === 'reset_demo') {
      if (role !== 'super_admin') {
        return NextResponse.json(
          { error: 'عزل الأدوار: إعادة ضبط النظام متاحة للأدمن فقط (403 Forbidden)' },
          { status: 403 }
        );
      }
      await saveDbAsync(initialDatabase);
      return NextResponse.json(initialDatabase);
    }

    let rotatedToken: string | null = null;

    if (body.settings && role === 'super_admin') {
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

      const newPassword =
        typeof body.settings.adminPassword === 'string' && body.settings.adminPassword.trim()
          ? body.settings.adminPassword.trim()
          : db.settings.adminPassword || 'admin';

      const newSupplierPassword =
        typeof body.settings.supplierPassword === 'string' && body.settings.supplierPassword.trim()
          ? body.settings.supplierPassword.trim()
          : db.settings.supplierPassword || 'supplier';

      const newCashierPassword =
        typeof body.settings.cashierPassword === 'string' && body.settings.cashierPassword.trim()
          ? body.settings.cashierPassword.trim()
          : db.settings.cashierPassword || 'cashier';

      const newAccountantPassword =
        typeof body.settings.accountantPassword === 'string' && body.settings.accountantPassword.trim()
          ? body.settings.accountantPassword.trim()
          : db.settings.accountantPassword || 'accountant';

      if (newPassword !== (db.settings.adminPassword || 'admin')) {
        rotatedToken = generateAdminToken(newPassword).token;
      }

      db.settings = {
        ...db.settings,
        ...body.settings,
        adminPassword: newPassword,
        supplierPassword: newSupplierPassword,
        cashierPassword: newCashierPassword,
        accountantPassword: newAccountantPassword,
        pageContent: incomingPageContent,
        themeConfig: incomingThemeConfig,
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

