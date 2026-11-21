import { NextRequest, NextResponse } from 'next/server';
import {
  getDbAsync,
  inspectPostgresRelationalHealth,
  withDbTransaction,
} from '@/lib/db';
import {
  computeSettingsFingerprint,
  generateAdminToken,
  hashPasswordScrypt,
  normalizeAdminRole,
  toPublicStaffAccount,
  verifyAdminRequest,
} from '@/lib/auth';
import { AdminRole, StaffAccount } from '@/types/store';

export const dynamic = 'force-dynamic';

const VALID_STAFF_ROLES = new Set<string>([
  'super_admin',
  'admin',
  'accountant',
  'cashier',
  'supplier',
  'delivery_rider',
]);

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,40}$/;

function syncPrimaryRoleSettings(
  settings: StaffAccount['role'] extends never ? never : any,
  role: AdminRole,
  username?: string,
  plainPassword?: string
) {
  if (!settings) return;
  switch (role) {
    case 'super_admin':
    case 'admin':
      if (username) settings.adminUsername = username;
      if (plainPassword) settings.adminPassword = plainPassword;
      break;
    case 'accountant':
      if (username) settings.accountantUsername = username;
      if (plainPassword) settings.accountantPassword = plainPassword;
      break;
    case 'cashier':
      if (username) settings.cashierUsername = username;
      if (plainPassword) settings.cashierPassword = plainPassword;
      break;
    case 'supplier':
      if (username) settings.supplierUsername = username;
      if (plainPassword) settings.supplierPassword = plainPassword;
      break;
    case 'delivery_rider':
      if (username) settings.riderUsername = username;
      if (plainPassword) settings.riderPassword = plainPassword;
      break;
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDbAsync();
    const auth = verifyAdminRequest(request, ['super_admin']);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error || 'غير مصرح بالوصول' },
        { status: auth.statusCode || 401 }
      );
    }

    const dbHealth = await inspectPostgresRelationalHealth();
    const staffAccounts = Array.isArray(db.staffAccounts)
      ? db.staffAccounts.map(toPublicStaffAccount)
      : [];

    return NextResponse.json({
      success: true,
      staffAccounts,
      dbHealth,
    });
  } catch (err) {
    console.error('GET /api/admin/staff error:', err);
    return NextResponse.json(
      { error: 'تعذر تحميل قائمة حسابات الموظفين' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await getDbAsync();
    const auth = verifyAdminRequest(request, ['super_admin']);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error || 'غير مصرح بالوصول' },
        { status: auth.statusCode || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawUsername = typeof body.username === 'string' ? body.username.trim() : '';
    const rawPassword = typeof body.password === 'string' ? body.password.trim() : '';
    const rawDisplayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const rawRole = typeof body.role === 'string' ? body.role.trim() : '';

    if (!USERNAME_REGEX.test(rawUsername)) {
      return NextResponse.json(
        {
          error:
            'اسم المستخدم يجب أن يتكون من 3 إلى 40 حرفاً إنجليزياً أو أرقاماً أو (_) فقط بدون مسافات',
        },
        { status: 400 }
      );
    }

    if (rawPassword.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب ألا تقل عن 6 أحرف أو رموز' },
        { status: 400 }
      );
    }

    if (rawDisplayName.length < 2) {
      return NextResponse.json(
        { error: 'يرجى إدخال الاسم التعريفي للموظف (حرفان على الأقل)' },
        { status: 400 }
      );
    }

    if (!VALID_STAFF_ROLES.has(rawRole)) {
      return NextResponse.json(
        { error: 'الدور الوظيفي المحدد غير صالح ضمن أدوار النظام الخمسة' },
        { status: 400 }
      );
    }

    const normalizedRole: AdminRole = normalizeAdminRole(rawRole);

    return await withDbTransaction(async (db) => {
      if (!Array.isArray(db.staffAccounts)) {
        db.staffAccounts = [];
      }

      const duplicate = db.staffAccounts.find(
        (acc) => acc.username.trim().toLowerCase() === rawUsername.toLowerCase()
      );
      if (duplicate) {
        return NextResponse.json(
          { error: 'اسم المستخدم مسجل بالفعل لموظف آخر، يرجى اختيار اسم مستخدم فريد' },
          { status: 409 }
        );
      }

      const nowIso = new Date().toISOString();
      const created: StaffAccount = {
        id: `staff-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        username: rawUsername,
        passwordHash: hashPasswordScrypt(rawPassword),
        role: normalizedRole,
        displayName: rawDisplayName,
        phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : undefined,
        active: body.active !== false,
        isPrimary: false,
        notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      db.staffAccounts.push(created);

      return NextResponse.json(
        {
          success: true,
          account: toPublicStaffAccount(created),
          message: 'تم إنشاء حساب الموظف وتشفير كلمة المرور بنجاح',
        },
        { status: 201 }
      );
    });
  } catch (err) {
    console.error('POST /api/admin/staff error:', err);
    return NextResponse.json(
      { error: 'تعذر إنشاء حساب الموظف الجديد' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await getDbAsync();
    const auth = verifyAdminRequest(request, ['super_admin']);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error || 'غير مصرح بالوصول' },
        { status: auth.statusCode || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const staffId = typeof body.id === 'string' ? body.id.trim() : '';
    if (!staffId) {
      return NextResponse.json(
        { error: 'معرف حساب الموظف مطلوب للتعديل' },
        { status: 400 }
      );
    }

    return await withDbTransaction(async (db) => {
      if (!Array.isArray(db.staffAccounts)) {
        db.staffAccounts = [];
      }

      const target = db.staffAccounts.find((acc) => acc.id === staffId);
      if (!target) {
        return NextResponse.json(
          { error: 'حساب الموظف غير موجود (404 Not Found)' },
          { status: 404 }
        );
      }

      const isCurrentlyActiveAdmin =
        normalizeAdminRole(target.role) === 'super_admin' && target.active !== false;
      const nextRole =
        typeof body.role === 'string' && VALID_STAFF_ROLES.has(body.role)
          ? normalizeAdminRole(body.role)
          : normalizeAdminRole(target.role);
      const nextActive =
        typeof body.active === 'boolean' ? body.active : target.active !== false;

      if (isCurrentlyActiveAdmin && (!nextActive || nextRole !== 'super_admin')) {
        const activeAdminsCount = db.staffAccounts.filter(
          (acc) => normalizeAdminRole(acc.role) === 'super_admin' && acc.active !== false
        ).length;
        if (activeAdminsCount <= 1) {
          return NextResponse.json(
            {
              error:
                'حماية النظام: لا يمكن إيقاف أو خفض صلاحية حساب المدير العام الوحيد النشط منعاً لقفل النظام',
            },
            { status: 400 }
          );
        }
      }

      if (target.isPrimary && nextRole !== normalizeAdminRole(target.role)) {
        return NextResponse.json(
          {
            error:
              'الحسابات التأسيسية الخمسة مرتبطة بأدوارها الأساسية — أنشئ حساب موظف إضافي للدور الآخر بدلاً من ذلك',
          },
          { status: 400 }
        );
      }

      let updatedUsername = target.username;
      if (typeof body.username === 'string' && body.username.trim() !== target.username) {
        const candidateUsername = body.username.trim();
        if (!USERNAME_REGEX.test(candidateUsername)) {
          return NextResponse.json(
            {
              error:
                'اسم المستخدم يجب أن يتكون من 3 إلى 40 حرفاً إنجليزياً أو أرقاماً أو (_) فقط بدون مسافات',
            },
            { status: 400 }
          );
        }
        const collision = db.staffAccounts.find(
          (acc) =>
            acc.id !== target.id &&
            acc.username.trim().toLowerCase() === candidateUsername.toLowerCase()
        );
        if (collision) {
          return NextResponse.json(
            { error: 'اسم المستخدم مستخدم بالفعل لحساب موظف آخر' },
            { status: 409 }
          );
        }
        updatedUsername = candidateUsername;
      }

      let updatedPlainPassword: string | undefined;
      let credentialsRotated = updatedUsername !== target.username;

      if (typeof body.password === 'string' && body.password.trim().length > 0) {
        const trimmedPass = body.password.trim();
        if (trimmedPass.length < 6) {
          return NextResponse.json(
            { error: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف أو رموز' },
            { status: 400 }
          );
        }
        updatedPlainPassword = trimmedPass;
        target.passwordHash = hashPasswordScrypt(trimmedPass);
        if (target.isPrimary) {
          target.settingsFingerprint = computeSettingsFingerprint(trimmedPass);
        }
        credentialsRotated = true;
      }

      target.username = updatedUsername;
      if (!target.isPrimary) {
        target.role = nextRole;
      }
      target.active = nextActive;

      if (typeof body.displayName === 'string' && body.displayName.trim().length >= 2) {
        target.displayName = body.displayName.trim();
      }
      if (typeof body.phone === 'string') {
        target.phone = body.phone.trim() || undefined;
      }
      if (typeof body.notes === 'string') {
        target.notes = body.notes.trim() || undefined;
      }
      target.updatedAt = new Date().toISOString();

      if (target.isPrimary) {
        syncPrimaryRoleSettings(
          db.settings,
          normalizeAdminRole(target.role),
          updatedUsername,
          updatedPlainPassword
        );
      }

      let rotatedToken: string | undefined;
      if (credentialsRotated && auth.staffId === target.id && target.active) {
        rotatedToken = generateAdminToken(target.passwordHash, normalizeAdminRole(target.role), {
          staffId: target.id,
          username: target.username,
          displayName: target.displayName,
        }).token;
      }

      const response = NextResponse.json({
        success: true,
        account: toPublicStaffAccount(target),
        ...(rotatedToken ? { rotatedToken } : {}),
        message: 'تم تحديث بيانات حساب الموظف بنجاح',
      });

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
    });
  } catch (err) {
    console.error('PATCH /api/admin/staff error:', err);
    return NextResponse.json(
      { error: 'تعذر تحديث بيانات حساب الموظف' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await getDbAsync();
    const auth = verifyAdminRequest(request, ['super_admin']);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: auth.error || 'غير مصرح بالوصول' },
        { status: auth.statusCode || 401 }
      );
    }

    const url = new URL(request.url);
    let staffId = url.searchParams.get('id')?.trim() || '';
    if (!staffId) {
      const body = await request.json().catch(() => ({}));
      staffId = typeof body.id === 'string' ? body.id.trim() : '';
    }

    if (!staffId) {
      return NextResponse.json(
        { error: 'معرف حساب الموظف مطلوب للحذف' },
        { status: 400 }
      );
    }

    return await withDbTransaction(async (db) => {
      if (!Array.isArray(db.staffAccounts)) {
        db.staffAccounts = [];
      }

      const idx = db.staffAccounts.findIndex((acc) => acc.id === staffId);
      if (idx === -1) {
        return NextResponse.json(
          { error: 'حساب الموظف غير موجود (404 Not Found)' },
          { status: 404 }
        );
      }

      const target = db.staffAccounts[idx];
      if (target.isPrimary) {
        return NextResponse.json(
          {
            error:
              'الحسابات التأسيسية الخمسة محمية من الحذف — يمكنك إيقاف الموظفين الإضافيين أو حذفهم فقط',
          },
          { status: 400 }
        );
      }

      if (auth.staffId && target.id === auth.staffId) {
        return NextResponse.json(
          { error: 'لا يمكنك حذف حسابك الشخصي أثناء الجلسة الحالية' },
          { status: 400 }
        );
      }

      if (normalizeAdminRole(target.role) === 'super_admin' && target.active !== false) {
        const activeAdminsCount = db.staffAccounts.filter(
          (acc) => normalizeAdminRole(acc.role) === 'super_admin' && acc.active !== false
        ).length;
        if (activeAdminsCount <= 1) {
          return NextResponse.json(
            { error: 'حماية النظام: لا يمكن حذف حساب المدير العام الوحيد النشط' },
            { status: 400 }
          );
        }
      }

      db.staffAccounts.splice(idx, 1);

      return NextResponse.json({
        success: true,
        deletedId: target.id,
        message: 'تم حذف حساب الموظف وإلغاء جلسته فوراً',
      });
    });
  } catch (err) {
    console.error('DELETE /api/admin/staff error:', err);
    return NextResponse.json(
      { error: 'تعذر حذف حساب الموظف' },
      { status: 500 }
    );
  }
}
