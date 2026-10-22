import {
  BorderRadiusStyle,
  CardStyle,
  HeroLayoutStyle,
  NavbarStyle,
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

export const BANI_MAZAR_BANDAR_ZONES = [
  'شارع مسجد الزراعيين ومحيط المحل',
  'شارع الجمهورية (وسط البلد)',
  'شارع العاشر من رمضان',
  'ميدان المحطة وشارع بورسعيد',
  'شرق المحطة وشارع الإبراهيمية',
  'حي السلام وشارع المدارس',
  'غرب البلد ومجلس المدينة',
  'أرض الحرية والتقسيم الجديد',
];

export const BANI_MAZAR_VILLAGES = [
  'قرية القيس',
  'قرية صندفا',
  'قرية بني علي',
  'قرية شلقام',
  'قرية أبشاق',
  'قرية طمبو',
  'قرية الجندية',
  'قرية أبو جرج',
  'قرية صفط أبو جرج',
  'قرية البهنسا',
  'قرية أبطوجه',
  'قرية إشروبة',
  'قرية الناصرية',
  'قرية بني صامت',
  'قرية الحسينية',
  'قرية نزلة عمرو',
  'قرية ساقولا',
  'قرية معصرة حجاج',
];

export const VILLAGE_DELIVERY_BATCHES: string[] = [
  'دورة التوزيع الأولى (الساعة 2:00 ظهراً)',
  'دورة التوزيع الثانية (الساعة 8:00 مساءً)',
];

export const STORE_THEMES: StoreThemePresetMeta[] = [
  {
    id: 'royal_roastery',
    name: '1. هوية محمصة حفصة الرسمية (أوف وايت رخامي وإسبريسو)',
    subtitle: 'رخامي دافئ (#FAF6F0) • إسبريسو (#231710) • أوك عسلي (#C88A4B) • ذهبي (#D4AF37)',
    description:
      'الهوية البصرية المعتمدة لمحمصة حفصة في بني مزار أمام مسجد الزراعيين: خلفية رخامية دافئة (#FAF6F0)، كروت كريمي اللوز (#F3ECE1)، هيدر وفوتر إسبريسو (#231710)، ولمسات بديل الخشب (#C88A4B) والذهبي الملكي (#D4AF37).',
    badge: '👑 الهوية المعتمدة 100%',
    isDark: false,
    swatches: {
      primary: '#231710',
      secondary: '#C88A4B',
      accent: '#D4AF37',
      bg: '#FAF6F0',
      card: '#F3ECE1',
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
    name: '2. أزرق سماوي ملكي (فاتح)',
    subtitle: 'خلفية سماوية ثلجية • خطوط كحلية غامقة',
    description: 'ثيم عصري فاتح بالكامل بدرجات الأزرق السماوي الهادئ وبطاقات ناصعة مع خطوط كحلية غامقة عالية التباين.',
    badge: '☀️ فاتح • خط غامق',
    isDark: false,
    swatches: {
      primary: '#0a192f',
      secondary: '#1d4ed8',
      accent: '#0284c7',
      bg: '#e2eefc',
      card: '#f8fbff',
    },
    defaults: {
      heroLayout: 'showcase',
      navbarStyle: 'floating',
      cardStyle: 'soft_elevated',
      borderRadius: 'pill',
    },
  },
  {
    id: 'levant_heritage',
    name: '3. البوتيك الحرفي للمحمصة (Artisanal Pantry)',
    subtitle: 'أوف وايت رخامي (#FAF6F0) • إسبريسو محمص (#231710) وفستق حلبي (#3B6E4C)',
    description: 'نظام تصميم حرفي عضوي يجمع بين الرخام الدافئ وبديل الخشب العسلي والذهب الملكي.',
    badge: '☀️ فاتح • حرفي عضوي',
    isDark: false,
    swatches: {
      primary: '#231710',
      secondary: '#C88A4B',
      accent: '#D4AF37',
      bg: '#FAF6F0',
      card: '#F3ECE1',
    },
    defaults: {
      heroLayout: 'split',
      navbarStyle: 'classic',
      cardStyle: 'classic',
      borderRadius: 'rounded',
    },
  },
  {
    id: 'midnight_obsidian',
    name: '4. الفحم الملكي والذهب (غامق)',
    subtitle: 'خلفية سوداء فحمية • خطوط بيضاء وذهبية فاتحة',
    description: 'ثيم ليلي أسود فحمي فاخر يحوّل جميع الصفحات والبطاقات إلى اللون الداكن مع خطوط بيضاء وذهبية ساطعة.',
    badge: '🌙 غامق • خط فاتح',
    isDark: true,
    swatches: {
      primary: '#f8fafc',
      secondary: '#f59e0b',
      accent: '#fbbf24',
      bg: '#0b0d13',
      card: '#151924',
    },
    defaults: {
      heroLayout: 'showcase',
      navbarStyle: 'floating',
      cardStyle: 'soft_elevated',
      borderRadius: 'rounded',
    },
  },
  {
    id: 'emerald_palace',
    name: '5. الزمرد الليلي العميق (غامق)',
    subtitle: 'خلفية خضراء زمردية داكنة • خطوط نعناعية وعاجية فاتحة',
    description: 'ثيم ليلي زمردي فخم بخلفيات وبطاقات خضراء داكنة جداً مع خطوط عاجية ونعناعية فاتحة ولمسات ذهبية.',
    badge: '🌙 غامق • خط فاتح',
    isDark: true,
    swatches: {
      primary: '#ecfdf5',
      secondary: '#10b981',
      accent: '#34d399',
      bg: '#041a13',
      card: '#092b20',
    },
    defaults: {
      heroLayout: 'centered',
      navbarStyle: 'dark_royal',
      cardStyle: 'editorial',
      borderRadius: 'rounded',
    },
  },
  {
    id: 'saffron_velvet',
    name: '6. المخمل البنفسجي الملكي (غامق)',
    subtitle: 'خلفية بنفسجية ليلية • خطوط لؤلؤية وكهرمانية فاتحة',
    description: 'ثيم ليلي ملكي بدرجات البنفسجي العميق والتوتي الداكن مع خطوط لؤلؤية فاتحة وأزرار كهرمانية مضيئة.',
    badge: '🌙 غامق • خط فاتح',
    isDark: true,
    swatches: {
      primary: '#fdf4ff',
      secondary: '#c026d3',
      accent: '#f59e0b',
      bg: '#130722',
      card: '#210e38',
    },
    defaults: {
      heroLayout: 'split',
      navbarStyle: 'dark_royal',
      cardStyle: 'editorial',
      borderRadius: 'sharp',
    },
  },
];

export const DEFAULT_THEME_CONFIG: StoreThemeConfig = {
  themeId: 'royal_roastery',
  heroLayout: 'split',
  navbarStyle: 'classic',
  cardStyle: 'classic',
  borderRadius: 'rounded',
  showThemeSwitcher: false,
};

export function getResolvedThemeConfig(settings?: StoreSettings | null): StoreThemeConfig {
  if (!settings?.themeConfig) {
    return DEFAULT_THEME_CONFIG;
  }
  return {
    ...DEFAULT_THEME_CONFIG,
    ...settings.themeConfig,
  };
}

export const DEFAULT_PAGE_CONTENT: StorePageContent = {
  // Header & Announcement Bar
  showAnnouncementBar: true,
  headerSubtitle: 'بني مزار — أمام مسجد الزراعيين',
  logoEmoji: '☕',

  // Landing Page: Hero Section
  heroBadge: 'طازج يومياً • بني مزار',
  heroTitlePrefix: 'أصل التحميصة',
  heroTitleHighlight: 'ومزاج القهوة الفاخر',
  heroTitleSuffix: 'لحد باب بيتك',
  heroDescription: 'أفخر المكسرات المحمصة والبن المطحون بالطلب في بني مزار.',
  heroImage: '/images/products/royal-mix.jpg',
  heroPrimaryCtaText: '🎁 صمّم بوكس السهرة',
  heroSecondaryCtaText: '☕ توليفة البن',
  heroBoxesCtaText: '🥜 تصفح المتجر',
  heroFeaturedProductId: 'prod-box-roqan-125',
  heroFeaturedBadge: 'الأكثر طلباً 🔥',
  heroFeaturedTitle: 'بوكس «روقان» المقسم',
  heroFeaturedSubtitle: '4 خانات مختارة بعناية',
  heroStats: [
    { value: '30 دقيقة', label: 'توصيل البندر' },
    { value: '5% كاش باك', label: 'محفظة VIP' },
    { value: 'طازج 100%', label: 'تحميص يومي' },
  ],

  // Landing Page: Custom Box Banner
  showCustomBoxBanner: true,
  customBoxBannerBadge: 'حصرياً في محمصة حفصة',
  customBoxBannerTitle: 'صمّم بوكس السهرة على ذوقك 🎁',
  customBoxBannerDesc: 'اختر حجم البوكس واملأ كل خانة بأصنافك المفضلة.',
  customBoxBannerPills: [
    '🎁 بوكس روقان (125 ج.م)',
    '👨‍👩‍👧‍👦 بوكس العيلة (250 ج.م)',
    '👑 بوكس VIP (450 ج.م)',
  ],
  customBoxBannerCta: '✨ ابدأ تصميم بوكسك الآن',

  // Landing Page: Mixed Boxes Section
  showMixedBoxesSection: true,
  mixedBoxesBadge: 'الأكثر مبيعاً',
  mixedBoxesTitle: 'بوكسات السهرة المقسمة',
  mixedBoxesDesc: '',
  mixedBoxesGiftNote: '✨ 5% كاش باك فوري في محفظة VIP',

  // Landing Page: Coupons Banner
  showCouponsSection: true,
  couponsBannerBadge: '🔥 عروض الأسبوع',
  couponsBannerTitle: 'باقات التوفير الأسبوعية',

  // Landing Page: Why Choose Us (4 Trust Features)
  showTrustSection: true,
  trustSectionSubheading: 'لماذا محمصة حفصة؟',
  trustSectionTitle: 'جودة وطزاجة في كل طلب',
  trustFeatures: [
    {
      id: 'tf-1',
      icon: '🔥',
      title: 'تحميص يومي طازج',
      description: 'تعبئة حرارية تحفظ القرمشة والنكهة.',
    },
    {
      id: 'tf-2',
      icon: '⚡',
      title: 'توصيل سريع 30 دقيقة',
      description: 'تغطية فورية للبندر ودورتان يومياً للقرى.',
    },
    {
      id: 'tf-3',
      icon: '👑',
      title: 'كاش باك 5% VIP',
      description: 'رصيد نقدي فوري برقم موبايلك.',
    },
    {
      id: 'tf-4',
      icon: '⚖️',
      title: 'ميزان إلكتروني دقيق',
      description: 'نفس دقة وسعر المحل بالجرام.',
    },
  ],

  // Custom Box Builder Page (/build-box & /custom-box)
  customBoxPageBadge: 'بوكسات السهرة',
  customBoxPageTitle: 'صمّم بوكس السهرة بنفسك',
  customBoxPageDesc: '',

  // Track Order Page (/track & /track-order)
  trackOrderPageBadge: '🛵 متابعة الطلب',
  trackOrderPageTitle: 'تتبع حالة طلبك',
  trackOrderPageDesc: '',

  // Checkout & Payment Methods (/checkout)
  checkoutPageTitle: 'إتمام الطلب السريع',
  checkoutPageDesc: '',
  enableCod: true,
  enableInstapay: true,
  enableVodafoneCash: true,
  enableVipWallet: true,

  // Footer & Floating WhatsApp
  footerDescription: 'محمصة حفصة للبن والمكسرات — بني مزار، أمام مسجد الزراعيين.',
  footerFeatures: [
    {
      id: 'ff-1',
      icon: 'Sparkles',
      title: 'طحن وتحميص بالطلب',
      description: 'بن طازج ومكسرات محمصة يومياً.',
    },
    {
      id: 'ff-2',
      icon: 'ShieldCheck',
      title: 'محفظة ولاء VIP',
      description: '5% كاش باك فوري برقم موبايلك.',
    },
    {
      id: 'ff-3',
      icon: 'Truck',
      title: 'توصيل سريع',
      description: 'لبندر وقرى مركز بني مزار.',
    },
  ],
  showFloatingWhatsapp: true,
  floatingWhatsappText: 'واتساب حفصة',
  floatingWhatsappMessage: 'مرحباً محمصة حفصة، أرغب في الطلب السريع.',
};

export const DEFAULT_PRODUCT_IMAGE = '/images/products/royal-mix.jpg';

export function getSafeImageUrl(url?: string | null, fallback: string = DEFAULT_PRODUCT_IMAGE): string {
  if (typeof url === 'string' && url.trim().length > 0) {
    return url.trim();
  }
  return fallback;
}

export function getResolvedPageContent(settings?: StoreSettings | null): StorePageContent {
  if (!settings?.pageContent) {
    return DEFAULT_PAGE_CONTENT;
  }
  const pc = settings.pageContent;
  if (
    pc.headerSubtitle?.includes('HAFSA ROASTERY') ||
    pc.heroDescription?.includes('24 عين') ||
    pc.customBoxBannerDesc?.includes('اختر حجم البوكس المقسم')
  ) {
    return {
      ...DEFAULT_PAGE_CONTENT,
      showAnnouncementBar: pc.showAnnouncementBar ?? true,
      showCustomBoxBanner: pc.showCustomBoxBanner ?? true,
      showMixedBoxesSection: pc.showMixedBoxesSection ?? true,
      showCouponsSection: pc.showCouponsSection ?? true,
      showTrustSection: pc.showTrustSection ?? true,
      enableCod: pc.enableCod ?? true,
      enableInstapay: pc.enableInstapay ?? true,
      enableVodafoneCash: pc.enableVodafoneCash ?? true,
      enableVipWallet: pc.enableVipWallet ?? true,
      showFloatingWhatsapp: pc.showFloatingWhatsapp ?? true,
      heroImage: getSafeImageUrl(pc.heroImage, DEFAULT_PAGE_CONTENT.heroImage),
    };
  }
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
