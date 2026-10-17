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
  originalPricePerKg?: number
): WeightVariant[] {
  const safeKilo = Math.max(0, Number(pricePerKg) || 0);
  const safeOrig =
    originalPricePerKg && originalPricePerKg > safeKilo
      ? Number(originalPricePerKg)
      : undefined;

  return [
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
}

/**
 * Returns the exact price for any weight in grams based on a product's kilo price or weight variants.
 */
export function getProductPriceForWeight(product: Product, weightGrams: number): number {
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
 * Returns the raw cost (from Arafat's sheet) for a given weight in grams.
 */
export function getProductCostForWeight(product: Product, weightGrams: number): number {
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
  approximateTotalGrams: number;
  basePrice: number;
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
    badge: 'الأكثر مبيعاً في بني مزار 🔥',
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

  const totalRawCost = rawIngredientsCost + preset.packagingCost;
  const minSafeSellingPrice =
    Math.ceil(totalRawCost / (1 - preset.minMarginPercent / 100) / 5) * 5;
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
    option: 'تحويجة حفصة الملكية بالزعفران والمستكة',
    name: 'تحويجة حفصة الملكية بالزعفران والمستكة',
    extraPerKg: 100,
    desc: 'تحويجة حفصة الملكية الفاخرة بالحبهان والمستكة اليوناني والزعفران',
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
  let beanOriginSummary = input.beanOrigin || 'توليفة حفصة الخاصة';

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
      (s) => s.id === input.spicing || s.option === input.spicing || s.name === input.spicing
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
 * Calculates exact POS price, cost, and barcode when weighing by grams on the store scale.
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

  const plu = getProductBarcode(product, productIndex).slice(0, 6).padEnd(6, '0');
  const gramsStr = String(Math.min(99999, safeGrams)).padStart(5, '0');
  const barcodeLabel = `${plu}${gramsStr}7`;

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
 * (e.g. "عايز بـ 50 جنيه لب سوبر" or "عايز بـ 100 جنيه مكسرات")
 */
export function calculatePosItemByAmountEgp(
  product: Product,
  targetAmountEgp: number,
  productIndex = 0
): PosScaleItemResult {
  const safeAmount = Math.max(5, Math.round(Number(targetAmountEgp) || 50));
  const kiloPrice =
    product.pricePerKg ||
    product.weights?.find((w) => (w.weightGrams || w.grams) === 1000)?.price ||
    400;
  const weightGrams = Math.max(10, Math.round((safeAmount / kiloPrice) * 1000));
  const rawCostEgp = getProductCostForWeight(product, weightGrams);
  const netProfitEgp = safeAmount - rawCostEgp;
  const marginPercent =
    safeAmount > 0 ? Math.round((netProfitEgp / safeAmount) * 1000) / 10 : 0;

  const plu = getProductBarcode(product, productIndex).slice(0, 6).padEnd(6, '0');
  const gramsStr = String(Math.min(99999, weightGrams)).padStart(5, '0');
  const barcodeLabel = `${plu}${gramsStr}7`;

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
 * Parses an EAN-13 electronic scale barcode (20PPPPWWWWWC) or product PLU/slug/name.
 */
export function parseScaleBarcode(
  code: string,
  products: Product[]
): { product: Product; weightGrams: number; calc: PosScaleItemResult } | null {
  const clean = (code || '').trim();
  if (!clean || !products || products.length === 0) return null;

  // 1. Check 12-13 digit weight-embedded scale barcode: 20 + 4-digit PLU + 5-digit weightGrams + checksum
  if (/^20\d{9,11}$/.test(clean)) {
    const pluIndex = parseInt(clean.slice(2, 6), 10) - 1;
    const weightGrams = parseInt(clean.slice(6, 11), 10) || 250;
    const product = products[pluIndex] || products[0];
    if (product) {
      return {
        product,
        weightGrams,
        calc: calculatePosItemByGrams(product, weightGrams, Math.max(0, pluIndex)),
      };
    }
  }

  // 2. Check 6-digit PLU code (e.g. 200001..200029)
  if (/^20\d{4}$/.test(clean)) {
    const pluIndex = parseInt(clean.slice(2, 6), 10) - 1;
    const product = products[pluIndex];
    if (product) {
      return {
        product,
        weightGrams: 250,
        calc: calculatePosItemByGrams(product, 250, pluIndex),
      };
    }
  }

  // 3. Direct match by product.barcode, id, slug, or name substring
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
    return {
      product,
      weightGrams: 250,
      calc: calculatePosItemByGrams(product, 250, foundIdx),
    };
  }

  return null;
}

/**
 * Shared helper to resolve the 4 standard weight variants (125g, 250g, 500g, 1000g) for any product.
 * Eliminates duplicate weight fallback generation across ProductCard, ProductModal, ProductDetail, and POS.
 */
export function getResolvedProductWeights(product: Product): WeightVariant[] {
  if (product.weights && product.weights.length >= 4) {
    return product.weights;
  }
  const kiloWeight = product.weights?.find((w) => (w.grams || w.weightGrams) === 1000);
  const fallbackKiloPrice =
    product.pricePerKg ||
    kiloWeight?.price ||
    (product.weights?.[0]?.price ? product.weights[0].price * 4 : 400);
  const generated = generateWeightsFromKiloPrice(
    fallbackKiloPrice,
    kiloWeight?.originalPrice
  );
  return generated.map((gw) => {
    const existing = product.weights?.find(
      (ew) => (ew.grams || ew.weightGrams) === gw.weightGrams
    );
    return existing
      ? { ...gw, ...existing, grams: gw.weightGrams, weightGrams: gw.weightGrams }
      : gw;
  });
}

/**
 * Shared short weight label formatter for buttons across ProductCard, ProductModal, and POS.
 */
export function getShortWeightLabel(w: WeightVariant): string {
  const g = w.grams || w.weightGrams;
  if (g === 125) return 'ثمن 125ج';
  if (g === 250) return 'ربع 250ج';
  if (g === 500) return 'نصف 500ج';
  if (g === 1000) return 'كيلو 1000ج';
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


