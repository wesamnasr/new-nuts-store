import fs from 'fs';
import os from 'os';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { AdminRole, DatabaseSchema, StaffAccount } from '@/types/store';
import {
  getResolvedBandarZones,
  getResolvedDeliveryBatches,
  getResolvedPageContent,
  getResolvedThemeConfig,
  getResolvedVillageZones,
  getSafeImageUrl,
} from '@/lib/defaults';
import {
  computeSettingsFingerprint,
  hashPasswordScrypt,
} from '@/lib/password-hash';
import {
  ensurePostgresSchema,
  executeAtomicPostgresTransaction,
  getPostgresUrl,
  inspectPostgresRelationalHealth,
  isMissingRelationError,
  RELATIONAL_TABLES,
  syncAllRelationalTablesHttp,
} from '@/lib/postgres-schema';
import seedJson from '../../data/store-db.json';

export {
  getPostgresUrl,
  ensurePostgresSchema,
  inspectPostgresRelationalHealth,
  RELATIONAL_TABLES,
};

const DB_PATH = path.join(process.cwd(), 'data', 'store-db.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'new-nuts-store-db.json');
const PG_READ_CACHE_TTL_MS = 1500;

declare global {
  // eslint-disable-next-line no-var
  var __newNutsMemoryDb: DatabaseSchema | undefined;
  // eslint-disable-next-line no-var
  var __newNutsLastPersistedDb: DatabaseSchema | undefined;
  // eslint-disable-next-line no-var
  var __newNutsPgCacheTs: number | undefined;
  // eslint-disable-next-line no-var
  var __newNutsPgInFlightRead: Promise<DatabaseSchema> | undefined;
  // eslint-disable-next-line no-var
  var __newNutsHydrationVerified: boolean | undefined;
  // eslint-disable-next-line no-var
  var __newNutsLocalFileMtimeNs: bigint | undefined;
  // eslint-disable-next-line no-var
  var __newNutsLocalFileSize: bigint | undefined;
  // eslint-disable-next-line no-var
  var __newNutsLocalCleanSnapshot: DatabaseSchema | undefined;
  // eslint-disable-next-line no-var
  var __newNutsWriteMutex: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __newNutsPrimaryHashCache: Map<string, string> | undefined;
}

export const initialDatabase: DatabaseSchema =
  seedJson as unknown as DatabaseSchema;

function getCachedPrimaryScryptHash(role: AdminRole, rawPassword: string, fp: string): string {
  if (!globalThis.__newNutsPrimaryHashCache) {
    globalThis.__newNutsPrimaryHashCache = new Map<string, string>();
  }
  const key = `${role}:${fp}`;
  const cached = globalThis.__newNutsPrimaryHashCache.get(key);
  if (cached) return cached;
  const hashed = hashPasswordScrypt(rawPassword);
  globalThis.__newNutsPrimaryHashCache.set(key, hashed);
  return hashed;
}

function syncStaffAccounts(parsed: DatabaseSchema): void {
  const settings = parsed.settings;
  if (!settings) return;

  const existingList: StaffAccount[] = Array.isArray(parsed.staffAccounts)
    ? parsed.staffAccounts.filter((s) => Boolean(s && typeof s === 'object' && s.id && s.username))
    : [];

  const primaryDefinitions: Array<{
    id: string;
    role: AdminRole;
    username: string;
    rawPassword: string;
    defaultDisplayName: string;
  }> = [
    {
      id: 'staff-primary-super_admin',
      role: 'super_admin',
      username: settings.adminUsername || 'admin',
      rawPassword: settings.adminPassword || '123456',
      defaultDisplayName: 'إدارة النظام (المدير العام)',
    },
    {
      id: 'staff-primary-accountant',
      role: 'accountant',
      username: settings.accountantUsername || 'acc',
      rawPassword: settings.accountantPassword || '123456',
      defaultDisplayName: 'المحاسب المالي الرئيسي',
    },
    {
      id: 'staff-primary-cashier',
      role: 'cashier',
      username: settings.cashierUsername || 'cash',
      rawPassword: settings.cashierPassword || '123456',
      defaultDisplayName: 'كاشير نقطة البيع (أساسي)',
    },
    {
      id: 'staff-primary-supplier',
      role: 'supplier',
      username: settings.supplierUsername || 'sup',
      rawPassword: settings.supplierPassword || '123456',
      defaultDisplayName: 'مسؤول التوريد والمخزون الرئيسي',
    },
    {
      id: 'staff-primary-delivery_rider',
      role: 'delivery_rider',
      username: settings.riderUsername || 'rider',
      rawPassword: settings.riderPassword || '123456',
      defaultDisplayName: 'مندوب التوصيل الرئيسي',
    },
  ];

  const nowIso = new Date().toISOString();
  const primaryIds = new Set(primaryDefinitions.map((d) => d.id));
  const nextAccounts: StaffAccount[] = [];
  const usedUsernames = new Set<string>();

  for (const def of primaryDefinitions) {
    const existing =
      existingList.find((acc) => acc.id === def.id) ||
      existingList.find((acc) => acc.isPrimary && acc.role === def.role);

    const fp = computeSettingsFingerprint(def.rawPassword);
    const hasReusableHash =
      existing &&
      existing.settingsFingerprint === fp &&
      typeof existing.passwordHash === 'string' &&
      existing.passwordHash.startsWith('scrypt$');

    const passwordHash = hasReusableHash
      ? existing.passwordHash
      : getCachedPrimaryScryptHash(def.role, def.rawPassword, fp);

    const normalizedUsername = def.username.trim();
    usedUsernames.add(normalizedUsername.toLowerCase());

    nextAccounts.push({
      id: def.id,
      username: normalizedUsername,
      passwordHash,
      role: def.role,
      displayName: existing?.displayName?.trim() || def.defaultDisplayName,
      phone: existing?.phone,
      active: existing?.active !== false,
      isPrimary: true,
      notes: existing?.notes,
      settingsFingerprint: fp,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: existing?.updatedAt || nowIso,
      lastLoginAt: existing?.lastLoginAt,
    });
  }

  for (const acc of existingList) {
    if (primaryIds.has(acc.id) || acc.isPrimary) continue;
    const uname = String(acc.username || '').trim();
    if (!uname || usedUsernames.has(uname.toLowerCase())) continue;
    usedUsernames.add(uname.toLowerCase());

    nextAccounts.push({
      ...acc,
      username: uname,
      passwordHash: hashPasswordScrypt(acc.passwordHash || '123456'),
      active: acc.active !== false,
      isPrimary: false,
      displayName: acc.displayName?.trim() || uname,
      createdAt: acc.createdAt || nowIso,
    });
  }

  parsed.staffAccounts = nextAccounts;
}

export function normalizeDatabase(parsed: DatabaseSchema): DatabaseSchema {
  const alreadySeeded = parsed.isSeeded === true;
  const hasCanonicalCategories =
    Array.isArray(parsed.categories) &&
    parsed.categories.some((c) => c.id === 'cat-snacks') &&
    parsed.categories.some((c) => c.id === 'cat-coffee-espresso');

  if (!alreadySeeded && !hasCanonicalCategories) {
    parsed.categories = structuredClone(initialDatabase.categories);
    parsed.products = structuredClone(initialDatabase.products);
    parsed.settings = {
      ...structuredClone(initialDatabase.settings),
      adminUsername: parsed.settings?.adminUsername || 'admin',
      adminPassword: parsed.settings?.adminPassword || '123456',
      supplierUsername: parsed.settings?.supplierUsername || 'sup',
      supplierPassword: parsed.settings?.supplierPassword || '123456',
      cashierUsername: parsed.settings?.cashierUsername || 'cash',
      cashierPassword: parsed.settings?.cashierPassword || '123456',
      accountantUsername: parsed.settings?.accountantUsername || 'acc',
      accountantPassword: parsed.settings?.accountantPassword || '123456',
      riderUsername: parsed.settings?.riderUsername || 'rider',
      riderPassword: parsed.settings?.riderPassword || '123456',
    };
  }

  if (parsed.settings) {
    if (!alreadySeeded && parsed.settings.storeName === 'محمصة الواحة الذهبية') {
      parsed.settings = {
        ...structuredClone(initialDatabase.settings),
        adminUsername: parsed.settings.adminUsername || 'admin',
        adminPassword: parsed.settings.adminPassword || '123456',
        supplierUsername: parsed.settings.supplierUsername || 'sup',
        supplierPassword: parsed.settings.supplierPassword || '123456',
        cashierUsername: parsed.settings.cashierUsername || 'cash',
        cashierPassword: parsed.settings.cashierPassword || '123456',
        accountantUsername: parsed.settings.accountantUsername || 'acc',
        accountantPassword: parsed.settings.accountantPassword || '123456',
        riderUsername: parsed.settings.riderUsername || 'rider',
        riderPassword: parsed.settings.riderPassword || '123456',
      };
      parsed.categories = structuredClone(initialDatabase.categories);
      parsed.shippingRates = structuredClone(initialDatabase.shippingRates);
      parsed.coupons = structuredClone(initialDatabase.coupons);
    }
    parsed.settings.pageContent = getResolvedPageContent(parsed.settings);
    parsed.settings.themeConfig = getResolvedThemeConfig(parsed.settings);
    if (!parsed.settings.adminUsername || parsed.settings.adminUsername === 'admin_hafsa') {
      parsed.settings.adminUsername = 'admin';
    }
    if (
      !parsed.settings.adminPassword ||
      parsed.settings.adminPassword === 'admin' ||
      parsed.settings.adminPassword === 'Hafsa@Admin2026'
    ) {
      parsed.settings.adminPassword = '123456';
    }
    if (
      !parsed.settings.supplierUsername ||
      parsed.settings.supplierUsername === 'supplier' ||
      parsed.settings.supplierUsername === 'supplier_arafat'
    ) {
      parsed.settings.supplierUsername = 'sup';
    }
    if (
      !parsed.settings.supplierPassword ||
      parsed.settings.supplierPassword === 'supplier' ||
      parsed.settings.supplierPassword === 'Sup#Arafat2026'
    ) {
      parsed.settings.supplierPassword = '123456';
    }
    if (
      !parsed.settings.cashierUsername ||
      parsed.settings.cashierUsername === 'cashier' ||
      parsed.settings.cashierUsername === 'cashier_pos'
    ) {
      parsed.settings.cashierUsername = 'cash';
    }
    if (
      !parsed.settings.cashierPassword ||
      parsed.settings.cashierPassword === 'cashier' ||
      parsed.settings.cashierPassword === 'Cash#Pos2026'
    ) {
      parsed.settings.cashierPassword = '123456';
    }
    if (
      !parsed.settings.accountantUsername ||
      parsed.settings.accountantUsername === 'accountant' ||
      parsed.settings.accountantUsername === 'accountant_fin'
    ) {
      parsed.settings.accountantUsername = 'acc';
    }
    if (
      !parsed.settings.accountantPassword ||
      parsed.settings.accountantPassword === 'accountant' ||
      parsed.settings.accountantPassword === 'Acc#Fin2026'
    ) {
      parsed.settings.accountantPassword = '123456';
    }
    if (!parsed.settings.riderUsername || parsed.settings.riderUsername === 'rider_delivery') {
      parsed.settings.riderUsername = 'rider';
    }
    if (
      !parsed.settings.riderPassword ||
      parsed.settings.riderPassword === 'rider' ||
      parsed.settings.riderPassword === 'Rider#Hafsa2026'
    ) {
      parsed.settings.riderPassword = '123456';
    }
    delete (parsed.settings as any).customerUsername;
    delete (parsed.settings as any).customerPassword;
    delete (parsed.settings as any).managerPassword;
    delete (parsed.settings as any).promoPartnerPassword;
    delete (parsed.settings as any).wesamAdminPassword;
    if (typeof parsed.settings.vipCashbackPercent !== 'number') {
      parsed.settings.vipCashbackPercent = 5;
    }
    if (typeof parsed.settings.vipMinOrderForCashback !== 'number') {
      parsed.settings.vipMinOrderForCashback = 150;
    }
    if (typeof parsed.settings.villageMinOrderAmount !== 'number') {
      parsed.settings.villageMinOrderAmount = 200;
    }
    if (typeof parsed.settings.governoratesFreeShippingThreshold !== 'number') {
      parsed.settings.governoratesFreeShippingThreshold = 650;
    }
    if (typeof parsed.settings.enableTax !== 'boolean') {
      parsed.settings.enableTax = false;
    }
    if (typeof parsed.settings.taxRatePercent !== 'number') {
      parsed.settings.taxRatePercent = 14;
    }
    if (parsed.settings.taxPricingMode !== 'exclusive') {
      parsed.settings.taxPricingMode = 'inclusive';
    }
    if (typeof parsed.settings.enableCreditSales !== 'boolean') {
      parsed.settings.enableCreditSales = false;
    }
    if (typeof parsed.settings.creditSalesRequireApproval !== 'boolean') {
      parsed.settings.creditSalesRequireApproval = true;
    }
    if (!Array.isArray(parsed.settings.posRegisters) || parsed.settings.posRegisters.length === 0) {
      parsed.settings.posRegisters = [
        { id: 'reg-1', name: 'ماكينة كاشير 1 (الرئيسية)', active: true },
        { id: 'reg-2', name: 'ماكينة كاشير 2 (الفرعية)', active: true },
      ];
    }
    if (Array.isArray(parsed.settings.bandarZones)) {
      parsed.settings.bandarZones = getResolvedBandarZones(parsed.settings);
    }
    if (Array.isArray(parsed.settings.villageZones)) {
      parsed.settings.villageZones = getResolvedVillageZones(parsed.settings);
    }
    if (Array.isArray(parsed.settings.deliveryBatches)) {
      parsed.settings.deliveryBatches = getResolvedDeliveryBatches(parsed.settings);
    }
  }

  if (!Array.isArray(parsed.categories)) {
    parsed.categories = alreadySeeded ? [] : structuredClone(initialDatabase.categories);
  } else if (!alreadySeeded && parsed.categories.length < 6) {
    parsed.categories = structuredClone(initialDatabase.categories);
  }

  if (!Array.isArray(parsed.products)) {
    parsed.products = alreadySeeded ? [] : structuredClone(initialDatabase.products);
  } else if (!alreadySeeded && parsed.products.length < 20) {
    parsed.products = structuredClone(initialDatabase.products);
  }

  if (!Array.isArray(parsed.vipMembers)) {
    parsed.vipMembers = structuredClone(initialDatabase.vipMembers || []);
  }
  if (!Array.isArray(parsed.promotions) || (!alreadySeeded && parsed.promotions.length === 0)) {
    parsed.promotions = alreadySeeded
      ? (Array.isArray(parsed.promotions) ? parsed.promotions : [])
      : structuredClone(initialDatabase.promotions || []);
  }
  const seedDemoPromoIds = new Set([
    'promo-thursday-bundle',
    'promo-roqan-coffee',
    'promo-vip-secret-1',
  ]);
  const allowSeedPromoExtend = process.env.MIZAN_DISABLE_DEMO_PROMO_EXTEND !== '1';
  if (allowSeedPromoExtend) {
    for (const promo of parsed.promotions) {
      if (
        seedDemoPromoIds.has(promo.id) &&
        promo.active !== false &&
        promo.endsAt &&
        Date.parse(promo.endsAt) < Date.now()
      ) {
        promo.endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
    }
  }
  if (!Array.isArray(parsed.flashPromotions) || (!alreadySeeded && parsed.flashPromotions.length === 0)) {
    parsed.flashPromotions = structuredClone(parsed.promotions);
  } else if (allowSeedPromoExtend) {
    for (const promo of parsed.flashPromotions) {
      if (
        seedDemoPromoIds.has(promo.id) &&
        promo.active !== false &&
        promo.endsAt &&
        Date.parse(promo.endsAt) < Date.now()
      ) {
        promo.endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
    }
  }
  if (!Array.isArray(parsed.posShifts)) {
    parsed.posShifts = structuredClone(initialDatabase.posShifts || []);
  }
  if (!Array.isArray(parsed.posExpenses)) {
    parsed.posExpenses = structuredClone(initialDatabase.posExpenses || []);
  }
  if (!Array.isArray(parsed.posReturns)) {
    parsed.posReturns = [];
  }
  if (!Array.isArray(parsed.supplyInvoices)) {
    parsed.supplyInvoices = structuredClone(initialDatabase.supplyInvoices || []);
  }
  if (!Array.isArray(parsed.supplierPayments)) {
    parsed.supplierPayments = [];
  }
  if (!Array.isArray(parsed.supplyReturns)) {
    parsed.supplyReturns = [];
  }
  if (!Array.isArray(parsed.treasuryTransactions)) {
    parsed.treasuryTransactions = [];
  }
  if (!Array.isArray(parsed.inventoryAdjustments)) {
    parsed.inventoryAdjustments = [];
  }
  if (!Array.isArray(parsed.auditLogs)) {
    parsed.auditLogs = [];
  }
  if (!Array.isArray(parsed.warehouses) || parsed.warehouses.length === 0) {
    parsed.warehouses = [
      { id: 'wh-pos', code: 'WH-POS', name: 'صالة العرض وبار البيع', isPosBranch: true, active: true },
      { id: 'wh-main', code: 'WH-MAIN', name: 'المخزن الرئيسي (التوريد)', isMainStore: true, active: true },
    ];
  }
  if (!Array.isArray(parsed.warehouseTransfers)) {
    parsed.warehouseTransfers = [];
  }
  if (!Array.isArray(parsed.bomRecipes)) {
    parsed.bomRecipes = [];
  }
  if (!Array.isArray(parsed.prepMethods) || parsed.prepMethods.length === 0) {
    parsed.prepMethods = [
      { id: 'pm-1', name: 'تحميص فاتح', groupName: 'درجة التحميص', extraPrice: 0, active: true },
      { id: 'pm-2', name: 'تحميص وسط', groupName: 'درجة التحميص', extraPrice: 0, active: true },
      { id: 'pm-3', name: 'تحميص غامق', groupName: 'درجة التحميص', extraPrice: 0, active: true },
      { id: 'pm-4', name: 'سادة صافي', groupName: 'التحويج', extraPrice: 0, active: true },
      { id: 'pm-5', name: 'محوج مخصوص (حبهان ومستكة)', groupName: 'التحويج', extraPrice: 15, active: true },
      { id: 'pm-6', name: 'طحن ناعم (تركي)', groupName: 'درجة الطحن', extraPrice: 0, active: true },
      { id: 'pm-7', name: 'محمص مملح', groupName: 'المكسرات واللب', extraPrice: 0, active: true },
      { id: 'pm-8', name: 'بدون ملح (صحي)', groupName: 'المكسرات واللب', extraPrice: 0, active: true },
    ];
  }
  if (!Array.isArray(parsed.productAddons) || parsed.productAddons.length === 0) {
    parsed.productAddons = [
      { id: 'ad-1', name: 'حبهان أخضر إضافي', extraPrice: 15, extraCost: 8, active: true },
      { id: 'ad-2', name: 'مستكة وقرنفل', extraPrice: 10, extraCost: 5, active: true },
      { id: 'ad-3', name: 'شوت إسبريسو إضافي', extraPrice: 15, extraCost: 6, active: true },
      { id: 'ad-4', name: 'تغليف هدايا فاخر وكارت إهداء', extraPrice: 25, extraCost: 12, active: true },
    ];
  }
  if (!Array.isArray(parsed.deliveryCompanies)) {
    parsed.deliveryCompanies = [
      { id: 'dc-1', name: 'توصيل الفرع المباشر', commissionPercent: 0, active: true },
    ];
  }
  if (!Array.isArray(parsed.employees)) {
    parsed.employees = [];
  }
  if (!Array.isArray(parsed.diningHalls) || parsed.diningHalls.length === 0) {
    parsed.diningHalls = [
      {
        id: 'hall-bar',
        name: 'بار القهوة والزجاج',
        active: true,
        tables: [
          { id: 'tbl-1', name: 'كرسي / طاولة 1', capacity: 2, active: true },
          { id: 'tbl-2', name: 'كرسي / طاولة 2', capacity: 2, active: true },
          { id: 'tbl-3', name: 'كرسي / طاولة 3', capacity: 2, active: true },
          { id: 'tbl-4', name: 'كرسي / طاولة 4', capacity: 2, active: true },
        ],
      },
    ];
  }
  if (!Array.isArray(parsed.expenseCategories) || parsed.expenseCategories.length === 0) {
    parsed.expenseCategories = [
      { id: 'ec-1', key: 'raw_materials', label: 'خامات وتوريدات', active: true },
      { id: 'ec-2', key: 'packaging', label: 'أكياس وعبوات تغليف', active: true },
      { id: 'ec-3', key: 'utilities', label: 'كهرباء ومرافق وغاز', active: true },
      { id: 'ec-4', key: 'delivery_rider', label: 'طيارين وتوصيل طلبات', active: true },
      { id: 'ec-5', key: 'other', label: 'مصروفات تشغيلية أخرى', active: true },
    ];
  }
  parsed.isSeeded = true;

  if (Array.isArray(parsed.orders)) {
    for (const order of parsed.orders) {
      if ((order.status as string) === 'preparing') {
        order.status = 'roasting_packing';
      } else if (
        !order.status ||
        ![
          'pending',
          'confirmed',
          'roasting_packing',
          'shipped',
          'delivered',
          'cancelled',
        ].includes(order.status)
      ) {
        order.status = 'pending';
      }
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          item.productImage = getSafeImageUrl(item.productImage);
          if (Array.isArray(item.customBreakdown)) {
            for (const part of item.customBreakdown) {
              part.productImage = getSafeImageUrl(part.productImage);
            }
          }
        }
      }
    }
  }

  if (Array.isArray(parsed.products)) {
    for (const prod of parsed.products) {
      prod.image = getSafeImageUrl(prod.image);
      prod.showOnline = prod.showOnline !== false;
      prod.showInPos = prod.showInPos !== false;
      prod.stockKg = typeof prod.stockKg === 'number' ? prod.stockKg : 50;
      prod.packagingCost = typeof prod.packagingCost === 'number' ? prod.packagingCost : 5;
      if (typeof prod.inStock !== 'boolean') {
        prod.inStock = prod.stockKg > 0;
      }
      if (prod.sellingMode === 'unit') {
        const uLabel = prod.unitLabel?.trim() || 'قطعة';
        const uPrice =
          typeof prod.unitPrice === 'number' && prod.unitPrice > 0
            ? prod.unitPrice
            : prod.pricePerKg || prod.weights?.[0]?.price || 100;
        const uCost =
          typeof prod.unitCost === 'number' && prod.unitCost >= 0
            ? prod.unitCost
            : prod.costPerKg || Math.round(uPrice * 0.72);
        prod.unitLabel = uLabel;
        prod.unitPrice = uPrice;
        prod.unitCost = uCost;
        prod.pricePerKg = uPrice;
        prod.costPerKg = uCost;
        if (!Array.isArray(prod.weights) || prod.weights.length === 0) {
          prod.weights = [
            {
              id: 'u-1',
              label: uLabel,
              unitsCount: 1,
              weightGrams: 1000,
              grams: 1000,
              price: uPrice,
            },
          ];
        }
      } else if (
        Array.isArray(prod.weights) &&
        !prod.weights.some((w) => (w.weightGrams || w.grams) === 125)
      ) {
        const w1000 = prod.weights.find(
          (w) => (w.weightGrams || w.grams) === 1000
        );
        const w250 = prod.weights.find(
          (w) => (w.weightGrams || w.grams) === 250
        );
        const w125Price = w1000
          ? Math.round(w1000.price * 0.125)
          : w250
            ? Math.round(w250.price * 0.5)
            : 50;
        prod.weights.unshift({
          id: 'w-125',
          label: 'ثمن كيلو (125 جم)',
          grams: 125,
          weightGrams: 125,
          price: w125Price,
        });
      }
    }
  }

  if (Array.isArray(parsed.categories)) {
    for (const cat of parsed.categories) {
      cat.image = getSafeImageUrl(cat.image);
    }
  }

  syncStaffAccounts(parsed);

  return parsed;
}

function readLocalFileWithMtimeCache(filePath: string): DatabaseSchema {
  const st = fs.statSync(filePath, { bigint: true });
  if (
    globalThis.__newNutsLocalCleanSnapshot &&
    globalThis.__newNutsLocalFileMtimeNs === st.mtimeNs &&
    globalThis.__newNutsLocalFileSize === st.size
  ) {
    const cloned = structuredClone(globalThis.__newNutsLocalCleanSnapshot);
    globalThis.__newNutsMemoryDb = cloned;
    return cloned;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = normalizeDatabase(JSON.parse(raw) as DatabaseSchema);
  globalThis.__newNutsLocalCleanSnapshot = structuredClone(parsed);
  globalThis.__newNutsLocalFileMtimeNs = st.mtimeNs;
  globalThis.__newNutsLocalFileSize = st.size;
  globalThis.__newNutsMemoryDb = parsed;
  return parsed;
}

function ensureDbFile(): DatabaseSchema {
  try {
    if (getPostgresUrl() && globalThis.__newNutsMemoryDb) {
      return globalThis.__newNutsMemoryDb;
    }

    if (process.env.VERCEL && fs.existsSync(TMP_DB_PATH)) {
      return readLocalFileWithMtimeCache(TMP_DB_PATH);
    }

    if (fs.existsSync(DB_PATH)) {
      return readLocalFileWithMtimeCache(DB_PATH);
    }

    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const seeded = normalizeDatabase(structuredClone(initialDatabase));
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(seeded, null, 2),
      'utf-8'
    );
    try {
      const st = fs.statSync(DB_PATH, { bigint: true });
      globalThis.__newNutsLocalCleanSnapshot = structuredClone(seeded);
      globalThis.__newNutsLocalFileMtimeNs = st.mtimeNs;
      globalThis.__newNutsLocalFileSize = st.size;
    } catch {}
    globalThis.__newNutsMemoryDb = seeded;
    return seeded;
  } catch (err) {
    if (globalThis.__newNutsMemoryDb) {
      return globalThis.__newNutsMemoryDb;
    }
    try {
      if (fs.existsSync(TMP_DB_PATH)) {
        return readLocalFileWithMtimeCache(TMP_DB_PATH);
      }
    } catch {
      // Ignore /tmp read error
    }
    console.error('Database read fallback to memory:', err);
    return normalizeDatabase(structuredClone(initialDatabase));
  }
}

export function getDb(): DatabaseSchema {
  return ensureDbFile();
}

export function saveDb(data: DatabaseSchema): void {
  const normalized = normalizeDatabase(data);
  globalThis.__newNutsMemoryDb = normalized;
  globalThis.__newNutsPgCacheTs = 0;
  const serialized = JSON.stringify(normalized, null, 2);

  try {
    if (!process.env.VERCEL) {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, serialized, 'utf-8');
      try {
        const st = fs.statSync(DB_PATH, { bigint: true });
        globalThis.__newNutsLocalCleanSnapshot = structuredClone(normalized);
        globalThis.__newNutsLocalFileMtimeNs = st.mtimeNs;
        globalThis.__newNutsLocalFileSize = st.size;
      } catch {}
      return;
    }
  } catch {
    // Fall through to /tmp write on read-only filesystem
  }

  try {
    fs.writeFileSync(TMP_DB_PATH, serialized, 'utf-8');
    try {
      const st = fs.statSync(TMP_DB_PATH, { bigint: true });
      globalThis.__newNutsLocalCleanSnapshot = structuredClone(normalized);
      globalThis.__newNutsLocalFileMtimeNs = st.mtimeNs;
      globalThis.__newNutsLocalFileSize = st.size;
    } catch {}
  } catch (err) {
    console.error('Failed to write database file to /tmp:', err);
  }
}

function isErrorHttpResponse(val: unknown): boolean {
  if (typeof Response !== 'undefined' && val instanceof Response && val.status >= 400) {
    return true;
  }
  if (
    val &&
    typeof val === 'object' &&
    typeof (val as { status?: unknown }).status === 'number' &&
    ((val as { status: number }).status >= 400)
  ) {
    return true;
  }
  return false;
}

async function fetchPostgresStateOnce(pgUrl: string): Promise<DatabaseSchema> {
  const sql = neon(pgUrl);

  let rows: Record<string, any>[];
  try {
    if (globalThis.__newNutsHydrationVerified) {
      rows = await sql`
        SELECT data, version
        FROM store_state
        WHERE id = 'main'
        LIMIT 1
      `;
    } else {
      rows = await sql`
        SELECT
          data,
          version,
          (SELECT COUNT(*)::int FROM products) AS prod_count,
          (SELECT COUNT(*)::int FROM staff_accounts) AS staff_count
        FROM store_state
        WHERE id = 'main'
        LIMIT 1
      `;
    }
  } catch (readErr) {
    if (isMissingRelationError(readErr)) {
      globalThis.__newNutsRelationalSchemaReady = false;
      await ensurePostgresSchema();
      rows = [];
    } else {
      throw readErr;
    }
  }

  if (Array.isArray(rows) && rows.length > 0 && rows[0]?.data) {
    globalThis.__newNutsRelationalSchemaReady = true;
    const parsed =
      typeof rows[0].data === 'string'
        ? (JSON.parse(rows[0].data) as DatabaseSchema)
        : (rows[0].data as DatabaseSchema);
    const hadCanonical =
      Array.isArray(parsed.categories) &&
      parsed.categories.some((c) => c.id === 'cat-snacks') &&
      Boolean(parsed.settings?.adminUsername) &&
      parsed.settings?.adminPassword !== 'admin' &&
      parsed.settings?.adminPassword !== 'Hafsa@Admin2026';

    const normalized = normalizeDatabase(parsed);

    if (!globalThis.__newNutsHydrationVerified) {
      const needsRelationalHydration =
        !hadCanonical ||
        Number(rows[0].prod_count) === 0 ||
        Number(rows[0].staff_count) === 0;

      if (needsRelationalHydration) {
        const currentVersion = Number(rows[0].version) || 1;
        await syncAllRelationalTablesHttp(pgUrl, normalized, currentVersion);
      }
      globalThis.__newNutsHydrationVerified = true;
    }

    const cleanSnapshot = structuredClone(normalized);
    globalThis.__newNutsMemoryDb = cleanSnapshot;
    globalThis.__newNutsLastPersistedDb = structuredClone(normalized);
    globalThis.__newNutsPgCacheTs = Date.now();
    return normalized;
  }

  await ensurePostgresSchema();
  const seed = ensureDbFile();
  await syncAllRelationalTablesHttp(pgUrl, seed, 1);
  globalThis.__newNutsHydrationVerified = true;
  globalThis.__newNutsMemoryDb = structuredClone(seed);
  globalThis.__newNutsLastPersistedDb = structuredClone(seed);
  globalThis.__newNutsPgCacheTs = Date.now();
  return seed;
}

export async function getDbAsync(): Promise<DatabaseSchema> {
  const pgUrl = getPostgresUrl();
  if (!pgUrl) {
    return getDb();
  }

  if (
    globalThis.__newNutsMemoryDb &&
    globalThis.__newNutsPgCacheTs &&
    Date.now() - globalThis.__newNutsPgCacheTs < PG_READ_CACHE_TTL_MS
  ) {
    return structuredClone(globalThis.__newNutsMemoryDb);
  }

  if (globalThis.__newNutsPgInFlightRead) {
    const shared = await globalThis.__newNutsPgInFlightRead;
    return structuredClone(shared);
  }

  const inFlight = fetchPostgresStateOnce(pgUrl);
  globalThis.__newNutsPgInFlightRead = inFlight;

  try {
    const db = await inFlight;
    return structuredClone(db);
  } catch (err) {
    console.error('Neon Postgres read error, falling back to local/tmp DB:', err);
    return getDb();
  } finally {
    globalThis.__newNutsPgInFlightRead = undefined;
  }
}

async function persistDbUnlocked(data: DatabaseSchema): Promise<void> {
  const prevPersisted = globalThis.__newNutsLastPersistedDb;
  const normalized = normalizeDatabase(data);
  saveDb(normalized);

  const pgUrl = getPostgresUrl();
  if (!pgUrl) {
    globalThis.__newNutsLastPersistedDb = structuredClone(normalized);
    return;
  }

  try {
    const sql = neon(pgUrl);
    let rows: Record<string, any>[];
    try {
      rows = await sql`SELECT version FROM store_state WHERE id = 'main' LIMIT 1`;
    } catch (readErr) {
      if (isMissingRelationError(readErr)) {
        globalThis.__newNutsRelationalSchemaReady = false;
        await ensurePostgresSchema();
        rows = [];
      } else {
        throw readErr;
      }
    }
    const nextVersion = (Number(rows?.[0]?.version) || 0) + 1;
    await syncAllRelationalTablesHttp(
      pgUrl,
      normalized,
      nextVersion,
      undefined,
      rows.length > 0 ? prevPersisted : undefined
    );
    const clean = structuredClone(normalized);
    globalThis.__newNutsMemoryDb = clean;
    globalThis.__newNutsLastPersistedDb = structuredClone(normalized);
    globalThis.__newNutsPgCacheTs = Date.now();
  } catch (err) {
    globalThis.__newNutsPgCacheTs = 0;
    console.error('Failed to persist store state & relational tables to Neon Postgres:', err);
  }
}

export async function saveDbAsync(data: DatabaseSchema): Promise<void> {
  const previousLock = globalThis.__newNutsWriteMutex || Promise.resolve();
  const nextWrite = previousLock.catch(() => {}).then(async () => {
    await persistDbUnlocked(data);
  });
  globalThis.__newNutsWriteMutex = nextWrite;
  await nextWrite;
}

export async function withDbTransaction<T>(
  mutator: (db: DatabaseSchema) => Promise<T> | T
): Promise<T> {
  const previousLock = globalThis.__newNutsWriteMutex || Promise.resolve();
  let result!: T;

  const txPromise = previousLock.catch(() => {}).then(async () => {
    const pgUrl = getPostgresUrl();
    globalThis.__newNutsPgCacheTs = 0;

    if (pgUrl) {
      try {
        const outcome = await executeAtomicPostgresTransaction<T>(
          pgUrl,
          normalizeDatabase,
          () => ensureDbFile(),
          mutator,
          isErrorHttpResponse
        );
        result = outcome.result;
        if (outcome.committedDb) {
          saveDb(outcome.committedDb);
          globalThis.__newNutsMemoryDb = structuredClone(outcome.committedDb);
          globalThis.__newNutsLastPersistedDb = structuredClone(outcome.committedDb);
          globalThis.__newNutsPgCacheTs = Date.now();
        } else {
          globalThis.__newNutsMemoryDb = undefined;
          globalThis.__newNutsPgCacheTs = 0;
        }
        return;
      } catch (err) {
        globalThis.__newNutsMemoryDb = undefined;
        globalThis.__newNutsPgCacheTs = 0;
        throw err;
      }
    }

    // Local JSON atomic mutex transaction with full rollback on error/4xx/5xx
    const db = await getDbAsync();
    try {
      result = await mutator(db);
      if (!isErrorHttpResponse(result)) {
        await persistDbUnlocked(db);
      } else {
        globalThis.__newNutsMemoryDb = undefined;
        globalThis.__newNutsLocalCleanSnapshot = undefined;
      }
    } catch (err) {
      globalThis.__newNutsMemoryDb = undefined;
      globalThis.__newNutsLocalCleanSnapshot = undefined;
      throw err;
    }
  });

  globalThis.__newNutsWriteMutex = txPromise;
  await txPromise;
  return result;
}
