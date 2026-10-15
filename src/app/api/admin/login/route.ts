import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateAdminToken, verifyAdminRequest, extractAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
    const { password } = body as { password?: string };

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
    }

    const db = getDb();
    const configuredPassword = db.settings?.adminPassword || 'admin';

    if (password !== configuredPassword) {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
    }

    const session = generateAdminToken(password);

    const response = NextResponse.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
    });

    response.cookies.set({
      name: 'admin_session',
      value: session.token,
      httpOnly: true, // SECURED: Cookie protected from XSS access
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
