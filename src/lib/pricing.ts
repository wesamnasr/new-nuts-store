import {
  Product,
  RoastOption,
  CustomMixItem,
  WeightVariant,
  BoxSlotSelection,
  CustomCoffeeBlendSpec,
  FlashPromotionItem,
  PartitionedBoxSize,
  CoffeeRoastLevel,
  CoffeeSpicingOption,
  CoffeeGrindType,
  WeightGrams,
} from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';

export interface CustomBoxCalculationResult {
  isValid: boolean;
  totalPrice: number;
  totalPercentage: number;
  breakdown: CustomMixItem[];
  error?: string;
}

/**
 * Dynamic Weight-to-Price Engine (محرك تحويل الأوزان والأسعار اللحظي - البند رابعاً.1):
 * Input: Kilo price only (matching Arafat's Excel sheet).
 * Automatically computes:
 * - 125g (ثمن كيلو) = 12.5%
 * - 250g (ربع كيلو) = 25%
 * - 500g (نصف كيلو) = 50%
 * - 1000g (كيلو كامل) = 100%
 */
export function generateWeightsFromKiloPrice(
  pricePerKg: number,
  originalPricePerKg?: number,
  include2000g: boolean = false
): WeightVariant[] {
  const safeKilo = Math.max(0, Number(pricePerKg) || 0);
  const safeOrig =
    originalPricePerKg && originalPricePerKg > safeKilo
      ? Number(originalPricePerKg)
      : undefined;

  const variants: WeightVariant[] = [
    {
      id: 'w-125',
      label: 'ثمن 125 جم',
      weightGrams: 125,
      grams: 125,
      price: Math.round(safeKilo * 0.125),
      originalPrice: safeOrig ? Math.round(safeOrig * 0.125) : undefined,
    },
    {
      id: 'w-250',
      label: 'ربع 250 جم',
      weightGrams: 250,
      grams: 250,
      price: Math.round(safeKilo * 0.25),
      originalPrice: safeOrig ? Math.round(safeOrig * 0.25) : undefined,
    },
    {
      id: 'w-500',
      label: 'نصف 500 جم',
      weightGrams: 500,
      grams: 500,
      price: Math.round(safeKilo * 0.5),
      originalPrice: safeOrig ? Math.round(safeOrig * 0.5) : undefined,
    },
    {
      id: 'w-1000',
      label: 'كيلو 1000 جم',
      weightGrams: 1000,
      grams: 1000,
      price: Math.round(safeKilo),
      originalPrice: safeOrig ? Math.round(safeOrig) : undefined,
    },
  ];

  if (include2000g) {
    variants.push({
      id: 'w-2000',
      label: '2 كجم (2000 جم)',
      weightGrams: 2000,
      grams: 2000,
      price: Math.round(safeKilo * 2),
      originalPrice: safeOrig ? Math.round(safeOrig * 2) : undefined,
    });
  }

  return variants;
}

/**
 * Returns all 5 weight variants (including 2000g / 2kg bulk variant) for a product.
 */
export function generate5WeightsFromKiloPrice(
  pricePerKg: number,
  originalPricePerKg?: number
): WeightVariant[] {
  return generateWeightsFromKiloPrice(pricePerKg, originalPricePerKg, true);
}

/**
 * Generates a standalone 2000g (2kg) weight variant with optional bulk discount.
 */
export function generate2000gWeightVariant(
  pricePerKg: number,
  originalPricePerKg?: number,
  discountPercent: number = 0
): WeightVariant {
  const safeKilo = Math.max(0, Number(pricePerKg) || 0);
  const safeOrig =
    originalPricePerKg && originalPricePerKg > safeKilo
      ? Number(originalPricePerKg)
      : undefined;
  const factor = 2 * (1 - discountPercent / 100);

  return {
    id: 'w-2000',
    label: '2 كجم (2000 جم)',
    weightGrams: 2000,
    grams: 2000,
    price: Math.round(safeKilo * factor),
    originalPrice: safeOrig ? Math.round(safeOrig * 2) : undefined,
  };
}

export function isUnitProduct(product?: Product | null): boolean {
  return product?.sellingMode === 'unit';
}

export function getProductStockUnitLabel(product?: Product | null): string {
  if (isUnitProduct(product)) {
    return product?.unitLabel?.trim() || 'قطعة';
  }
  return 'كجم';
}

/**
 * Returns the exact price for any weight in grams (or unit equivalent) based on a product's selling mode.
 */
export function getProductPriceForWeight(product: Product, weightGrams: number): number {
  if (isUnitProduct(product)) {
    const matchedUnitVariant = product.weights?.find(
      (w) => (w.weightGrams || w.grams) === weightGrams
    );
    if (matchedUnitVariant) return matchedUnitVariant.price;
    const baseUnitPrice =
      product.unitPrice ??
      product.pricePerKg ??
      product.weights?.[0]?.price ??
      0;
    const units = Math.max(1, (weightGrams || 1000) / 1000);
    return Math.round(baseUnitPrice * units);
  }

  const matchedVariant = product.weights?.find(
    (w) => (w.weightGrams || w.grams) === weightGrams
  );
  if (matchedVariant) return matchedVariant.price;

  if (product.pricePerKg && product.pricePerKg > 0) {
    return Math.round((product.pricePerKg * weightGrams) / 1000);
  }

  const w1000 = product.weights?.find(
    (w) => (w.weightGrams || w.grams) === 1000 || w.id === 'w-1000'
  );
  if (w1000) {
    return Math.round((w1000.price * weightGrams) / 1000);
  }

  return product.weights?.[0]?.price || 0;
}

/**
 * Returns the raw cost for a given weight in grams (or unit equivalent when sellingMode === 'unit').
 */
export function getProductCostForWeight(product: Product, weightGrams: number): number {
  if (isUnitProduct(product)) {
    const baseUnitPrice =
      product.unitPrice ??
      product.pricePerKg ??
      product.weights?.[0]?.price ??
      100;
    const baseUnitCost =
      product.unitCost ??
      product.costPerKg ??
      Math.round(baseUnitPrice * 0.72);
    const units = Math.max(1, (weightGrams || 1000) / 1000);
    return Math.round(baseUnitCost * units);
  }

  const kiloPrice =
    product.pricePerKg ||
    product.weights?.find((w) => (w.weightGrams || w.grams) === 1000)?.price ||
    400;
  const costPerKg = product.costPerKg || Math.round(kiloPrice * 0.72);
  return Math.round((costPerKg * weightGrams) / 1000);
}

/**
 * Partitioned Box Studio Presets (استوديو صمّم بوكس السهرة بنفسك — /build-box)
 */
export interface PartitionedBoxPresetConfig {
  id: PartitionedBoxSize;
  name: string;
  title: string;
  subtitle: string;
  badge: string;
  slotsCount: 4 | 6;
  slotWeightGrams: number;
  gramsPerSlot: number;
  totalWeightGrams: number;
  totalGrams?: number;
  approximateTotalGrams: number;
  basePrice: number;
  basePriceEgp?: number;
  packagingCost: number;
  minMarginPercent: number;
  defaultSlots: Array<{
    slotNumber: number;
    slotTitle: string;
    categoryLabel: string;
    defaultProductId: string;
  }>;
}

export const PARTITIONED_BOX_PRESETS: Record<PartitionedBoxSize, PartitionedBoxPresetConfig> = {
  roqan_4: {
    id: 'roqan_4',
    name: 'بوكس روقان المقسم (4 خانات)',
    title: 'بوكس روقان (4 خانات)',
    subtitle: 'مقرمشات وكريك + فول فلسطيني ومكرمل + كاندي وشوكولاتة + ميكس مكسرات VIP',
    badge: 'الأكثر مبيعاً في المتجر 🔥',
    slotsCount: 4,
    slotWeightGrams: 110,
    gramsPerSlot: 110,
    totalWeightGrams: 440,
    approximateTotalGrams: 440,
    basePrice: 125,
    packagingCost: 12,
    minMarginPercent: 20,
    defaultSlots: [
      { slotNumber: 1, slotTitle: 'الخانة 1: مقرمشات وكريك', categoryLabel: 'مقرمشات وتسالي', defaultProductId: 'prod-crik-crak-1' },
      { slotNumber: 2, slotTitle: 'الخانة 2: فول فلسطيني ومكرمل', categoryLabel: 'محمصة التسالي', defaultProductId: 'prod-palestinian-peanuts-1' },
      { slotNumber: 3, slotTitle: 'الخانة 3: كاندي وشوكولاتة', categoryLabel: 'استاند السعادة', defaultProductId: 'prod-imported-choco-1' },
      { slotNumber: 4, slotTitle: 'الخانة 4: ميكس مكسرات VIP', categoryLabel: 'مكسرات VIP', defaultProductId: 'prod-hafsa-vip-mix-1' },
    ],
  },
  family_6: {
    id: 'family_6',
    name: 'بوكس العيلة واللمة (6 خانات)',
    title: 'بوكس العيلة واللمة (6 خانات)',
    subtitle: 'يكفي 4 - 6 أفراد لسهرة كاملة بـ 6 أصناف متنوعة من اختيارك',
    badge: 'سهرة العيلة والصحاب 👨‍👩‍👧‍👦',
    slotsCount: 6,
    slotWeightGrams: 135,
    gramsPerSlot: 135,
    totalWeightGrams: 810,
    approximateTotalGrams: 810,
    basePrice: 250,
    packagingCost: 18,
    minMarginPercent: 20,
    defaultSlots: [
      { slotNumber: 1, slotTitle: 'الخانة 1: لب سوبر محمص', categoryLabel: 'لب وتسالي', defaultProductId: 'prod-super-seeds-1' },
      { slotNumber: 2, slotTitle: 'الخانة 2: كاجو ولوز محمص', categoryLabel: 'مكسرات VIP', defaultProductId: 'prod-cashew-1' },
      { slotNumber: 3, slotTitle: 'الخانة 3: كريك كراك وذرة إسباني', categoryLabel: 'مقرمشات', defaultProductId: 'prod-spanish-corn-1' },
      { slotNumber: 4, slotTitle: 'الخانة 4: فول فلسطيني وسوداني حلواني', categoryLabel: 'تسالي ساخنة', defaultProductId: 'prod-palestinian-peanuts-1' },
      { slotNumber: 5, slotTitle: 'الخانة 5: شوكولاتة ودرابيه فاخر', categoryLabel: 'شوكولاتة', defaultProductId: 'prod-dragee-choco-1' },
      { slotNumber: 6, slotTitle: 'الخانة 6: كاندي مشكل مستورد', categoryLabel: 'كاندي', defaultProductId: 'prod-gummy-candy-1' },
    ],
  },
  vip_6: {
    id: 'vip_6',
    name: 'بوكس هدايا وزيارات VIP فاخر (6 خانات ملكية)',
    title: 'بوكس هدايا VIP (6 خانات ملكية)',
    subtitle: 'فستق + كاجو جامبو + بندق تركي + لوز كاليفورنيا + عين جمل + شوكولاتة فاخرة',
    badge: 'تشريف وهدايا VIP 👑',
    slotsCount: 6,
    slotWeightGrams: 150,
    gramsPerSlot: 150,
    totalWeightGrams: 900,
    approximateTotalGrams: 900,
    basePrice: 450,
    packagingCost: 28,
    minMarginPercent: 18,
    defaultSlots: [
      { slotNumber: 1, slotTitle: 'الخانة 1: فستق أمريكي جامبو', categoryLabel: 'مكسرات ملكية', defaultProductId: 'prod-pistachio-1' },
      { slotNumber: 2, slotTitle: 'الخانة 2: كاجو جامبو W180', categoryLabel: 'مكسرات ملكية', defaultProductId: 'prod-cashew-1' },
      { slotNumber: 3, slotTitle: 'الخانة 3: بندق تركي مقشر', categoryLabel: 'مكسرات ملكية', defaultProductId: 'prod-hazelnut-1' },
      { slotNumber: 4, slotTitle: 'الخانة 4: لوز كاليفورنيا ذهبي', categoryLabel: 'مكسرات ملكية', defaultProductId: 'prod-almond-1' },
      { slotNumber: 5, slotTitle: 'الخانة 5: عين جمل تشيلي وبيكان', categoryLabel: 'مكسرات ملكية', defaultProductId: 'prod-walnut-1' },
      { slotNumber: 6, slotTitle: 'الخانة 6: شوكولاتة مستوردة ودرابيه', categoryLabel: 'شوكولاتة VIP', defaultProductId: 'prod-imported-choco-1' },
    ],
  },
};

export interface PartitionedBoxTierConfig extends PartitionedBoxPresetConfig {
  totalGrams: number;
  basePriceEgp: number;
}

export const PARTITIONED_BOX_TIERS: PartitionedBoxTierConfig[] = Object.values(
  PARTITIONED_BOX_PRESETS
).map((p) => ({
  ...p,
  totalGrams: p.totalWeightGrams,
  basePriceEgp: p.basePrice,
}));

export function calculatePartitionedBoxValuation(
  presetOrId: PartitionedBoxPresetConfig | PartitionedBoxSize,
  slotsInput: any[]
) {
  const presetId = typeof presetOrId === 'string' ? presetOrId : presetOrId.id;
  const res = calculatePartitionedBox(presetId, slotsInput);
  return {
    ...res,
    finalBoxPriceEgp: res.finalPrice,
    totalRawCostEgp: res.rawCost,
  };
}

export interface PartitionedBoxResult {
  isValid: boolean;
  preset: PartitionedBoxPresetConfig;
  filledSlotsCount: number;
  totalSlotsCount: number;
  totalWeightGrams: number;
  rawCost: number;
  protectedPrice: number;
  finalPrice: number;
  vipExtraSurcharge: number;
  netProfitEgp: number;
  profitMarginPercent: number;
  slots: BoxSlotSelection[];
  finalBoxPriceEgp?: number;
  totalRawCostEgp?: number;
  error?: string;
}

/**
 * Calculates the Partitioned Box price with built-in Profit Margin Protection
 * (حساب السعر والوزن الإجمالي وهامش الربح المحمي برمجياً)
 */
export function calculatePartitionedBox(
  presetId: PartitionedBoxSize,
  selectedSlots: Array<
    | BoxSlotSelection
    | {
        slotNumber?: number;
        slotIndex?: number;
        product?: Product;
        productId?: string;
        productName?: string;
        productImage?: string;
        roastOption?: string;
        slotGrams?: number;
        weightGrams?: number;
        pricePerKg?: number;
        costPerKg?: number;
        isSuperVipItem?: boolean;
      }
  >
): PartitionedBoxResult {
  const preset =
    PARTITIONED_BOX_PRESETS[presetId] || PARTITIONED_BOX_PRESETS.roqan_4;

  const slots: BoxSlotSelection[] = [];
  let rawIngredientsCost = 0;
  let publicRetailIngredientsTotal = 0;

  for (let i = 0; i < (selectedSlots || []).length; i++) {
    const item = selectedSlots[i] as any;
    if (!item) continue;

    const slotNumber = item.slotNumber ?? item.slotIndex ?? i + 1;
    const slotMeta = preset.defaultSlots.find((s) => s.slotNumber === slotNumber) || {
      slotNumber,
      slotTitle: `الخانة ${slotNumber}`,
      categoryLabel: 'اختيار خاص',
    };
    const weightGrams = item.slotGrams || item.weightGrams || preset.slotWeightGrams;

    let costContribution = 0;
    let retailContribution = 0;
    let productId = item.productId || '';
    let productName = item.productName || '';
    let productImage = item.productImage || '/images/products/royal-mix.jpg';
    let roastOption = item.roastOption || 'محمص مملح';
    let pricePerKg = item.pricePerKg || 320;
    let costPerKg = item.costPerKg || Math.round(pricePerKg * 0.68);
    let isSuperVipItem = Boolean(item.isSuperVipItem);

    if (item.product) {
      const prod: Product = item.product;
      productId = prod.id;
      productName = prod.name;
      productImage = getSafeImageUrl(prod.image);
      roastOption = item.roastOption || prod.roastOptions?.[0] || 'محمص مملح';
      pricePerKg = prod.pricePerKg || 400;
      costPerKg = prod.costPerKg || Math.round(pricePerKg * 0.7);
      isSuperVipItem = Boolean(prod.isSuperVipItem || pricePerKg >= 600);
      costContribution = getProductCostForWeight(prod, weightGrams);
      retailContribution = getProductPriceForWeight(prod, weightGrams);
    } else {
      costContribution =
        item.costContribution ?? Math.round((costPerKg * weightGrams) / 1000);
      retailContribution =
        item.priceContribution ?? Math.round((pricePerKg * weightGrams) / 1000);
      if (pricePerKg >= 600) isSuperVipItem = true;
    }

    rawIngredientsCost += costContribution;
    publicRetailIngredientsTotal += Math.round((pricePerKg * weightGrams) / 1000);
    slots.push({
      slotIndex: slotNumber,
      slotNumber,
      slotTitle: slotMeta.slotTitle,
      categoryLabel: slotMeta.categoryLabel,
      productId,
      productName,
      productImage: getSafeImageUrl(productImage),
      roastOption,
      slotGrams: weightGrams,
      weightGrams,
      pricePerKg,
      costPerKg,
      isSuperVipItem,
      costContribution,
      priceContribution: retailContribution,
    });
  }

  // Deterministic customer selling price computed solely from public retail pricePerKg
  // so public storefront (/build-box) and server (POST /api/orders) ALWAYS match 100%.
  const deterministicCostProxy =
    Math.round(publicRetailIngredientsTotal * 0.72) + preset.packagingCost;
  const totalRawCost = rawIngredientsCost + preset.packagingCost;
  const minSafeSellingPrice =
    Math.ceil(deterministicCostProxy / (1 - preset.minMarginPercent / 100) / 5) * 5;
  const protectedPrice = Math.max(preset.basePrice, minSafeSellingPrice);
  const vipExtraSurcharge = Math.max(0, protectedPrice - preset.basePrice);
  const netProfitEgp = protectedPrice - totalRawCost;
  const profitMarginPercent =
    protectedPrice > 0 ? Math.round((netProfitEgp / protectedPrice) * 1000) / 10 : 0;

  const isValid = slots.length === preset.slotsCount;

  return {
    isValid,
    preset,
    filledSlotsCount: slots.length,
    totalSlotsCount: preset.slotsCount,
    totalWeightGrams: slots.length * preset.slotWeightGrams,
    rawCost: totalRawCost,
    protectedPrice,
    finalPrice: protectedPrice,
    vipExtraSurcharge,
    netProfitEgp,
    profitMarginPercent,
    slots,
    error: isValid
      ? undefined
      : `يرجى اختيار أصناف جميع الخانات الـ ${preset.slotsCount} أولاً (تم اختيار ${slots.length} من ${preset.slotsCount})`,
  };
}

/**
 * Custom Coffee Blender Pricing Engine (ركن المحمصة: اعمل توليفة قهوتك على مزاجك — /coffee-blender)
 */
export const COFFEE_ORIGINS = [
  {
    id: 'brazilian',
    name: 'بن برازيلي سانتوس فاخر',
    notes: 'قوام متوازن، كريمة غنية، وحمضية منخفضة مثالية للقهوة التركي',
    pricePerKg: 520,
    costPerKg: 380,
    badge: 'طعم كلاسيكي أصيل',
  },
  {
    id: 'colombian',
    name: 'بن كولومبي سوبريمو أرابيكا',
    notes: 'نكهة غنية ورائحة فواحة مع لمسات كراميل وشوكولاتة',
    pricePerKg: 640,
    costPerKg: 470,
    badge: 'أرابيكا فاخرة 100%',
  },
  {
    id: 'ethiopian',
    name: 'بن حبشي إثيوبي مختص',
    notes: 'مذاق عطري ساحر ونكهة أصيلة لعشاق المزاج العالي',
    pricePerKg: 620,
    costPerKg: 455,
    badge: 'عشاق المزاج العالي',
  },
  {
    id: 'indian',
    name: 'بن هندي روبوستا وكارز',
    notes: 'وش ثقيل كثيف جداً وكافيين عالي يضبط قوام التوليفة',
    pricePerKg: 480,
    costPerKg: 350,
    badge: 'وش كثيف جداً',
  },
];

export interface CoffeeOriginCatalogItem {
  id: string;
  name: string;
  notes: string;
  flavorNote: string;
  pricePerKg: number;
  costPerKg: number;
  badge: string;
}

export const COFFEE_ORIGINS_CATALOG: CoffeeOriginCatalogItem[] = COFFEE_ORIGINS.map((o) => ({
  ...o,
  flavorNote: o.notes,
}));

export const COFFEE_SPICING_SURCHARGE_PER_KG: Record<
  string,
  { pricePerKg: number; costPerKg: number }
> = {
  plain: { pricePerKg: 0, costPerKg: 0 },
  cardamom: { pricePerKg: 40, costPerKg: 25 },
  royal_mix: { pricePerKg: 60, costPerKg: 40 },
  extra_cardamom: { pricePerKg: 80, costPerKg: 50 },
};

export const COFFEE_ROAST_LEVELS: CoffeeRoastLevel[] = [
  'فاتح (أشقر)',
  'وسط (مضبوط)',
  'وسط غامق',
  'غامق (إسبريسو)',
];

export const COFFEE_SPICING_OPTIONS: Array<{
  id: string;
  option: CoffeeSpicingOption;
  name: string;
  extraPerKg: number;
  desc: string;
}> = [
  {
    id: 'plain',
    option: 'سادة بدون تحويجة',
    name: 'سادة بدون تحويجة',
    extraPerKg: 0,
    desc: 'طعم البن النقي 100% بدون أي إضافات',
  },
  {
    id: 'light_cardamom',
    option: 'محوج خفيف بالحبهان',
    name: 'محوج خفيف بالحبهان',
    extraPerKg: 40,
    desc: 'لمسة حبهان أخضر هندي خفيفة تبرز طعم البن',
  },
  {
    id: 'special_spiced',
    option: 'محوج مخصوص بحبهان وزر ورد',
    name: 'محوج مخصوص بحبهان وزر ورد',
    extraPerKg: 60,
    desc: 'حبهان أخضر هندي جامبو مطحون طازج + زر ورد وجوزة الطيب',
  },
  {
    id: 'royal_saffron',
    option: 'التحويجة الملكية بالزعفران والمستكة',
    name: 'التحويجة الملكية بالزعفران والمستكة',
    extraPerKg: 100,
    desc: 'تحويجة ملكية فاخرة بالحبهان والمستكة اليوناني والزعفران',
  },
];

export const COFFEE_GRIND_TYPES: CoffeeGrindType[] = [
  'ماكينة تركي ناعم',
  'إسبريسو وموكا بوت',
  'فرنساوي وخشن',
  'حبوب صحيحة (بدون طحن)',
];

export interface CoffeeBlendPriceResult {
  isValid: boolean;
  totalPercentage: number;
  price: number;
  totalPrice: number;
  kiloRate: number;
  baristaLabel: string;
  spec: CustomCoffeeBlendSpec;
  error?: string;
}

export function calculateCoffeeBlendPrice(input: {
  originId?: string;
  beanOrigin?: string;
  brazilianPercent?: number;
  indianPercent?: number;
  colombianPercent?: number;
  habashiPercent?: number;
  roastLevel: string;
  spicing: string;
  grindType: string;
  weightGrams: WeightGrams;
  customBlendName?: string;
  notes?: string;
}): CoffeeBlendPriceResult {
  const hasPercentages =
    typeof input.brazilianPercent === 'number' ||
    typeof input.colombianPercent === 'number' ||
    typeof input.habashiPercent === 'number' ||
    typeof input.indianPercent === 'number';

  const bPct = Number(input.brazilianPercent) || 0;
  const cPct = Number(input.colombianPercent) || 0;
  const hPct = Number(input.habashiPercent) || 0;
  const iPct = Number(input.indianPercent) || 0;

  const totalPercentage = hasPercentages ? bPct + cPct + hPct + iPct : 100;
  const isValid = totalPercentage === 100;

  let baseKiloPrice = 540;
  let beanOriginSummary = input.beanOrigin || 'توليفة المتجر الخاصة';

  if (hasPercentages) {
    baseKiloPrice = Math.round(
      (bPct * 520 + cPct * 640 + hPct * 620 + iPct * 480) /
        Math.max(1, totalPercentage)
    );
    const parts: string[] = [];
    if (bPct > 0) parts.push(`${bPct}% بن برازيلي`);
    if (cPct > 0) parts.push(`${cPct}% بن كولومبي`);
    if (hPct > 0) parts.push(`${hPct}% بن حبشي`);
    if (iPct > 0) parts.push(`${iPct}% بن هندي`);
    beanOriginSummary = parts.join(' + ') || 'توليفة بن خاصة';
  } else {
    const originObj =
      COFFEE_ORIGINS.find((o) => o.id === input.originId || o.name === input.beanOrigin) ||
      COFFEE_ORIGINS[0];
    baseKiloPrice = originObj.pricePerKg;
    beanOriginSummary = originObj.name;
  }

  const spicingObj =
    COFFEE_SPICING_OPTIONS.find(
      (s) =>
        s.id === input.spicing ||
        s.option === input.spicing ||
        s.name === input.spicing ||
        (s.id === 'royal_saffron' && typeof input.spicing === 'string' && input.spicing.includes('بالزعفران'))
    ) || COFFEE_SPICING_OPTIONS[0];

  const kiloRate = baseKiloPrice + spicingObj.extraPerKg;
  const validWeights = [125, 250, 500, 1000];
  const weightGrams = validWeights.includes(Number(input.weightGrams))
    ? Number(input.weightGrams)
    : 250;

  const weightLabelMap: Record<number, string> = {
    125: 'ثمن كيلو (125 جم)',
    250: 'ربع كيلو (250 جم)',
    500: 'نصف كيلو (500 جم)',
    1000: 'كيلو كامل (1000 جم)',
  };

  const totalPrice = Math.round((kiloRate * weightGrams) / 1000);
  const weightLabel = weightLabelMap[weightGrams] || `${weightGrams} جم`;
  const customBlendName = input.customBlendName?.trim() || undefined;

  const baristaLabel = `${
    customBlendName ? `[${customBlendName}] ` : ''
  }${beanOriginSummary} | تحميص: ${input.roastLevel} | ${input.spicing} | طحنة: ${
    input.grindType
  } | الوزن: ${weightGrams} جم${
    input.notes ? ` | ملاحظة: ${input.notes}` : ''
  }`;

  const spec: CustomCoffeeBlendSpec = {
    beanOrigin: beanOriginSummary,
    brazilianPercent: hasPercentages ? bPct : 50,
    colombianPercent: hasPercentages ? cPct : 30,
    habashiPercent: hasPercentages ? hPct : 0,
    indianPercent: hasPercentages ? iPct : 20,
    roastLevel: input.roastLevel,
    spicing: input.spicing,
    grindType: input.grindType,
    weightGrams,
    weightLabel,
    baristaLabel,
    customBlendName,
    notes: input.notes,
  };

  return {
    isValid,
    totalPercentage,
    price: totalPrice,
    totalPrice,
    kiloRate,
    baristaLabel,
    spec,
    error: isValid
      ? undefined
      : `مجموع نسب البن حالياً ${totalPercentage}% — يجب أن يكون الإجمالي 100% بالضبط لطحن التوليفة`,
  };
}

/**
 * 4th Partner Promo Profit Margin Safety Calculator (حاسبة أمان الربح التلقائية للشريك الرابع)
 */
export function calculatePromoProfitSafety(
  itemsOrOriginalPrice: FlashPromotionItem[] | number,
  packagingOrCostPrice: number,
  promoPrice: number,
  minSafeMarginPercent = 15
): {
  isSafe: boolean;
  isProfitSafe: boolean;
  totalRawCost: number;
  originalRetailPrice: number;
  netProfit: number;
  netProfitEgp: number;
  profitMarginPercent: number;
  discountAmount: number;
  discountPercentage: number;
  warning?: string;
  rejectionReason?: string;
} {
  let totalRawCost = 0;
  let originalRetailPrice = 0;

  if (Array.isArray(itemsOrOriginalPrice)) {
    const itemsCost = itemsOrOriginalPrice.reduce(
      (sum, item) => sum + (Number(item.unitCost) || 0) * (Number(item.quantity) || 1),
      0
    );
    originalRetailPrice = itemsOrOriginalPrice.reduce(
      (sum, item) =>
        sum + (Number(item.unitRetailPrice) || 0) * (Number(item.quantity) || 1),
      0
    );
    totalRawCost = Math.round(itemsCost + (Number(packagingOrCostPrice) || 0));
  } else {
    originalRetailPrice = Math.max(0, Number(itemsOrOriginalPrice) || 0);
    totalRawCost = Math.max(0, Number(packagingOrCostPrice) || 0);
  }

  const safePromoPrice = Math.max(0, Number(promoPrice) || 0);
  const netProfitEgp = Math.round(safePromoPrice - totalRawCost);
  const profitMarginPercent =
    safePromoPrice > 0 ? Math.round((netProfitEgp / safePromoPrice) * 1000) / 10 : 0;
  const discountAmount = Math.max(0, originalRetailPrice - safePromoPrice);
  const discountPercentage =
    originalRetailPrice > 0
      ? Math.round((discountAmount / originalRetailPrice) * 100)
      : 0;

  if (netProfitEgp <= 0) {
    const msg = `⛔ مرفوض برمجياً: سعر العرض (${safePromoPrice} ج.م) أقل من أو يساوي التكلفة الفعلية في شيت عرفات + التغليف (${totalRawCost} ج.م) ويسبب خسارة (${netProfitEgp} ج.م)!`;
    return {
      isSafe: false,
      isProfitSafe: false,
      totalRawCost,
      originalRetailPrice,
      netProfit: netProfitEgp,
      netProfitEgp,
      profitMarginPercent,
      discountAmount,
      discountPercentage,
      warning: msg,
      rejectionReason: msg,
    };
  }

  if (profitMarginPercent < minSafeMarginPercent) {
    const minAllowed = Math.ceil(totalRawCost / (1 - minSafeMarginPercent / 100));
    const msg = `⚠️ مرفوض من حاسبة أمان الربح: هامش الربح الحالي (${profitMarginPercent}%) أقل من حد الأمان الأدنى للمحل (${minSafeMarginPercent}%). الحد الأدنى المسموح لسعر هذا العرض هو ${minAllowed} ج.م.`;
    return {
      isSafe: false,
      isProfitSafe: false,
      totalRawCost,
      originalRetailPrice,
      netProfit: netProfitEgp,
      netProfitEgp,
      profitMarginPercent,
      discountAmount,
      discountPercentage,
      warning: msg,
      rejectionReason: msg,
    };
  }

  return {
    isSafe: true,
    isProfitSafe: true,
    totalRawCost,
    originalRetailPrice,
    netProfit: netProfitEgp,
    netProfitEgp,
    profitMarginPercent,
    discountAmount,
    discountPercentage,
  };
}

/**
 * VIP Cashback Calculator (5% Cashback on orders >= 150 EGP)
 */
export function calculateVipCashback(
  subtotalAfterDiscounts: number,
  minOrderAmount = 150,
  cashbackPercent = 5
): number {
  const amount = Number(subtotalAfterDiscounts) || 0;
  if (amount < minOrderAmount) return 0;
  return Math.round((amount * cashbackPercent) / 100);
}

/**
 * Returns the base price of a product for the specified box weight capacity.
 * - 500g: uses 500g variant price.
 * - 1000g: uses 1000g variant price.
 * - 2000g: uses 2000g variant if present, otherwise 2 * 1000g price.
 */
export function getProductBasePriceForBox(
  product: Product,
  boxSizeGrams: 500 | 1000 | 2000
): number {
  if (!product || !product.weights || product.weights.length === 0) {
    return 0;
  }

  if (boxSizeGrams === 500) {
    const v500 = product.weights.find(
      (w) => (w.weightGrams || w.grams) === 500 || w.id === 'w-500'
    );
    if (v500) return v500.price;

    const v1000 = product.weights.find(
      (w) => (w.weightGrams || w.grams) === 1000 || w.id === 'w-1000'
    );
    if (v1000) return Math.round(v1000.price / 2);

    const v250 = product.weights.find(
      (w) => (w.weightGrams || w.grams) === 250 || w.id === 'w-250'
    );
    if (v250) return v250.price * 2;

    return product.weights[0].price;
  }

  if (boxSizeGrams === 1000) {
    const v1000 = product.weights.find(
      (w) => (w.weightGrams || w.grams) === 1000 || w.id === 'w-1000'
    );
    if (v1000) return v1000.price;

    const v500 = product.weights.find(
      (w) => (w.weightGrams || w.grams) === 500 || w.id === 'w-500'
    );
    if (v500) return v500.price * 2;

    return product.weights[product.weights.length - 1].price;
  }

  if (boxSizeGrams === 2000) {
    const v2000 = product.weights.find(
      (w) => (w.weightGrams || w.grams) === 2000 || w.id === 'w-2000'
    );
    if (v2000) return v2000.price;

    const base1000 = getProductBasePriceForBox(product, 1000);
    return base1000 * 2;
  }

  return 0;
}

/**
 * Calculates custom mix box pricing, validates capacity, and creates item breakdown.
 * Formula: BoxPrice = sum( BasePrice(P_i, W_box) * (p_i / 100) )
 */
export function calculateCustomBoxPrice(
  boxSizeGrams: 500 | 1000 | 2000 | number,
  portions: Array<{ product: Product; percentage: number; roastOption: RoastOption }>
): CustomBoxCalculationResult {
  if (boxSizeGrams !== 500 && boxSizeGrams !== 1000 && boxSizeGrams !== 2000) {
    return {
      isValid: false,
      totalPrice: 0,
      totalPercentage: 0,
      breakdown: [],
      error: 'حجم العلبة غير صالح، الأحجام المتاحة هي 500 جم، 1 كجم، 2 كجم',
    };
  }

  if (!portions || portions.length === 0) {
    return {
      isValid: false,
      totalPrice: 0,
      totalPercentage: 0,
      breakdown: [],
      error: 'لم يتم اختيار أي أصناف للعلبة المشكلة',
    };
  }

  for (const p of portions) {
    if (typeof p.percentage !== 'number' || isNaN(p.percentage) || p.percentage <= 0) {
      return {
        isValid: false,
        totalPrice: 0,
        totalPercentage: 0,
        breakdown: [],
        error: 'نسبة الصنف يجب أن تكون أكبر من صفر',
      };
    }
  }

  const totalPercentage =
    Math.round(portions.reduce((sum, p) => sum + p.percentage, 0) * 100) / 100;

  if (totalPercentage < 100) {
    const remaining = Math.round((100 - totalPercentage) * 100) / 100;
    return {
      isValid: false,
      totalPrice: 0,
      totalPercentage,
      breakdown: [],
      error: `سعة العلبة غير مكتملة (المحدد حالياً: ${totalPercentage}% - المتبقي: ${remaining}%). يرجى إكمال السعة إلى 100%.`,
    };
  }

  if (totalPercentage > 100) {
    const excess = Math.round((totalPercentage - 100) * 100) / 100;
    return {
      isValid: false,
      totalPrice: 0,
      totalPercentage,
      breakdown: [],
      error: `لقد تجاوزت السعة الإجمالية 100% بمقدار ${excess}%. يرجى تقليل النسب لتصبح 100%.`,
    };
  }

  for (const item of portions) {
    const basePrice = getProductBasePriceForBox(item.product, boxSizeGrams as 500 | 1000 | 2000);
    if (!basePrice || basePrice <= 0) {
      return {
        isValid: false,
        totalPrice: 0,
        totalPercentage: 100,
        breakdown: [],
        error: `أحد الأصناف المختارة (${item.product?.name || 'غير معروف'}) غير متوفر بسعر صالح لحجم ${boxSizeGrams} جم`,
      };
    }
  }

  const breakdown: CustomMixItem[] = portions.map((item) => {
    const basePrice = getProductBasePriceForBox(item.product, boxSizeGrams as 500 | 1000 | 2000);
    const weightGrams = Math.round((boxSizeGrams * item.percentage) / 100);
    const priceContribution = Math.round((basePrice * item.percentage) / 100);

    return {
      productId: item.product.id,
      productName: item.product.name,
      productImage: getSafeImageUrl(item.product.image),
      roastOption: item.roastOption,
      percentage: item.percentage,
      weightGrams,
      priceContribution,
    };
  });

  const totalPrice = breakdown.reduce((sum, item) => sum + item.priceContribution, 0);

  return {
    isValid: true,
    totalPrice,
    totalPercentage: 100,
    breakdown,
  };
}

/**
 * Electronic Barcode Scale & POS Calculation Engine (نظام ميزان الباركود الإلكتروني والكاشير)
 */
export function getProductBarcode(product: Product, index = 0): string {
  if (product.barcode) return product.barcode;
  const num = String(index + 1).padStart(4, '0');
  return `20${num}`;
}

export interface PosScaleItemResult {
  weightGrams: number;
  weightLabel: string;
  unitPrice: number;
  rawCostEgp: number;
  netProfitEgp: number;
  marginPercent: number;
  barcodeLabel: string;
}

/**
 * Computes the standard GS1 / EAN-13 modulo-10 check digit for a 12-digit payload.
 */
export function computeEan13CheckDigit(twelveDigits: string): string {
  const digits = twelveDigits.replace(/\D/g, '').padStart(12, '0').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(digits[i]) || 0;
    sum += i % 2 === 0 ? d : d * 3;
  }
  const mod = sum % 10;
  return String(mod === 0 ? 0 : 10 - mod);
}

function resolvePlu4Digits(product: Product, productIndex = 0): string {
  const raw = (product.barcode || '').replace(/\D/g, '');
  if (/^(20|21|22)\d{4}$/.test(raw)) {
    return raw.slice(2, 6);
  }
  if (/^\d{4}$/.test(raw)) {
    return raw;
  }
  return String(Math.max(1, productIndex + 1)).padStart(4, '0').slice(-4);
}

const EASTERN_ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

const ARABIC_KEYBOARD_TO_ASCII_MAP: Record<string, string> = {
  ش: 'A',
  لا: 'B',
  ؤ: 'C',
  ي: 'D',
  ث: 'E',
  ب: 'F',
  ل: 'G',
  ا: 'H',
  ه: 'I',
  ت: 'J',
  ن: 'K',
  م: 'L',
  ة: 'M',
  ى: 'N',
  خ: 'O',
  ح: 'P',
  ض: 'Q',
  ق: 'R',
  س: 'S',
  ف: 'T',
  ع: 'U',
  ر: 'V',
  ص: 'W',
  ء: 'X',
  غ: 'Y',
  ئ: 'Z',
};

/**
 * Normalizes barcode scanner text regardless of Windows Arabic/English keyboard layout
 * or Eastern Arabic numerals (٠-٩ -> 0-9).
 */
export function normalizeBarcodeScanInput(raw: string): string {
  if (!raw) return '';
  let out = '';
  for (const ch of raw.trim()) {
    if (EASTERN_ARABIC_DIGITS_MAP[ch] !== undefined) {
      out += EASTERN_ARABIC_DIGITS_MAP[ch];
    } else {
      out += ch;
    }
  }
  // If entire string contains Arabic keyboard letters from an English SKU/Order code (e.g. POS-1001 scanned under AR layout)
  if (/^[\u0600-\u06FF0-9\-_*]+$/.test(out) && /\d/.test(out) && /[\u0600-\u06FF]/.test(out)) {
    let mapped = '';
    for (const ch of out) {
      mapped += ARABIC_KEYBOARD_TO_ASCII_MAP[ch] ?? ch;
    }
    return mapped;
  }
  return out;
}

/**
 * Resolves a physical KeyboardEvent from a USB HID scanner (e.g. Datalogic 20-beam)
 * into layout-independent ASCII character using `event.code` first.
 */
export function mapPhysicalScannerKeyToAscii(e: {
  code?: string;
  key?: string;
  shiftKey?: boolean;
}): string | null {
  const code = e.code || '';
  if (/^Digit[0-9]$/.test(code) && !e.shiftKey) {
    return code.slice(5);
  }
  if (/^Numpad[0-9]$/.test(code)) {
    return code.slice(6);
  }
  if (code === 'Minus' || code === 'NumpadSubtract') {
    return e.shiftKey && code === 'Minus' ? '_' : '-';
  }
  if (/^Key[A-Z]$/.test(code)) {
    const letter = code.slice(3);
    return e.shiftKey ? letter : letter.toLowerCase();
  }
  if (typeof e.key === 'string' && e.key.length === 1) {
    return EASTERN_ARABIC_DIGITS_MAP[e.key] ?? e.key;
  }
  return null;
}

function findProductByScalePlu(plu4: string, products: Product[]): { product: Product; index: number } | null {
  const pluNum = parseInt(plu4, 10);
  const explicitIdx = products.findIndex((p) => {
    if (Number.isFinite(pluNum) && typeof p.pluCode === 'number' && p.pluCode === pluNum) {
      return true;
    }
    const raw = (p.barcode || '').replace(/\D/g, '');
    return raw === `20${plu4}` || raw === `21${plu4}` || raw === `22${plu4}` || raw === plu4;
  });
  if (explicitIdx !== -1) {
    return { product: products[explicitIdx], index: explicitIdx };
  }
  const pluIndex = pluNum - 1;
  if (Number.isFinite(pluIndex) && pluIndex >= 0 && pluIndex < products.length) {
    return { product: products[pluIndex], index: pluIndex };
  }
  return null;
}

/**
 * Calculates exact POS price, cost, and EAN-13 weight barcode (20PPPPWWWWWC) when weighing by grams.
 */
export function calculatePosItemByGrams(
  product: Product,
  weightGrams: number,
  productIndex = 0
): PosScaleItemResult {
  const safeGrams = Math.max(5, Math.round(Number(weightGrams) || 250));
  const unitPrice = getProductPriceForWeight(product, safeGrams);
  const rawCostEgp = getProductCostForWeight(product, safeGrams);
  const netProfitEgp = unitPrice - rawCostEgp;
  const marginPercent =
    unitPrice > 0 ? Math.round((netProfitEgp / unitPrice) * 1000) / 10 : 0;

  let weightLabel = `وزن ميزان ${safeGrams} جم`;
  if (safeGrams === 125) weightLabel = 'ثمن كيلو (125 جم)';
  else if (safeGrams === 250) weightLabel = 'ربع كيلو (250 جم)';
  else if (safeGrams === 500) weightLabel = 'نصف كيلو (500 جم)';
  else if (safeGrams === 1000) weightLabel = 'كيلو كامل (1000 جم)';
  else if (safeGrams === 2000) weightLabel = '2 كجم (2000 جم)';

  const plu4 = resolvePlu4Digits(product, productIndex);
  const gramsStr = String(Math.min(99999, safeGrams)).padStart(5, '0');
  const body12 = `20${plu4}${gramsStr}0`.slice(0, 12);
  const payload12 = `20${plu4}${gramsStr}`.padEnd(12, '0').slice(0, 12);
  void body12;
  const barcodeLabel = `${payload12}${computeEan13CheckDigit(payload12)}`;

  return {
    weightGrams: safeGrams,
    weightLabel,
    unitPrice,
    rawCostEgp,
    netProfitEgp,
    marginPercent,
    barcodeLabel,
  };
}

/**
 * Calculates exact grams to weigh on the scale when a customer asks for a specific EGP amount
 * and generates a price-embedded EAN-13 scale barcode (Prefix 22 for whole EGP, Prefix 21 for piastres).
 */
export function calculatePosItemByAmountEgp(
  product: Product,
  targetAmountEgp: number,
  productIndex = 0
): PosScaleItemResult {
  const numericAmount = Math.max(1, Number(targetAmountEgp) || 50);
  const hasPiastres = Math.abs(numericAmount - Math.round(numericAmount)) > 0.001;
  const safeAmount = hasPiastres
    ? Math.round(numericAmount * 100) / 100
    : Math.max(5, Math.round(numericAmount));
  const kiloPrice =
    product.pricePerKg ||
    product.weights?.find((w) => (w.weightGrams || w.grams) === 1000)?.price ||
    400;
  const weightGrams = Math.max(10, Math.round((safeAmount / kiloPrice) * 1000));
  const rawCostEgp = getProductCostForWeight(product, weightGrams);
  const netProfitEgp = Math.round((safeAmount - rawCostEgp) * 100) / 100;
  const marginPercent =
    safeAmount > 0 ? Math.round((netProfitEgp / safeAmount) * 1000) / 10 : 0;

  const plu4 = resolvePlu4Digits(product, productIndex);
  let payload12: string;
  if (hasPiastres && safeAmount * 100 <= 99999) {
    const piastresStr = String(Math.round(safeAmount * 100)).padStart(5, '0');
    payload12 = `21${plu4}${piastresStr}`.padEnd(12, '0').slice(0, 12);
  } else {
    const egpStr = String(Math.min(99999, Math.round(safeAmount))).padStart(5, '0');
    payload12 = `22${plu4}${egpStr}`.padEnd(12, '0').slice(0, 12);
  }
  const barcodeLabel = `${payload12}${computeEan13CheckDigit(payload12)}`;

  return {
    weightGrams,
    weightLabel: `طلب بمبلغ (${safeAmount} ج.م = ${weightGrams} جم)`,
    unitPrice: safeAmount,
    rawCostEgp,
    netProfitEgp,
    marginPercent,
    barcodeLabel,
  };
}

/**
 * Parses:
 * - Prefix 20 weight-embedded EAN-13 scale barcode (20 + 4-digit PLU + 5-digit grams + pad/check)
 * - Prefix 21 price-embedded EAN-13 scale barcode in piastres (21 + 4-digit PLU + 5-digit piastres + pad/check)
 * - Prefix 22 price-embedded EAN-13 scale barcode in EGP (22 + 4-digit PLU + 5-digit EGP + pad/check)
 * - 6-digit PLU code (20PPPP)
 * - Standard SKU / EAN-13 / UPC-A / product.barcode / slug / name
 */
export function parseScaleBarcode(
  code: string,
  products: Product[]
): {
  product: Product;
  weightGrams: number;
  calc: PosScaleItemResult;
  barcodeKind?: 'scale_weight' | 'scale_price' | 'plu' | 'sku';
} | null {
  const rawTrimmed = (code || '').trim();
  const clean = normalizeBarcodeScanInput(rawTrimmed);
  if ((!rawTrimmed && !clean) || !products || products.length === 0) return null;

  // Helper to resolve a matched product with optional explicit weight/price (used by QR payloads too)
  const buildProductScanResult = (
    product: Product,
    idx: number,
    explicitGrams?: number,
    explicitPrice?: number
  ) => {
    if (explicitGrams && explicitGrams > 0 && !isUnitProduct(product)) {
      return {
        product,
        weightGrams: Math.round(explicitGrams),
        barcodeKind: 'scale_weight' as const,
        calc: calculatePosItemByGrams(product, Math.round(explicitGrams), idx),
      };
    }
    if (explicitPrice && explicitPrice > 0 && !isUnitProduct(product)) {
      const calc = calculatePosItemByAmountEgp(product, explicitPrice, idx);
      return {
        product,
        weightGrams: calc.weightGrams,
        barcodeKind: 'scale_price' as const,
        calc,
      };
    }
    if (isUnitProduct(product)) {
      const variants = getResolvedProductWeights(product);
      const firstVar = variants[0];
      const unitPrice = firstVar?.price ?? product.unitPrice ?? product.pricePerKg ?? 100;
      const rawCostEgp = getProductCostForWeight(product, firstVar?.weightGrams || 1000);
      const netProfitEgp = unitPrice - rawCostEgp;
      const marginPercent =
        unitPrice > 0 ? Math.round((netProfitEgp / unitPrice) * 1000) / 10 : 0;
      return {
        product,
        weightGrams: firstVar?.weightGrams || 1000,
        barcodeKind: 'sku' as const,
        calc: {
          weightGrams: firstVar?.weightGrams || 1000,
          weightLabel: firstVar?.label || product.unitLabel?.trim() || 'قطعة واحدة',
          unitPrice,
          rawCostEgp,
          netProfitEgp,
          marginPercent,
          barcodeLabel: product.barcode || getProductBarcode(product, idx),
        },
      };
    }
    return {
      product,
      weightGrams: 250,
      barcodeKind: 'sku' as const,
      calc: calculatePosItemByGrams(product, 250, idx),
    };
  };

  // -2. Direct exact match against raw QR/Barcode text stored on a product (supports alphanumeric QR strings / URLs)
  if (rawTrimmed && !/^(20|21|22)\d{9,11}$/.test(clean)) {
    const rawExactIdx = products.findIndex(
      (p) =>
        p.barcode &&
        p.barcode.trim().toLowerCase() === rawTrimmed.toLowerCase()
    );
    if (rawExactIdx !== -1) {
      return buildProductScanResult(products[rawExactIdx], rawExactIdx);
    }
  }

  // -1. Smart QR Code Payloads (JSON e.g. {"plu":"0001","weight":350}, Key-Value/Pipe e.g. PLU=0001&W=350, or QR containing an embedded 11-13 digit 20/21/22 scale barcode)
  if (rawTrimmed.startsWith('{') && rawTrimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(rawTrimmed) as Record<string, unknown>;
      const codeKey = String(
        obj.barcode ?? obj.code ?? obj.sku ?? obj.plu ?? obj.id ?? ''
      ).trim();
      const rawWeight = Number(obj.weightGrams ?? obj.grams ?? obj.weight ?? obj.w ?? 0);
      const rawKg = Number(obj.kg ?? obj.weightKg ?? 0);
      const grams = rawWeight > 0 ? rawWeight : rawKg > 0 ? Math.round(rawKg * 1000) : 0;
      const price = Number(obj.price ?? obj.amount ?? obj.total ?? obj.p ?? 0);
      if (codeKey) {
        const pluClean = normalizeBarcodeScanInput(codeKey);
        const byPlu =
          /^\d{1,6}$/.test(pluClean)
            ? findProductByScalePlu(
                pluClean.length >= 6 && /^(20|21|22)/.test(pluClean)
                  ? pluClean.slice(2, 6)
                  : pluClean.padStart(4, '0'),
                products
              )
            : null;
        if (byPlu) {
          return buildProductScanResult(byPlu.product, byPlu.index, grams || undefined, price || undefined);
        }
        const byCodeIdx = products.findIndex(
          (p, idx) =>
            (p.barcode && p.barcode.trim().toLowerCase() === codeKey.toLowerCase()) ||
            getProductBarcode(p, idx) === pluClean ||
            p.id.toLowerCase() === codeKey.toLowerCase() ||
            p.slug.toLowerCase() === codeKey.toLowerCase()
        );
        if (byCodeIdx !== -1) {
          return buildProductScanResult(
            products[byCodeIdx],
            byCodeIdx,
            grams || undefined,
            price || undefined
          );
        }
      }
    } catch {
      // Fall through to standard barcode/QR parsers
    }
  }

  // QR key-value / pipe format (e.g. "PLU=0001&W=350", "SKU:622123|W:500", "CODE=200001;G=250")
  if (/[=:|&;]/.test(rawTrimmed)) {
    const embeddedScale = rawTrimmed.match(/\b((?:20|21|22)\d{9,11})\b/);
    if (embeddedScale?.[1]) {
      return parseScaleBarcode(embeddedScale[1], products);
    }
    const kvMap: Record<string, string> = {};
    rawTrimmed.split(/[&|;\n]+/).forEach((part) => {
      const m = part.trim().match(/^([a-zA-Z_]+)\s*[:=]\s*(.+)$/);
      if (m) kvMap[m[1].toLowerCase()] = m[2].trim();
    });
    const kvCode = kvMap.barcode || kvMap.code || kvMap.sku || kvMap.plu || kvMap.id || '';
    const kvGrams = Number(kvMap.grams || kvMap.weightgrams || kvMap.weight || kvMap.w || kvMap.g || 0);
    const kvKg = Number(kvMap.kg || kvMap.weightkg || 0);
    const grams = kvGrams > 0 ? kvGrams : kvKg > 0 ? Math.round(kvKg * 1000) : 0;
    const price = Number(kvMap.price || kvMap.amount || kvMap.p || 0);
    if (kvCode) {
      const pluClean = normalizeBarcodeScanInput(kvCode);
      const byPlu =
        /^\d{1,6}$/.test(pluClean)
          ? findProductByScalePlu(
              pluClean.length >= 6 && /^(20|21|22)/.test(pluClean)
                ? pluClean.slice(2, 6)
                : pluClean.padStart(4, '0'),
              products
            )
          : null;
      if (byPlu) {
        return buildProductScanResult(byPlu.product, byPlu.index, grams || undefined, price || undefined);
      }
      const byCodeIdx = products.findIndex(
        (p, idx) =>
          (p.barcode && p.barcode.trim().toLowerCase() === kvCode.toLowerCase()) ||
          getProductBarcode(p, idx) === pluClean ||
          p.id.toLowerCase() === kvCode.toLowerCase() ||
          p.slug.toLowerCase() === kvCode.toLowerCase()
      );
      if (byCodeIdx !== -1) {
        return buildProductScanResult(
          products[byCodeIdx],
          byCodeIdx,
          grams || undefined,
          price || undefined
        );
      }
    }
  }

  // 0. Exact match on custom SKU / EAN-13 / UPC barcode first (unless it's a dynamic 12-13 digit 20/21/22 scale ticket)
  const exactCustomIdx = products.findIndex(
    (p) => p.barcode && p.barcode.trim() === clean
  );
  if (exactCustomIdx !== -1 && !/^(20|21|22)\d{9,11}$/.test(clean)) {
    return buildProductScanResult(products[exactCustomIdx], exactCustomIdx);
  }

  // 1. Check 11-13 digit weight-embedded scale barcode: 20 + 4-digit PLU + 5-digit weightGrams + [pad/checksum]
  if (/^20\d{9,11}$/.test(clean)) {
    const plu4 = clean.slice(2, 6);
    const weightGrams = parseInt(clean.slice(6, 11), 10) || 250;
    const found = findProductByScalePlu(plu4, products);
    if (found) {
      return {
        product: found.product,
        weightGrams,
        barcodeKind: 'scale_weight',
        calc: calculatePosItemByGrams(found.product, weightGrams, found.index),
      };
    }
  }

  // 2. Check 11-13 digit price-embedded scale barcode:
  //    Prefix 21 = 5-digit price in piastres (÷ 100), Prefix 22 = 5-digit price in whole EGP
  if (/^(21|22)\d{9,11}$/.test(clean)) {
    const prefix = clean.slice(0, 2);
    const plu4 = clean.slice(2, 6);
    const rawPriceField = parseInt(clean.slice(6, 11), 10) || 0;
    const targetAmountEgp =
      prefix === '21'
        ? Math.max(1, Math.round(rawPriceField) / 100)
        : Math.max(1, rawPriceField);
    const found = findProductByScalePlu(plu4, products);
    if (found) {
      const calc = calculatePosItemByAmountEgp(found.product, targetAmountEgp, found.index);
      return {
        product: found.product,
        weightGrams: calc.weightGrams,
        barcodeKind: 'scale_price',
        calc,
      };
    }
  }

  // 3. Check 6-digit PLU code (e.g. 200001..200099)
  if (/^(20|21|22)\d{4}$/.test(clean)) {
    const found = findProductByScalePlu(clean.slice(2, 6), products);
    if (found) {
      return {
        product: found.product,
        weightGrams: 250,
        barcodeKind: 'plu',
        calc: calculatePosItemByGrams(found.product, 250, found.index),
      };
    }
  }

  // 4. Direct match by product.barcode, id, slug, or name substring
  const foundIdx = products.findIndex(
    (p, idx) =>
      p.barcode === clean ||
      getProductBarcode(p, idx) === clean ||
      p.id.toLowerCase() === clean.toLowerCase() ||
      p.slug.toLowerCase() === clean.toLowerCase() ||
      p.name.includes(clean)
  );
  if (foundIdx !== -1) {
    const product = products[foundIdx];
    if (isUnitProduct(product)) {
      const variants = getResolvedProductWeights(product);
      const firstVar = variants[0];
      const unitPrice = firstVar?.price ?? product.unitPrice ?? product.pricePerKg ?? 100;
      const rawCostEgp = getProductCostForWeight(product, firstVar?.weightGrams || 1000);
      const netProfitEgp = unitPrice - rawCostEgp;
      const marginPercent =
        unitPrice > 0 ? Math.round((netProfitEgp / unitPrice) * 1000) / 10 : 0;
      return {
        product,
        weightGrams: firstVar?.weightGrams || 1000,
        barcodeKind: 'sku',
        calc: {
          weightGrams: firstVar?.weightGrams || 1000,
          weightLabel: firstVar?.label || product.unitLabel?.trim() || 'قطعة واحدة',
          unitPrice,
          rawCostEgp,
          netProfitEgp,
          marginPercent,
          barcodeLabel: product.barcode || getProductBarcode(product, foundIdx),
        },
      };
    }
    return {
      product,
      weightGrams: 250,
      barcodeKind: 'sku',
      calc: calculatePosItemByGrams(product, 250, foundIdx),
    };
  }

  return null;
}

/**
 * Shared helper to resolve product variants (either 4 standard weights in weight mode, or piece/pack variants in unit mode).
 */
export function getResolvedProductWeights(
  product: Product,
  include2000g: boolean = false
): WeightVariant[] {
  if (isUnitProduct(product)) {
    const unitLabel = product.unitLabel?.trim() || 'قطعة';
    const basePrice =
      product.unitPrice ??
      product.pricePerKg ??
      product.weights?.[0]?.price ??
      100;

    // Check if product.weights already defines unit/pack variants (not legacy 125g..1000g default set)
    const isLegacyWeightSet =
      Array.isArray(product.weights) &&
      product.weights.length >= 4 &&
      product.weights[0]?.weightGrams === 125 &&
      !product.weights[0]?.id?.startsWith('u-') &&
      !product.weights[0]?.unitsCount;

    if (Array.isArray(product.weights) && product.weights.length > 0 && !isLegacyWeightSet) {
      return product.weights.map((w, idx) => {
        const units =
          w.unitsCount && w.unitsCount > 0
            ? w.unitsCount
            : w.weightGrams >= 1000
              ? Math.max(1, Math.round(w.weightGrams / 1000))
              : 1;
        return {
          ...w,
          id: w.id || `u-${idx + 1}`,
          label: w.label || (units === 1 ? `${unitLabel} واحدة` : `عبوة ${units} ${unitLabel}`),
          unitsCount: units,
          weightGrams: units * 1000,
          grams: units * 1000,
        };
      });
    }

    return [
      {
        id: 'u-1',
        label: unitLabel,
        unitsCount: 1,
        weightGrams: 1000,
        grams: 1000,
        price: Math.round(basePrice),
      },
    ];
  }

  let list: WeightVariant[];
  if (product.weights && product.weights.length >= 4) {
    list = [...product.weights];
  } else {
    const kiloWeight = product.weights?.find((w) => (w.grams || w.weightGrams) === 1000);
    const fallbackKiloPrice =
      product.pricePerKg ||
      kiloWeight?.price ||
      (product.weights?.[0]?.price ? product.weights[0].price * 4 : 400);
    const generated = generateWeightsFromKiloPrice(
      fallbackKiloPrice,
      kiloWeight?.originalPrice
    );
    list = generated.map((gw) => {
      const existing = product.weights?.find(
        (ew) => (ew.grams || ew.weightGrams) === gw.weightGrams
      );
      return existing
        ? { ...gw, ...existing, grams: gw.weightGrams, weightGrams: gw.weightGrams }
        : gw;
    });
  }

  const shouldAdd2000g = include2000g || (product as any).supports2kg === true;
  if (shouldAdd2000g && !list.some((w) => (w.grams || w.weightGrams) === 2000)) {
    const kiloWeight = list.find((w) => (w.grams || w.weightGrams) === 1000);
    const kiloPrice = product.pricePerKg || kiloWeight?.price || 400;
    list.push(generate2000gWeightVariant(kiloPrice, kiloWeight?.originalPrice));
  }

  return list;
}

/**
 * Shared short weight/unit label formatter for buttons across ProductCard, ProductModal, and POS.
 */
export function getShortWeightLabel(w: WeightVariant): string {
  if (w.unitsCount || w.id?.startsWith('u-')) {
    return w.label;
  }
  const g = w.grams || w.weightGrams;
  if (g === 125) return 'ثمن 125ج';
  if (g === 250) return 'ربع 250ج';
  if (g === 500) return 'نصف 500ج';
  if (g === 1000) return 'كيلو 1000ج';
  if (g === 2000) return '2كجم 2000ج';
  return w.label;
}

/**
 * Shared helper to build default Partitioned Box slot selections for 1-click quick add
 * in Homepage, Shop, and POS Cashier.
 */
export function buildDefaultPartitionedBoxSlots(
  size: PartitionedBoxSize,
  products: Product[]
): BoxSlotSelection[] {
  const preset = PARTITIONED_BOX_PRESETS[size];
  const defaultProductIds =
    size === 'roqan_4'
      ? [
          'prod-super-seed-1',
          'prod-white-seed-1',
          'prod-aswani-peanut-1',
          'prod-cheese-crackers-1',
        ]
      : size === 'family_6'
        ? [
            'prod-super-seed-1',
            'prod-watermelon-seed-1',
            'prod-aswani-peanut-1',
            'prod-syrian-mix-1',
            'prod-cashew-1',
            'prod-almond-1',
          ]
        : [
            'prod-pistachio-1',
            'prod-cashew-1',
            'prod-hazelnut-1',
            'prod-almond-1',
            'prod-walnut-1',
            'prod-royal-mix-1',
          ];

  return defaultProductIds.map((pid, idx) => {
    const prod =
      products.find((p) => p.id === pid) ||
      products[idx % Math.max(1, products.length)];
    const pricePerKg =
      prod?.pricePerKg ||
      prod?.weights.find((w) => (w.grams || w.weightGrams) === 1000)?.price ||
      300;
    return {
      slotIndex: idx + 1,
      slotNumber: idx + 1,
      productId: prod?.id || `slot-${idx + 1}`,
      productName: prod?.name || `صنف مختار ${idx + 1}`,
      productImage: prod?.image || '',
      roastOption: prod?.roastOptions?.[0] || 'محمص مملح',
      slotGrams: preset.gramsPerSlot,
      weightGrams: preset.gramsPerSlot,
      pricePerKg,
      costPerKg: prod?.costPerKg || Math.round(pricePerKg * 0.68),
      isSuperVipItem: Boolean(prod?.isSuperVipItem),
    };
  });
}


