import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseSchema } from '@/types/store';
import {
  DEFAULT_PAGE_CONTENT,
  DEFAULT_THEME_CONFIG,
  getResolvedPageContent,
  getResolvedThemeConfig,
  getSafeImageUrl,
} from '@/lib/defaults';

const DB_PATH = path.join(process.cwd(), 'data', 'store-db.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'new-nuts-store-db.json');

declare global {
  // eslint-disable-next-line no-var
  var __newNutsMemoryDb: DatabaseSchema | undefined;
}

export const initialDatabase: DatabaseSchema = {
  settings: {
    storeName: 'محمصة الواحة الذهبية',
    tagline: 'أفخر أنواع المكسرات الطازجة محمصة يومياً بحب وعناية',
    announcementText: '🔥 شحن مجاني لجميع المحافظات للطلبات فوق 1000 ج.م | استخدم كود NUTS10 لخصم 10% على أول طلب!',
    whatsappNumber: '201000000000',
    supportPhone: '01000000000',
    freeShippingThreshold: 1000,
    instapayAddress: 'elwaha.nuts@instapay',
    vodafoneCashNumber: '01000000000',
    address: 'القاهرة - مدينة نصر - شارع عباس العقاد',
    workingHours: 'يومياً من 10 صباحاً حتى 12 منتصف الليل',
    adminPassword: 'admin',
    pageContent: DEFAULT_PAGE_CONTENT,
    themeConfig: DEFAULT_THEME_CONFIG,
  },
  categories: [
    {
      id: 'cat-luxury-nuts',
      name: 'المكسرات الفاخرة',
      slug: 'luxury-nuts',
      description: 'بندق، فستق، عين جمل، كاجو ولوز نخب أول مستورد وطازج',
      icon: 'Nut',
      image: '/images/products/pistachio.jpg',
    },
    {
      id: 'cat-mixed-boxes',
      name: 'بوكسات المشكل والهدايا',
      slug: 'mixed-boxes',
      description: 'تشكيلات ملكية وبوكسات هدايا فاخرة للمناسبات والعزومات',
      icon: 'Gift',
      image: '/images/products/royal-mix.jpg',
    },
    {
      id: 'cat-dried-fruits',
      name: 'فواكه مجففة وتمور',
      slug: 'dried-fruits',
      description: 'تمور ملكية محشوة بالمكسرات، قراصيا، مشمشية، تين وزبيب فاخر',
      icon: 'Apple',
      image: '/images/products/stuffed-dates.jpg',
    },
    {
      id: 'cat-snacks',
      name: 'تسالي ومقرمشات',
      slug: 'snacks',
      description: 'فول سوداني حلواني، لب سوبر، ذرة محمصة ومقرمشات بنكهات مميزة',
      icon: 'Sparkles',
      image: '/images/products/savory-snacks.jpg',
    },
  ],
  products: [
    {
      id: 'prod-pistachio-1',
      slug: 'jumbo-pistachio-usa',
      name: 'فستق أمريكي جامبو محمص',
      subtitle: 'حبة كبيرة مفتوحة مقرمشة ونكهة غنية لا تقاوم',
      categoryId: 'cat-luxury-nuts',
      description:
        'فستق أمريكي جامبو نخب أول، يتم تحميصه يومياً بدرجة حرارة مدروسة للحفاظ على الزيوت الطبيعية والقرمشة المثالية. خالٍ من الحبات المغلقة ومفرز بعناية فائقة.',
      image: '/images/products/pistachio.jpg',
      badge: 'الأكثر مبيعاً',
      origin: 'أمريكي جامبو نخب أول',
      nutritionalHighlight: 'غني بالبروتين النباتي ومضادات الأكسدة وفيتامين B6',
      caloriesPer100g: 562,
      proteinPer100g: '20 جم',
      roastOptions: ['محمص مملح', 'محمص بدون ملح', 'نيء طبيعي'],
      weights: [
        { id: 'w-250', label: '250 جم (ربع كيلو)', weightGrams: 250, price: 215, originalPrice: 240 },
        { id: 'w-500', label: '500 جم (نصف كيلو)', weightGrams: 500, price: 420, originalPrice: 470 },
        { id: 'w-1000', label: '1 كجم (كيلو كامل)', weightGrams: 1000, price: 820, originalPrice: 920 },
      ],
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 128,
      reviews: [
        {
          id: 'r1',
          customerName: 'أحمد عبد الرحمن',
          rating: 5,
          comment: 'الفستق طازج جداً ومقرمش ومفيش ولا حباية مقفولة، التغليف ممتاز بيحفظ الطراوة.',
          date: 'منذ يومين',
          verified: true,
        },
        {
          id: 'r2',
          customerName: 'نهى محمود',
          rating: 5,
          comment: 'أحسن محمصة جربتها أونلاين، التحميص بدون ملح طعمه طبيعي وتحفة.',
          date: 'منذ أسبوع',
          verified: true,
        },
      ],
    },
    {
      id: 'prod-hazelnut-1',
      slug: 'turkish-hazelnut-peeled',
      name: 'بندق تركي مقشر فاخر',
      subtitle: 'بندق غيرسون التركي الأصلي بحجم كبير وطعم غني',
      categoryId: 'cat-luxury-nuts',
      description:
        'بندق تركي مقشر من أجود مزارع البحر الأسود في تركيا، متاح محمص ذهبي مقرمش أو نيء طبيعي للحلويات والتناول الصحي اليومي.',
      image: '/images/products/hazelnut.jpg',
      badge: 'تحميص اليوم',
      origin: 'تركي فاخر (غيرسون)',
      nutritionalHighlight: 'مصدر ممتاز لفيتامين E والدهون الصحية للقلب والذاكرة',
      caloriesPer100g: 628,
      proteinPer100g: '15 جم',
      roastOptions: ['محمص بدون ملح', 'محمص مملح', 'نيء طبيعي'],
      weights: [
        { id: 'w-250', label: '250 جم (ربع كيلو)', weightGrams: 250, price: 185, originalPrice: 210 },
        { id: 'w-500', label: '500 جم (نصف كيلو)', weightGrams: 500, price: 360, originalPrice: 400 },
        { id: 'w-1000', label: '1 كجم (كيلو كامل)', weightGrams: 1000, price: 700, originalPrice: 780 },
      ],
      inStock: true,
      featured: true,
      rating: 4.8,
      reviewsCount: 94,
      reviews: [
        {
          id: 'r3',
          customerName: 'مريم طارق',
          rating: 5,
          comment: 'البندق التركي ريحته وطعمه يجننوا، واضح إنه لسه متحمص طازة.',
          date: 'منذ 3 أيام',
          verified: true,
        },
      ],
    },
    {
      id: 'prod-walnut-1',
      slug: 'chilean-walnut-halves',
      name: 'عين جمل تشيلي أنصاف (فراشة)',
      subtitle: 'لون فاتح ذهبي وطعم كريمي بدون أي مرارة',
      categoryId: 'cat-luxury-nuts',
      description:
        'عين جمل تشيلي نخب أول (أنصاف كاملة فاتحة اللون)، يتميز بطعمه الحلو الكريمي وخلوه التام من المرارة. مثالي للتركيز وتقوية الذاكرة وللأطفال.',
      image: '/images/products/walnut.jpg',
      badge: 'غذاء الذكاء',
      origin: 'تشيلي نخب أول (Extra Light)',
      nutritionalHighlight: 'أعلى مصدر نباتي لأحماض أوميجا-3 الداعمة لصحة الدماغ',
      caloriesPer100g: 654,
      proteinPer100g: '15.2 جم',
      roastOptions: ['نيء طبيعي', 'محمص بدون ملح'],
      weights: [
        { id: 'w-250', label: '250 جم (ربع كيلو)', weightGrams: 250, price: 165, originalPrice: 185 },
        { id: 'w-500', label: '500 جم (نصف كيلو)', weightGrams: 500, price: 320, originalPrice: 360 },
        { id: 'w-1000', label: '1 كجم (كيلو كامل)', weightGrams: 1000, price: 620, originalPrice: 700 },
      ],
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 112,
      reviews: [
        {
          id: 'r4',
          customerName: 'د. كريم سامي',
          rating: 5,
          comment: 'عين الجمل لونه أبيض فاتح ومفيش فيه أي طعم مر نهائياً، جودة ممتازة.',
          date: 'منذ 5 أيام',
          verified: true,
        },
      ],
    },
    {
      id: 'prod-cashew-1',
      slug: 'jumbo-vietnamese-cashew-w180',
      name: 'كاجو جامبو ملكي (W180)',
      subtitle: 'أكبر مقاس حبة كاجو بقوام زبدي وقرمشة فاخرة',
      categoryId: 'cat-luxury-nuts',
      description:
        'كاجو جامبو مقاس W180 الملكي، محمص بعناية بدون زيوت مهدرجة ليمنحك القرمشة الذهبية مع القوام الزبدي الغني.',
      image: '/images/products/cashew.jpg',
      badge: 'حجم جامبو ملكي',
      origin: 'فيتنامي / هندي ملكي W180',
      nutritionalHighlight: 'غني بالماغنسيوم والزنك والحديد لتعزيز المناعة والطاقة',
      caloriesPer100g: 553,
      proteinPer100g: '18.2 جم',
      roastOptions: ['محمص مملح', 'محمص بدون ملح', 'مدخن بالتوابل', 'نيء طبيعي'],
      weights: [
        { id: 'w-250', label: '250 جم (ربع كيلو)', weightGrams: 250, price: 195, originalPrice: 220 },
        { id: 'w-500', label: '500 جم (نصف كيلو)', weightGrams: 500, price: 380, originalPrice: 430 },
        { id: 'w-1000', label: '1 كجم (كيلو كامل)', weightGrams: 1000, price: 740, originalPrice: 840 },
      ],
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 145,
    },
    {
      id: 'prod-almond-1',
      slug: 'california-golden-almonds',
      name: 'لوز كاليفورنيا ذهبي جامبو',
      subtitle: 'حبات لوز منتقاة بعناية غنية بالألياف والبروتين',
      categoryId: 'cat-luxury-nuts',
      description:
        'لوز أمريكي كاليفورنيا حبة كبيرة مقرمشة، مثالي كسناك صحي للرياضيين والدايت أو مع القهوة الصباحية.',
      image: '/images/products/almond.jpg',
      badge: 'صحي للدايت',
      origin: 'كاليفورنيا - أمريكا',
      nutritionalHighlight: 'غني بالألياف وفيتامين E والكالسيوم والبروتين لبناء العضلات',
      caloriesPer100g: 579,
      proteinPer100g: '21.2 جم',
      roastOptions: ['محمص بدون ملح', 'محمص مملح', 'مدخن بالتوابل', 'نيء طبيعي'],
      weights: [
        { id: 'w-250', label: '250 جم (ربع كيلو)', weightGrams: 250, price: 160, originalPrice: 180 },
        { id: 'w-500', label: '500 جم (نصف كيلو)', weightGrams: 500, price: 310, originalPrice: 350 },
        { id: 'w-1000', label: '1 كجم (كيلو كامل)', weightGrams: 1000, price: 600, originalPrice: 680 },
      ],
      inStock: true,
      featured: false,
      rating: 4.8,
      reviewsCount: 79,
    },
    {
      id: 'prod-royal-mix-1',
      slug: 'royal-vip-mixed-nuts-box',
      name: 'بوكس المشكل الملكي VIP (5 أصناف فاخرة)',
      subtitle: 'فستق + كاجو جامبو + بندق تركي + لوز كاليفورنيا + عين جمل',
      categoryId: 'cat-mixed-boxes',
      description:
        'التشكيلة الأكثر طلباً! مزيج متوازن بعناية بنسبة متساوية من 5 أنواع مكسرات فاخرة (بدون فول سوداني أو لب): فستق أمريكي، كاجو جامبو، بندق تركي، لوز أمريكي، وعين جمل تشيلي في علبة محكمة الغلق تحفظ القرمشة.',
      image: '/images/products/royal-mix.jpg',
      badge: 'توفير + هدية مثالية',
      origin: 'تشكيلة ملكية مستوردة 100%',
      nutritionalHighlight: 'مزيج متكامل من الفيتامينات والمعادن والأوميجا 3 والطاقة',
      caloriesPer100g: 590,
      proteinPer100g: '19 جم',
      roastOptions: ['محمص مملح', 'محمص بدون ملح', 'نيء طبيعي', 'مدخن بالتوابل'],
      weights: [
        { id: 'w-500', label: 'بوكس 500 جم (نصف كيلو)', weightGrams: 500, price: 375, originalPrice: 430 },
        { id: 'w-1000', label: 'بوكس 1 كجم العائلي', weightGrams: 1000, price: 720, originalPrice: 840 },
        { id: 'w-2000', label: 'بوكس الضيافة الملكي 2 كجم', weightGrams: 2000, price: 1390, originalPrice: 1650 },
      ],
      inStock: true,
      featured: true,
      rating: 5.0,
      reviewsCount: 214,
      reviews: [
        {
          id: 'r5',
          customerName: 'مهندس طارق الشناوي',
          rating: 5,
          comment: 'البوكس الملكي يشرف جداً في الضيافة والهدايا، النسب متساوية فعلاً وكل صنف أحلى من التاني.',
          date: 'منذ يوم',
          verified: true,
        },
      ],
    },
    {
      id: 'prod-energy-mix-1',
      slug: 'healthy-fitness-mix-box',
      name: 'بوكس الطاقة والرشاقة (مكسرات نيئة وفواكه مجففة)',
      subtitle: 'عين جمل + لوز + كاجو + بندق + توت بري وزبيب ذهبي',
      categoryId: 'cat-mixed-boxes',
      description:
        'مصمم خصيصاً لمحبي الأكل الصحي والرياضيين والطلاب، يجمع بين المكسرات النيئة غير المملحة والفواكه المجففة الطبيعية لمنحك طاقة مستدامة وتركيز عالي طوال اليوم.',
      image: '/images/products/energy-mix.jpg',
      badge: 'طبيعي 100%',
      origin: 'تشكيلة صحية بدون ملح أو سكر مضاف',
      nutritionalHighlight: 'طاقة فورية وألياف طبيعية بدون أي أملاح أو مواد حافظة',
      caloriesPer100g: 510,
      proteinPer100g: '16.5 جم',
      roastOptions: ['نيء طبيعي', 'محمص بدون ملح'],
      weights: [
        { id: 'w-500', label: 'بوكس 500 جم', weightGrams: 500, price: 330, originalPrice: 375 },
        { id: 'w-1000', label: 'بوكس 1 كجم', weightGrams: 1000, price: 630, originalPrice: 720 },
      ],
      inStock: true,
      featured: false,
      rating: 4.9,
      reviewsCount: 63,
    },
    {
      id: 'prod-dates-stuffed-1',
      slug: 'royal-medjool-dates-stuffed-nuts',
      name: 'تمر مجدول ملكي محشو بالمكسرات الفاخرة',
      subtitle: 'حبات تمر مجدول جامبو محشوة باللوز والفستق والكاجو وعين الجمل',
      categoryId: 'cat-dried-fruits',
      description:
        'تمر مجدول ملكي طري وفاخر، منزوع النوى ومحشو يدوياً بحبات كاملة من الفستق واللوز المحمص وعين الجمل والكاجو. مثالي مع القهوة العربية وكهدية راقية.',
      image: '/images/products/stuffed-dates.jpg',
      badge: 'ضيافة فاخرة',
      origin: 'تمر مجدول ملكي + مكسرات مستوردة',
      nutritionalHighlight: 'غني بالحديد والبوتاسيوم والسكريات الطبيعية الصحية',
      caloriesPer100g: 390,
      proteinPer100g: '8.5 جم',
      roastOptions: ['تشكيلة فاخرة'],
      weights: [
        { id: 'w-500', label: 'علبة 500 جم فاخرة', weightGrams: 500, price: 245, originalPrice: 280 },
        { id: 'w-1000', label: 'علبة 1 كجم ملكية', weightGrams: 1000, price: 460, originalPrice: 530 },
      ],
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 88,
    },
    {
      id: 'prod-apricot-prunes-1',
      slug: 'turkish-dried-apricots-and-prunes',
      name: 'مشمشية تركي جامبو وقراصيا فاخرة',
      subtitle: 'فواكه مجففة طبيعية طرية وغنية بالفيتامينات',
      categoryId: 'cat-dried-fruits',
      description:
        'مشمشية تركي مقاس جامبو رقم 1 مع قراصيا مستوردة منزوعة النوى، طرية جداً وبطعم طبيعي غني ومثالية للتناول المباشر أو الحلويات.',
      image: '/images/products/apricots-prunes.jpg',
      origin: 'تركي مستورد نخب أول',
      nutritionalHighlight: 'غنية بالحديد والألياف وفيتامين A',
      caloriesPer100g: 241,
      proteinPer100g: '3.4 جم',
      roastOptions: ['نيء طبيعي'],
      weights: [
        { id: 'w-250', label: '250 جم', weightGrams: 250, price: 115, originalPrice: 135 },
        { id: 'w-500', label: '500 جم', weightGrams: 500, price: 220, originalPrice: 260 },
        { id: 'w-1000', label: '1 كجم', weightGrams: 1000, price: 420, originalPrice: 490 },
      ],
      inStock: true,
      featured: false,
      rating: 4.7,
      reviewsCount: 47,
    },
    {
      id: 'prod-savory-mix-1',
      slug: 'crunchy-cheese-smoked-snacks-mix',
      name: 'ميكس تسالي ومقرمشات السهرة الفاخر',
      subtitle: 'فول سوداني حلواني + ذرة أسباني مقرمشة + مقرمشات بالجبنة والباربكيو',
      categoryId: 'cat-snacks',
      description:
        'تشكيلة السهرة واللمات العائلية! تجمع بين السوداني الحلواني المحمص، الذرة الأسباني المقرمشة، الحمص، والمقرمشات المخبوزة بنكهات الجبنة والمدخن.',
      image: '/images/products/savory-snacks.jpg',
      badge: 'سناك العائلة',
      origin: 'تحميص يومي طازج',
      nutritionalHighlight: 'قرمشة طازجة محمصة بالهواء الساخن بأقل نسبة دهون',
      caloriesPer100g: 460,
      proteinPer100g: '14 جم',
      roastOptions: ['محمص مملح', 'مدخن بالتوابل'],
      weights: [
        { id: 'w-500', label: '500 جم (نصف كيلو)', weightGrams: 500, price: 110, originalPrice: 130 },
        { id: 'w-1000', label: '1 كجم (كيلو عائلي)', weightGrams: 1000, price: 205, originalPrice: 245 },
      ],
      inStock: true,
      featured: false,
      rating: 4.8,
      reviewsCount: 91,
    },
  ],
  shippingRates: [
    { id: 'ship-1', governorate: 'القاهرة والجيزة', price: 50, estimatedDays: 'خلال 24 ساعة' },
    { id: 'ship-2', governorate: 'الإسكندرية', price: 60, estimatedDays: '1 - 2 يوم عمل' },
    { id: 'ship-3', governorate: 'الدلتا والقناة (المنصورة، طنطا، الزقازيق، الإسماعيلية، بورسعيد)', price: 65, estimatedDays: '1 - 2 يوم عمل' },
    { id: 'ship-4', governorate: 'محافظات الصعيد (بني سويف، المنيا، أسيوط، سوهاج)', price: 80, estimatedDays: '2 - 3 أيام عمل' },
    { id: 'ship-5', governorate: 'الأقصر وأسوان والبحر الأحمر وجنوب سيناء', price: 95, estimatedDays: '2 - 4 أيام عمل' },
  ],
  coupons: [
    {
      id: 'coup-1',
      code: 'NUTS10',
      discountType: 'percentage',
      value: 10,
      minOrderAmount: 300,
      active: true,
      description: 'خصم 10% على جميع الطلبات فوق 300 ج.م',
    },
    {
      id: 'coup-2',
      code: 'WELCOME50',
      discountType: 'fixed',
      value: 50,
      minOrderAmount: 500,
      active: true,
      description: 'خصم 50 جنيه للطلبات فوق 500 ج.م',
    },
  ],
  orders: [
    {
      id: 'ord-1001',
      orderNumber: 'NUT-1001',
      customerName: 'محمد عادل الشافعي',
      customerPhone: '01012345678',
      governorate: 'القاهرة والجيزة',
      address: 'التجمع الخامس - الحي الثاني - فيلا 42',
      notes: 'يرجى الاتصال قبل الوصول بنصف ساعة',
      items: [
        {
          cartItemId: 'prod-royal-mix-1-w-1000-محمص مملح',
          productId: 'prod-royal-mix-1',
          productName: 'بوكس المشكل الملكي VIP (5 أصناف فاخرة)',
          productImage: '/images/products/royal-mix.jpg',
          weightId: 'w-1000',
          weightLabel: 'بوكس 1 كجم العائلي',
          roastOption: 'محمص مملح',
          unitPrice: 720,
          quantity: 1,
        },
        {
          cartItemId: 'prod-hazelnut-1-w-500-محمص بدون ملح',
          productId: 'prod-hazelnut-1',
          productName: 'بندق تركي مقشر فاخر',
          productImage: '/images/products/hazelnut.jpg',
          weightId: 'w-500',
          weightLabel: '500 جم (نصف كيلو)',
          roastOption: 'محمص بدون ملح',
          unitPrice: 360,
          quantity: 1,
        },
      ],
      subtotal: 1080,
      shippingCost: 0,
      discountAmount: 108,
      couponCode: 'NUTS10',
      total: 972,
      paymentMethod: 'cod',
      status: 'roasting_packing',
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    },
    {
      id: 'ord-1002',
      orderNumber: 'NUT-1002',
      customerName: 'سارة حسام الدين',
      customerPhone: '01123456789',
      governorate: 'الإسكندرية',
      address: 'سموحة - شارع فوزي معاذ - برج النخيل شقة 8',
      items: [
        {
          cartItemId: 'prod-pistachio-1-w-500-محمص مملح',
          productId: 'prod-pistachio-1',
          productName: 'فستق أمريكي جامبو محمص',
          productImage: '/images/products/pistachio.jpg',
          weightId: 'w-500',
          weightLabel: '500 جم (نصف كيلو)',
          roastOption: 'محمص مملح',
          unitPrice: 420,
          quantity: 1,
        },
        {
          cartItemId: 'prod-walnut-1-w-500-نيء طبيعي',
          productId: 'prod-walnut-1',
          productName: 'عين جمل تشيلي أنصاف (فراشة)',
          productImage: '/images/products/walnut.jpg',
          weightId: 'w-500',
          weightLabel: '500 جم (نصف كيلو)',
          roastOption: 'نيء طبيعي',
          unitPrice: 320,
          quantity: 1,
        },
      ],
      subtotal: 740,
      shippingCost: 60,
      discountAmount: 0,
      total: 800,
      paymentMethod: 'instapay',
      paymentReference: 'تحويل إنستا باي من سارة حسام - رقم مرجعي 983412',
      status: 'delivered',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ],
};

function normalizeDatabase(parsed: DatabaseSchema): DatabaseSchema {
  if (parsed.settings) {
    parsed.settings.pageContent = getResolvedPageContent(parsed.settings);
    parsed.settings.themeConfig = getResolvedThemeConfig(parsed.settings);
  }
  if (Array.isArray(parsed.orders)) {
    for (const order of parsed.orders) {
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          item.productImage = getSafeImageUrl(item.productImage);
          if (Array.isArray(item.customBreakdown)) {
            for (const part of item.customBreakdown) {
              part.productImage = getSafeImageUrl(part.productImage);
            }
          }
        }
      }
    }
  }
  if (Array.isArray(parsed.products)) {
    for (const prod of parsed.products) {
      prod.image = getSafeImageUrl(prod.image);
    }
  }
  if (Array.isArray(parsed.categories)) {
    for (const cat of parsed.categories) {
      cat.image = getSafeImageUrl(cat.image);
    }
  }
  return parsed;
}

function ensureDbFile(): DatabaseSchema {
  try {
    // On Vercel/read-only environments, if a newer copy exists in /tmp, prefer it
    if (process.env.VERCEL && fs.existsSync(TMP_DB_PATH)) {
      const rawTmp = fs.readFileSync(TMP_DB_PATH, 'utf-8');
      const parsedTmp = normalizeDatabase(JSON.parse(rawTmp) as DatabaseSchema);
      globalThis.__newNutsMemoryDb = parsedTmp;
      return parsedTmp;
    }

    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = normalizeDatabase(JSON.parse(raw) as DatabaseSchema);
      globalThis.__newNutsMemoryDb = parsed;
      return parsed;
    }

    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDatabase, null, 2), 'utf-8');
    return normalizeDatabase(structuredClone(initialDatabase));
  } catch (err) {
    if (globalThis.__newNutsMemoryDb) {
      return globalThis.__newNutsMemoryDb;
    }
    try {
      if (fs.existsSync(TMP_DB_PATH)) {
        const rawTmp = fs.readFileSync(TMP_DB_PATH, 'utf-8');
        return normalizeDatabase(JSON.parse(rawTmp) as DatabaseSchema);
      }
    } catch {
      // Ignore /tmp read error
    }
    console.error('Database read fallback to memory:', err);
    return normalizeDatabase(structuredClone(initialDatabase));
  }
}

export function getDb(): DatabaseSchema {
  return ensureDbFile();
}

export function saveDb(data: DatabaseSchema): void {
  const normalized = normalizeDatabase(data);
  globalThis.__newNutsMemoryDb = normalized;
  const serialized = JSON.stringify(normalized, null, 2);

  try {
    if (!process.env.VERCEL) {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, serialized, 'utf-8');
      return;
    }
  } catch {
    // Fall through to /tmp write on read-only filesystem
  }

  try {
    fs.writeFileSync(TMP_DB_PATH, serialized, 'utf-8');
  } catch (err) {
    console.error('Failed to write database file to /tmp:', err);
  }
}
