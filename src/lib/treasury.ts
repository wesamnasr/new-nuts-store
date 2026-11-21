import {
  DatabaseSchema,
  TreasuryAccountId,
  TreasuryTransaction,
} from '@/types/store';

export const TREASURY_ACCOUNT_META: Record<
  TreasuryAccountId,
  { id: TreasuryAccountId; label: string; subtitle: string }
> = {
  main_safe: {
    id: 'main_safe',
    label: 'الخزينة النقدية الرئيسية',
    subtitle: 'استلام تقفيل درج الورديات النقدي والمصروفات وتوريدات الكاش',
  },
  instapay_bank: {
    id: 'instapay_bank',
    label: 'حساب إنستاباي / البنك',
    subtitle: 'تحويلات InstaPay الفورية من الكاشير والمتجر الإلكتروني',
  },
  vodafone_wallet: {
    id: 'vodafone_wallet',
    label: 'محفظة فودافون كاش',
    subtitle: 'أرصدة ومدفوعات محفظة الكاش الإلكترونية',
  },
  card_bank: {
    id: 'card_bank',
    label: 'حساب ماكينة الفيزا (POS Card)',
    subtitle: 'مقبوضات بطاقات الدفع البنكية على ماكينة الفرع',
  },
};

export interface TreasuryAccountBalance {
  accountId: TreasuryAccountId;
  label: string;
  subtitle: string;
  totalIn: number;
  totalOut: number;
  balance: number;
}

export function calculateTreasuryBalances(
  transactions: TreasuryTransaction[] | undefined
): {
  accounts: Record<TreasuryAccountId, TreasuryAccountBalance>;
  totalLiquidity: number;
} {
  const accounts = {} as Record<TreasuryAccountId, TreasuryAccountBalance>;
  for (const key of Object.keys(TREASURY_ACCOUNT_META) as TreasuryAccountId[]) {
    const meta = TREASURY_ACCOUNT_META[key];
    accounts[key] = {
      accountId: key,
      label: meta.label,
      subtitle: meta.subtitle,
      totalIn: 0,
      totalOut: 0,
      balance: 0,
    };
  }

  for (const tx of transactions || []) {
    const bucket = accounts[tx.accountId];
    if (!bucket) continue;
    const amt = Math.max(0, Math.round((Number(tx.amount) || 0) * 100) / 100);
    if (tx.direction === 'in') {
      bucket.totalIn = Math.round((bucket.totalIn + amt) * 100) / 100;
    } else {
      bucket.totalOut = Math.round((bucket.totalOut + amt) * 100) / 100;
    }
    bucket.balance = Math.round((bucket.totalIn - bucket.totalOut) * 100) / 100;
  }

  const totalLiquidity =
    Math.round(
      Object.values(accounts).reduce((sum, a) => sum + a.balance, 0) * 100
    ) / 100;

  return { accounts, totalLiquidity };
}

export function recordTreasuryTransaction(
  db: DatabaseSchema,
  params: {
    accountId: TreasuryAccountId;
    direction: 'in' | 'out';
    category: TreasuryTransaction['category'];
    amount: number;
    referenceId?: string;
    title: string;
    notes?: string;
    recordedBy: string;
  }
): TreasuryTransaction | null {
  const cleanAmount = Math.round((Number(params.amount) || 0) * 100) / 100;
  if (cleanAmount <= 0) return null;

  if (!Array.isArray(db.treasuryTransactions)) {
    db.treasuryTransactions = [];
  }

  const tx: TreasuryTransaction = {
    id: `trs-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    txNumber: `TR-${1001 + db.treasuryTransactions.length}`,
    accountId: params.accountId,
    direction: params.direction,
    category: params.category,
    amount: cleanAmount,
    referenceId: params.referenceId,
    title: params.title,
    notes: params.notes,
    recordedBy: params.recordedBy,
    createdAt: new Date().toISOString(),
  };

  db.treasuryTransactions.unshift(tx);
  return tx;
}
