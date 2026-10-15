import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync, initialDatabase } from '@/lib/db';
import { verifyAdminRequest, sanitizePublicStoreData, generateAdminToken } from '@/lib/auth';
import { getResolvedPageContent, getResolvedThemeConfig } from '@/lib/defaults';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const db = await getDbAsync();
  if (request) {
    const auth = verifyAdminRequest(request);
    if (auth.isAuthenticated) {
      return NextResponse.json(db);
    }
  }

  // Public visitors get sanitized data without adminPassword and without customer orders
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

    const body = await request.json();

    if (body.action === 'reset_demo') {
      await saveDbAsync(initialDatabase);
      return NextResponse.json(initialDatabase);
    }

    let rotatedToken: string | null = null;

    if (body.settings) {
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

      if (newPassword !== (db.settings.adminPassword || 'admin')) {
        rotatedToken = generateAdminToken(newPassword).token;
      }

      db.settings = {
        ...db.settings,
        ...body.settings,
        adminPassword: newPassword,
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

    await saveDbAsync(db);
    const response = NextResponse.json(db);

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
