import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync } from '@/lib/db';
import {
  ALL_DASHBOARD_PERMISSIONS,
  generateAdminToken,
  verifyAdminRequest,
  extractAdminToken,
  getResolvedRolePermissions,
  getRolePasswordFromSettings,
  getRoleUsernameFromSettings,
  normalizeAdminRole,
  verifyPasswordConstantTime,
} from '@/lib/auth';
import { AdminPermissionId, AdminRole, StaffAccount, SystemRole } from '@/types/store';

export const dynamic = 'force-dynamic';

const LOGIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_FAILED_ATTEMPTS = 10;
const loginFailuresByIp = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  return realIp ? realIp.trim() : null;
}

function getRoleRedirectPath(role: AdminRole): string {
  switch (role) {
    case 'supplier':
      return '/supplier';
    case 'cashier':
      return '/pos';
    case 'delivery_rider':
      return '/rider';
    case 'accountant':
    case 'super_admin':
    case 'admin':
    default:
      return '/admin';
  }
}

function getPermissionsForRole(
  role: AdminRole,
  resolved: ReturnType<typeof getResolvedRolePermissions>
): AdminPermissionId[] {
  if (role === 'supplier' || role === 'accountant' || role === 'cashier') {
    return resolved[role];
  }
  if (role === 'delivery_rider') {
    return [];
  }
  return ALL_DASHBOARD_PERMISSIONS;
}

export async function GET(request: NextRequest) {
  const db = await getDbAsync();
  const auth = verifyAdminRequest(request);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ authenticated: false, error: auth.error }, { status: 401 });
  }
  const token = extractAdminToken(request);
  const role = auth.role || 'super_admin';
  const rolePermissions = getResolvedRolePermissions(db.settings);
  const username = auth.username || getRoleUsernameFromSettings(db.settings, role);
  return NextResponse.json({
    success: true,
    authenticated: true,
    token,
    role,
    staffId: auth.staffId,
    username,
    displayName: auth.displayName || username,
    redirectTo: getRoleRedirectPath(role),
    unifiedDashboard: '/admin',
    permissions: getPermissionsForRole(role, rolePermissions),
    rolePermissions,
  });
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    if (clientIp) {
      const existing = loginFailuresByIp.get(clientIp);
      if (existing) {
        if (Date.now() > existing.resetAt) {
          loginFailuresByIp.delete(clientIp);
        } else if (existing.count >= LOGIN_MAX_FAILED_ATTEMPTS) {
          return NextResponse.json(
            { error: 'تم تجاوز الحد المسموح لمحاولات تسجيل الدخول، يرجى الانتظار دقائق والمحاولة مجدداً' },
            { status: 429 }
          );
        }
      }
    }
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

    if (requestedRole && (requestedRole as string) === 'customer') {
      return NextResponse.json(
        { error: 'عزل الأدوار: حسابات الموظفين تقتصر على أدوار طاقم العمل المصرح لهم فقط' },
        { status: 401 }
      );
    }

    const db = await getDbAsync();

    // 1. Multi-Staff Directory Resolution (scrypt-hashed individual staff accounts)
    let matchedStaffAccount: StaffAccount | undefined;
    if (hasUsernameInput && Array.isArray(db.staffAccounts)) {
      const candidateStaff = db.staffAccounts.find(
        (acc) => acc.username.trim().toLowerCase() === normalizedInputUser
      );

      if (candidateStaff) {
        const hashMatches = verifyPasswordConstantTime(password, candidateStaff.passwordHash);
        const primarySettingsMatches =
          Boolean(candidateStaff.isPrimary) &&
          verifyPasswordConstantTime(
            password,
            getRolePasswordFromSettings(db.settings, candidateStaff.role)
          );

        if (hashMatches || primarySettingsMatches) {
          if (candidateStaff.active === false) {
            return NextResponse.json(
              { error: 'تم إيقاف حساب هذا الموظف من قِبل الإدارة — يرجى مراجعة مدير الفرع' },
              { status: 403 }
            );
          }

          if (
            !requestedRole ||
            normalizeAdminRole(requestedRole) === normalizeAdminRole(candidateStaff.role)
          ) {
            matchedStaffAccount = candidateStaff;
          }
        }
      }
    }

    if (matchedStaffAccount) {
      if (clientIp) {
        loginFailuresByIp.delete(clientIp);
      }

      const adminRole = normalizeAdminRole(matchedStaffAccount.role);
      const session = generateAdminToken(matchedStaffAccount.passwordHash, adminRole, {
        staffId: matchedStaffAccount.id,
        username: matchedStaffAccount.username,
        displayName: matchedStaffAccount.displayName,
      });

      try {
        matchedStaffAccount.lastLoginAt = new Date().toISOString();
        await saveDbAsync(db);
      } catch {
        // Non-blocking audit timestamp update
      }

      const redirectTo = getRoleRedirectPath(adminRole);
      const rolePermissions = getResolvedRolePermissions(db.settings);

      const response = NextResponse.json({
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
        role: adminRole,
        staffId: matchedStaffAccount.id,
        username: matchedStaffAccount.username,
        displayName: matchedStaffAccount.displayName,
        redirectTo,
        unifiedDashboard: '/admin',
        permissions: getPermissionsForRole(adminRole, rolePermissions),
        rolePermissions,
      });

      response.cookies.set({
        name: 'admin_session',
        value: session.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60,
      });

      return response;
    }

    // 2. Canonical Role Settings Fallback (preserves backwards compatibility for legacy/password-only tests)
    const adminUser = getRoleUsernameFromSettings(db.settings, 'super_admin').trim().toLowerCase();
    const configuredPassword = getRolePasswordFromSettings(db.settings, 'super_admin');

    const supplierUser = getRoleUsernameFromSettings(db.settings, 'supplier').trim().toLowerCase();
    const supplierPass = getRolePasswordFromSettings(db.settings, 'supplier');

    const cashierUser = getRoleUsernameFromSettings(db.settings, 'cashier').trim().toLowerCase();
    const cashierPass = getRolePasswordFromSettings(db.settings, 'cashier');

    const accountantUser = getRoleUsernameFromSettings(db.settings, 'accountant').trim().toLowerCase();
    const accountantPass = getRolePasswordFromSettings(db.settings, 'accountant');

    const riderUser = getRoleUsernameFromSettings(db.settings, 'delivery_rider').trim().toLowerCase();
    const riderPass = getRolePasswordFromSettings(db.settings, 'delivery_rider');

    const matchesRoleCredentials = (targetRole: SystemRole): boolean => {
      switch (targetRole) {
        case 'super_admin':
        case 'admin': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === adminUser ||
            normalizedInputUser === 'admin_hafsa';
          const passOk = verifyPasswordConstantTime(password, configuredPassword);
          return userOk && passOk;
        }
        case 'supplier': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === supplierUser ||
            normalizedInputUser === 'supplier_arafat';
          const passOk = verifyPasswordConstantTime(password, supplierPass);
          return userOk && passOk;
        }
        case 'cashier': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === cashierUser ||
            normalizedInputUser === 'cashier_pos';
          const passOk = verifyPasswordConstantTime(password, cashierPass);
          return userOk && passOk;
        }
        case 'accountant': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === accountantUser ||
            normalizedInputUser === 'accountant_fin';
          const passOk = verifyPasswordConstantTime(password, accountantPass);
          return userOk && passOk;
        }
        case 'delivery_rider': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === riderUser ||
            normalizedInputUser === 'rider_delivery';
          const passOk = verifyPasswordConstantTime(password, riderPass);
          return userOk && passOk;
        }
        default:
          return false;
      }
    };

    let matchedRole: SystemRole | null = null;

    if (requestedRole) {
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
        'delivery_rider',
      ];
      for (const candidate of candidateRoles) {
        if (matchesRoleCredentials(candidate)) {
          matchedRole = candidate;
          break;
        }
      }
    }

    if (!matchedRole) {
      if (clientIp) {
        const curr = loginFailuresByIp.get(clientIp);
        if (!curr || Date.now() > curr.resetAt) {
          loginFailuresByIp.set(clientIp, {
            count: 1,
            resetAt: Date.now() + LOGIN_RATE_LIMIT_WINDOW_MS,
          });
        } else {
          curr.count += 1;
        }
      }
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    if (clientIp) {
      loginFailuresByIp.delete(clientIp);
    }

    const matchedUsername = getRoleUsernameFromSettings(db.settings, matchedRole);
    const adminRole: AdminRole = normalizeAdminRole(matchedRole);
    const primaryAcc = (db.staffAccounts || []).find(
      (acc) => acc.isPrimary && normalizeAdminRole(acc.role) === adminRole
    );

    if (primaryAcc && primaryAcc.active === false) {
      return NextResponse.json(
        { error: 'تم إيقاف حساب هذا الموظف من قِبل الإدارة — يرجى مراجعة مدير الفرع' },
        { status: 403 }
      );
    }

    const roleSigningSecret =
      adminRole === 'super_admin'
        ? configuredPassword
        : getRolePasswordFromSettings(db.settings, adminRole);

    const session =
      adminRole === 'super_admin'
        ? generateAdminToken(configuredPassword)
        : generateAdminToken(roleSigningSecret, adminRole);

    const redirectTo = getRoleRedirectPath(adminRole);
    const rolePermissions = getResolvedRolePermissions(db.settings);

    const response = NextResponse.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      role: adminRole,
      staffId: primaryAcc?.id,
      username: matchedUsername,
      displayName: primaryAcc?.displayName || matchedUsername,
      redirectTo,
      unifiedDashboard: '/admin',
      permissions: getPermissionsForRole(adminRole, rolePermissions),
      rolePermissions,
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
