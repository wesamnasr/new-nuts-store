import { Product, RoastOption, CustomMixItem } from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';

export interface CustomBoxCalculationResult {
  isValid: boolean;
  totalPrice: number;
  totalPercentage: number;
  breakdown: CustomMixItem[];
  error?: string;
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
    const v500 = product.weights.find((w) => w.weightGrams === 500 || w.id === 'w-500');
    if (v500) return v500.price;

    const v1000 = product.weights.find((w) => w.weightGrams === 1000 || w.id === 'w-1000');
    if (v1000) return Math.round(v1000.price / 2);

    const v250 = product.weights.find((w) => w.weightGrams === 250 || w.id === 'w-250');
    if (v250) return v250.price * 2;

    return product.weights[0].price;
  }

  if (boxSizeGrams === 1000) {
    const v1000 = product.weights.find((w) => w.weightGrams === 1000 || w.id === 'w-1000');
    if (v1000) return v1000.price;

    const v500 = product.weights.find((w) => w.weightGrams === 500 || w.id === 'w-500');
    if (v500) return v500.price * 2;

    return product.weights[product.weights.length - 1].price;
  }

  if (boxSizeGrams === 2000) {
    const v2000 = product.weights.find((w) => w.weightGrams === 2000 || w.id === 'w-2000');
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

  // Enforce positive portions
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

  const totalPercentage = Math.round(
    portions.reduce((sum, p) => sum + p.percentage, 0) * 100
  ) / 100;

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

  // Check that all products have a valid base price for this box size
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

  // Exactly 100% capacity
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
