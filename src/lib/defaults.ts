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

export const STORE_THEMES: StoreThemePresetMeta[] = [
  // =========================================================================
  // 1-3: ثيمات فاتحة بخطوط غامقة (3 LIGHT THEMES WITH DARK FONTS)
  // =========================================================================
  {
    id: 'royal_roastery',
    name: '1. كريمي الرمال والفستق (فاتح)',
    subtitle: 'خلفية كريمية دافئة • خطوط بنية غامقة',
    description: 'ثيم نهاري مشرق بخلفية كريمية رملية دافئة ونصوص بنية محمصة غامقة مع لمسات الأخضر الفستقي والذهبي.',
    badge: '☀️ فاتح • خط غامق',
    isDark: false,
    swatches: {
      primary: '#2b1408',
      secondary: '#2e7d32',
      accent: '#d97706',
      bg: '#f5ebd9',
      card: '#fffdf9',
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
    subtitle: 'كتان الشوفان (#FAF7F2) • إسبريسو محمص (#1C130D) وفستق خام',
    description: 'نظام تصميم حرفي عضوي (Modern Organic Tactile) بخلفية كتان الشوفان (#FAF7F2) وبطاقات عاجية (#FFFFFF) بحدود (#E6DCCE) مع خطوط إسبريسو (#1C130D) ولمسات الكراميل (#C89357) والفستق الخام (#4E7C59).',
    badge: '☀️ فاتح • حرفي عضوي',
    isDark: false,
    swatches: {
      primary: '#1C130D',
      secondary: '#C89357',
      accent: '#4E7C59',
      bg: '#FAF7F2',
      card: '#FFFFFF',
    },
    defaults: {
      heroLayout: 'split',
      navbarStyle: 'classic',
      cardStyle: 'classic',
      borderRadius: 'rounded',
    },
  },

  // =========================================================================
  // 4-6: ثيمات غامقة بخطوط فاتحة (3 DARK THEMES WITH LIGHT FONTS)
  // =========================================================================
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
  headerSubtitle: 'مكسرات فاخرة • تحميص يومي طازج',
  logoEmoji: '🌰',

  // Landing Page: Hero Section
  heroBadge: 'محمصة طازجة يومياً • نخب أول مستورد 100%',
  heroTitlePrefix: 'طعم القرمشة الفاخرة من',
  heroTitleHighlight: 'البندق والفستق وعين الجمل',
  heroTitleSuffix: 'لحد باب بيتك',
  heroDescription:
    'نختار لك أجود حبات المكسرات من مزارع تركيا وكاليفورنيا وتشيلي، نحمصها يومياً بالهواء الساخن بدون أي زيوت ونغلفها حرارياً لتصلك بأعلى قرمشة وطراوة.',
  heroImage: '/images/products/royal-mix.jpg',
  heroPrimaryCtaText: 'كوّن علبتك بنفسك الآن',
  heroSecondaryCtaText: 'تسوق المكسرات',
  heroBoxesCtaText: 'بوكسات الملكي',
  heroFeaturedProductId: 'prod-royal-mix-1',
  heroFeaturedBadge: 'الأكثر طلباً للضيافة',
  heroFeaturedTitle: 'بوكس المشكل الملكي VIP',
  heroFeaturedSubtitle: 'فستق + بندق تركي + كاجو جامبو + عين جمل + لوز',
  heroStats: [
    { value: '100%', label: 'ضمان طراوة وتحميص اليوم' },
    { value: '+4,500', label: 'عميل سعيد في مصر' },
    { value: '24 ساعة', label: 'توصيل سريع ومغلف حرارياً' },
  ],

  // Landing Page: Custom Box Banner
  showCustomBoxBanner: true,
  customBoxBannerBadge: 'ميزة تفاعلية جديدة وحصرية',
  customBoxBannerTitle: 'كوّن علبتك بنفسك على ذوقك! 🥜✨',
  customBoxBannerDesc:
    'اختر حجم البوكس المفضل لك (500 جم أو 1 كجم أو 2 كجم)، وحدد نسب أصناف المكسرات التي تحبها ودرجة تحميص كل صنف حتى تكتمل علبتك 100% مع حساب السعر الفعلي لحظياً!',
  customBoxBannerPills: [
    '📦 أحجام: 500 جم • 1 كجم • 2 كجم',
    '⚖️ تقسيم حر للنسب أو توزيع متساوٍ بضغطة زر',
    '🔥 اختيار التحميص لكل صنف داخل العلبة',
  ],
  customBoxBannerCta: 'ابدأ تكوين علبتك الآن',

  // Landing Page: Mixed Boxes Section
  showMixedBoxesSection: true,
  mixedBoxesBadge: 'توفير حتى 15% + تغليف هدايا فاخر',
  mixedBoxesTitle: 'بوكسات المشكل الملكي والهدايا',
  mixedBoxesDesc:
    'تشكيلات متوازنة تجمع أفخر أنواع الفستق والبندق والكاجو واللوز وعين الجمل في عبوات محكمة الغلق تشرفك في الضيافة والهدايا.',
  mixedBoxesGiftNote: '✨ إمكانية إضافة كارت إهداء مجاني عند كتابة ملاحظة في صفحة إتمام الطلب!',

  // Landing Page: Coupons Banner
  showCouponsSection: true,
  couponsBannerBadge: '🎁 عروض وكوبونات خصم فعالة الآن',
  couponsBannerTitle: 'انسخ كود الخصم واستخدمه في السلة لتوفير فوري!',

  // Landing Page: Why Choose Us (4 Trust Features)
  showTrustSection: true,
  trustSectionSubheading: 'لماذا يثق بنا الآلاف؟',
  trustSectionTitle: 'سر الجودة والقرمشة في كل حبة',
  trustFeatures: [
    {
      id: 'tf-1',
      icon: '🔥',
      title: 'تحميص يومي بالطلب',
      description:
        'لا نخزن مكسرات محمصة لفترات طويلة؛ يتم التحميص يومياً بكميات مدروسة لضمان وصولها إليك دافئة ومقرمشة.',
    },
    {
      id: 'tf-2',
      icon: '🌿',
      title: 'فرز أول خالٍ من الشوائب',
      description:
        'نستورد أعلى درجات الفرز (فستق جامبو مفتوح، بندق تركي غيرسون، كاجو W180، وعين جمل تشيلي أبيض).',
    },
    {
      id: 'tf-3',
      icon: '🛡️',
      title: 'عبوات حفظ الطراوة',
      description:
        'تغليف غذائي مبطن بطبقة عازلة للرطوبة والضوء مع سحاب محكم الغلق لإعادة الإغلاق بعد كل استخدام.',
    },
    {
      id: 'tf-4',
      icon: '💯',
      title: 'ضمان الاستبدال الفوري',
      description:
        'رضاك مضمون 100%! يحق لك معاينة الطلب عند الاستلام وفي حال وجود أي ملاحظة نستبدله لك فوراً بدون أي تكلفة.',
    },
  ],

  // Custom Box Builder Page (/custom-box)
  customBoxPageBadge: 'ميزة تفاعلية حصرية • محمصة الواحة الذهبية',
  customBoxPageTitle: 'كوّن علبتك المشكلة على ذوقك',
  customBoxPageDesc:
    'اختر حجم العلبة المفضل لديك، وحدد نسب أصناف المكسرات الفاخرة ودرجة التحميص لكل صنف حتى تكتمل سعة العلبة 100% مع حساب السعر اللحظي بدقة.',

  // Track Order Page (/track-order)
  trackOrderPageBadge: '📦 متابعة الطلبات لحظة بلحظة',
  trackOrderPageTitle: 'تتبع حالة طلبك',
  trackOrderPageDesc:
    'أدخل رقم الطلب (مثال: NUT-1001) أو رقم الموبايل الذي قمت بالطلب به لمعرفة مرحلة التحميص والتوصيل.',

  // Checkout & Payment Methods (/checkout)
  checkoutPageTitle: 'إتمام الطلب والتوصيل',
  checkoutPageDesc: 'أدخل بيانات العنوان واختر وسيلة الدفع المناسبة لك ليصلك طلبك طازجاً ومقرمشاً',
  enableCod: true,
  enableInstapay: true,
  enableVodafoneCash: true,

  // Footer & Floating WhatsApp
  footerDescription:
    'وجهتك الأولى لأفخر أنواع المكسرات المستوردة الطازجة من البندق التركي، الفستق الأمريكي الجامبو، عين الجمل التشيلي، الكاجو الملكي، وبوكسات الهدايا الفاخرة.',
  footerFeatures: [
    {
      id: 'ff-1',
      icon: 'Sparkles',
      title: 'تحميص يومي طازج 100%',
      description:
        'نحمص المكسرات يومياً بالهواء الساخن بدون أي زيوت مهدرجة للحفاظ على الطعم والقرمشة.',
    },
    {
      id: 'ff-2',
      icon: 'ShieldCheck',
      title: 'تغليف حراري محكم الغلق',
      description:
        'عبوات صحية بسحاب (Zip-lock) تحفظ المكسرات طازجة ومقرمشة لأطول فترة ممكنة.',
    },
    {
      id: 'ff-3',
      icon: 'Truck',
      title: 'شحن سريع لجميع المحافظات',
      description:
        'توصيل لحد باب البيت مع الدفع عند الاستلام أو عبر إنستا باي وفودافون كاش.',
    },
  ],
  showFloatingWhatsapp: true,
  floatingWhatsappText: 'اطلب أو استفسر واتساب',
  floatingWhatsappMessage: 'أحتاج مساعدة في اختيار وطلب المكسرات.',
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
