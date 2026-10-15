export type RoastOption = 'محمص مملح' | 'محمص بدون ملح' | 'نيء طبيعي' | 'مدخن بالتوابل' | 'تشكيلة فاخرة';

export interface WeightVariant {
  id: string;
  label: string;       // e.g., "250 جم", "500 جم", "1 كجم"
  weightGrams: number; // e.g., 250, 500, 1000
  price: number;       // Price in EGP
  originalPrice?: number; // Optional crossed-out price
}

export interface ProductReview {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
  verified: boolean;
}

export interface NutritionalInfo {
  servingSize: string;
  calories: number;
  protein: number;
  fats: number;
  carbohydrates: number;
  fiber: number;
  healthBenefits: string[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  categoryId: string;
  description: string;
  image: string;
  gallery?: string[];
  badge?: string;            // e.g. "الأكثر مبيعاً", "تحميص اليوم", "عرض خاص", "فاخر"
  origin: string;            // e.g. "تركي فاخر", "أمريكي جامبو", "إيراني أول", "تشيلي"
  nutritionalHighlight: string; // e.g. "غني بأوميجا 3 ومضادات الأكسدة"
  caloriesPer100g: number;
  proteinPer100g: string;
  roastOptions: RoastOption[];
  weights: WeightVariant[];
  inStock: boolean;
  featured: boolean;
  rating: number;
  reviewsCount: number;
  reviews?: ProductReview[];
  nutritionalInfo?: NutritionalInfo;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image: string;
}

export interface ShippingRate {
  id: string;
  governorate: string;
  price: number;
  estimatedDays: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;       // e.g. 10 for 10% or 50 for 50 EGP
  minOrderAmount: number;
  active: boolean;
  description: string;
}

export interface CustomMixItem {
  productId: string;
  productName: string;
  productImage?: string;
  roastOption: RoastOption;
  percentage: number;       // e.g. 50 for 50%
  weightGrams: number;      // e.g. 500
  priceContribution: number;// e.g. 410 EGP
}

export interface CartItem {
  cartItemId: string; // product.id + weight.id + roastOption (or custom box id)
  productId: string;
  productName: string;
  productImage: string;
  weightId: string;
  weightLabel: string;
  roastOption: RoastOption;
  unitPrice: number;
  quantity: number;
  isCustomMix?: boolean;
  boxCapacityGrams?: number; // 500 | 1000 | 2000
  customBreakdown?: CustomMixItem[];
}

export type OrderStatus = 'pending' | 'confirmed' | 'roasting_packing' | 'shipped' | 'delivered' | 'cancelled';

export type PaymentMethod = 'cod' | 'instapay' | 'vodafone_cash';

export interface Order {
  id: string;
  orderNumber: string; // e.g. "NUT-1042"
  customerName: string;
  customerPhone: string;
  customerAltPhone?: string;
  governorate: string;
  address: string;
  notes?: string;
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  couponCode?: string;
  total: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string; // phone/handle or screenshot reference for InstaPay / Wallet
  status: OrderStatus;
  createdAt: string;
}

export interface TrustFeatureItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface HeroStatItem {
  value: string;
  label: string;
}

export interface StorePageContent {
  // Header & Announcement Bar
  showAnnouncementBar: boolean;
  headerSubtitle: string;
  logoEmoji: string;

  // Landing Page: Hero Section
  heroBadge: string;
  heroTitlePrefix: string;
  heroTitleHighlight: string;
  heroTitleSuffix: string;
  heroDescription: string;
  heroImage: string;
  heroPrimaryCtaText: string;
  heroSecondaryCtaText: string;
  heroBoxesCtaText: string;
  heroFeaturedProductId: string;
  heroFeaturedBadge: string;
  heroFeaturedTitle: string;
  heroFeaturedSubtitle: string;
  heroStats: HeroStatItem[];

  // Landing Page: Custom Box Banner
  showCustomBoxBanner: boolean;
  customBoxBannerBadge: string;
  customBoxBannerTitle: string;
  customBoxBannerDesc: string;
  customBoxBannerPills: string[];
  customBoxBannerCta: string;

  // Landing Page: Mixed Boxes Section
  showMixedBoxesSection: boolean;
  mixedBoxesBadge: string;
  mixedBoxesTitle: string;
  mixedBoxesDesc: string;
  mixedBoxesGiftNote: string;

  // Landing Page: Coupons Banner
  showCouponsSection: boolean;
  couponsBannerBadge: string;
  couponsBannerTitle: string;

  // Landing Page: Why Choose Us (4 Trust Features)
  showTrustSection: boolean;
  trustSectionSubheading: string;
  trustSectionTitle: string;
  trustFeatures: TrustFeatureItem[];

  // Custom Box Builder Page (/custom-box)
  customBoxPageBadge: string;
  customBoxPageTitle: string;
  customBoxPageDesc: string;

  // Track Order Page (/track-order)
  trackOrderPageBadge: string;
  trackOrderPageTitle: string;
  trackOrderPageDesc: string;

  // Checkout & Payment Methods (/checkout)
  checkoutPageTitle: string;
  checkoutPageDesc: string;
  enableCod: boolean;
  enableInstapay: boolean;
  enableVodafoneCash: boolean;

  // Footer & Floating WhatsApp
  footerDescription: string;
  footerFeatures: TrustFeatureItem[];
  showFloatingWhatsapp: boolean;
  floatingWhatsappText: string;
  floatingWhatsappMessage: string;
}

export type StoreThemeId =
  | 'royal_roastery'
  | 'emerald_palace'
  | 'midnight_obsidian'
  | 'levant_heritage'
  | 'modern_minimal'
  | 'saffron_velvet';

export type HeroLayoutStyle = 'split' | 'centered' | 'showcase';
export type NavbarStyle = 'classic' | 'floating' | 'dark_royal';
export type CardStyle = 'classic' | 'editorial' | 'soft_elevated';
export type BorderRadiusStyle = 'rounded' | 'sharp' | 'pill';

export interface StoreThemeConfig {
  themeId: StoreThemeId;
  heroLayout: HeroLayoutStyle;
  navbarStyle: NavbarStyle;
  cardStyle: CardStyle;
  borderRadius: BorderRadiusStyle;
  showThemeSwitcher: boolean;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  announcementText: string;
  whatsappNumber: string;
  supportPhone: string;
  freeShippingThreshold: number;
  instapayAddress: string;
  vodafoneCashNumber: string;
  address: string;
  workingHours: string;
  adminPassword?: string;
  pageContent?: StorePageContent;
  themeConfig?: StoreThemeConfig;
}

export interface DatabaseSchema {
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  shippingRates: ShippingRate[];
  coupons: Coupon[];
  orders: Order[];
}

export interface AdminAuthSession {
  token: string;
  expiresAt: number;
}

export interface ReviewSubmissionPayload {
  productId: string;
  customerName: string;
  rating: number;
  comment: string;
}

export interface ReviewSubmissionResponse {
  success: boolean;
  review?: ProductReview;
  rating?: number;
  reviewsCount?: number;
  error?: string;
}

export interface CustomMixPortion {
  product: Product;
  percentage: number;
  roastOption: RoastOption;
}

