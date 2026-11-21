import type { Category, Product, ProductSellingMode } from '@/types/store';
import { escapeCsvField } from '@/lib/csv';
import {
  generateWeightsFromKiloPrice,
  isUnitProduct,
  normalizeBarcodeScanInput,
} from '@/lib/pricing';
import { getSafeImageUrl } from '@/lib/defaults';

export const CATALOG_CSV_HEADERS = [
  'الباركود',
  'اسم الصنف',
  'القسم',
  'نوع البيع',
  'سعر البيع',
  'سعر التكلفة',
  'الرصيد المتاح',
  'وحدة البيع',
  'متاح كاشير',
  'متاح أونلاين',
] as const;

function makeProductSlug(name: string, barcode: string): string {
  const cleanBarcode = barcode.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
    .slice(0, 40);
  const suffix = cleanBarcode || String(Date.now()).slice(-6);
  return `${base || 'item'}-${suffix}`;
}

export interface RapidScanUpsertInput {
  barcode: string;
  name: string;
  categoryId: string;
  sellingMode: ProductSellingMode;
  retailPrice: number;
  costPrice: number;
  stockQty: number;
  unitLabel?: string;
  showInPos?: boolean;
  showOnline?: boolean;
  stockOperation?: 'set' | 'increment';
}

export function upsertRapidScannedProduct(
  input: RapidScanUpsertInput,
  existingProducts: Product[],
  categories: Category[]
): {
  nextProducts: Product[];
  product: Product;
  isUpdate: boolean;
} {
  const cleanBarcode = normalizeBarcodeScanInput(input.barcode || '').trim();
  const cleanName = (input.name || '').trim();
  const safeRetail = Math.max(1, Math.round(Number(input.retailPrice) * 100) / 100 || 1);
  const safeCost = Math.max(
    0,
    Math.round((Number(input.costPrice) >= 0 ? Number(input.costPrice) : safeRetail * 0.75) * 100) /
      100
  );
  const safeStockInput = Math.max(0, Math.round((Number(input.stockQty) || 0) * 1000) / 1000);
  const sellingMode: ProductSellingMode = input.sellingMode === 'weight' ? 'weight' : 'unit';
  const unitLabel = (input.unitLabel || 'قطعة').trim() || 'قطعة';
  const fallbackCategoryId = categories[0]?.id || 'cat-general';
  const resolvedCategoryId =
    categories.some((c) => c.id === input.categoryId) ? input.categoryId : fallbackCategoryId;

  const existingIdx = existingProducts.findIndex((p) => {
    if (cleanBarcode && p.barcode && normalizeBarcodeScanInput(p.barcode) === cleanBarcode) {
      return true;
    }
    if (!cleanBarcode && cleanName && p.name.trim() === cleanName) {
      return true;
    }
    return false;
  });

  const buildWeights = (mode: ProductSellingMode, price: number, uLabel: string) => {
    if (mode === 'unit') {
      return [
        {
          id: 'u-1',
          label: uLabel,
          weightGrams: 1000,
          grams: 1000,
          unitsCount: 1,
          price,
        },
      ];
    }
    return generateWeightsFromKiloPrice(price);
  };

  if (existingIdx !== -1) {
    const prev = existingProducts[existingIdx];
    const nextStock =
      input.stockOperation === 'increment'
        ? Math.round(((typeof prev.stockKg === 'number' ? prev.stockKg : 0) + safeStockInput) * 1000) /
          1000
        : safeStockInput;

    const updated: Product = {
      ...prev,
      name: cleanName || prev.name,
      barcode: cleanBarcode || prev.barcode,
      categoryId: input.categoryId ? resolvedCategoryId : prev.categoryId,
      sellingMode,
      unitLabel: sellingMode === 'unit' ? unitLabel : prev.unitLabel,
      unitPrice: sellingMode === 'unit' ? safeRetail : undefined,
      unitCost: sellingMode === 'unit' ? safeCost : undefined,
      pricePerKg: safeRetail,
      costPerKg: safeCost,
      weights: buildWeights(sellingMode, safeRetail, unitLabel),
      stockKg: nextStock,
      inStock: nextStock > 0,
      showInPos: input.showInPos ?? prev.showInPos ?? true,
      showOnline: input.showOnline ?? prev.showOnline ?? true,
    };

    const nextProducts = [...existingProducts];
    nextProducts[existingIdx] = updated;
    return { nextProducts, product: updated, isUpdate: true };
  }

  const newId = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const created: Product = {
    id: newId,
    slug: makeProductSlug(cleanName || 'صنف-جديد', cleanBarcode),
    name: cleanName || `صنف ${cleanBarcode}`,
    subtitle: sellingMode === 'unit' ? `يباع بـ ${unitLabel}` : 'يباع بالوزن الطازج',
    categoryId: resolvedCategoryId,
    description: cleanName || `صنف مسجل بالباركود ${cleanBarcode}`,
    image: getSafeImageUrl(''),
    origin: 'الفرع الرئيسي',
    nutritionalHighlight: 'جودة مضمونة',
    caloriesPer100g: 0,
    proteinPer100g: '0g',
    roastOptions: ['سادة'],
    sellingMode,
    unitLabel: sellingMode === 'unit' ? unitLabel : undefined,
    unitPrice: sellingMode === 'unit' ? safeRetail : undefined,
    unitCost: sellingMode === 'unit' ? safeCost : undefined,
    pricePerKg: safeRetail,
    costPerKg: safeCost,
    weights: buildWeights(sellingMode, safeRetail, unitLabel),
    stockKg: safeStockInput,
    inStock: safeStockInput > 0,
    showInPos: input.showInPos ?? true,
    showOnline: input.showOnline ?? true,
    barcode: cleanBarcode || undefined,
    featured: false,
    rating: 5,
    reviewsCount: 0,
  };

  return {
    nextProducts: [created, ...existingProducts],
    product: created,
    isUpdate: false,
  };
}

/**
 * Exports all catalog products to an Excel-compatible UTF-8 BOM CSV file.
 */
export function generateCatalogProductsCsv(
  products: Product[],
  categories: Category[]
): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const headerLine = CATALOG_CSV_HEADERS.map(escapeCsvField).join(',');
  const rows = (products || []).map((p) => {
    const unitMode = isUnitProduct(p);
    const retail = unitMode
      ? p.unitPrice ?? p.weights?.[0]?.price ?? p.pricePerKg ?? 0
      : p.pricePerKg ?? p.weights?.find((w) => w.weightGrams === 1000)?.price ?? 0;
    const cost = unitMode ? p.unitCost ?? p.costPerKg ?? 0 : p.costPerKg ?? 0;
    const stock = typeof p.stockKg === 'number' ? p.stockKg : p.inStock ? 50 : 0;

    return [
      p.barcode || '',
      p.name,
      catMap.get(p.categoryId) || p.categoryId,
      unitMode ? 'قطعة' : 'وزن',
      retail,
      cost,
      stock,
      unitMode ? p.unitLabel || 'قطعة' : 'كجم',
      p.showInPos === false ? 'لا' : 'نعم',
      p.showOnline === false ? 'لا' : 'نعم',
    ]
      .map(escapeCsvField)
      .join(',');
  });

  return '\uFEFF' + [headerLine, ...rows].join('\r\n');
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === ';') {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Imports & merges an Excel/CSV catalog into the existing product list.
 */
export function parseCatalogProductsCsv(
  csvText: string,
  existingProducts: Product[],
  categories: Category[]
): {
  mergedProducts: Product[];
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
} {
  const cleanText = (csvText || '').replace(/^\uFEFF/, '').trim();
  if (!cleanText) {
    return {
      mergedProducts: existingProducts,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
    };
  }

  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      mergedProducts: existingProducts,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
    };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const findCol = (candidates: string[], fallbackIdx: number) => {
    for (const c of candidates) {
      const exactIdx = headers.findIndex((h) => h === c);
      if (exactIdx !== -1) return exactIdx;
    }
    for (const c of candidates) {
      const partialIdx = headers.findIndex((h) => h.includes(c));
      if (partialIdx !== -1) return partialIdx;
    }
    return fallbackIdx;
  };

  const colBarcode = findCol(['الباركود', 'باركود', 'barcode', 'كود', 'sku'], 0);
  const colName = findCol(['اسم الصنف', 'اسم المنتج', 'الصنف', 'اسم', 'name'], 1);
  const colCategory = findCol(['القسم', 'قسم', 'category', 'تصنيف'], 2);
  const colMode = findCol(['نوع البيع', 'طريقة البيع', 'selling_mode', 'mode', 'نوع'], 3);
  const colPrice = findCol(['سعر البيع', 'سعر بيع', 'retail_price', 'price', 'سعر الجمهور'], 4);
  const colCost = findCol(['سعر التكلفة', 'تكلفة', 'شراء', 'جملة', 'cost'], 5);
  const colStock = findCol(['الرصيد المتاح', 'رصيد', 'مخزون', 'كمية', 'stock', 'qty'], 6);
  const colUnit = findCol(['وحدة البيع', 'وحدة', 'unit'], 7);
  const colPos = findCol(['متاح كاشير', 'كاشير', 'pos'], 8);
  const colOnline = findCol(['متاح أونلاين', 'أونلاين', 'اونلاين', 'online'], 9);

  let workingProducts = [...existingProducts];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let r = 1; r < lines.length; r++) {
    const cols = splitCsvLine(lines[r]);
    const rawBarcode = normalizeBarcodeScanInput(cols[colBarcode] || '');
    const rawName = (cols[colName] || '').trim();
    const rawPrice = Number(normalizeBarcodeScanInput(cols[colPrice] || '0'));

    if ((!rawName && !rawBarcode) || !Number.isFinite(rawPrice) || rawPrice <= 0) {
      skippedCount++;
      continue;
    }

    const rawCat = (cols[colCategory] || '').trim();
    const matchedCat =
      categories.find(
        (c) =>
          c.id === rawCat ||
          c.name.trim() === rawCat ||
          c.name.includes(rawCat)
      ) || categories[0];

    const rawMode = (cols[colMode] || '').trim().toLowerCase();
    const isWeight =
      rawMode.includes('وزن') ||
      rawMode.includes('كيلو') ||
      rawMode === 'weight' ||
      /^(20|21|22)\d{4}$/.test(rawBarcode);

    const rawCost = Number(normalizeBarcodeScanInput(cols[colCost] || ''));
    const rawStock = Number(normalizeBarcodeScanInput(cols[colStock] || '0'));
    const rawUnit = (cols[colUnit] || 'قطعة').trim();
    const rawPos = (cols[colPos] || 'نعم').trim().toLowerCase();
    const rawOnline = (cols[colOnline] || 'نعم').trim().toLowerCase();

    const res = upsertRapidScannedProduct(
      {
        barcode: rawBarcode,
        name: rawName,
        categoryId: matchedCat?.id || 'cat-general',
        sellingMode: isWeight ? 'weight' : 'unit',
        retailPrice: rawPrice,
        costPrice: Number.isFinite(rawCost) && rawCost >= 0 ? rawCost : Math.round(rawPrice * 0.75 * 100) / 100,
        stockQty: Number.isFinite(rawStock) && rawStock >= 0 ? rawStock : 20,
        unitLabel: isWeight ? 'كجم' : rawUnit || 'قطعة',
        showInPos: !(rawPos === 'لا' || rawPos === 'false' || rawPos === '0' || rawPos === 'no'),
        showOnline: !(rawOnline === 'لا' || rawOnline === 'false' || rawOnline === '0' || rawOnline === 'no'),
        stockOperation: 'set',
      },
      workingProducts,
      categories
    );

    workingProducts = res.nextProducts;
    if (res.isUpdate) updatedCount++;
    else createdCount++;
  }

  return {
    mergedProducts: workingProducts,
    createdCount,
    updatedCount,
    skippedCount,
  };
}
