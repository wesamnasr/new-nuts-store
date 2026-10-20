export type RoastOption =
  | 'محمص مملح'
  | 'محمص بدون ملح'
  | 'نيء طبيعي'
  | 'مدخن بالتوابل'
  | 'مدخن بالجبنة'
  | 'تشكيلة فاخرة'
  | 'تحميص وسط سادة'
  | 'تحميص وسط محوج'
  | 'تحميص غامق محوج'
  | 'تحميص فاتح أشقر'
  | 'طازج طبيعي 100%'
  | string;

export type WeightGrams = 125 | 250 | 500 | 1000 | 2000 | number;

export type PartitionedBoxSize = 'roqan_4' | 'family_6' | 'vip_6';
export type PartitionedBoxTierId = PartitionedBoxSize;
export type Promotion = FlashPromotion;

export type CoffeeBlendRoastLevel = 'light' | 'medium' | 'dark' | string;
export type CoffeeBlendSpicingOption = 'plain' | 'cardamom' | 'royal_mix' | 'extra_cardamom' | string;
export type CoffeeGrindSize = 'turkish_fine' | 'espresso_medium' | 'french_coarse' | 'whole_bean' | string;

export type CoffeeRoastLevel =
  | 'فاتح (أشقر)'
  | 'وسط (مضبوط)'
  | 'وسط (المزاج المضبوط)'
  | 'وسط غامق'
  | 'غامق (إسبريسو)'
  | 'غامق (عشاق القهوة الثقيلة)'
  | string;

export type CoffeeSpicingOption =
  | 'سادة بدون تحويجة'
  | 'سادة صافي'
  | 'محوج خفيف بالحبهان'
  | 'محوج مخصوص بالحبهان والمستكة'
  | 'محوج مخصوص بحبهان وزر ورد'
  | 'تحويجة حفصة الملكية بالزعفران والمستكة'
  | 'محوج ملكي إضافي (حبهان + مستكة + جوزة الطيب + زر ورد)'
  | string;

export type CoffeeGrindType =
  | 'ماكينة تركي ناعم'
  | 'مطحون تركي ناعم (للركوة والكنكة)'
  | 'إسبريسو وموكا بوت'
  | 'طحنة إسبريسو وماكينات منزلي'
  | 'فرنساوي وخشن'
  | 'طحنة فرنساوي وبالحليب'
  | 'حبوب صحيحة (بدون طحن)'
  | 'حصى بدون طحن (حبوب كاملة)'
  | string;

export interface WeightVariant {
  id: string;
  label: string;          // e.g., "ثمن 125 جم", "ربع 250 جم", "نصف 500 جم", "كيلو 1000 جم"
  weightGrams: number;    // 125 | 250 | 500 | 1000 | 2000
  grams?: number;         // Alias for weightGrams
  price: number;          // Price in EGP
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
  subCategoryName?: string; // One of the 23 approved Excel sub-categories
  subCategory?: string;     // Alias for subCategoryName
  description: string;
  image: string;
  gallery?: string[];
  badge?: string;            // e.g. "الأكثر مبيعاً", "محمص اليوم", "عرض خاص", "فاخر"
  origin: string;            // e.g. "تركي فاخر", "أمريكي جامبو", "بني مزار طازج"
  nutritionalHighlight: string;
  caloriesPer100g: number;
  proteinPer100g: string;
  roastOptions: RoastOption[];
  weights: WeightVariant[];
  pricePerKg?: number;       // Base Kilo selling price in EGP (auto-computes 125g, 250g, 500g, 1000g)
  costPerKg?: number;        // Arafat's Excel cost per Kg in EGP (for profit margin protection)
  packagingCost?: number;    // Packaging cost per unit in EGP
  stockKg?: number;          // Current available inventory in Kilograms
  showOnline?: boolean;      // Controls visibility on storefront (/) and online checkout
  showInPos?: boolean;       // Controls visibility in POS cashier terminal (/pos)
  barcode?: string;          // Electronic barcode scale PLU / SKU code
  isSuperVipItem?: boolean;  // Super VIP nuts indicator for partitioned box margin safety
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
  subCategories?: string[];
}

export interface ShippingRate {
  id: string;
  governorate: string;
  price: number;
  estimatedDays: string;
  zoneType?: 'bandar' | 'village' | 'pickup' | 'governorate';
  minOrderAmount?: number;
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
  roastOption: RoastOption | string;
  percentage: number;       // e.g. 50 for 50%
  weightGrams: number;      // e.g. 500
  priceContribution: number;// e.g. 410 EGP
  slotNumber?: number;      // 1..4 or 1..6 for partitioned boxes
  slotTitle?: string;       // e.g. "الخانة 1: مقرمشات وكريك"
}

export interface BoxSlotSelection {
  slotIndex?: number;
  slotNumber?: number;
  slotTitle?: string;
  categoryLabel?: string;
  productId: string;
  productName: string;
  productImage: string;
  roastOption: RoastOption | string;
  slotGrams?: number;
  weightGrams?: number;
  pricePerKg?: number;
  costPerKg?: number;
  isSuperVipItem?: boolean;
  costContribution?: number;
  priceContribution?: number;
}

export interface CustomCoffeeBlendSpec {
  beanOrigin?: string;
  brazilianPercent?: number;
  indianPercent?: number;
  colombianPercent?: number;
  habashiPercent?: number;
  roastLevel: CoffeeRoastLevel;
  spicing: CoffeeSpicingOption;
  grindType: CoffeeGrindType;
  weightGrams: WeightGrams;
  weightLabel?: string;
  baristaLabel: string;   // Printable barista spec sticker text
  customBlendName?: string;
  notes?: string;
}

export interface CartItem {
  cartItemId: string; // product.id + weight.id + roastOption (or custom box / coffee id)
  productId: string;
  productName: string;
  productImage: string;
  weightId: string;
  weightLabel: string;
  roastOption: RoastOption | string;
  unitPrice: number;
  quantity: number;
  rawCostEgp?: number;        // Raw cost from Arafat's sheet for POS profit calculation
  customWeightGrams?: number; // Exact scale weight in grams (e.g. 185g or 320g)
  barcodeLabel?: string;      // EAN-13 / Scale barcode string
  workerNotes?: string; // ملاحظات خاصة للعامل (بدون ملح، تقسيم الربع على كيسين ثمن، إلخ)
  isCustomMix?: boolean;
  boxCapacityGrams?: number; // 500 | 1000 | 2000
  customBreakdown?: CustomMixItem[];
  isPartitionedBox?: boolean;
  partitionedBoxSize?: PartitionedBoxSize;
  partitionedBoxTierId?: PartitionedBoxSize;
  partitionedSlots?: BoxSlotSelection[];
  boxPresetId?: PartitionedBoxSize;
  boxSlotsCount?: 4 | 6;
  boxSlots?: BoxSlotSelection[];
  isCoffeeBlend?: boolean;
  coffeeBlendSpec?: CustomCoffeeBlendSpec;
}

export type OrderStatus = 'pending' | 'confirmed' | 'roasting_packing' | 'shipped' | 'delivered' | 'cancelled';

export type PaymentMethod = 'cod' | 'instapay' | 'vodafone_cash' | 'vip_wallet';

export type DeliveryMethodType = 'bandar_fast' | 'villages_scheduled' | 'store_pickup';

export type PosOrderType = 'counter_takeaway' | 'glass_bar_dine_in' | 'phone_delivery';

export interface Order {
  id: string;
  orderNumber: string; // e.g. "NUT-1042" or "POS-1042"
  orderSource?: 'online' | 'pos';
  posOrderType?: PosOrderType;
  chairNumber?: 1 | 2 | 3 | 4; // For the 4-chair glass bar in front of Agricultural Mosque
  cashierName?: string;
  shiftId?: string;
  customerName: string;
  customerPhone: string;
  customerAltPhone?: string;
  governorate: string;
  address: string;
  notes?: string;
  deliveryMethod?: DeliveryMethodType;
  villageName?: string;
  deliverySlot?: string;      // "دورة الساعة 2:00 ظهراً" | "دورة الساعة 8:00 مساءً"
  deliveryBatchSlot?: string; // Alias for deliverySlot
  pickupTime?: string;        // For Click & Collect in front of Agricultural Mosque
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  couponCode?: string;
  vipRedeemedAmount?: number; // Deducted from customer's VIP wallet
  vipWalletRedeemed?: number; // Alias for vipRedeemedAmount
  vipCashbackEarned?: number; // 5% cashback earned on orders >= 150 EGP
  total: number;
  cashTendered?: number;      // Amount paid in cash at POS drawer
  changeDue?: number;         // Change returned to customer at POS drawer
  rawCostTotal?: number;      // Total raw cost from Arafat's sheet
  netProfitEgp?: number;      // Net profit in EGP on this order/invoice
  paymentMethod: PaymentMethod;
  paymentReference?: string; // phone/handle or screenshot reference for InstaPay / Wallet
  status: OrderStatus;
  createdAt: string;
}

export interface VipTransaction {
  id: string;
  date: string;
  type: 'earn' | 'redeem' | 'cashier_credit' | 'cashier_debit' | 'earned' | 'redeemed' | 'manual_cashier';
  amount?: number;
  amountEgp?: number;
  orderNumber?: string;
  description: string;
}

export interface VipMember {
  id?: string;
  membershipCode?: string; // e.g. "HAFSA-VIP-1001"
  name?: string;
  customerName?: string;
  phone: string;          // 01XXXXXXXXX
  walletBalance?: number; // Cashback balance in EGP
  walletBalanceEgp?: number; // Alias for walletBalance in EGP
  pointsBalance: number;  // Cashback balance in EGP
  totalSpent: number;
  ordersCount: number;
  tier: 'Gold VIP' | 'Royal Platinum' | 'gold' | 'platinum';
  qrCodeValue?: string;
  joinedAt: string;
  transactions: VipTransaction[];
}

export interface FlashPromotionItem {
  productId: string;
  productName: string;
  weightGrams: number;
  weightLabel: string;
  quantity: number;
  unitCost: number;        // Computed from product.costPerKg
  unitRetailPrice: number; // Computed from product.pricePerKg
}

export interface FlashPromotion {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeText?: string;
  items?: FlashPromotionItem[];
  bundleItemsSummary?: string;
  packagingCost?: number;
  totalRawCost?: number;         // Sum of item costs + packagingCost (from Arafat's sheet)
  costPrice?: number;            // Alias for totalRawCost
  originalRetailPrice?: number;
  originalPrice?: number;        // Alias for originalRetailPrice
  promoPrice: number;
  discountedPrice?: number;      // Alias for promoPrice
  netProfitEgp?: number;         // promoPrice - totalRawCost
  profitMarginPercent?: number;  // (netProfitEgp / promoPrice) * 100
  minSafeMarginPercent?: number; // Default 15%
  isProfitSafe?: boolean;
  active: boolean;
  isVipOnly?: boolean;
  endsAt: string;
  image: string;
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

  // Custom Box Builder Page (/build-box & /custom-box)
  customBoxPageBadge: string;
  customBoxPageTitle: string;
  customBoxPageDesc: string;

  // Track Order Page (/track & /track-order)
  trackOrderPageBadge: string;
  trackOrderPageTitle: string;
  trackOrderPageDesc: string;

  // Checkout & Payment Methods (/checkout)
  checkoutPageTitle: string;
  checkoutPageDesc: string;
  enableCod: boolean;
  enableInstapay: boolean;
  enableVodafoneCash: boolean;
  enableVipWallet?: boolean;

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

export type StaffRole = 'super_admin' | 'supplier' | 'cashier' | 'accountant';

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'supplier'
  | 'cashier'
  | 'accountant'
  | 'store_manager'
  | 'promo_partner';

export type SystemRole = AdminRole;

export interface SupplyInvoiceItem {
  productId: string;
  productName: string;
  quantityKg: number;
  costPerKg: number;
  totalCost: number;
}

export interface SupplyInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  items: SupplyInvoiceItem[];
  totalAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  notes?: string;
  adminNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  announcementText: string;
  whatsappNumber: string;
  supportPhone: string;
  freeShippingThreshold: number;
  vipCashbackPercent?: number;       // 5% cashback
  vipCashbackPercentage?: number;    // Alias for vipCashbackPercent
  vipMinOrderForCashback?: number;   // 150 EGP
  villageMinOrderAmount?: number;    // 200 EGP minimum for Bani Mazar villages
  minOrderVillages?: number;         // Alias for villageMinOrderAmount
  bandarShippingCost?: number;       // 20 EGP
  villagesShippingCost?: number;     // 25 EGP
  instapayAddress: string;
  vodafoneCashNumber: string;
  address: string;
  workingHours: string;
  googleMapsUrl?: string;
  metaPixelId?: string;
  tiktokPixelId?: string;
  adminUsername?: string;
  adminPassword?: string;
  supplierUsername?: string;
  supplierPassword?: string;
  cashierUsername?: string;
  cashierPassword?: string;
  accountantUsername?: string;
  accountantPassword?: string;
  managerPassword?: string;
  promoPartnerPassword?: string;
  wesamAdminPassword?: string;
  pageContent?: StorePageContent;
  themeConfig?: StoreThemeConfig;
}

export interface PosExpense {
  id: string;
  shiftId?: string;
  title: string;
  amount: number;
  category: 'raw_materials' | 'packaging' | 'utilities' | 'delivery_rider' | 'other';
  notes?: string;
  createdAt: string;
}

export interface PosShift {
  id: string;
  shiftNumber: string; // e.g. "SHIFT-101"
  cashierId?: string;
  cashierName: string;
  shiftPeriod: 'الوردية الصباحية' | 'الوردية المسائية' | 'وردية اليوم الكامل';
  status: 'open' | 'closed';
  startingCash?: number;
  openingCash: number;
  cashSales?: number;
  cashSalesTotal: number;
  cardSales?: number;
  vodafoneCashTotal: number;
  instapayTotal: number;
  vipRedeemedTotal: number;
  vipCashbackIssuedTotal: number;
  expenses?: number;
  expensesTotal: number;
  expectedCash?: number;
  expectedCashInDrawer: number;
  actualCash?: number;
  actualClosingCash?: number;
  variance?: number;
  cashDifference?: number;
  ordersCount: number;
  totalRevenue: number;
  totalRawCost: number;
  totalNetProfit: number;
  startTime?: string;
  openedAt: string;
  endTime?: string;
  closedAt?: string;
  notes?: string;
}

export interface DatabaseSchema {
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  shippingRates: ShippingRate[];
  coupons: Coupon[];
  orders: Order[];
  vipMembers?: VipMember[];
  promotions?: FlashPromotion[];
  posShifts?: PosShift[];
  posExpenses?: PosExpense[];
  supplyInvoices?: SupplyInvoice[];
}

export interface AdminAuthSession {
  token: string;
  expiresAt: number;
  role?: AdminRole;
  username?: string;
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
