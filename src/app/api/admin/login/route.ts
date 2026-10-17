import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync } from '@/lib/db';
import { generateAdminToken, verifyAdminRequest, extractAdminToken } from '@/lib/auth';
import { AdminRole } from '@/types/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await getDbAsync();
  const auth = verifyAdminRequest(request);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ authenticated: false, error: auth.error }, { status: 401 });
  }
  const token = extractAdminToken(request);
  return NextResponse.json({ success: true, authenticated: true, token });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { password, role: requestedRole } = body as { password?: string; role?: AdminRole };

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
    }

    const db = await getDbAsync();
    const configuredPassword = db.settings?.adminPassword || 'admin';
    const managerPass = db.settings?.managerPassword || 'manager';
    const promoPass = db.settings?.promoPartnerPassword || 'promo';
    const wesamPass = db.settings?.wesamAdminPassword || 'wesam';

    let matchedRole: AdminRole | null = null;
    if (password === configuredPassword || password === wesamPass) {
      matchedRole = requestedRole || 'super_admin';
    } else if (password === managerPass) {
      matchedRole = 'store_manager';
    } else if (password === promoPass) {
      matchedRole = 'promo_partner';
    }

    if (!matchedRole) {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
    }

    // Sign with primary configuredPassword so verifyAdminToken remains 100% compatible
    const session = generateAdminToken(configuredPassword);

    const response = NextResponse.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      role: matchedRole,
    });

    response.cookies.set({
      name: 'admin_session',
      value: session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الدخول' }, { status: 500 });
  }
}
