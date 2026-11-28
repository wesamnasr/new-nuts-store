import {
  BorderRadiusStyle,
  CardStyle,
  HeroLayoutStyle,
  NavbarStyle,
  ReceiptConfig,
  ReceiptDividerStyle,
  ReceiptFontSizeMode,
  ReceiptHeaderStyle,
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
  enableHallsAndTables: false,
  enableBlindShiftClose: true,
};

export const DEFAULT_PARTNERS = [
  { id: 'partner-1', name: 'الشريك الأول (إدارة المحمصة)', sharePercent: 25 },
  { id: 'partner-2', name: 'الشريك الثاني (التوريدات والمخزون)', sharePercent: 25 },
  { id: 'partner-3', name: 'الشريك الثالث (المحاسبة والمالية)', sharePercent: 25 },
  { id: 'partner-4', name: 'الشريك الرابع (العروض والتسويق)', sharePercent: 25 },
];

export function getResolvedPartners(
  settings?: StoreSettings | null
): Array<{ id: string; name: string; sharePercent: number }> {
  if (Array.isArray(settings?.partnersList) && settings!.partnersList.length > 0) {
    return settings!.partnersList;
  }
  return DEFAULT_PARTNERS;
}

export function getResolvedManagerPin(settings?: StoreSettings | null): string {
  const clean = (settings?.managerPin || '').trim();
  return clean.length >= 4 ? clean : '1234';
}

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
    enableHallsAndTables:
      raw?.enableHallsAndTables ?? DEFAULT_FEATURE_FLAGS.enableHallsAndTables,
    enableBlindShiftClose:
      raw?.enableBlindShiftClose ?? DEFAULT_FEATURE_FLAGS.enableBlindShiftClose,
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

export const DEFAULT_RECEIPT_CONFIG: Required<ReceiptConfig> = {
  paperWidthMm: 80,
  headerStyle: 'classic',
  dividerStyle: 'dashed',
  fontSizeMode: 'normal',

  // Header lines
  showLogo: true,
  logoUrl: '/images/brand/hafsa-logo-icon.png',
  logoSizePx: 48,
  showStoreName: true,
  customStoreName: '',
  showHeaderSubtitle: true,
  headerSubtitle: '',
  showInvoiceTitle: true,
  invoiceTitle: '',
  showAddress: true,
  customAddress: '',
  showPhone: true,
  customPhone: '',

  // Meta lines
  showOrderNumber: true,
  showOrderTime: true,
  showCashierName: false,
  showCustomerInfo: true,
  showCustomerName: true,
  showPaymentMethod: true,
  showCustomerPhone: true,
  showCustomerGovernorate: true,
  showCustomerAddress: true,

  // Items table
  showItemWeight: true,
  showItemDetails: true,
  showQuantityColumn: true,
  showUnitPriceColumn: true,

  // Totals & payment lines
  showItemCount: true,
  showSubtotal: true,
  showDiscount: true,
  showVipRedeemed: true,
  showShippingCost: true,
  totalLabel: 'الإجمالي المطلوب:',
  showPaymentBreakdown: true,
  showCashTenderedAndChange: true,
  showVipCashback: true,
  showTaxDetails: true,

  // Bottom lines
  showReturnPolicy: false,
  returnPolicyText: 'الاستبدال أو الاسترجاع خلال 24 ساعة بأصل الفاتورة وفي نفس حالة الشراء.',
  showBarcode: true,
  showQrCode: true,
  qrCodeUrl: 'https://hafsahnuts.com',
  qrCodeCaption: 'امسح الكود للطلب الأونلاين — hafsahnuts.com',
  showPromoLine: true,
  promoLine: 'اطلب أونلاين من hafsahnuts.com وخد 5% كاش باك في محفظتك!',
  showFooterMessage: true,
  footerMessage: 'شكراً لتسوقكم معنا • نتشرف بخدمتكم دائماً',
};

export interface ReceiptDesignPreset {
  id: 'supermarket_classic' | 'boutique_framed' | 'compact_express_58';
  name: string;
  description: string;
  badge: string;
  config: Partial<ReceiptConfig>;
}

export const RECEIPT_DESIGN_PRESETS: ReceiptDesignPreset[] = [
  {
    id: 'supermarket_classic',
    name: 'سوبرماركت كلاسيكي',
    description: 'رول 80 مم قياسي بشعار المتجر وجدول 4 أعمدة وباركود ورمز QR.',
    badge: '80 مم • متوازن',
    config: {
      paperWidthMm: 80,
      headerStyle: 'classic',
      dividerStyle: 'dashed',
      fontSizeMode: 'normal',
      showLogo: true,
      logoSizePx: 48,
      showInvoiceTitle: false,
      showReturnPolicy: false,
      showUnitPriceColumn: true,
      showQuantityColumn: true,
      showItemDetails: true,
      showBarcode: true,
      showQrCode: true,
    },
  },
  {
    id: 'boutique_framed',
    name: 'إطار فاخر مميز',
    description: 'ترويسة مؤطرة بوضوح مع فواصل مزدوجة وخط أكبر وسياسة استبدال واضحة.',
    badge: '80 مم • رسمي',
    config: {
      paperWidthMm: 80,
      headerStyle: 'boxed',
      dividerStyle: 'double',
      fontSizeMode: 'large',
      showLogo: true,
      logoSizePx: 56,
      showInvoiceTitle: true,
      invoiceTitle: 'فاتورة مبيعات معتمدة',
      showReturnPolicy: true,
      returnPolicyText: 'الاستبدال أو الاسترجاع خلال 24 ساعة بأصل الفاتورة وفي نفس حالة الشراء.',
      showUnitPriceColumn: true,
      showQuantityColumn: true,
      showItemDetails: true,
      showBarcode: true,
      showQrCode: true,
    },
  },
  {
    id: 'compact_express_58',
    name: 'مختصر سريع (58 مم)',
    description: 'مصمم لطابعات 58 مم الضيقة لتوفير الورق بدون عمود سعر الوحدة وبخط مضغوط.',
    badge: '58 مم • اقتصادي',
    config: {
      paperWidthMm: 58,
      headerStyle: 'minimal',
      dividerStyle: 'dashed',
      fontSizeMode: 'compact',
      showLogo: false,
      logoSizePx: 38,
      showInvoiceTitle: true,
      invoiceTitle: 'بون مبيعات',
      showReturnPolicy: false,
      showUnitPriceColumn: false,
      showQuantityColumn: true,
      showItemDetails: true,
      showBarcode: true,
      showQrCode: false,
    },
  },
];

export function getResolvedReceiptConfig(
  settings?: StoreSettings | null
): Required<ReceiptConfig> {
  const raw = settings?.receiptConfig;
  const fallbackWidth: 58 | 80 = settings?.thermalPaperWidthMm === 58 ? 58 : 80;
  const paperWidthMm: 58 | 80 =
    raw?.paperWidthMm === 58 || raw?.paperWidthMm === 80
      ? raw.paperWidthMm
      : fallbackWidth;

  const validHeaderStyles: ReceiptHeaderStyle[] = ['classic', 'boxed', 'minimal'];
  const headerStyle: ReceiptHeaderStyle =
    raw?.headerStyle && validHeaderStyles.includes(raw.headerStyle)
      ? raw.headerStyle
      : DEFAULT_RECEIPT_CONFIG.headerStyle;

  const validDividerStyles: ReceiptDividerStyle[] = ['dashed', 'solid', 'double'];
  const dividerStyle: ReceiptDividerStyle =
    raw?.dividerStyle && validDividerStyles.includes(raw.dividerStyle)
      ? raw.dividerStyle
      : DEFAULT_RECEIPT_CONFIG.dividerStyle;

  const validFontModes: ReceiptFontSizeMode[] = ['compact', 'normal', 'large'];
  const fontSizeMode: ReceiptFontSizeMode =
    raw?.fontSizeMode && validFontModes.includes(raw.fontSizeMode)
      ? raw.fontSizeMode
      : DEFAULT_RECEIPT_CONFIG.fontSizeMode;

  const parsedLogoSize = Number(raw?.logoSizePx);
  const logoSizePx =
    Number.isFinite(parsedLogoSize) && parsedLogoSize >= 28 && parsedLogoSize <= 84
      ? Math.round(parsedLogoSize)
      : DEFAULT_RECEIPT_CONFIG.logoSizePx;

  const legacyCustomerInfo =
    typeof raw?.showCustomerInfo === 'boolean'
      ? raw.showCustomerInfo
      : DEFAULT_RECEIPT_CONFIG.showCustomerInfo;

  const resolvedReturnPolicyText =
    typeof raw?.returnPolicyText === 'string'
      ? raw.returnPolicyText
      : DEFAULT_RECEIPT_CONFIG.returnPolicyText;

  return {
    paperWidthMm,
    headerStyle,
    dividerStyle,
    fontSizeMode,
    showLogo: typeof raw?.showLogo === 'boolean' ? raw.showLogo : DEFAULT_RECEIPT_CONFIG.showLogo,
    logoUrl:
      typeof raw?.logoUrl === 'string' && raw.logoUrl.trim()
        ? raw.logoUrl.trim()
        : DEFAULT_RECEIPT_CONFIG.logoUrl,
    logoSizePx,
    showStoreName:
      typeof raw?.showStoreName === 'boolean'
        ? raw.showStoreName
        : DEFAULT_RECEIPT_CONFIG.showStoreName,
    customStoreName:
      typeof raw?.customStoreName === 'string'
        ? raw.customStoreName
        : DEFAULT_RECEIPT_CONFIG.customStoreName,
    showHeaderSubtitle:
      typeof raw?.showHeaderSubtitle === 'boolean'
        ? raw.showHeaderSubtitle
        : DEFAULT_RECEIPT_CONFIG.showHeaderSubtitle,
    headerSubtitle:
      typeof raw?.headerSubtitle === 'string'
        ? raw.headerSubtitle
        : DEFAULT_RECEIPT_CONFIG.headerSubtitle,
    showInvoiceTitle:
      typeof raw?.showInvoiceTitle === 'boolean'
        ? raw.showInvoiceTitle
        : DEFAULT_RECEIPT_CONFIG.showInvoiceTitle,
    invoiceTitle:
      typeof raw?.invoiceTitle === 'string'
        ? raw.invoiceTitle
        : DEFAULT_RECEIPT_CONFIG.invoiceTitle,
    showAddress:
      typeof raw?.showAddress === 'boolean' ? raw.showAddress : DEFAULT_RECEIPT_CONFIG.showAddress,
    customAddress:
      typeof raw?.customAddress === 'string'
        ? raw.customAddress
        : DEFAULT_RECEIPT_CONFIG.customAddress,
    showPhone:
      typeof raw?.showPhone === 'boolean' ? raw.showPhone : DEFAULT_RECEIPT_CONFIG.showPhone,
    customPhone:
      typeof raw?.customPhone === 'string'
        ? raw.customPhone
        : DEFAULT_RECEIPT_CONFIG.customPhone,
    showOrderNumber:
      typeof raw?.showOrderNumber === 'boolean'
        ? raw.showOrderNumber
        : DEFAULT_RECEIPT_CONFIG.showOrderNumber,
    showOrderTime:
      typeof raw?.showOrderTime === 'boolean'
        ? raw.showOrderTime
        : DEFAULT_RECEIPT_CONFIG.showOrderTime,
    showCashierName:
      typeof raw?.showCashierName === 'boolean'
        ? raw.showCashierName
        : DEFAULT_RECEIPT_CONFIG.showCashierName,
    showCustomerInfo: legacyCustomerInfo,
    showCustomerName:
      typeof raw?.showCustomerName === 'boolean' ? raw.showCustomerName : legacyCustomerInfo,
    showPaymentMethod:
      typeof raw?.showPaymentMethod === 'boolean'
        ? raw.showPaymentMethod
        : DEFAULT_RECEIPT_CONFIG.showPaymentMethod,
    showCustomerPhone:
      typeof raw?.showCustomerPhone === 'boolean' ? raw.showCustomerPhone : legacyCustomerInfo,
    showCustomerGovernorate:
      typeof raw?.showCustomerGovernorate === 'boolean'
        ? raw.showCustomerGovernorate
        : legacyCustomerInfo,
    showCustomerAddress:
      typeof raw?.showCustomerAddress === 'boolean' ? raw.showCustomerAddress : legacyCustomerInfo,
    showItemWeight:
      typeof raw?.showItemWeight === 'boolean'
        ? raw.showItemWeight
        : DEFAULT_RECEIPT_CONFIG.showItemWeight,
    showItemDetails:
      typeof raw?.showItemDetails === 'boolean'
        ? raw.showItemDetails
        : DEFAULT_RECEIPT_CONFIG.showItemDetails,
    showQuantityColumn:
      typeof raw?.showQuantityColumn === 'boolean'
        ? raw.showQuantityColumn
        : DEFAULT_RECEIPT_CONFIG.showQuantityColumn,
    showUnitPriceColumn:
      typeof raw?.showUnitPriceColumn === 'boolean'
        ? raw.showUnitPriceColumn
        : DEFAULT_RECEIPT_CONFIG.showUnitPriceColumn,
    showItemCount:
      typeof raw?.showItemCount === 'boolean'
        ? raw.showItemCount
        : DEFAULT_RECEIPT_CONFIG.showItemCount,
    showSubtotal:
      typeof raw?.showSubtotal === 'boolean'
        ? raw.showSubtotal
        : DEFAULT_RECEIPT_CONFIG.showSubtotal,
    showDiscount:
      typeof raw?.showDiscount === 'boolean'
        ? raw.showDiscount
        : DEFAULT_RECEIPT_CONFIG.showDiscount,
    showVipRedeemed:
      typeof raw?.showVipRedeemed === 'boolean'
        ? raw.showVipRedeemed
        : DEFAULT_RECEIPT_CONFIG.showVipRedeemed,
    showShippingCost:
      typeof raw?.showShippingCost === 'boolean'
        ? raw.showShippingCost
        : DEFAULT_RECEIPT_CONFIG.showShippingCost,
    totalLabel:
      typeof raw?.totalLabel === 'string' && raw.totalLabel.trim()
        ? raw.totalLabel
        : DEFAULT_RECEIPT_CONFIG.totalLabel,
    showPaymentBreakdown:
      typeof raw?.showPaymentBreakdown === 'boolean'
        ? raw.showPaymentBreakdown
        : DEFAULT_RECEIPT_CONFIG.showPaymentBreakdown,
    showCashTenderedAndChange:
      typeof raw?.showCashTenderedAndChange === 'boolean'
        ? raw.showCashTenderedAndChange
        : DEFAULT_RECEIPT_CONFIG.showCashTenderedAndChange,
    showVipCashback:
      typeof raw?.showVipCashback === 'boolean'
        ? raw.showVipCashback
        : DEFAULT_RECEIPT_CONFIG.showVipCashback,
    showTaxDetails:
      typeof raw?.showTaxDetails === 'boolean'
        ? raw.showTaxDetails
        : DEFAULT_RECEIPT_CONFIG.showTaxDetails,
    showReturnPolicy:
      typeof raw?.showReturnPolicy === 'boolean'
        ? raw.showReturnPolicy
        : Boolean(raw?.returnPolicyText && raw.returnPolicyText.trim()),
    returnPolicyText: resolvedReturnPolicyText,
    showBarcode:
      typeof raw?.showBarcode === 'boolean' ? raw.showBarcode : DEFAULT_RECEIPT_CONFIG.showBarcode,
    showQrCode:
      typeof raw?.showQrCode === 'boolean' ? raw.showQrCode : DEFAULT_RECEIPT_CONFIG.showQrCode,
    qrCodeUrl:
      typeof raw?.qrCodeUrl === 'string' ? raw.qrCodeUrl : DEFAULT_RECEIPT_CONFIG.qrCodeUrl,
    qrCodeCaption:
      typeof raw?.qrCodeCaption === 'string'
        ? raw.qrCodeCaption
        : DEFAULT_RECEIPT_CONFIG.qrCodeCaption,
    showPromoLine:
      typeof raw?.showPromoLine === 'boolean'
        ? raw.showPromoLine
        : DEFAULT_RECEIPT_CONFIG.showPromoLine,
    promoLine:
      typeof raw?.promoLine === 'string' ? raw.promoLine : DEFAULT_RECEIPT_CONFIG.promoLine,
    showFooterMessage:
      typeof raw?.showFooterMessage === 'boolean'
        ? raw.showFooterMessage
        : DEFAULT_RECEIPT_CONFIG.showFooterMessage,
    footerMessage:
      typeof raw?.footerMessage === 'string'
        ? raw.footerMessage
        : DEFAULT_RECEIPT_CONFIG.footerMessage,
  };
}
