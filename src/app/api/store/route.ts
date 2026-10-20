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

    // Role 2 (Supplier), Role 3 (Cashier), and Role 4 (Accountant) cannot mutate store data via PUT /api/store
    if (role === 'accountant' || role === 'cashier' || role === 'supplier') {
      return NextResponse.json(
        {
          error:
            'عزل الأدوار: هذا الدور غير مصرح له بتعديل بيانات المتجر أو الكتالوج (403 Forbidden)',
        },
        { status: 403 }
      );
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

      const newAdminUsername =
        typeof body.settings.adminUsername === 'string' && body.settings.adminUsername.trim()
          ? body.settings.adminUsername.trim()
          : db.settings.adminUsername || 'admin_hafsa';

      const newPassword =
        typeof body.settings.adminPassword === 'string' && body.settings.adminPassword.trim()
          ? body.settings.adminPassword.trim()
          : db.settings.adminPassword || 'Hafsa@Admin2026';

      const newSupplierUsername =
        typeof body.settings.supplierUsername === 'string' && body.settings.supplierUsername.trim()
          ? body.settings.supplierUsername.trim()
          : db.settings.supplierUsername || 'supplier_arafat';

      const newSupplierPassword =
        typeof body.settings.supplierPassword === 'string' && body.settings.supplierPassword.trim()
          ? body.settings.supplierPassword.trim()
          : db.settings.supplierPassword || 'Sup#Arafat2026';

      const newCashierUsername =
        typeof body.settings.cashierUsername === 'string' && body.settings.cashierUsername.trim()
          ? body.settings.cashierUsername.trim()
          : db.settings.cashierUsername || 'cashier_pos';

      const newCashierPassword =
        typeof body.settings.cashierPassword === 'string' && body.settings.cashierPassword.trim()
          ? body.settings.cashierPassword.trim()
          : db.settings.cashierPassword || 'Cash#Pos2026';

      const newAccountantUsername =
        typeof body.settings.accountantUsername === 'string' && body.settings.accountantUsername.trim()
          ? body.settings.accountantUsername.trim()
          : db.settings.accountantUsername || 'accountant_fin';

      const newAccountantPassword =
        typeof body.settings.accountantPassword === 'string' && body.settings.accountantPassword.trim()
          ? body.settings.accountantPassword.trim()
          : db.settings.accountantPassword || 'Acc#Fin2026';

      if (newPassword !== (db.settings.adminPassword || 'Hafsa@Admin2026')) {
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

