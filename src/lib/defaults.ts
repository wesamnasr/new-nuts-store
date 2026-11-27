import {
  BorderRadiusStyle,
  CardStyle,
  HeroLayoutStyle,
  NavbarStyle,
  StoreFeatureFlags,
  StorePageContent,
  StoreSettings,
  StoreThemeConfig,
  StoreThemeId,
} from '@/types/store';

export interface StoreThemePresetMeta {
  id: StoreThemeId;
  name: string;
  subtitle: string;
  description: string;
  badge: string;
  isDark?: boolean;
  swatches: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    card: string;
  };
  defaults: {
    heroLayout: HeroLayoutStyle;
    navbarStyle: NavbarStyle;
    cardStyle: CardStyle;
    borderRadius: BorderRadiusStyle;
  };
}

export const DEFAULT_BRAND_NAME = 'محمصة حفصة للبن والمكسرات';
export const DEFAULT_CITY_NAME = 'بني مزار';
export const DEFAULT_CURRENCY_SYMBOL = 'ج.م';
export const DEFAULT_ORDER_PREFIX = 'HFS';

export const DEFAULT_BANDAR_ZONES = [
  'محيط مسجد الزراعيين والشارع الرئيسي',
  'شرق المحطة وطريق البحر',
  'شارع بورسعيد وشارع الإعدادية بنات',
  'شارع صيدلية مكة وموقف صندفا',
  'شارع الجمهورية ووسط البندر',
  'غرب المحطة وحي السلام والتقسيم الجديد',
];

export const DEFAULT_VILLAGE_ZONES = [
  'القيس',
  'صندفا',
  'بني علي',
  'شلقام',
  'أبشاق',
  'طمبو',
  'الجندية',
  'الحسينية وقرى شرق وغرب المركز',
];

export const DEFAULT_DELIVERY_BATCHES: string[] = [
  'دورة الظهيرة (2:00 ظهراً) — للحجز قبل 1:30 ظهراً',
  'دورة المساء (8:00 مساءً) — للحجز قبل 7:30 مساءً',
];

// Backward-compatible exports pointing to neutral blueprint defaults
export const BANI_MAZAR_BANDAR_ZONES = DEFAULT_BANDAR_ZONES;
export const BANI_MAZAR_VILLAGES = DEFAULT_VILLAGE_ZONES;
export const VILLAGE_DELIVERY_BATCHES = DEFAULT_DELIVERY_BATCHES;

export const DEFAULT_FEATURE_FLAGS: Required<StoreFeatureFlags> = {
  enableCoffeeBlender: true,
  blenderModuleLabel: 'معمل التوليفات',
  enableCustomBoxes: true,
  boxesModuleLabel: 'صمّم بوكسك',
  enableWeightScale: true,
  enableVillageBatches: true,
  enableVipWallet: true,
};

export function getResolvedFeatureFlags(
  settings?: StoreSettings | null
): Required<StoreFeatureFlags> {
  const raw = settings?.featureFlags;
  return {
    enableCoffeeBlender: raw?.enableCoffeeBlender ?? DEFAULT_FEATURE_FLAGS.enableCoffeeBlender,
    blenderModuleLabel:
      raw?.blenderModuleLabel?.trim() || DEFAULT_FEATURE_FLAGS.blenderModuleLabel,
    enableCustomBoxes: raw?.enableCustomBoxes ?? DEFAULT_FEATURE_FLAGS.enableCustomBoxes,
    boxesModuleLabel:
      raw?.boxesModuleLabel?.trim() || DEFAULT_FEATURE_FLAGS.boxesModuleLabel,
    enableWeightScale: raw?.enableWeightScale ?? DEFAULT_FEATURE_FLAGS.enableWeightScale,
    enableVillageBatches:
      raw?.enableVillageBatches ?? DEFAULT_FEATURE_FLAGS.enableVillageBatches,
    enableVipWallet:
      raw?.enableVipWallet ??
      settings?.pageContent?.enableVipWallet ??
      DEFAULT_FEATURE_FLAGS.enableVipWallet,
  };
}

export function getCurrencySymbol(settings?: StoreSettings | null): string {
  return settings?.currencySymbol?.trim() || DEFAULT_CURRENCY_SYMBOL;
}

export function getOrderPrefix(settings?: StoreSettings | null): string {
  const clean = (settings?.orderPrefix || DEFAULT_ORDER_PREFIX)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return clean || DEFAULT_ORDER_PREFIX;
}

export function getCityName(settings?: StoreSettings | null): string {
  return settings?.cityName?.trim() || DEFAULT_CITY_NAME;
}

function normalizeZoneOrBatchItem(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const rec = item as Record<string, unknown>;
    const lbl = typeof rec.label === 'string' ? rec.label.trim() : '';
    const note = typeof rec.cutoffNote === 'string' ? rec.cutoffNote.trim() : '';
    if (lbl && note && note !== lbl) return `${lbl} — ${note}`;
    if (lbl) return lbl;
    if (typeof rec.name === 'string') return rec.name.trim();
  }
  return '';
}

export function getResolvedBandarZones(settings?: StoreSettings | null): string[] {
  if (Array.isArray(settings?.bandarZones) && settings!.bandarZones.length > 0) {
    const cleaned = settings!.bandarZones.map(normalizeZoneOrBatchItem).filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }
  return DEFAULT_BANDAR_ZONES;
}

export function getResolvedVillageZones(settings?: StoreSettings | null): string[] {
  if (Array.isArray(settings?.villageZones) && settings!.villageZones.length > 0) {
    const cleaned = settings!.villageZones.map(normalizeZoneOrBatchItem).filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }
  return DEFAULT_VILLAGE_ZONES;
}

export function getResolvedDeliveryBatches(settings?: StoreSettings | null): string[] {
  if (Array.isArray(settings?.deliveryBatches) && settings!.deliveryBatches.length > 0) {
    const cleaned = settings!.deliveryBatches.map(normalizeZoneOrBatchItem).filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }
  return DEFAULT_DELIVERY_BATCHES;
}

export const STORE_THEMES: StoreThemePresetMeta[] = [
  {
    id: 'royal_roastery',
    name: 'إسبريسو وذهبي ملكي (فاتح — للمحامص والبن والتمور)',
    subtitle: 'رخامي دافئ (#FAF6F0) • إسبريسو (#231710) • أوك عسلي (#C88A4B) • ذهبي (#D4AF37)',
    description:
      'ثيم دافئ وفاخر يناسب المحامص، القهوة المختصة، المكسرات، التمور، والمخابز الحرفية.',
    badge: 'ثيم المحامص والأغذية',
    isDark: false,
    swatches: {
      primary: '#231710',
      secondary: '#C88A4B',
      accent: '#D4AF37',
      bg: '#FAF6F0',
      card: '#FFFFFF',
    },
    defaults: {
      heroLayout: 'split',
      navbarStyle: 'classic',
      cardStyle: 'classic',
      borderRadius: 'rounded',
    },
  },
  {
    id: 'modern_minimal',
    name: 'أزرق سماوي عصري (فاتح — للماركت والتجزئة العامة)',
    subtitle: 'أبيض ثلجي (#F8FBFF) • كحلي داكن (#07132E) • أزرق ملكي (#2563EB)',
    description:
      'ثيم مشرق ونظيف يناسب السوبر ماركت، منتجات الألبان والجبن، المجمدات، ومحلات التجزئة العامة.',
    badge: 'ثيم الماركت والتجزئة',
    isDark: false,
    swatches: {
      primary: '#07132E',
      secondary: '#2563EB',
      accent: '#0284C7',
      bg: '#E2EEFC',
      card: '#F8FBFF',
    },
    defaults: {
      heroLayout: 'split',
      navbarStyle: 'classic',
      cardStyle: 'soft_elevated',
      borderRadius: 'rounded',
    },
  },
  {
    id: 'emerald_palace',
    name: 'الزمرد الطبيعي العميق (داكن — للعطارة والأورجانيك)',
    subtitle: 'زمردي داكن (#041A13) • بطاقات غابية (#092B20) • نعناعي مشرق (#34D399)',
    description:
      'ثيم زمردي فخم بوضع ليلي مريح يناسب العطارة، الأعشاب الطبيعية، العسل، والمنتجات العضوية.',
    badge: 'ثيم العطارة والطبيعة',
    isDark: true,
    swatches: {
      primary: '#041A13',
      secondary: '#10B981',
      accent: '#34D399',
      bg: '#041A13',
      card: '#092B20',
    },
    defaults: {
      heroLayout: 'split',
      navbarStyle: 'dark_royal',
      cardStyle: 'editorial',
      borderRadius: 'rounded',
    },
  },
  {
    id: 'saffron_velvet',
    name: 'المخمل البنفسجي والكهرمان (داكن — للحلويات والعطور)',
    subtitle: 'بنفسجي ملكي (#130722) • مخملي (#210E38) • ذهبي كهرماني (#F59E0B)',
    description:
      'ثيم ملكي فاخر يناسب محلات الحلويات الشرقية، الشوكولاتة المستوردة، الهدايا، وتركيب العطور.',
    badge: 'ثيم الحلويات والعطور',
    isDark: true,
    swatches: {
      primary: '#130722',
      secondary: '#E879F9',
      accent: '#F59E0B',
      bg: '#130722',
      card: '#210E38',
    },
    defaults: {
      heroLayout: 'showcase',
      navbarStyle: 'dark_royal',
      cardStyle: 'editorial',
      borderRadius: 'pill',
    },
  },
];

export const DEFAULT_THEME_CONFIG: StoreThemeConfig = {
  themeId: 'royal_roastery',
  heroLayout: 'split',
  navbarStyle: 'classic',
  cardStyle: 'classic',
  borderRadius: 'rounded',
  showThemeSwitcher: true,
};

export function getResolvedThemeConfig(settings?: StoreSettings | null): StoreThemeConfig {
  const raw = settings?.themeConfig;
  if (!raw) {
    return { ...DEFAULT_THEME_CONFIG };
  }
  const validIds = new Set<StoreThemeId>(STORE_THEMES.map((t) => t.id));
  const themeId: StoreThemeId = validIds.has(raw.themeId)
    ? raw.themeId
    : DEFAULT_THEME_CONFIG.themeId;

  return {
    themeId,
    heroLayout: raw.heroLayout || DEFAULT_THEME_CONFIG.heroLayout,
    navbarStyle: raw.navbarStyle || DEFAULT_THEME_CONFIG.navbarStyle,
    cardStyle: raw.cardStyle || DEFAULT_THEME_CONFIG.cardStyle,
    borderRadius: raw.borderRadius || DEFAULT_THEME_CONFIG.borderRadius,
    showThemeSwitcher:
      typeof raw.showThemeSwitcher === 'boolean'
        ? raw.showThemeSwitcher
        : DEFAULT_THEME_CONFIG.showThemeSwitcher,
  };
}

export const DEFAULT_PAGE_CONTENT: StorePageContent = {
  // Header & Announcement Bar
  showAnnouncementBar: true,
  headerSubtitle: 'بني مزار — أمام مسجد الزراعيين • تحميص يومي طازج',
  logoEmoji: '',

  // Landing Page: Hero Section
  heroBadge: 'محمصة حفصة — بني مزار • تحميص يومي طازج 100%',
  heroTitlePrefix: 'أصل التحميصة ومزاج القهوة الفاخر..',
  heroTitleHighlight: 'الآن في قلب بني مزار',
  heroTitleSuffix: 'أمام مسجد الزراعيين',
  heroDescription:
    '24 عين مكسرات وتسالي محمصة يومياً، 4 صوامع بن طازج وركن إسبريسو، بوكسات السهرة المقسمة، وتوصيل فوري خلال 30 دقيقة للبندر ودورتين يومياً للقرى.',
  heroImage: '/images/products/royal-mix.jpg',
  heroPrimaryCtaText: 'صمّم بوكس السهرة (125 ج)',
  heroSecondaryCtaText: 'اعمل توليفة قهوتك',
  heroBoxesCtaText: 'تصفح المتجر',
  heroFeaturedProductId: 'prod-box-roqan-125',
  heroFeaturedBadge: 'الأكثر طلباً في بني مزار',
  heroFeaturedTitle: 'بوكس السهرة المقسم «لمة الخميس»',
  heroFeaturedSubtitle: '4 خانات مختارة بعناية — 125 ج.م',
  heroStats: [
    { value: '30 دقيقة', label: 'توصيل فوري لبندر بني مزار' },
    { value: '5% كاش باك', label: 'محفظة حفصة VIP الموحدة' },
    { value: '100%', label: 'تحميص وتعبئة يومية طازجة' },
  ],

  // Landing Page: Custom Box Banner
  showCustomBoxBanner: true,
  customBoxBannerBadge: 'استوديو حفصة للبوكسات',
  customBoxBannerTitle: 'صمّم بوكس السهرة واللمة على ذوقك',
  customBoxBannerDesc:
    'اختر حجم البوكس (4 أو 6 خانات) واملأ كل خانة بأصنافك المفضلة من المكسرات والتسالي والكاندي بسعر محسوب لحظياً.',
  customBoxBannerPills: [
    'بوكس روقان 4 خانات (125 ج.م)',
    'بوكس العيلة 6 خانات (250 ج.م)',
    'بوكس هدايا VIP (450 ج.م)',
  ],
  customBoxBannerCta: 'ابدأ تصميم بوكسك الآن',

  // Landing Page: Mixed Boxes Section
  showMixedBoxesSection: true,
  mixedBoxesBadge: 'الأكثر مبيعاً',
  mixedBoxesTitle: 'بوكسات السهرة واللمة المقسمة',
  mixedBoxesDesc: '',
  mixedBoxesGiftNote: '5% كاش باك فوري في محفظة حفصة VIP للفواتير فوق 150 ج.م',

  // Landing Page: Coupons Banner
  showCouponsSection: true,
  couponsBannerBadge: 'عروض حفصة الخاطفة',
  couponsBannerTitle: 'عروض وباقات التوفير الأسبوعية',

  // Landing Page: Why Choose Us (4 Trust Features)
  showTrustSection: true,
  trustSectionSubheading: 'لماذا محمصة حفصة ببني مزار؟',
  trustSectionTitle: 'حفصة.. طزاجة تُرى ورائحة لا تُنسى',
  trustFeatures: [
    {
      id: 'tf-1',
      icon: 'Flame',
      title: 'تحميص وتعبئة يومية 100%',
      description: 'مكسرات وبن يُحمّص ويُطحن طازجاً أمام عينك كل يوم بتغليف حراري يحفظ القرمشة.',
    },
    {
      id: 'tf-2',
      icon: 'Zap',
      title: 'توصيل 30 دقيقة للبندر ودورتين للقرى',
      description: 'توصيل فوري لبندر بني مزار ودورية حفصة اليومية للقرى الكبرى (2 ظهراً و8 مساءً).',
    },
    {
      id: 'tf-3',
      icon: 'Crown',
      title: 'كاش باك 5% في محفظة VIP',
      description: 'رصيد نقدي فوري برقم موبايلك موحّد بين كاشير المحل والموقع الإلكتروني.',
    },
    {
      id: 'tf-4',
      icon: 'Scale',
      title: 'دقة ميزان باركود إلكتروني',
      description: 'وزن دقيق بالجرام (ثمن، ربع، نصف، كيلو) أو بالقطعة والكوب بنفس سعر المحل.',
    },
  ],

  // Custom Box Builder Page (/build-box & /custom-box)
  customBoxPageBadge: 'استوديو بوكسات حفصة',
  customBoxPageTitle: 'صمّم بوكس السهرة المقسم بنفسك',
  customBoxPageDesc: '',

  // Track Order Page (/track & /track-order)
  trackOrderPageBadge: 'متابعة طلبات محمصة حفصة',
  trackOrderPageTitle: 'تتبع حالة طلبك لحظياً',
  trackOrderPageDesc: '',

  // Checkout & Payment Methods (/checkout)
  checkoutPageTitle: 'إتمام الطلب السريع — محمصة حفصة',
  checkoutPageDesc: '',
  enableCod: true,
  enableInstapay: true,
  enableVodafoneCash: true,
  enableVipWallet: true,

  // Footer & Floating WhatsApp
  footerDescription:
    'محمصة حفصة للبن والمكسرات بمركز بني مزار (أمام مسجد الزراعيين مباشرة) — طزاجة يومية، ركن قهوة وإسبريسو، وتوصيل سريع للبندر والقرى.',
  footerFeatures: [
    {
      id: 'ff-1',
      icon: 'Sparkles',
      title: 'تحميص وطحن فوري أمامك',
      description: 'بن ومكسرات نخب أول تُجهّز وتُغلّف طازجة عند الطلب.',
    },
    {
      id: 'ff-2',
      icon: 'ShieldCheck',
      title: 'نادي حفصة VIP الموحد',
      description: '5% كاش باك فوري برقم موبايلك بين المحل والموقع.',
    },
    {
      id: 'ff-3',
      icon: 'Truck',
      title: 'توصيل بني مزار والقرى',
      description: '30 دقيقة داخل البندر ودورتين يومياً للقرى الكبرى.',
    },
  ],
  showFloatingWhatsapp: true,
  floatingWhatsappText: 'اطلب عبر واتساب حفصة',
  floatingWhatsappMessage: 'مرحباً محمصة حفصة (بني مزار)، أرغب في الاستفسار أو الطلب السريع.',
};

export const DEFAULT_PRODUCT_IMAGE = '/images/products/royal-mix.jpg';

export const WEBP_ENHANCED_LOCAL_IMAGES: Record<string, string> = {
  '/images/branch/store-exterior.jpg': '/images/branch/store-exterior.webp',
  '/images/branch/store-interior.jpg': '/images/branch/store-interior.webp',
  '/images/products/almond.jpg': '/images/products/almond.webp',
  '/images/products/apricots-prunes.jpg': '/images/products/apricots-prunes.webp',
  '/images/products/cashew.jpg': '/images/products/cashew.webp',
  '/images/products/energy-mix.jpg': '/images/products/energy-mix.webp',
  '/images/products/hazelnut.jpg': '/images/products/hazelnut.webp',
  '/images/products/pistachio.jpg': '/images/products/pistachio.webp',
  '/images/products/royal-mix.jpg': '/images/products/royal-mix.webp',
  '/images/products/savory-snacks.jpg': '/images/products/savory-snacks.webp',
  '/images/products/stuffed-dates.jpg': '/images/products/stuffed-dates.webp',
  '/images/products/walnut.jpg': '/images/products/walnut.webp',
  '/images/brand/hafsa-logo-main.png': '/images/brand/hafsa-logo-main.webp',
  '/images/brand/hafsa-sticker-gold.png': '/images/brand/hafsa-sticker-gold.webp',
};

export function getSafeImageUrl(url?: string | null, fallback: string = DEFAULT_PRODUCT_IMAGE): string {
  const resolved = typeof url === 'string' && url.trim().length > 0 ? url.trim() : fallback;
  return WEBP_ENHANCED_LOCAL_IMAGES[resolved] || resolved;
}

export function getOgSafeImageUrl(url?: string | null, fallback: string = DEFAULT_PRODUCT_IMAGE): string {
  if (typeof url === 'string' && url.trim().length > 0) {
    return url.trim();
  }
  return fallback;
}

export function stripUiEmojis(value?: string | null): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function formatCategoryName(name?: string | null): string {
  if (typeof name !== 'string') return '';
  return stripUiEmojis(name)
    .replace(/\s*\(VIP Nuts\)\s*/gi, '')
    .replace(/^[^\w\u0600-\u06FF]+\s*/, '')
    .trim();
}

export function getResolvedPageContent(settings?: StoreSettings | null): StorePageContent {
  if (!settings?.pageContent) {
    return DEFAULT_PAGE_CONTENT;
  }
  const pc = settings.pageContent;
  return {
    ...DEFAULT_PAGE_CONTENT,
    ...pc,
    heroImage: getSafeImageUrl(pc.heroImage, DEFAULT_PAGE_CONTENT.heroImage),
    heroStats:
      Array.isArray(pc.heroStats) && pc.heroStats.length > 0
        ? pc.heroStats
        : DEFAULT_PAGE_CONTENT.heroStats,
    customBoxBannerPills:
      Array.isArray(pc.customBoxBannerPills) && pc.customBoxBannerPills.length > 0
        ? pc.customBoxBannerPills
        : DEFAULT_PAGE_CONTENT.customBoxBannerPills,
    trustFeatures:
      Array.isArray(pc.trustFeatures) && pc.trustFeatures.length > 0
        ? pc.trustFeatures
        : DEFAULT_PAGE_CONTENT.trustFeatures,
    footerFeatures:
      Array.isArray(pc.footerFeatures) && pc.footerFeatures.length > 0
        ? pc.footerFeatures
        : DEFAULT_PAGE_CONTENT.footerFeatures,
  };
}
