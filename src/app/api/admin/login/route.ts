import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync } from '@/lib/db';
import {
  ALL_DASHBOARD_PERMISSIONS,
  generateAdminToken,
  verifyAdminRequest,
  extractAdminToken,
  getEffectiveRolePermissions,
  getResolvedCustomRoles,
  getResolvedRolePermissions,
  getRolePasswordFromSettings,
  getRoleUsernameFromSettings,
  normalizeAdminRole,
  verifyPasswordConstantTime,
} from '@/lib/auth';
import { AdminPermissionId, AdminRole, StaffAccount, SystemRole } from '@/types/store';
import { appendAuditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

const LOGIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_FAILED_ATTEMPTS = 8;
const loginFailuresMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  return realIp ? realIp.trim() : 'local';
}

function getRateLimitKey(ip: string, username: string): string {
  return `${ip}:${username || 'default'}`;
}

function recordFailedAttempt(rateKey: string): void {
  const curr = loginFailuresMap.get(rateKey);
  if (!curr || Date.now() > curr.resetAt) {
    loginFailuresMap.set(rateKey, {
      count: 1,
      resetAt: Date.now() + LOGIN_RATE_LIMIT_WINDOW_MS,
    });
  } else {
    curr.count += 1;
  }
}

function getRoleRedirectPath(role: AdminRole): string {
  switch (role) {
    case 'supplier':
      // UX Constitution: No external supplier login — internal Procurement Officer works inside /admin
      return '/admin?tab=supply_invoices';
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
  const token = extractAdminToken(request);
  if (!token) {
    return NextResponse.json(
      { authenticated: false, error: 'Missing admin session token' },
      { status: 401 }
    );
  }
  const db = await getDbAsync();
  const auth = verifyAdminRequest(request);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ authenticated: false, error: auth.error }, { status: 401 });
  }
  const role = auth.role || 'super_admin';
  const rolePermissions = getResolvedRolePermissions(db.settings);
  const customRoles = getResolvedCustomRoles(db.settings);
  const customRole = auth.customRoleId
    ? customRoles.find((r) => r.id === auth.customRoleId)
    : undefined;
  const username = auth.username || getRoleUsernameFromSettings(db.settings, role);
  const permissions = customRole
    ? getEffectiveRolePermissions(role, db.settings, customRole.id)
    : getPermissionsForRole(role, rolePermissions);
  return NextResponse.json({
    success: true,
    authenticated: true,
    token,
    role,
    customRoleId: customRole?.id,
    customRoleName: customRole?.name,
    staffId: auth.staffId,
    username,
    displayName: auth.displayName || username,
    redirectTo: customRole ? '/admin' : getRoleRedirectPath(role),
    unifiedDashboard: '/admin',
    permissions,
    rolePermissions,
  });
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
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

    const rawUsername = typeof username === 'string' ? username.trim() : '';
    const rateKey = getRateLimitKey(clientIp, rawUsername.toLowerCase());

    const existingFailure = loginFailuresMap.get(rateKey);
    if (existingFailure) {
      if (Date.now() > existingFailure.resetAt) {
        loginFailuresMap.delete(rateKey);
      } else if (existingFailure.count >= LOGIN_MAX_FAILED_ATTEMPTS) {
        return NextResponse.json(
          { error: 'تم تجاوز الحد المسموح لمحاولات تسجيل الدخول لهذا الحساب، يرجى الانتظار 5 دقائق والمحاولة مجدداً' },
          { status: 429 }
        );
      }
    }

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
      loginFailuresMap.delete(rateKey);

      const adminRole = normalizeAdminRole(matchedStaffAccount.role);
      const session = generateAdminToken(matchedStaffAccount.passwordHash, adminRole, {
        staffId: matchedStaffAccount.id,
        username: matchedStaffAccount.username,
        displayName: matchedStaffAccount.displayName,
      });

      const customRoles = getResolvedCustomRoles(db.settings);
      const customRole = matchedStaffAccount.customRoleId
        ? customRoles.find((r) => r.id === matchedStaffAccount.customRoleId)
        : undefined;
      const redirectTo = customRole ? '/admin' : getRoleRedirectPath(adminRole);

      try {
        matchedStaffAccount.lastLoginAt = new Date().toISOString();
        appendAuditLog(db, {
          action: 'auth_login',
          actorUsername: matchedStaffAccount.username,
          actorDisplayName: matchedStaffAccount.displayName,
          actorRole: adminRole,
          targetType: 'session',
          targetId: matchedStaffAccount.id,
          summary: `تسجيل دخول ناجح للموظف «${matchedStaffAccount.displayName}» (${matchedStaffAccount.username}) وتوجيهه إلى ${redirectTo}`,
          ipAddress: clientIp,
        });
        await saveDbAsync(db);
      } catch {
        // Non-blocking audit timestamp update
      }

      const rolePermissions = getResolvedRolePermissions(db.settings);
      const effectivePermissions = customRole
        ? getEffectiveRolePermissions(adminRole, db.settings, customRole.id)
        : getPermissionsForRole(adminRole, rolePermissions);

      const response = NextResponse.json({
        success: true,
        token: session.token,
        expiresAt: session.expiresAt,
        role: adminRole,
        customRoleId: customRole?.id,
        customRoleName: customRole?.name,
        staffId: matchedStaffAccount.id,
        username: matchedStaffAccount.username,
        displayName: matchedStaffAccount.displayName,
        redirectTo,
        unifiedDashboard: '/admin',
        permissions: effectivePermissions,
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
            normalizedInputUser === 'admin';
          const passOk = verifyPasswordConstantTime(password, configuredPassword);
          return userOk && passOk;
        }
        case 'supplier': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === supplierUser ||
            normalizedInputUser === 'sup';
          const passOk = verifyPasswordConstantTime(password, supplierPass);
          return userOk && passOk;
        }
        case 'cashier': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === cashierUser ||
            normalizedInputUser === 'cash';
          const passOk = verifyPasswordConstantTime(password, cashierPass);
          return userOk && passOk;
        }
        case 'accountant': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === accountantUser ||
            normalizedInputUser === 'acc';
          const passOk = verifyPasswordConstantTime(password, accountantPass);
          return userOk && passOk;
        }
        case 'delivery_rider': {
          const userOk =
            !hasUsernameInput ||
            normalizedInputUser === riderUser ||
            normalizedInputUser === 'rider';
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
      recordFailedAttempt(rateKey);
      try {
        appendAuditLog(db, {
          action: 'auth_failed',
          actorUsername: normalizedInputUser || 'unknown',
          actorRole: requestedRole || 'unknown',
          targetType: 'session',
          summary: `محاولة تسجيل دخول فاشلة لحساب «${normalizedInputUser || 'غير محدد'}»`,
          ipAddress: clientIp,
        });
        await saveDbAsync(db);
      } catch {
        // Non-blocking failed login audit
      }
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    loginFailuresMap.delete(rateKey);

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

    try {
      appendAuditLog(db, {
        action: 'auth_login',
        actorUsername: matchedUsername,
        actorDisplayName: primaryAcc?.displayName || matchedUsername,
        actorRole: adminRole,
        targetType: 'session',
        targetId: primaryAcc?.id,
        summary: `تسجيل دخول ناجح للحساب «${matchedUsername}» (${adminRole})`,
        ipAddress: clientIp,
      });
      await saveDbAsync(db);
    } catch {
      // Non-blocking login audit
    }

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
