import {
  DeliveryMethodType,
  FulfillmentHub,
  ShippingRate,
  StoreSettings,
} from '@/types/store';

export const DEFAULT_GOVERNORATES_FREE_SHIPPING_THRESHOLD = 650;

export const FULFILLMENT_HUB_LABELS: Record<FulfillmentHub, string> = {
  cairo_october: 'مخزن القاهرة (٦ أكتوبر)',
  bani_mazar: 'مخزن بني مزار (المنيا)',
};

export const DEFAULT_EGYPT_GOVERNORATE_RATES: ShippingRate[] = [
  // مخزن القاهرة (٦ أكتوبر) — القاهرة الكبرى والوجه البحري والقناة والإسكندرية
  {
    id: 'gov-cairo',
    governorate: 'القاهرة',
    price: 55,
    estimatedDays: 'خلال 24 ساعة',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-giza-october',
    governorate: 'الجيزة و٦ أكتوبر والشيخ زايد',
    price: 55,
    estimatedDays: 'خلال 24 ساعة',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-qalyubia',
    governorate: 'القليوبية',
    price: 60,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-alexandria',
    governorate: 'الإسكندرية',
    price: 65,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-sharqia',
    governorate: 'الشرقية',
    price: 65,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-dakahlia',
    governorate: 'الدقهلية (المنصورة)',
    price: 65,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-gharbia',
    governorate: 'الغربية (طنطا)',
    price: 65,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-monufia',
    governorate: 'المنوفية',
    price: 65,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-beheira',
    governorate: 'البحيرة',
    price: 65,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-kafr-el-sheikh',
    governorate: 'كفر الشيخ',
    price: 65,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-damietta',
    governorate: 'دمياط',
    price: 65,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-ismailia',
    governorate: 'الإسماعيلية',
    price: 70,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-suez',
    governorate: 'السويس',
    price: 70,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-port-said',
    governorate: 'بورسعيد',
    price: 70,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-matrouh',
    governorate: 'مرسى مطروح',
    price: 85,
    estimatedDays: '2 - 4 أيام عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-north-sinai',
    governorate: 'شمال سيناء',
    price: 85,
    estimatedDays: '2 - 4 أيام عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },
  {
    id: 'gov-south-sinai',
    governorate: 'جنوب سيناء (شرم الشيخ والطور)',
    price: 85,
    estimatedDays: '2 - 4 أيام عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'cairo_october',
  },

  // مخزن بني مزار (المنيا) — المنيا ومحافظات الصعيد بالكامل
  {
    id: 'gov-minya',
    governorate: 'المنيا (مراكز المحافظة)',
    price: 45,
    estimatedDays: 'نفس اليوم أو خلال 24 ساعة',
    zoneType: 'governorate',
    fulfillmentHub: 'bani_mazar',
  },
  {
    id: 'gov-beni-suef',
    governorate: 'بني سويف',
    price: 55,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'bani_mazar',
  },
  {
    id: 'gov-fayoum',
    governorate: 'الفيوم',
    price: 55,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'bani_mazar',
  },
  {
    id: 'gov-assiut',
    governorate: 'أسيوط',
    price: 60,
    estimatedDays: '1 - 2 يوم عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'bani_mazar',
  },
  {
    id: 'gov-sohag',
    governorate: 'سوهاج',
    price: 65,
    estimatedDays: '2 - 3 أيام عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'bani_mazar',
  },
  {
    id: 'gov-qena',
    governorate: 'قنا',
    price: 70,
    estimatedDays: '2 - 3 أيام عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'bani_mazar',
  },
  {
    id: 'gov-luxor',
    governorate: 'الأقصر',
    price: 70,
    estimatedDays: '2 - 3 أيام عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'bani_mazar',
  },
  {
    id: 'gov-aswan',
    governorate: 'أسوان',
    price: 75,
    estimatedDays: '2 - 3 أيام عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'bani_mazar',
  },
  {
    id: 'gov-red-sea',
    governorate: 'البحر الأحمر (الغردقة)',
    price: 80,
    estimatedDays: '2 - 4 أيام عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'bani_mazar',
  },
  {
    id: 'gov-new-valley',
    governorate: 'الوادي الجديد',
    price: 85,
    estimatedDays: '2 - 4 أيام عمل',
    zoneType: 'governorate',
    fulfillmentHub: 'bani_mazar',
  },
];

const BANI_MAZAR_HUB_KEYWORDS = [
  'بني مزار',
  'المنيا',
  'مغاغة',
  'مطاي',
  'سمالوط',
  'ملوي',
  'بني سويف',
  'الفيوم',
  'أسيوط',
  'اسيوط',
  'سوهاج',
  'قنا',
  'الأقصر',
  'الاقصر',
  'أسوان',
  'اسوان',
  'البحر الأحمر',
  'البحر الاحمر',
  'الغردقة',
  'الوادي الجديد',
];

function normalizeGovKey(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

export function inferFulfillmentHubFromGovernorate(governorate?: string): FulfillmentHub {
  const norm = normalizeGovKey(governorate || '');
  if (!norm) return 'bani_mazar';
  for (const kw of BANI_MAZAR_HUB_KEYWORDS) {
    if (norm.includes(normalizeGovKey(kw))) {
      return 'bani_mazar';
    }
  }
  return 'cairo_october';
}

export function getFulfillmentHubLabel(hub?: FulfillmentHub): string {
  if (hub === 'cairo_october') return FULFILLMENT_HUB_LABELS.cairo_october;
  return FULFILLMENT_HUB_LABELS.bani_mazar;
}

/**
 * Returns the complete list of Egypt governorate shipping rates for customer selection,
 * preserving custom Admin-configured prices/ETAs while guaranteeing all 27 Egyptian governorates exist.
 */
export function getGovernorateShippingRates(shippingRates?: ShippingRate[]): ShippingRate[] {
  const customGovRates = (Array.isArray(shippingRates) ? shippingRates : []).filter(
    (r) =>
      r &&
      r.governorate &&
      r.zoneType !== 'bandar' &&
      r.zoneType !== 'village' &&
      r.zoneType !== 'pickup' &&
      !r.governorate.includes('بندر بني مزار') &&
      !r.governorate.includes('قرى مركز بني مزار') &&
      !r.governorate.includes('استلام سريع')
  );

  const byId = new Map<string, ShippingRate>();
  const byNorm = new Map<string, ShippingRate>();

  for (const rate of customGovRates) {
    const hydrated: ShippingRate = {
      ...rate,
      zoneType: 'governorate',
      fulfillmentHub: rate.fulfillmentHub || inferFulfillmentHubFromGovernorate(rate.governorate),
    };
    byId.set(rate.id, hydrated);
    byNorm.set(normalizeGovKey(rate.governorate), hydrated);
  }

  const merged: ShippingRate[] = [];
  const usedIds = new Set<string>();

  for (const def of DEFAULT_EGYPT_GOVERNORATE_RATES) {
    const defNorm = normalizeGovKey(def.governorate);
    const defBase = defNorm.split('(')[0].split(' ')[0];

    const matchedCustom =
      byId.get(def.id) ||
      byNorm.get(defNorm) ||
      customGovRates.find((r) => {
        if (usedIds.has(r.id)) return false;
        const rNorm = normalizeGovKey(r.governorate);
        return (
          rNorm === defNorm ||
          (defBase.length >= 3 && rNorm.includes(defBase) && !(defBase === 'بني' && !rNorm.includes('سويف')))
        );
      });

    if (matchedCustom) {
      usedIds.add(matchedCustom.id);
      merged.push({
        ...def,
        ...matchedCustom,
        zoneType: 'governorate',
        fulfillmentHub:
          matchedCustom.fulfillmentHub ||
          def.fulfillmentHub ||
          inferFulfillmentHubFromGovernorate(matchedCustom.governorate),
      });
    } else {
      merged.push(def);
    }
  }

  for (const extra of customGovRates) {
    if (!usedIds.has(extra.id)) {
      merged.push({
        ...extra,
        zoneType: 'governorate',
        fulfillmentHub: extra.fulfillmentHub || inferFulfillmentHubFromGovernorate(extra.governorate),
      });
    }
  }

  return merged;
}

export function findGovernorateRate(
  governorate: string | undefined,
  shippingRates?: ShippingRate[]
): ShippingRate | undefined {
  if (!governorate?.trim()) return undefined;
  const allRates = getGovernorateShippingRates(shippingRates);
  const target = normalizeGovKey(governorate);
  return (
    allRates.find((r) => normalizeGovKey(r.governorate) === target) ||
    allRates.find((r) => {
      const rn = normalizeGovKey(r.governorate);
      return rn.includes(target) || target.includes(rn);
    })
  );
}

export function resolveOrderFulfillmentHub(
  deliveryMethod: DeliveryMethodType | undefined,
  governorate: string | undefined,
  shippingRates?: ShippingRate[]
): FulfillmentHub {
  if (
    deliveryMethod === 'bandar_fast' ||
    deliveryMethod === 'villages_scheduled' ||
    deliveryMethod === 'store_pickup'
  ) {
    return 'bani_mazar';
  }
  const matched = findGovernorateRate(governorate, shippingRates);
  if (matched?.fulfillmentHub) return matched.fulfillmentHub;
  return inferFulfillmentHubFromGovernorate(governorate);
}

export function getFreeShippingThresholdForMethod(
  deliveryMethod: DeliveryMethodType | undefined,
  settings?: StoreSettings | null
): number {
  if (deliveryMethod === 'governorate_shipping') {
    const govThreshold = Number(settings?.governoratesFreeShippingThreshold);
    if (Number.isFinite(govThreshold) && govThreshold > 0) {
      return govThreshold;
    }
    return DEFAULT_GOVERNORATES_FREE_SHIPPING_THRESHOLD;
  }
  const localThreshold = Number(settings?.freeShippingThreshold);
  if (Number.isFinite(localThreshold) && localThreshold > 0) {
    return localThreshold;
  }
  return 300;
}
