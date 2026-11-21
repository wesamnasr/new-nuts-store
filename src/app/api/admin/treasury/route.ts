import { NextResponse } from 'next/server';
import { getDbAsync, withDbTransaction } from '@/lib/db';
import { hasRolePermission, verifyAdminRequest } from '@/lib/auth';
import {
  calculateTreasuryBalances,
  recordTreasuryTransaction,
  TREASURY_ACCOUNT_META,
} from '@/lib/treasury';
import { appendAuditLog } from '@/lib/audit-log';
import { TreasuryAccountId, TreasuryTransaction } from '@/types/store';

export const dynamic = 'force-dynamic';

const VALID_ACCOUNTS: TreasuryAccountId[] = [
  'main_safe',
  'instapay_bank',
  'vodafone_wallet',
  'card_bank',
];

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
        { error: 'عزل الأدوار: غير مصرح بالاطلاع على الخزينة والحسابات المالية (403)' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const accountFilter = url.searchParams.get('accountId') as TreasuryAccountId | null;

    const allTx = Array.isArray(db.treasuryTransactions) ? db.treasuryTransactions : [];
    const { accounts, totalLiquidity } = calculateTreasuryBalances(allTx);

    const filteredTx = accountFilter
      ? allTx.filter((t) => t.accountId === accountFilter)
      : allTx;

    const approvedSupply = (db.supplyInvoices || []).filter(
      (s) => s.status === 'approved'
    );
    const totalSupplierPayables =
      Math.round(
        approvedSupply.reduce((sum, inv) => {
          const rem =
            typeof inv.remainingAmount === 'number'
              ? inv.remainingAmount
              : Math.max(
                  0,
                  (inv.totalAmount || 0) -
                    (inv.paidAmount || 0) -
                    (inv.returnedAmount || 0)
                );
          return sum + rem;
        }, 0) * 100
      ) / 100;

    return NextResponse.json({
      success: true,
      accounts,
      totalLiquidity,
      totalSupplierPayables,
      transactions: filteredTx.slice(0, 200),
      supplierPayments: (db.supplierPayments || []).slice(0, 100),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'فشل تحميل بيانات الخزينة', details: err?.message },
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
        { error: 'عزل الأدوار: سندات الخزينة والتحويلات البنكية مخصصة لمدير النظام فقط (403)' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const actorName = auth.displayName || auth.username || 'super_admin';

    return await withDbTransaction(async (db) => {
      if (body.action === 'transfer') {
        const fromAccountId = body.fromAccountId as TreasuryAccountId;
        const toAccountId = body.toAccountId as TreasuryAccountId;
        const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
        const notes = (body.notes || '').trim();

        if (
          !VALID_ACCOUNTS.includes(fromAccountId) ||
          !VALID_ACCOUNTS.includes(toAccountId) ||
          fromAccountId === toAccountId
        ) {
          return NextResponse.json(
            { error: 'يرجى اختيار حسابين مختلفين وصحيحين للتحويل بينهما' },
            { status: 400 }
          );
        }
        if (amount <= 0) {
          return NextResponse.json(
            { error: 'قيمة التحويل يجب أن تكون أكبر من صفر' },
            { status: 400 }
          );
        }

        const outTx = recordTreasuryTransaction(db, {
          accountId: fromAccountId,
          direction: 'out',
          category: 'transfer',
          amount,
          title: `تحويل صادر إلى ${TREASURY_ACCOUNT_META[toAccountId].label}`,
          notes: notes || undefined,
          recordedBy: actorName,
        });
        const inTx = recordTreasuryTransaction(db, {
          accountId: toAccountId,
          direction: 'in',
          category: 'transfer',
          amount,
          referenceId: outTx?.txNumber,
          title: `تحويل وارد من ${TREASURY_ACCOUNT_META[fromAccountId].label}`,
          notes: notes || undefined,
          recordedBy: actorName,
        });

        appendAuditLog(db, {
          actorUsername: actorName,
          actorRole: auth.role || 'super_admin',
          action: 'treasury_tx',
          targetType: 'treasury',
          targetId: outTx?.txNumber,
          summary: `تحويل مالي بقيمة ${amount} ج.م من "${TREASURY_ACCOUNT_META[fromAccountId].label}" إلى "${TREASURY_ACCOUNT_META[toAccountId].label}"`,
        });

        const { accounts, totalLiquidity } = calculateTreasuryBalances(
          db.treasuryTransactions
        );
        return NextResponse.json({
          success: true,
          outTx,
          inTx,
          accounts,
          totalLiquidity,
        });
      }

      // Standard manual receipt / disbursement voucher
      const accountId = (body.accountId || 'main_safe') as TreasuryAccountId;
      const direction: 'in' | 'out' = body.direction === 'out' ? 'out' : 'in';
      const category = (body.category ||
        (direction === 'in'
          ? 'owner_deposit'
          : 'general_expense')) as TreasuryTransaction['category'];
      const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
      const title = (body.title || '').trim();
      const notes = (body.notes || '').trim();

      if (!VALID_ACCOUNTS.includes(accountId)) {
        return NextResponse.json({ error: 'الحساب المالي غير صالح' }, { status: 400 });
      }
      if (amount <= 0 || !title) {
        return NextResponse.json(
          { error: 'يرجى إدخال بيان السند ومبلغ أكبر من صفر' },
          { status: 400 }
        );
      }

      const tx = recordTreasuryTransaction(db, {
        accountId,
        direction,
        category,
        amount,
        title,
        notes: notes || undefined,
        recordedBy: actorName,
      });

      appendAuditLog(db, {
        actorUsername: actorName,
        actorRole: auth.role || 'super_admin',
        action: 'treasury_tx',
        targetType: 'treasury',
        targetId: tx?.txNumber,
        summary: `${direction === 'in' ? 'سند قبض/إيداع' : 'سند صرف/سحب'} بقيمة ${amount} ج.م على "${TREASURY_ACCOUNT_META[accountId].label}": ${title}`,
      });

      const { accounts, totalLiquidity } = calculateTreasuryBalances(
        db.treasuryTransactions
      );
      return NextResponse.json({
        success: true,
        transaction: tx,
        accounts,
        totalLiquidity,
      });
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'فشل تسجيل حركة الخزينة', details: err?.message },
      { status: 500 }
    );
  }
}
