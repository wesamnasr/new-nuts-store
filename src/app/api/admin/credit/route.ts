import { NextResponse } from 'next/server';
import { getDbAsync, withDbTransaction } from '@/lib/db';
import { hasRolePermission, verifyAdminRequest } from '@/lib/auth';
import { validateEgyptianPhone } from '@/lib/validation';
import { recordTreasuryTransaction, TREASURY_ACCOUNT_META } from '@/lib/treasury';
import { appendAuditLog } from '@/lib/audit-log';
import { TreasuryAccountId, VipMember } from '@/types/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = verifyAdminRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'غير مصرح (401)' }, { status: 401 });
    }

    const db = await getDbAsync();
    const canView =
      auth.role === 'super_admin' ||
      auth.role === 'admin' ||
      auth.role === 'accountant' ||
      hasRolePermission(auth.role, 'accounting_portal', db.settings);

    if (!canView) {
      return NextResponse.json(
        { error: 'عزل الأدوار: غير مصرح بالاطلاع على ذمم العملاء والبيع الآجل (403)' },
        { status: 403 }
      );
    }

    const members = Array.isArray(db.vipMembers) ? db.vipMembers : [];
    const totalReceivables =
      Math.round(
        members.reduce(
          (sum, m) => sum + (m.creditBalanceDue ?? m.creditBalance ?? 0),
          0
        ) * 100
      ) / 100;

    const creditOrders = (db.orders || [])
      .filter((o) => (o.creditDueAmount || 0) > 0 || o.paymentMethod === 'credit')
      .slice(0, 100);

    return NextResponse.json({
      success: true,
      enableCreditSales: Boolean(db.settings?.enableCreditSales),
      creditSalesRequireApproval: db.settings?.creditSalesRequireApproval !== false,
      totalReceivables,
      customers: members,
      creditOrders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'فشل تحميل بيانات البيع الآجل', details: err?.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await getDbAsync();
    const auth = verifyAdminRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'غير مصرح (401)' }, { status: 401 });
    }
    if (auth.role !== 'super_admin' && auth.role !== 'admin') {
      return NextResponse.json(
        { error: 'عزل الأدوار: تعديل سياسة البيع الآجل والحدود الائتمانية مخصص للمدير فقط (403)' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const actorName = auth.displayName || auth.username || 'super_admin';

    return await withDbTransaction(async (db) => {
      if (body.action === 'toggle_master_credit') {
        const nextEnable = Boolean(body.enableCreditSales);
        const nextReqApproval =
          body.creditSalesRequireApproval !== undefined
            ? Boolean(body.creditSalesRequireApproval)
            : db.settings.creditSalesRequireApproval !== false;

        db.settings = {
          ...db.settings,
          enableCreditSales: nextEnable,
          creditSalesRequireApproval: nextReqApproval,
        };

        appendAuditLog(db, {
          actorUsername: actorName,
          actorRole: auth.role || 'super_admin',
          action: 'settings_update',
          targetType: 'credit_policy',
          summary: `${nextEnable ? 'تفعيل' : 'قفل وإيقاف'} نظام البيع الآجل بالكاشير (${
            nextReqApproval ? 'للعملاء المعتمدين فقط' : 'مسموح لكافة المسجلين'
          })`,
        });

        return NextResponse.json({
          success: true,
          enableCreditSales: nextEnable,
          creditSalesRequireApproval: nextReqApproval,
        });
      }

      if (body.action === 'update_customer_credit') {
        const phoneCheck = validateEgyptianPhone(body.phone || '');
        if (!phoneCheck.isValid) {
          return NextResponse.json(
            { error: 'يرجى إدخال رقم هاتف مصري صحيح للعميل (010/011/012/015)' },
            { status: 400 }
          );
        }

        if (!Array.isArray(db.vipMembers)) db.vipMembers = [];
        const cleanLimit = Math.max(0, Math.round(Number(body.creditLimit) || 0));
        const allowCredit = Boolean(body.allowCredit);
        const customerName = (body.customerName || '').trim() || 'عميل معتمد';

        let member = db.vipMembers.find((m) => m.phone === phoneCheck.normalized);
        if (!member) {
          member = {
            id: `vip-${Date.now()}`,
            phone: phoneCheck.normalized,
            customerName,
            name: customerName,
            membershipCode: `VIP-${phoneCheck.normalized.slice(-4)}`,
            pointsBalance: 0,
            walletBalance: 0,
            totalSpent: 0,
            ordersCount: 0,
            tier: 'Gold VIP',
            allowCredit,
            creditLimit: cleanLimit,
            creditBalanceDue: 0,
            creditBalance: 0,
            joinedAt: new Date().toISOString(),
            transactions: [],
            creditTransactions: [],
          };
          db.vipMembers.unshift(member);
        } else {
          if (body.customerName?.trim()) {
            member.customerName = body.customerName.trim();
            member.name = body.customerName.trim();
          }
          member.allowCredit = allowCredit;
          member.creditLimit = cleanLimit;
        }

        appendAuditLog(db, {
          actorUsername: actorName,
          actorRole: auth.role || 'super_admin',
          action: 'settings_update',
          targetType: 'vip_member',
          targetId: member.phone,
          summary: `تحديث اعتماد البيع الآجل للعميل "${member.customerName}" (${member.phone}): ${
            allowCredit ? `معتمد بحد ${cleanLimit} ج.م` : 'موقوف'
          }`,
        });

        return NextResponse.json({ success: true, customer: member });
      }

      return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'فشل تحديث بيانات الائتمان', details: err?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await getDbAsync();
    const auth = verifyAdminRequest(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'غير مصرح (401)' }, { status: 401 });
    }
    if (auth.role !== 'super_admin' && auth.role !== 'admin') {
      return NextResponse.json(
        { error: 'عزل الأدوار: تحصيل الذمم من الإدارة مخصص لمدير النظام فقط (403)' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const phoneCheck = validateEgyptianPhone(body.phone || '');
    const rawAmount = Math.round((Number(body.amount) || 0) * 100) / 100;
    const accountId = (body.accountId || 'main_safe') as TreasuryAccountId;
    const notes = (body.notes || '').trim();
    const actorName = auth.displayName || auth.username || 'super_admin';

    if (!phoneCheck.isValid || rawAmount <= 0) {
      return NextResponse.json(
        { error: 'يرجى إدخال هاتف العميل ومبلغ سداد أكبر من صفر' },
        { status: 400 }
      );
    }

    return await withDbTransaction(async (db) => {
      const member = (db.vipMembers || []).find(
        (m) => m.phone === phoneCheck.normalized
      );
      const currentDebt = member ? (member.creditBalanceDue ?? member.creditBalance ?? 0) : 0;
      if (!member || currentDebt <= 0) {
        return NextResponse.json(
          { error: 'لا توجد مديونية قائمة على هذا العميل' },
          { status: 400 }
        );
      }

      const paidAmount = Math.min(currentDebt, rawAmount);
      const nextDebt = Math.max(
        0,
        Math.round((currentDebt - paidAmount) * 100) / 100
      );
      member.creditBalanceDue = nextDebt;
      member.creditBalance = nextDebt;

      if (!Array.isArray(member.creditTransactions)) {
        member.creditTransactions = [];
      }
      member.creditTransactions.unshift({
        id: `crd-pay-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'debt_payment',
        amount: paidAmount,
        recordedBy: actorName,
        notes: notes || `تحصيل بالإدارة (${TREASURY_ACCOUNT_META[accountId]?.label || 'الخزينة'})`,
      });

      const tx = recordTreasuryTransaction(db, {
        accountId: TREASURY_ACCOUNT_META[accountId] ? accountId : 'main_safe',
        direction: 'in',
        category: 'customer_debt_collection',
        amount: paidAmount,
        referenceId: member.phone,
        title: `تحصيل مديونية عميل: ${member.customerName || member.name || member.phone}`,
        notes: notes || undefined,
        recordedBy: actorName,
      });

      appendAuditLog(db, {
        actorUsername: actorName,
        actorRole: auth.role || 'super_admin',
        action: 'credit_settlement',
        targetType: 'vip_member',
        targetId: member.phone,
        summary: `تحصيل ${paidAmount} ج.م من مديونية العميل "${member.customerName}" وإيداعها في "${
          TREASURY_ACCOUNT_META[accountId]?.label || 'الخزينة'
        }" (المتبقي: ${nextDebt} ج.م)`,
      });

      return NextResponse.json({
        success: true,
        paidAmount,
        remainingDebt: nextDebt,
        customer: member,
        transaction: tx,
      });
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'فشل تحصيل مديونية العميل', details: err?.message },
      { status: 500 }
    );
  }
}
