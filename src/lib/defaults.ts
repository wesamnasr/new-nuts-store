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
  headerSubtitle: 'HAFSA ROASTERY • مركز بني مزار — أمام مسجد الزراعيين',
  logoEmoji: '☕',

  // Landing Page: Hero Section
  heroBadge: 'فرعنا الرقمي يعمل 24 ساعة • أمام مسجد الزراعيين ببني مزار',
  heroTitlePrefix: 'أصل التحميصة ومزاج القهوة الفاخر..',
  heroTitleHighlight: 'الآن في قلب بني مزار',
  heroTitleSuffix: 'طازج لحد باب بيتك',
  heroDescription:
    'من 24 عين مكسرات طازجة يومياً، إلى صوامع البن المطحون على مزاجك، وخلية العسل الطبيعي — اطلب أونلاين وتوصلك لحد باب البيت في البندر والقرى أو استلمها جاهزة من أمام مسجد الزراعيين.',
  heroImage: '/images/products/royal-mix.jpg',
  heroPrimaryCtaText: '🎁 صمّم بوكس السهرة (يبدأ من 125 ج)',
  heroSecondaryCtaText: '☕ اطلب بن وتوليفة خاصة',
  heroBoxesCtaText: '🥜 تصفح المكسرات والتسالي',
  heroFeaturedProductId: 'prod-box-roqan-125',
  heroFeaturedBadge: 'البطل البيعي في بني مزار 🔥',
  heroFeaturedTitle: 'بوكس السهرة «روقان» المقسم (4 خانات)',
  heroFeaturedSubtitle: 'كريك ومقرمشات + فول فلسطيني ومكرمل + كاندي وشوكولاتة + ميكس مكسرات VIP',
  heroStats: [
    { value: '30 دقيقة', label: 'توصيل فوري لبندر بني مزار' },
    { value: '5% كاش باك', label: 'في محفظة حفصة VIP تلقائياً' },
    { value: '24 عين', label: 'مكسرات وتسالي و4 صوامع بن' },
  ],

  // Landing Page: Custom Box Banner
  showCustomBoxBanner: true,
  customBoxBannerBadge: 'الميزة الحصرية الأولى في بني مزار والمنيا',
  customBoxBannerTitle: 'صمّم بوكس السهرة المقسم على ذوقك! 🎁✨',
  customBoxBannerDesc:
    'اختر حجم البوكس المقسم (بوكس روقان 4 خانات بـ 125 ج، بوكس العيلة 6 خانات بـ 250 ج، أو بوكس هدايا VIP بـ 450 ج) واملأ كل خانة بالصنف الذي تحبه مع حساب السعر اللحظي!',
  customBoxBannerPills: [
    '🎁 بوكس روقان (4 خانات — 125 ج.م)',
    '👨‍👩‍👧‍👦 بوكس العيلة واللمة (6 خانات — 250 ج.م)',
    '👑 بوكس هدايا وزيارات VIP (6 خانات ملكية — 450 ج.م)',
  ],
  customBoxBannerCta: '✨ عايز تختار أصناف كل خانة على ذوقك؟ اضغط هنا وصمّم بوكسك بنفسك!',

  // Landing Page: Mixed Boxes Section
  showMixedBoxesSection: true,
  mixedBoxesBadge: 'الأكثر مبيعاً في سهرات بني مزار',
  mixedBoxesTitle: 'بوكسات السهرة واللمة المقسمة',
  mixedBoxesDesc:
    'بوكسات مقسمة بعناية ومحمية بتغليف حراري يحفظ القرمشة، جاهزة للطلب الفوري أو التعديل حسب ذوقك.',
  mixedBoxesGiftNote: '✨ كل طلب فوق 150 ج.م يضيف 5% كاش باك فوري في محفظة حفصة VIP برقم موبايلك!',

  // Landing Page: Coupons Banner
  showCouponsSection: true,
  couponsBannerBadge: '🔥 عروض الشريك الرابع الخاطفة (Flash Deals & Weekend Offers)',
  couponsBannerTitle: 'باقات التوفير الأسبوعية المحمية بضمان طزاجة حفصة!',

  // Landing Page: Why Choose Us (4 Trust Features)
  showTrustSection: true,
  trustSectionSubheading: 'لماذا محمصة حفصة هي رقم 1 في بني مزار؟',
  trustSectionTitle: '4 مزايا حصرية تضمن لك المزاج والطزاجة',
  trustFeatures: [
    {
      id: 'tf-1',
      icon: '🔥',
      title: 'طزاجة وقرمشة مضمونة 100%',
      description: 'تعبئة يومية ولحام حراري يحفظ القرمشة مع ضمان استبدال فوري من المحل إذا لم يعجبك الطعم.',
    },
    {
      id: 'tf-2',
      icon: '⚡',
      title: 'توصيل خلال 30 دقيقة في البندر',
      description: 'توصيل فوري لبندر بني مزار ودورتان يومياً (الساعة 2 ظهراً و8 مساءً) لجميع قرى المركز.',
    },
    {
      id: 'tf-3',
      icon: '👑',
      title: 'كاش باك 5% في محفظة VIP',
      description: 'رصيد نقدي فوري برقم موبايلك على كل فاتورة فوق 150 ج.م وشحن مجاني لطلبات الـ VIP فوق 300 ج.م.',
    },
    {
      id: 'tf-4',
      icon: '⚖️',
      title: 'ميزان باركود إلكتروني بالجرام',
      description: 'نفس دقة وسعر المحل بالقرش (ثمن / ربع / نصف / كيلو) مع دفع عند الاستلام أو فودافون كاش أو إنستاباي.',
    },
  ],

  // Custom Box Builder Page (/build-box & /custom-box)
  customBoxPageBadge: 'استوديو حفصة التفاعلي • مركز بني مزار',
  customBoxPageTitle: 'صمّم بوكس السهرة بنفسك (4 أو 6 خانات)',
  customBoxPageDesc:
    'اختر حجم البوكس المقسم (روقان 125 ج • العيلة 250 ج • VIP 450 ج) واضغط على كل خانة لتملأها بأصنافك المفضلة من الـ 24 عين مكسرات وتسالي وشكولاتة.',

  // Track Order Page (/track & /track-order)
  trackOrderPageBadge: '🛵 متابعة الطلبات الحية • محمصة حفصة بني مزار',
  trackOrderPageTitle: 'تتبع طلبك + قصة حفصة وموقعنا أمام مسجد الزراعيين',
  trackOrderPageDesc:
    'أدخل رقم الطلب أو رقم موبايلك لمتابعة مراحل الطحن والتحضير وخروج الدليفري لبندر أو قرى بني مزار.',

  // Checkout & Payment Methods (/checkout)
  checkoutPageTitle: 'السلة الذكية والدفع السريع في خطوة واحدة',
  checkoutPageDesc: 'أكمل طلبك في أقل من 45 ثانية بدون كلمة مرور أو تعقيد — واختر توصيل البندر، دورة القرى، أو الاستلام من المحل',
  enableCod: true,
  enableInstapay: true,
  enableVodafoneCash: true,
  enableVipWallet: true,

  // Footer & Floating WhatsApp
  footerDescription:
    'محمصة حفصة للبن والمكسرات (HAFSA ROASTERY) — فرعك الرقمي الذي يعمل 24 ساعة في مركز بني مزار (أمام مسجد الزراعيين). 24 عين مكسرات وتسالي ساخنة، 4 صوامع بن نحاسية، خلية عسل طبيعي، واستوديو بوكسات السهرة.',
  footerFeatures: [
    {
      id: 'ff-1',
      icon: 'Sparkles',
      title: 'تحميص وطحن بالطلب أمام عينك',
      description: 'صوامع البن النحاسية تطحن توليفتك بالحبهان والمستكة قبل خروج الدليفري مباشرة.',
    },
    {
      id: 'ff-2',
      icon: 'ShieldCheck',
      title: 'نظام ولاء حفصة VIP الموحد',
      description: 'اجمع 5% كاش باك برقم موبايلك سواء اشتريت من كاشير المحل أو من الموقع الإلكتروني.',
    },
    {
      id: 'ff-3',
      icon: 'Truck',
      title: 'تغطية شاملة لبندر وقرى بني مزار',
      description: 'توصيل فوري للبندر (30-45 دقيقة) ودورتان يومياً (2 ظ و8 م) للقيس وصندفا وبني علي وشلقام وأبشاق.',
    },
  ],
  showFloatingWhatsapp: true,
  floatingWhatsappText: 'واتساب كاشير حفصة',
  floatingWhatsappMessage: 'مرحباً محمصة حفصة بني مزار، أرغب في الاستفسار أو الطلب السريع.',
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
