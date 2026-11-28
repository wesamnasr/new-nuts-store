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

export type ProductSellingMode = 'weight' | 'unit';

export interface WeightVariant {
  id: string;
  label: string;          // e.g., "ثمن 125 جم", "ربع 250 جم", or "قطعة واحدة", "عبوة 3 قطع"
  weightGrams: number;    // 125 | 250 | 500 | 1000 | 2000 (for unit mode: unitsCount * 1000)
  grams?: number;         // Alias for weightGrams
  unitsCount?: number;    // For unit-based selling mode (e.g., 1, 3, 6, 12)
  price: number;          // Selling price
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
  videoUrl?: string;            // Direct MP4/WebM or YouTube/Shorts/Facebook reel URL
  videoPoster?: string;         // Optional thumbnail poster for video slide
  adHeadline?: string;          // Optional sensory ad headline override
  adHighlights?: string[];      // Optional 3 short scannable bullet points
  proofImages?: string[];       // Optional customer WhatsApp screenshot / unboxing proof images
  comparisonPoints?: Array<{
    feature: string;
    hafsa: string;
    others: string;
  }>;
  adFaqs?: Array<{
    question: string;
    answer: string;
  }>;
  badge?: string;            // e.g. "الأكثر مبيعاً", "محمص اليوم", "عرض خاص", "فاخر"
  origin: string;            // e.g. "تركي فاخر", "أمريكي جامبو", "محلي طازج"
  nutritionalHighlight: string;
  caloriesPer100g: number;
  proteinPer100g: string;
  roastOptions: RoastOption[];
  weights: WeightVariant[];
  sellingMode?: ProductSellingMode; // 'weight' (default) | 'unit' (sold by piece/pack)
  unitLabel?: string;        // e.g. "قطعة", "عبوة", "علبة", "زجاجة"
  unitPrice?: number;        // Selling price per unit when sellingMode === 'unit'
  unitCost?: number;         // Raw cost per unit when sellingMode === 'unit'
  pricePerKg?: number;       // Base Kilo selling price (or unit price mirror)
  costPerKg?: number;        // Wholesale cost per Kg (or unit cost mirror for WAC & margin protection)
  packagingCost?: number;    // Packaging cost per unit
  stockKg?: number;          // Current available inventory (in Kg for weight mode, or Units for unit mode)
  warehouseStocks?: Record<string, number>; // Multi-warehouse stock split: { [warehouseId]: qtyKgOrUnits }
  showOnline?: boolean;      // Controls visibility on storefront (/) and online checkout
  showInPos?: boolean;       // Controls visibility in POS cashier terminal (/pos)
  barcode?: string;          // Electronic barcode scale PLU / SKU code
  lastRestockedAt?: string;  // ISO date of latest supply restock (for 10-day freshness traffic light)
  lastPurchaseCostPerKg?: number; // Previous supply purchase cost (for >5% price hike alert)
  pluCode?: number;          // Optional numeric PLU code for 20/21/22 scale tickets
  isSuperVipItem?: boolean;  // Super VIP nuts indicator for partitioned box margin safety
  inStock: boolean;
  featured: boolean;
  rating: number;
  reviewsCount: number;
  reviews?: ProductReview[];
  nutritionalInfo?: NutritionalInfo;
  taxExempt?: boolean;        // Exempt from 14% VAT when store tax mode is enabled
  etaItemCode?: string;       // Egyptian Tax Authority (EGS / GS1) item code
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

export type FulfillmentHub = 'bani_mazar' | 'cairo_october';

export interface ShippingRate {
  id: string;
  governorate: string;
  price: number;
  estimatedDays: string;
  zoneType?: 'bandar' | 'village' | 'pickup' | 'governorate';
  fulfillmentHub?: FulfillmentHub;
  minOrderAmount?: number;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;       // e.g. 10 for 10% or 50 for 50 EGP
  minOrderAmount: number;
  expiresAt?: string;
  maxUses?: number;
  usedCount?: number;
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
  sellByAmountMode?: boolean; // True when sold via POS "بيع بالمبلغ" quick calculator (audited)
  barcodeLabel?: string;      // EAN-13 / Scale barcode string
  workerNotes?: string; // ملاحظات خاصة للعامل (بدون ملح، تقسيم الربع على كيسين ثمن، إلخ)
  selectedAddons?: Array<{ id: string; name: string; extraPrice: number }>; // Paid modifiers / add-ons
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
  isFlashPromo?: boolean;
  flashPromoId?: string;
  coffeeBlendSpec?: CustomCoffeeBlendSpec;
}

export type OrderStatus = 'pending' | 'confirmed' | 'roasting_packing' | 'shipped' | 'delivered' | 'cancelled';

export type PaymentMethod =
  | 'cod'
  | 'instapay'
  | 'vodafone_cash'
  | 'vip_wallet'
  | 'card'
  | 'credit'
  | 'split';

export interface PosPaymentSplit {
  method: 'cod' | 'card' | 'instapay' | 'vodafone_cash' | 'vip_wallet' | 'credit';
  amount: number;
  reference?: string;
}

export interface PosReturnItem {
  cartItemId?: string;
  productId: string;
  productName: string;
  returnQty: number;
  weightGrams?: number;
  unitLabel?: string;
  refundAmount: number;
  condition: 'restock' | 'damaged';
}

export interface PosReturnRecord {
  id: string;
  returnNumber: string; // e.g. "RET-1001"
  orderId: string;
  orderNumber: string;
  shiftId?: string;
  registerId?: string;
  refundMethod: 'cash' | 'vip_wallet' | 'original_electronic' | 'credit_deduction';
  totalRefundAmount: number;
  taxRefundAmount?: number;
  items: PosReturnItem[];
  reason?: string;
  processedBy: string;
  createdAt: string;
}

export type DeliveryMethodType =
  | 'bandar_fast'
  | 'villages_scheduled'
  | 'governorate_shipping'
  | 'store_pickup';

export type PosOrderType =
  | 'counter_takeaway'
  | 'glass_bar_dine_in'
  | 'phone_delivery'
  | 'whatsapp_online';

export interface Order {
  id: string;
  orderNumber: string; // e.g. "NUT-1042" or "POS-1042"
  orderSource?: 'online' | 'pos';
  posOrderType?: PosOrderType;
  chairNumber?: 1 | 2 | 3 | 4; // For the 4-chair glass bar in front of Agricultural Mosque
  hallName?: string;          // Optional dining hall name when enableHallsAndTables is active
  tableName?: string;         // Optional dining table name when enableHallsAndTables is active
  deliveryCompanyId?: string; // Optional 3rd-party delivery company ID
  deliveryCompanyName?: string;
  warehouseId?: string;       // Fulfilling warehouse ID
  registerId?: string;        // Multi-register POS identifier (e.g. "reg-1", "reg-2")
  registerName?: string;      // Display name of POS register
  cashierId?: string;
  cashierName?: string;
  riderId?: string;
  riderName?: string;
  shiftId?: string;
  customerName: string;
  customerPhone: string;
  customerAltPhone?: string;
  governorate: string;
  address: string;
  notes?: string;
  deliveryMethod?: DeliveryMethodType;
  fulfillmentHub?: FulfillmentHub; // Automatic warehouse routing: bani_mazar vs cairo_october
  metaEventId?: string;            // Deduplication event_id shared between Meta Pixel & Conversions API
  upsellAdded?: boolean;           // True once a post-purchase 1-click upsell item was added
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
  taxAmount?: number;         // Egyptian VAT amount (e.g. 14%) when tax mode is enabled
  taxRatePercent?: number;    // Applied VAT rate %
  taxInclusive?: boolean;     // Whether prices already included VAT
  etaReceiptUuid?: string;    // Egyptian Tax Authority (ETA E-Receipt) UUID / QR signature
  total: number;
  cashTendered?: number;      // Amount paid in cash at POS drawer
  changeDue?: number;         // Change returned to customer at POS drawer
  rawCostTotal?: number;      // Total raw cost from Arafat's sheet
  netProfitEgp?: number;      // Net profit in EGP on this order/invoice
  paymentMethod: PaymentMethod;
  paymentSplits?: PosPaymentSplit[]; // Multi-tender split payment breakdown
  paymentReference?: string; // phone/handle or screenshot reference for InstaPay / Wallet
  paymentReceiptImage?: string; // Uploaded transfer screenshot (InstaPay / Vodafone Cash)
  creditDueAmount?: number;   // Unpaid B2B / Credit amount recorded on customer account
  creditPaidAmount?: number;  // Amount settled against creditDueAmount
  returnedAmountTotal?: number; // Cumulative amount refunded via POS returns
  returnRecords?: PosReturnRecord[]; // Embedded return history for this invoice
  inventoryReversed?: boolean; // Tracks whether stock & VIP points were restored upon cancellation
  deliveredAt?: string;       // Timestamp when rider confirmed delivery
  riderNotes?: string;        // Rider operational delivery notes
  cashCollected?: number;     // Cash amount collected by rider on COD
  riderCodSettled?: boolean;  // Whether collected COD cash was handed over to branch drawer
  riderCodSettledAt?: string; // Timestamp when COD cash was settled at branch
  riderCodSettledShiftId?: string; // POS shift ID that received the settled COD cash
  riderCodSettledBy?: string; // Cashier or Admin display name who received the cash
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

export interface CustomerCreditTransaction {
  id: string;
  date: string;
  type: 'credit_sale' | 'debt_payment' | 'return_deduction';
  amount: number;
  paymentMethod?: PaymentMethod;
  orderNumber?: string;
  shiftId?: string;
  recordedBy?: string;
  notes?: string;
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
  pinHash?: string;       // scrypt-hashed 4-digit security PIN
  hasPin?: boolean;        // Public indicator if PIN is configured
  allowCredit?: boolean;  // Admin flag allowing customer to purchase on credit (البيع الآجل)
  creditLimit?: number;   // Max permitted unpaid credit debt in EGP
  creditBalanceDue?: number; // Current unpaid credit debt owed by customer
  creditBalance?: number;    // Alias for creditBalanceDue
  creditTransactions?: CustomerCreditTransaction[];
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
  showFlashDealsSection?: boolean;
  flashDealsTitle?: string;
  flashDealsSubtitle?: string;
  showCoffeeBlenderBanner?: boolean;
  coffeeBlenderBannerTitle?: string;
  coffeeBlenderBannerDescription?: string;
}

export type StoreThemeId =
  | 'royal_roastery'
  | 'modern_minimal'
  | 'emerald_palace'
  | 'saffron_velvet'
  | 'midnight_obsidian'
  | 'levant_heritage';

export interface StoreFeatureFlags {
  enableCoffeeBlender?: boolean;
  blenderModuleLabel?: string;
  enableCustomBoxes?: boolean;
  boxesModuleLabel?: string;
  enableWeightScale?: boolean;
  enableVillageBatches?: boolean;
  enableVipWallet?: boolean;
  enableHallsAndTables?: boolean;
  enableBlindShiftClose?: boolean;
}
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

export type StaffRole = 'super_admin' | 'supplier' | 'cashier' | 'accountant' | 'delivery_rider';

export type AdminPermissionId =
  | 'overview'
  | 'orders'
  | 'products'
  | 'categories'
  | 'supply_portal'
  | 'supply_invoices'
  | 'accounting_portal'
  | 'cashier_portal'
  | 'operations'
  | 'shipping'
  | 'coupons'
  | 'reviews'
  | 'settings';

export type NonAdminStaffRole = 'supplier' | 'accountant' | 'cashier';

export type RolePermissionsConfig = Record<NonAdminStaffRole, AdminPermissionId[]>;

export interface CustomRoleDefinition {
  id: string;
  name: string;
  description?: string;
  baseRole: NonAdminStaffRole;
  permissions: AdminPermissionId[];
  color?: 'amber' | 'emerald' | 'sky' | 'purple' | 'rose' | 'stone';
  createdAt?: string;
}

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'supplier'
  | 'cashier'
  | 'accountant'
  | 'delivery_rider'
  | 'admin';

export type SystemRole = AdminRole;

export type TreasuryAccountId =
  | 'main_safe'
  | 'instapay_bank'
  | 'vodafone_wallet'
  | 'card_bank';

export interface TreasuryTransaction {
  id: string;
  txNumber: string;
  accountId: TreasuryAccountId;
  direction: 'in' | 'out';
  category:
    | 'shift_close'
    | 'electronic_settlement'
    | 'supplier_payment'
    | 'customer_debt_collection'
    | 'general_expense'
    | 'owner_deposit'
    | 'owner_withdrawal'
    | 'transfer';
  amount: number;
  referenceId?: string;
  title: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface SupplierPaymentRecord {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentMethod?: 'cash' | 'instapay' | 'vodafone_cash' | 'bank_transfer' | string;
  accountId: TreasuryAccountId;
  reference?: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface SupplyReturnItem {
  productId: string;
  productName: string;
  sellingMode?: ProductSellingMode;
  unitLabel?: string;
  quantity: number;     // Kg for weight products, Units for unit products
  returnQty?: number;   // Alias for quantity
  unitCost: number;
  totalCost: number;
}

export interface SupplyReturnRecord {
  id: string;
  returnNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  items: SupplyReturnItem[];
  totalReturnAmount: number;
  reason?: string;
  recordedBy: string;
  createdAt: string;
}

export interface SupplyInvoiceItem {
  productId: string;
  productName: string;
  sellingMode?: ProductSellingMode;
  unitLabel?: string;
  quantityUnits?: number;
  unitsCount?: number;
  unitCost?: number;
  quantityKg: number;
  actualScaleQty?: number;       // Actual weight/qty measured on roastery scale upon receipt
  weightVarianceKg?: number;     // actualScaleQty - invoicedQty (positive = surplus, negative = shortage)
  costPerKg: number;
  previousUnitCost?: number;     // Prior purchase cost for >5% price hike alert
  priceChangePercent?: number;   // % change vs previous purchase cost
  totalCost: number;
}

export interface SupplyInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  items: SupplyInvoiceItem[];
  totalAmount: number;
  paidAmount?: number;
  returnedAmount?: number;
  remainingAmount?: number;
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  dueDate?: string;
  payments?: SupplierPaymentRecord[];
  returns?: SupplyReturnRecord[];
  supplyReturns?: SupplyReturnRecord[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  notes?: string;
  adminNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface PosRegisterConfig {
  id: string;
  name: string;
  active?: boolean;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  announcementText: string;
  whatsappNumber: string;
  supportPhone: string;
  freeShippingThreshold: number;
  governoratesFreeShippingThreshold?: number; // Nationwide Egypt free shipping threshold (e.g. 650 EGP)
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
  metaCapiAccessToken?: string;
  metaCapiTestEventCode?: string;
  tiktokPixelId?: string;
  adminUsername?: string;
  adminPassword?: string;
  supplierUsername?: string;
  supplierPassword?: string;
  cashierUsername?: string;
  cashierPassword?: string;
  accountantUsername?: string;
  accountantPassword?: string;
  riderUsername?: string;
  riderPassword?: string;

  // Telegram Bot Notifications Integration
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramNotificationsEnabled?: boolean;
  telegramNotifyNewOrders?: boolean;
  telegramNotifySupplyInvoices?: boolean;
  telegramNotifyZReport?: boolean;
  telegramNotifyLowStock?: boolean;

  // White-Label Blueprint & Dynamic Regional Configuration
  currencySymbol?: string;           // e.g. "ج.م"
  orderPrefix?: string;              // e.g. "MZN", "ORD"
  cityName?: string;                 // e.g. "المدينة الرئيسية"
  bandarZones?: string[];            // Dynamic fast local delivery zones
  villageZones?: string[];           // Dynamic scheduled outskirts/village zones
  deliveryBatches?: string[];        // Dynamic scheduled delivery batch windows
  featureFlags?: StoreFeatureFlags;  // Toggleable domain modules

  // Optional Egyptian VAT (14%) & ETA E-Receipt Configuration
  enableTax?: boolean;               // Off by default for non-VAT local shops
  taxRatePercent?: number;           // Default 14% for Egypt
  taxPricingMode?: 'inclusive' | 'exclusive'; // Default 'inclusive'
  taxRegistrationNumber?: string;    // رقم التسجيل الضريبي (9 digits)
  taxActivityCode?: string;          // كود النشاط الضريبي
  taxBranchId?: string;              // كود الفرع بمنظومة الإيصال الإلكتروني

  // Multi-Register POS & Hardware Configuration
  posRegisters?: PosRegisterConfig[];
  enableDirectEscPosPrint?: boolean;
  autoOpenCashDrawer?: boolean;
  thermalPaperWidthMm?: 58 | 80;
  requireElectronicPaymentRef?: boolean;
  receiptConfig?: ReceiptConfig;

  // Credit Sales (البيع الآجل) Master Admin Controls
  enableCreditSales?: boolean;       // Master Admin switch: false = completely locked/disabled
  creditSalesRequireApproval?: boolean; // true = only customers with allowCredit=true & creditLimit

  // Security Manager PIN & 4-Partner Distribution Config
  managerPin?: string;               // 4-6 digit Manager secret PIN for returns, voids & partner withdrawals
  partnersList?: Array<{ id: string; name: string; sharePercent: number }>;

  pageContent?: StorePageContent;
  themeConfig?: StoreThemeConfig;
  rolePermissions?: RolePermissionsConfig;
  customRoles?: CustomRoleDefinition[];
}

export type ReceiptHeaderStyle = 'classic' | 'boxed' | 'minimal';
export type ReceiptDividerStyle = 'dashed' | 'solid' | 'double';
export type ReceiptFontSizeMode = 'compact' | 'normal' | 'large';

export interface ReceiptConfig {
  paperWidthMm?: 58 | 80;
  headerStyle?: ReceiptHeaderStyle;
  dividerStyle?: ReceiptDividerStyle;
  fontSizeMode?: ReceiptFontSizeMode;

  // Header lines
  showLogo?: boolean;
  logoUrl?: string;
  logoSizePx?: number;
  showStoreName?: boolean;
  customStoreName?: string;
  showHeaderSubtitle?: boolean;
  headerSubtitle?: string;
  showInvoiceTitle?: boolean;
  invoiceTitle?: string;
  showAddress?: boolean;
  customAddress?: string;
  showPhone?: boolean;
  customPhone?: string;

  // Receipt & customer meta lines
  showOrderNumber?: boolean;
  showOrderTime?: boolean;
  showCashierName?: boolean;
  showCustomerInfo?: boolean;
  showCustomerName?: boolean;
  showPaymentMethod?: boolean;
  showCustomerPhone?: boolean;
  showCustomerGovernorate?: boolean;
  showCustomerAddress?: boolean;

  // Items table columns & details
  showItemWeight?: boolean;
  showItemDetails?: boolean;
  showQuantityColumn?: boolean;
  showUnitPriceColumn?: boolean;

  // Totals & payment summary lines
  showItemCount?: boolean;
  showSubtotal?: boolean;
  showDiscount?: boolean;
  showVipRedeemed?: boolean;
  showShippingCost?: boolean;
  totalLabel?: string;
  showPaymentBreakdown?: boolean;
  showCashTenderedAndChange?: boolean;
  showVipCashback?: boolean;
  showTaxDetails?: boolean;

  // Bottom / barcode / QR / footer lines
  showReturnPolicy?: boolean;
  returnPolicyText?: string;
  showBarcode?: boolean;
  showQrCode?: boolean;
  qrCodeUrl?: string;
  qrCodeCaption?: string;
  showPromoLine?: boolean;
  promoLine?: string;
  showFooterMessage?: boolean;
  footerMessage?: string;
}

export interface PosExpense {
  id: string;
  shiftId?: string;
  registerId?: string;
  title: string;
  amount: number;
  category: 'raw_materials' | 'packaging' | 'utilities' | 'delivery_rider' | 'other' | string;
  createdBy?: string;
  notes?: string;
  createdAt: string;
}

export interface PosShift {
  id: string;
  shiftNumber: string; // e.g. "SHIFT-101"
  registerId?: string; // e.g. "reg-1"
  registerName?: string; // e.g. "ماكينة كاشير 1"
  cashierId?: string;
  cashierName: string;
  shiftPeriod: 'الوردية الصباحية' | 'الوردية المسائية' | 'وردية اليوم الكامل';
  status: 'open' | 'closed';
  startingCash?: number;
  openingCash: number;
  cashSales?: number;
  cashSalesTotal: number;
  cashReturnsTotal?: number;
  creditSalesTotal?: number;
  debtCollectionsCashTotal?: number;
  riderCodSettledTotal?: number;
  cardSales?: number;
  cardSalesTotal?: number;
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
  cupsOpeningCount?: number;
  cupsSoldCount?: number;
  cupsExpectedRemaining?: number;
  cupsActualRemaining?: number;
  cupsDifference?: number;
  treasuryTransferred?: boolean;
  startTime?: string;
  openedAt: string;
  endTime?: string;
  closedAt?: string;
  notes?: string;
}

export type AuditActionType =
  | 'auth_login'
  | 'auth_failed'
  | 'settings_update'
  | 'product_update'
  | 'price_change'
  | 'inventory_adjustment'
  | 'pos_shift_open'
  | 'pos_shift_close'
  | 'pos_return'
  | 'order_cancel'
  | 'supply_invoice_approve'
  | 'supply_invoice_reject'
  | 'supply_payment'
  | 'supply_return'
  | 'treasury_tx'
  | 'credit_settlement'
  | 'system_reset'
  | 'system_backup'
  | 'system_restore'
  | 'warehouse_transfer'
  | 'bom_update'
  | 'erp_master_update'
  | 'partner_withdrawal'
  | 'pos_sell_by_amount';

export interface AuditLogEntry {
  id: string;
  action: AuditActionType;
  actorUsername: string;
  actorDisplayName?: string;
  actorRole: AdminRole | string;
  targetType: string;
  targetId?: string;
  summary: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  ipAddress?: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  isMainStore?: boolean;
  isPosBranch?: boolean;
  active: boolean;
}

export interface WarehouseTransfer {
  id: string;
  transferNumber: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  productId: string;
  productName: string;
  quantityKg: number; // Kg for weight items, units for unit items
  unitLabel?: string;
  notes?: string;
  transferredBy: string;
  createdAt: string;
}

export interface ProductBomIngredient {
  rawProductId: string;
  rawProductName: string;
  deductGramsOrUnits: number; // Grams for weight raw item, count for unit raw item
  isUnitRaw?: boolean;
}

export interface ProductBomRecipe {
  id: string;
  parentProductId: string;
  parentProductName: string;
  ingredients: ProductBomIngredient[];
  updatedAt: string;
}

export interface PrepMethodOption {
  id: string;
  name: string;
  groupName: string; // درجة التحميص | التحويج | درجة الطحن | التمليح
  extraPrice: number;
  active: boolean;
}

export interface ProductAddonOption {
  id: string;
  name: string;
  extraPrice: number;
  extraCost?: number;
  active: boolean;
}

export interface DeliveryCompany {
  id: string;
  name: string;
  phone?: string;
  commissionPercent: number;
  notes?: string;
  active: boolean;
}

export interface EmployeeRecord {
  id: string;
  code: string;
  name: string;
  phone?: string;
  jobTitle: string;
  monthlySalary: number;
  hireDate?: string;
  notes?: string;
  active: boolean;
}

export interface DiningTable {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
}

export interface DiningHall {
  id: string;
  name: string;
  tables: DiningTable[];
  active: boolean;
}

export interface CustomExpenseCategory {
  id: string;
  key: string;
  label: string;
  monthlyBudget?: number;
  active: boolean;
}

export interface PartnerWithdrawal {
  id: string;
  withdrawalNumber: string; // e.g. "PW-1001"
  partnerId: string;        // partner-1 .. partner-4
  partnerName: string;
  productId: string;
  productName: string;
  quantityKgOrUnits: number;
  unitLabel: string;
  unitCostEgp: number;
  totalCostEgp: number;     // Deducted from partner's 25% profit share at wholesale cost
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface DatabaseSchema {
  isSeeded?: boolean;
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  shippingRates: ShippingRate[];
  coupons: Coupon[];
  orders: Order[];
  vipMembers?: VipMember[];
  promotions?: FlashPromotion[];
  flashPromotions?: FlashPromotion[];
  posShifts?: PosShift[];
  posExpenses?: PosExpense[];
  posReturns?: PosReturnRecord[];
  supplyInvoices?: SupplyInvoice[];
  supplierPayments?: SupplierPaymentRecord[];
  supplyReturns?: SupplyReturnRecord[];
  treasuryTransactions?: TreasuryTransaction[];
  staffAccounts?: StaffAccount[];
  inventoryAdjustments?: InventoryAdjustment[];
  auditLogs?: AuditLogEntry[];
  // Extended ERP Master Data & Multi-Warehouse / BOM Modules
  warehouses?: Warehouse[];
  warehouseTransfers?: WarehouseTransfer[];
  bomRecipes?: ProductBomRecipe[];
  prepMethods?: PrepMethodOption[];
  productAddons?: ProductAddonOption[];
  deliveryCompanies?: DeliveryCompany[];
  employees?: EmployeeRecord[];
  diningHalls?: DiningHall[];
  expenseCategories?: CustomExpenseCategory[];
  partnerWithdrawals?: PartnerWithdrawal[];
}

export type InventoryAdjustmentReason =
  | 'physical_count_discrepancy'
  | 'roasting_shrinkage'
  | 'damaged_spoilage'
  | 'sample_hospitality'
  | 'correction';

export interface InventoryAdjustment {
  id: string;
  adjustmentNumber: string;
  productId: string;
  productName: string;
  previousStockKg: number;
  newStockKg: number;
  differenceKg: number;
  unitCostPerKg: number;
  totalCostImpact: number;
  reason: InventoryAdjustmentReason;
  reasonLabel: string;
  notes?: string;
  adjustedBy: string;
  adjustedByRole: AdminRole;
  createdAt: string;
}

export interface StaffAccount {
  id: string;
  username: string;
  passwordHash: string;
  role: AdminRole;
  customRoleId?: string;
  displayName: string;
  phone?: string;
  active: boolean;
  isPrimary?: boolean;
  notes?: string;
  settingsFingerprint?: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export type StaffAccountPublic = Omit<StaffAccount, 'passwordHash' | 'settingsFingerprint'>;

export type StoreDatabase = DatabaseSchema;

export interface AdminAuthSession {
  token: string;
  expiresAt: number;
  role?: AdminRole;
  username?: string;
  staffId?: string;
  displayName?: string;
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
