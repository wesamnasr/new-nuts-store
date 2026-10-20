import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync } from '@/lib/db';
import {
  generateAdminToken,
  verifyAdminRequest,
  extractAdminToken,
  getRolePasswordFromSettings,
  getRoleUsernameFromSettings,
  normalizeAdminRole,
} from '@/lib/auth';
import { AdminRole, SystemRole } from '@/types/store';

export const dynamic = 'force-dynamic';

function getRoleRedirectPath(role: AdminRole): string {
  switch (role) {
    case 'supplier':
      return '/supplier';
    case 'cashier':
      return '/pos';
    case 'accountant':
      return '/accountant';
    case 'super_admin':
    case 'admin':
    default:
      return '/admin';
  }
}

export async function GET(request: NextRequest) {
  const db = await getDbAsync();
  const auth = verifyAdminRequest(request);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ authenticated: false, error: auth.error }, { status: 401 });
  }
  const token = extractAdminToken(request);
  const role = auth.role || 'super_admin';
  return NextResponse.json({
    success: true,
    authenticated: true,
    token,
    role,
    username: getRoleUsernameFromSettings(db.settings, role),
    redirectTo: getRoleRedirectPath(role),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      username,
      password,
      role: requestedRole,
    } = body as {
      username?: string;
      password?: string;
      role?: SystemRole;
    };

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 });
    }

    const hasUsernameInput = typeof username === 'string';
    const normalizedInputUser = hasUsernameInput ? username.trim().toLowerCase() : '';

    if (hasUsernameInput && normalizedInputUser === '') {
      return NextResponse.json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' }, { status: 401 });
    }

    const db = await getDbAsync();

    const adminUser = getRoleUsernameFromSettings(db.settings, 'super_admin').trim().toLowerCase();
    const configuredPassword = getRolePasswordFromSettings(db.settings, 'super_admin');

    const supplierUser = getRoleUsernameFromSettings(db.settings, 'supplier').trim().toLowerCase();
    const supplierPass = getRolePasswordFromSettings(db.settings, 'supplier');

    const cashierUser = getRoleUsernameFromSettings(db.settings, 'cashier').trim().toLowerCase();
    const cashierPass = getRolePasswordFromSettings(db.settings, 'cashier');

    const accountantUser = getRoleUsernameFromSettings(db.settings, 'accountant').trim().toLowerCase();
    const accountantPass = getRolePasswordFromSettings(db.settings, 'accountant');

    const matchesRoleCredentials = (targetRole: SystemRole): boolean => {
      switch (targetRole) {
        case 'super_admin':
        case 'admin': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === adminUser ||
            normalizedInputUser === 'admin_hafsa';
          const passOk = password === configuredPassword;
          return userOk && passOk;
        }
        case 'supplier': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === supplierUser ||
            normalizedInputUser === 'supplier_arafat';
          const passOk = password === supplierPass;
          return userOk && passOk;
        }
        case 'cashier': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === cashierUser ||
            normalizedInputUser === 'cashier_pos';
          const passOk = password === cashierPass;
          return userOk && passOk;
        }
        case 'accountant': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === accountantUser ||
            normalizedInputUser === 'accountant_fin';
          const passOk = password === accountantPass;
          return userOk && passOk;
        }
        default:
          return false;
      }
    };

    let matchedRole: SystemRole | null = null;

    if (requestedRole) {
      if ((requestedRole as string) === 'customer') {
        return NextResponse.json(
          { error: 'عزل الأدوار: حسابات الموظفين تقتصر على أدوار طاقم العمل الـ 4 فقط' },
          { status: 401 }
        );
      }
      const targetRole: SystemRole = normalizeAdminRole(requestedRole);
      if (matchesRoleCredentials(targetRole)) {
        matchedRole = targetRole;
      }
    } else {
      const candidateRoles: SystemRole[] = [
        'super_admin',
        'supplier',
        'cashier',
        'accountant',
      ];
      for (const candidate of candidateRoles) {
        if (matchesRoleCredentials(candidate)) {
          matchedRole = candidate;
          break;
        }
      }
    }

    if (!matchedRole) {
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    const matchedUsername = getRoleUsernameFromSettings(db.settings, matchedRole);

    const adminRole: AdminRole = normalizeAdminRole(matchedRole);
    const roleSigningSecret =
      adminRole === 'super_admin'
        ? configuredPassword
        : getRolePasswordFromSettings(db.settings, adminRole);

    const session =
      adminRole === 'super_admin'
        ? generateAdminToken(configuredPassword)
        : generateAdminToken(roleSigningSecret, adminRole);

    const redirectTo = getRoleRedirectPath(adminRole);

    const response = NextResponse.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      role: adminRole,
      username: matchedUsername,
      redirectTo,
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
