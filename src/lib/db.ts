import fs from 'fs';
import os from 'os';
import path from 'path';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { DatabaseSchema } from '@/types/store';
import {
  DEFAULT_PAGE_CONTENT,
  DEFAULT_THEME_CONFIG,
  getResolvedPageContent,
  getResolvedThemeConfig,
  getSafeImageUrl,
} from '@/lib/defaults';
import { generateWeightsFromKiloPrice } from '@/lib/pricing';

const DB_PATH = path.join(process.cwd(), 'data', 'store-db.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'new-nuts-store-db.json');

declare global {
  // eslint-disable-next-line no-var
  var __newNutsMemoryDb: DatabaseSchema | undefined;
  // eslint-disable-next-line no-var
  var __newNutsTableReady: boolean | undefined;
}

function getPostgresUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.STORAGE_URL ||
    undefined
  );
}

export const initialDatabase: DatabaseSchema = {
  settings: {
    storeName: 'محمصة حفصة للبن والمكسرات',
    tagline: 'أصل التحميصة ومزاج القهوة الفاخر • مركز بني مزار (أمام مسجد الزراعيين)',
    announcementText:
      '🔥 بمناسبة الافتتاح أمام مسجد الزراعيين: كوباية إسبريسو أو قهوة تركي هدية + عضوية VIP (5% كاش باك) مع كل طلب فوق 150 جنيه! | توصيل لبندر بني مزار في 30 دقيقة 🛵',
    whatsappNumber: '201100699524',
    supportPhone: '01100699524',
    freeShippingThreshold: 300,
    vipCashbackPercent: 5,
    vipMinOrderForCashback: 150,
    villageMinOrderAmount: 200,
    instapayAddress: 'hafsa.roastery@instapay',
    vodafoneCashNumber: '01100699524',
    address: 'المنيا - مركز بني مزار - شارع مسجد الزراعيين (أمام مسجد الزراعيين مباشرة)',
    workingHours: 'يومياً من 9 صباحاً حتى 2 بعد منتصف الليل (الموقع يعمل 24 ساعة)',
    googleMapsUrl: 'https://maps.google.com/?q=مسجد+الزراعيين+بني+مزار+المنيا',
    metaPixelId: 'HAFSA-META-PIXEL-2026',
    tiktokPixelId: 'HAFSA-TIKTOK-PIXEL-2026',
    adminPassword: 'admin',
    managerPassword: 'manager',
    promoPartnerPassword: 'promo',
    wesamAdminPassword: 'wesam',
    pageContent: DEFAULT_PAGE_CONTENT,
    themeConfig: DEFAULT_THEME_CONFIG,
  },
  categories: [
    {
      id: 'cat-luxury-nuts',
      name: '🥜 بنك المكسرات الفاخرة (VIP Nuts)',
      slug: 'luxury-nuts',
      description: 'فستق، كاجو، لوز، عين جمل، بيكان، ماكاديميا، بندق، وميكسات حفصة المشكلة',
      icon: 'Nut',
      image: '/images/products/pistachio.jpg',
      subCategories: ['فستق جامبو', 'كاجو ملكي', 'لوز كاليفورنيا', 'عين جمل تشيلي', 'بندق تركي', 'بيكان وماكاديميا', 'ميكسات VIP'],
    },
    {
      id: 'cat-snacks',
      name: '🌻 محمصة اللب والتسالي الساخنة',
      slug: 'snacks',
      description: 'لب سوبر، لب قرع جامبو، لب أبيض A1، لب خشب، لب بطيخ، فول سوداني، كريك كراك، فول فلسطيني، ذرة إسباني، ومقرمشات',
      icon: 'Sparkles',
      image: '/images/products/savory-snacks.jpg',
      subCategories: ['لب سوبر', 'لب قرع وأبيض A1', 'لب خشب وبطيخ', 'فول سوداني وفلسطيني', 'كريك كراك ومقرمشات', 'ذرة إسباني'],
    },
    {
      id: 'cat-coffee-espresso',
      name: '☕ ركن البن والإسبريسو',
      slug: 'coffee-espresso',
      description: 'بن تركي (سادة/محوج)، بن إسبريسو، بن فرنساوي، كبسولات، ومشاريب القهوة الساخنة والباردة للتوصيل السريع في البندر',
      icon: 'Coffee',
      image: '/images/products/hazelnut.jpg',
      subCategories: ['بن تركي محوج وسادة', 'بن إسبريسو وفرنساوي', 'توليفة حفصة السرية', 'مشاريب بار القهوة التيك أواي'],
    },
    {
      id: 'cat-choco-candy',
      name: '🍫 استاند الشوكولاتات والكاندي',
      slug: 'choco-candy',
      description: 'شوكولاتات مستوردة، درابيه، كاندي مشكل، وكوبايات القبة الجاهزة (Dome Cups)',
      icon: 'Candy',
      image: '/images/products/energy-mix.jpg',
      subCategories: ['شوكولاتات مستوردة', 'درابيه بالمكسرات', 'كوبايات القبة (Dome Cups)', 'كاندي السعادة المشكل'],
    },
    {
      id: 'cat-honey-spices',
      name: '🍯 خلية النحل والعطارة الفاخرة',
      slug: 'honey-spices',
      description: 'برطمانات العسل الطبيعي (سدر، موالح، برسيم، حبة البركة) بالمكسرات، وتوابل استاند العطار النقية',
      icon: 'Droplets',
      image: '/images/products/stuffed-dates.jpg',
      subCategories: ['عسل نحل بالمكسرات', 'عسل سدر وموالح وبرسيم', 'توابل استاند العطار النقية', 'تمور وفواكه مجففة'],
    },
    {
      id: 'cat-mixed-boxes',
      name: '🎁 البوكسات وعروض السهرة',
      slug: 'mixed-boxes',
      description: 'البوكسات الجاهزة والمقسمة (بوكس روقان 125 ج، بوكس العيلة 250 ج، بوكس هدايا الـ VIP بـ 450 ج)',
      icon: 'Gift',
      image: '/images/products/royal-mix.jpg',
      subCategories: ['بوكس روقان 125 ج (4 خانات)', 'بوكس العيلة 250 ج (6 خانات)', 'بوكس هدايا VIP 450 ج (6 خانات ملكية)'],
    },
  ],
  products: [
    // =========================================================================
    // 1. 🥜 بنك المكسرات الفاخرة (VIP Nuts) — الفئات 1 إلى 7
    // =========================================================================
    {
      id: 'prod-pistachio-1',
      slug: 'jumbo-pistachio-usa',
      name: 'فستق أمريكي جامبو محمص',
      subtitle: 'حبة كبيرة مفتوحة مقرمشة ونكهة غنية لا تقاوم • تحميص يومي',
      categoryId: 'cat-luxury-nuts',
      subCategoryName: 'فستق أمريكي جامبو',
      description:
        'فستق أمريكي جامبو نخب أول، يتم تحميصه يومياً بدرجة حرارة مدروسة للحفاظ على الزيوت الطبيعية والقرمشة المثالية. خالٍ من الحبات المغلقة ومفرز بعناية فائقة في محمصة حفصة.',
      image: '/images/products/pistachio.jpg',
      badge: 'الأكثر مبيعاً',
      origin: 'أمريكي جامبو نخب أول',
      nutritionalHighlight: 'غني بالبروتين النباتي ومضادات الأكسدة وفيتامين B6',
      caloriesPer100g: 562,
      proteinPer100g: '20 جم',
      pricePerKg: 820,
      costPerKg: 640,
      roastOptions: ['محمص مملح', 'محمص بدون ملح', 'نيء طبيعي'],
      weights: [
        { id: 'w-125', label: 'ثمن 125 جم', weightGrams: 125, price: 105, originalPrice: 120 },
        { id: 'w-250', label: 'ربع 250 جم', weightGrams: 250, price: 215, originalPrice: 240 },
        { id: 'w-500', label: 'نصف 500 جم', weightGrams: 500, price: 420, originalPrice: 470 },
        { id: 'w-1000', label: 'كيلو 1000 جم', weightGrams: 1000, price: 820, originalPrice: 920 },
      ],
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 128,
      reviews: [
        {
          id: 'r1',
          customerName: 'أحمد عبد الرحمن - بني مزار',
          rating: 5,
          comment: 'الفستق طازج جداً ومقرمش ومفيش ولا حباية مقفولة، التغليف باللحام الحراري ممتاز.',
          date: 'منذ يومين',
          verified: true,
        },
        {
          id: 'r2',
          customerName: 'نهى محمود - القيس',
          rating: 5,
          comment: 'أحسن محمصة في بني مزار، الطلب وصل في دورة الساعة 8 سخن ومقرمش.',
          date: 'منذ أسبوع',
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
      subCategoryName: 'كاجو ملكي W180',
      description:
        'كاجو جامبو مقاس W180 الملكي، محمص بعناية بالهواء الساخن بدون زيوت مهدرجة ليمنحك القرمشة الذهبية مع القوام الزبدي الغني.',
      image: '/images/products/cashew.jpg',
      badge: 'حجم جامبو ملكي',
      origin: 'فيتنامي / هندي ملكي W180',
      nutritionalHighlight: 'غني بالماغنسيوم والزنك والحديد لتعزيز المناعة والطاقة',
      caloriesPer100g: 553,
      proteinPer100g: '18.2 جم',
      pricePerKg: 740,
      costPerKg: 570,
      roastOptions: ['محمص مملح', 'محمص بدون ملح', 'مدخن بالتوابل', 'نيء طبيعي'],
      weights: [
        { id: 'w-125', label: 'ثمن 125 جم', weightGrams: 125, price: 95, originalPrice: 110 },
        { id: 'w-250', label: 'ربع 250 جم', weightGrams: 250, price: 195, originalPrice: 220 },
        { id: 'w-500', label: 'نصف 500 جم', weightGrams: 500, price: 380, originalPrice: 430 },
        { id: 'w-1000', label: 'كيلو 1000 جم', weightGrams: 1000, price: 740, originalPrice: 840 },
      ],
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 145,
    },
    {
      id: 'prod-hazelnut-1',
      slug: 'turkish-hazelnut-peeled',
      name: 'بندق تركي مقشر فاخر',
      subtitle: 'بندق غيرسون التركي الأصلي بحجم كبير وطعم غني',
      categoryId: 'cat-luxury-nuts',
      subCategoryName: 'بندق تركي مقشر',
      description:
        'بندق تركي مقشر من أجود مزارع البحر الأسود في تركيا، متاح محمص ذهبي مقرمش أو نيء طبيعي للحلويات والتناول الصحي اليومي.',
      image: '/images/products/hazelnut.jpg',
      badge: 'محمص اليوم',
      origin: 'تركي فاخر (غيرسون)',
      nutritionalHighlight: 'مصدر ممتاز لفيتامين E والدهون الصحية للقلب والذاكرة',
      caloriesPer100g: 628,
      proteinPer100g: '15 جم',
      pricePerKg: 700,
      costPerKg: 540,
      roastOptions: ['محمص بدون ملح', 'محمص مملح', 'نيء طبيعي'],
      weights: [
        { id: 'w-125', label: 'ثمن 125 جم', weightGrams: 125, price: 90, originalPrice: 105 },
        { id: 'w-250', label: 'ربع 250 جم', weightGrams: 250, price: 185, originalPrice: 210 },
        { id: 'w-500', label: 'نصف 500 جم', weightGrams: 500, price: 360, originalPrice: 400 },
        { id: 'w-1000', label: 'كيلو 1000 جم', weightGrams: 1000, price: 700, originalPrice: 780 },
      ],
      inStock: true,
      featured: true,
      rating: 4.8,
      reviewsCount: 94,
    },
    {
      id: 'prod-almond-1',
      slug: 'california-golden-almonds',
      name: 'لوز كاليفورنيا ذهبي جامبو',
      subtitle: 'حبات لوز منتقاة بعناية غنية بالألياف والبروتين',
      categoryId: 'cat-luxury-nuts',
      subCategoryName: 'لوز كاليفورنيا جامبو',
      description:
        'لوز أمريكي كاليفورنيا حبة كبيرة مقرمشة، مثالي كسناك صحي للرياضيين والدايت أو مع القهوة الصباحية من محمصة حفصة.',
      image: '/images/products/almond.jpg',
      badge: 'صحي للدايت',
      origin: 'كاليفورنيا - أمريكا',
      nutritionalHighlight: 'غني بالألياف وفيتامين E والكالسيوم والبروتين لبناء العضلات',
      caloriesPer100g: 579,
      proteinPer100g: '21.2 جم',
      pricePerKg: 600,
      costPerKg: 460,
      roastOptions: ['محمص بدون ملح', 'محمص مملح', 'مدخن بالتوابل', 'نيء طبيعي'],
      weights: [
        { id: 'w-125', label: 'ثمن 125 جم', weightGrams: 125, price: 75, originalPrice: 90 },
        { id: 'w-250', label: 'ربع 250 جم', weightGrams: 250, price: 160, originalPrice: 180 },
        { id: 'w-500', label: 'نصف 500 جم', weightGrams: 500, price: 310, originalPrice: 350 },
        { id: 'w-1000', label: 'كيلو 1000 جم', weightGrams: 1000, price: 600, originalPrice: 680 },
      ],
      inStock: true,
      featured: true,
      rating: 4.8,
      reviewsCount: 79,
    },
    {
      id: 'prod-walnut-1',
      slug: 'chilean-walnut-halves',
      name: 'عين جمل تشيلي أنصاف (فراشة)',
      subtitle: 'لون فاتح ذهبي وطعم كريمي بدون أي مرارة',
      categoryId: 'cat-luxury-nuts',
      subCategoryName: 'عين جمل تشيلي',
      description:
        'عين جمل تشيلي نخب أول (أنصاف كاملة فاتحة اللون)، يتميز بطعمه الحلو الكريمي وخلوه التام من المرارة. مثالي للتركيز وتقوية الذاكرة وللأطفال.',
      image: '/images/products/walnut.jpg',
      badge: 'غذاء الذكاء',
      origin: 'تشيلي نخب أول (Extra Light)',
      nutritionalHighlight: 'أعلى مصدر نباتي لأحماض أوميجا-3 الداعمة لصحة الدماغ',
      caloriesPer100g: 654,
      proteinPer100g: '15.2 جم',
      pricePerKg: 620,
      costPerKg: 475,
      roastOptions: ['نيء طبيعي', 'محمص بدون ملح'],
      weights: [
        { id: 'w-125', label: 'ثمن 125 جم', weightGrams: 125, price: 80, originalPrice: 95 },
        { id: 'w-250', label: 'ربع 250 جم', weightGrams: 250, price: 165, originalPrice: 185 },
        { id: 'w-500', label: 'نصف 500 جم', weightGrams: 500, price: 320, originalPrice: 360 },
        { id: 'w-1000', label: 'كيلو 1000 جم', weightGrams: 1000, price: 620, originalPrice: 700 },
      ],
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 112,
    },
    {
      id: 'prod-pecan-macadamia-1',
      slug: 'royal-pecan-and-macadamia',
      name: 'بيكان أمريكي وماكاديميا ملكية',
      subtitle: 'قمة الفخامة في عالم المكسرات بقوام زبدي مقرمش',
      categoryId: 'cat-luxury-nuts',
      subCategoryName: 'بيكان وماكاديميا',
      description:
        'تشكيلة النخبة من البيكان الأمريكي والماكاديميا الاسترالية المحمصة بعناية لعشاق المذاق الزبدي الفاخر.',
      image: '/images/products/walnut.jpg',
      badge: 'نخبة الـ VIP 👑',
      origin: 'أمريكي / أسترالي نخب أول',
      nutritionalHighlight: 'غني بالدهون الأحادية الصحية ومضادات الأكسدة الفائقة',
      caloriesPer100g: 690,
      proteinPer100g: '10 جم',
      pricePerKg: 960,
      costPerKg: 750,
      roastOptions: ['محمص بدون ملح', 'محمص مملح', 'نيء طبيعي'],
      weights: generateWeightsFromKiloPrice(960, 1080),
      inStock: true,
      featured: false,
      rating: 5.0,
      reviewsCount: 42,
    },
    {
      id: 'prod-hafsa-vip-mix-1',
      slug: 'hafsa-signature-vip-nuts-mix',
      name: 'ميكس حفصة المشكل الفاخر (بدون لب أو سوداني)',
      subtitle: 'خلطة متوازنة بالجرام: فستق + كاجو + بندق + لوز + عين جمل',
      categoryId: 'cat-luxury-nuts',
      subCategoryName: 'ميكس مكسرات حفصة VIP',
      description:
        'خلطة محمصة حفصة الشهيرة في بني مزار! 5 أصناف مكسرات مستوردة صافية بنسب متساوية تماماً وتحميص يومي طازج.',
      image: '/images/products/royal-mix.jpg',
      badge: 'خلطة حفصة الخاصة',
      origin: 'تشكيلة ملكية مستوردة 100%',
      nutritionalHighlight: 'طاقة متكاملة وأوميجا 3 وبروتين عالي',
      caloriesPer100g: 595,
      proteinPer100g: '19 جم',
      pricePerKg: 720,
      costPerKg: 550,
      roastOptions: ['محمص مملح', 'محمص بدون ملح', 'مدخن بالتوابل'],
      weights: generateWeightsFromKiloPrice(720, 820),
      inStock: true,
      featured: true,
      rating: 5.0,
      reviewsCount: 168,
    },

    // =========================================================================
    // 2. 🌻 محمصة اللب والتسالي الساخنة — الفئات 8 إلى 13
    // =========================================================================
    {
      id: 'prod-super-seeds-1',
      slug: 'hot-roasted-super-seeds',
      name: 'لب سوبر محمص طازج (حبة عريضة)',
      subtitle: 'لب سوبر نخب أول مملح خفيف ومقرمش من الفرن للشنطة',
      categoryId: 'cat-snacks',
      subCategoryName: 'لب سوبر فاخر',
      description:
        'لب سوبر حبة كبيرة مليانة، يتحمص يومياً في محمصة حفصة بملح خفيف متوازن ليضمن لك أحلى تسالي في السهرة بدون أي حبات فارغة.',
      image: '/images/products/savory-snacks.jpg',
      badge: 'ساخن من المحمصة 🔥',
      origin: 'مصري نخب أول (كفر الشيخ)',
      nutritionalHighlight: 'غني بالزنك والحديد والبروتين النباتي',
      caloriesPer100g: 535,
      proteinPer100g: '24 جم',
      pricePerKg: 280,
      costPerKg: 205,
      roastOptions: ['محمص مملح', 'محمص بدون ملح'],
      weights: generateWeightsFromKiloPrice(280, 320),
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 210,
    },
    {
      id: 'prod-pumpkin-seeds-1',
      slug: 'jumbo-white-pumpkin-seeds-a1',
      name: 'لب أبيض قرع جامبو (نخب A1)',
      subtitle: 'لب أبيض عريض مقرمش وسهل التقشير • تحميص الهوا الساخن',
      categoryId: 'cat-snacks',
      subCategoryName: 'لب قرع وأبيض A1',
      description:
        'لب أبيض وقرع جامبو فرز أول A1، محمص على الهادي ليحافظ على لونه الأبيض وقرمشته المميزة.',
      image: '/images/products/savory-snacks.jpg',
      badge: 'فرز أول A1',
      origin: 'جامبو نخب أول',
      nutritionalHighlight: 'أغنى مصدر طبيعي للماغنسيوم والزنك المفيد للمناعة',
      caloriesPer100g: 559,
      proteinPer100g: '30 جم',
      pricePerKg: 340,
      costPerKg: 250,
      roastOptions: ['محمص مملح', 'محمص بدون ملح', 'نيء طبيعي'],
      weights: generateWeightsFromKiloPrice(340, 380),
      inStock: true,
      featured: true,
      rating: 4.8,
      reviewsCount: 132,
    },
    {
      id: 'prod-watermelon-wood-seeds-1',
      slug: 'roasted-wood-and-watermelon-seeds',
      name: 'لب خشب ولب بطيخ محمص مقرمش',
      subtitle: 'أصل التسالي المصرية الأصيلة بتحميصة حفصة الذهبية',
      categoryId: 'cat-snacks',
      subCategoryName: 'لب خشب ولب بطيخ',
      description:
        'توليفة لب الخشب ولب البطيخ المحمص يومياً بنكهة زمان الأصلية وقرمشة تدوم بفضل التغليف الحراري.',
      image: '/images/products/savory-snacks.jpg',
      badge: 'طعم زمان الأصلي',
      origin: 'محمصة حفصة - بني مزار',
      nutritionalHighlight: 'خفيف ومغذي وغني بالمعادن الطبيعية',
      caloriesPer100g: 510,
      proteinPer100g: '21 جم',
      pricePerKg: 220,
      costPerKg: 155,
      roastOptions: ['محمص مملح', 'محمص بدون ملح'],
      weights: generateWeightsFromKiloPrice(220, 260),
      inStock: true,
      featured: false,
      rating: 4.8,
      reviewsCount: 84,
    },
    {
      id: 'prod-palestinian-peanuts-1',
      slug: 'palestinian-and-halwani-peanuts',
      name: 'فول فلسطيني جامبو وفول سوداني حلواني',
      subtitle: 'سوداني حلواني وفول فلسطيني مقرمش ومكرمل بالسمسم',
      categoryId: 'cat-snacks',
      subCategoryName: 'فول سوداني وفلسطيني',
      description:
        'أفخر حبات الفول الفلسطيني الجامبو والفول السوداني الحلواني المحمص طازجاً بدون نقطة زيت.',
      image: '/images/products/savory-snacks.jpg',
      badge: 'قرمشة مضمونة',
      origin: 'تحميص يومي طازج',
      nutritionalHighlight: 'بروتين عالي وطاقة فورية للسهرة والرحلات',
      caloriesPer100g: 567,
      proteinPer100g: '25.8 جم',
      pricePerKg: 180,
      costPerKg: 125,
      roastOptions: ['محمص مملح', 'محمص بدون ملح', 'مدخن بالتوابل'],
      weights: generateWeightsFromKiloPrice(180, 210),
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 156,
    },
    {
      id: 'prod-crik-crak-1',
      slug: 'crik-crak-and-crunchy-mix',
      name: 'كريك كراك ومقرمشات حفصة الساخنة',
      subtitle: 'كريك كراك + سوداني مغطى بالجبنة المتبلة والباربكيو والشطة والليمون',
      categoryId: 'cat-snacks',
      subCategoryName: 'كريك كراك ومقرمشات',
      description:
        'معشوق الشباب والأطفال في بني مزار! كريك كراك طازج ومقرمشات مخبوزة بنكهات الجبنة والباربكيو والبيتزا.',
      image: '/images/products/savory-snacks.jpg',
      badge: 'معشوق السهرة 😋',
      origin: 'محمصة حفصة - تعبئة يومية',
      nutritionalHighlight: 'مخبوز ومقرمش بنكهات طبيعية شهية',
      caloriesPer100g: 470,
      proteinPer100g: '15 جم',
      pricePerKg: 200,
      costPerKg: 135,
      roastOptions: ['مدخن بالتوابل', 'محمص مملح'],
      weights: generateWeightsFromKiloPrice(200, 240),
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 190,
    },
    {
      id: 'prod-spanish-corn-1',
      slug: 'crunchy-spanish-corn',
      name: 'ذرة إسباني مقرمشة (جبنة وباربكيو)',
      subtitle: 'ذرة إسباني هشة ومقرمشة جداً بدون صلابة',
      categoryId: 'cat-snacks',
      subCategoryName: 'ذرة إسباني مقرمشة',
      description:
        'ذرة إسباني مستوردة هشة ومقرمشة بتتبيلة الجبنة المتبلة والمدخن، تكمل أي بوكس سهرة.',
      image: '/images/products/savory-snacks.jpg',
      badge: 'هشة ومقرمشة',
      origin: 'إسباني مستورد',
      nutritionalHighlight: 'ألياف طبيعية وقرمشة خفيفة',
      caloriesPer100g: 440,
      proteinPer100g: '9 جم',
      pricePerKg: 220,
      costPerKg: 150,
      roastOptions: ['مدخن بالتوابل', 'محمص مملح'],
      weights: generateWeightsFromKiloPrice(220, 260),
      inStock: true,
      featured: false,
      rating: 4.8,
      reviewsCount: 95,
    },
    {
      id: 'prod-savory-mix-1',
      slug: 'crunchy-cheese-smoked-snacks-mix',
      name: 'ميكس تسالي ومقرمشات السهرة الفاخر',
      subtitle: 'فول سوداني حلواني + ذرة أسباني مقرمشة + مقرمشات بالجبنة والباربكيو',
      categoryId: 'cat-snacks',
      subCategoryName: 'ميكس تسالي السهرة',
      description:
        'تشكيلة السهرة واللمات العائلية! تجمع بين السوداني الحلواني المحمص، الذرة الأسباني المقرمشة، الحمص، والمقرمشات المخبوزة بنكهات الجبنة والمدخن.',
      image: '/images/products/savory-snacks.jpg',
      badge: 'سناك العائلة',
      origin: 'تحميص يومي طازج',
      nutritionalHighlight: 'قرمشة طازجة محمصة بالهواء الساخن بأقل نسبة دهون',
      caloriesPer100g: 460,
      proteinPer100g: '14 جم',
      pricePerKg: 205,
      costPerKg: 140,
      roastOptions: ['محمص مملح', 'مدخن بالتوابل'],
      weights: [
        { id: 'w-125', label: 'ثمن 125 جم', weightGrams: 125, price: 28, originalPrice: 35 },
        { id: 'w-250', label: 'ربع 250 جم', weightGrams: 250, price: 55, originalPrice: 65 },
        { id: 'w-500', label: 'نصف 500 جم', weightGrams: 500, price: 110, originalPrice: 130 },
        { id: 'w-1000', label: 'كيلو 1000 جم', weightGrams: 1000, price: 205, originalPrice: 245 },
      ],
      inStock: true,
      featured: false,
      rating: 4.8,
      reviewsCount: 91,
    },

    // =========================================================================
    // 3. ☕ ركن البن والإسبريسو (الـ 4 صوامع النحاسية) — الفئات 14 إلى 17
    // =========================================================================
    {
      id: 'prod-hafsa-turkish-coffee-1',
      slug: 'hafsa-signature-spiced-turkish-coffee',
      name: 'بن حفصة التركي بالتحويجة السرية (وش كثيف)',
      subtitle: '70% أرابيكا + 30% روبوستا مطحون طازج بالحبهان الأخضر والمستكة اليوناني',
      categoryId: 'cat-coffee-espresso',
      subCategoryName: 'بن تركي محوج مخصوص',
      description:
        'توليفة صوامع حفصة النحاسية الأشهر في بني مزار! يجمع بين نعومة ورائحة الأرابيكا البرازيلي والكولومبي وقوة وش الروبوستا الهندي مع الحبهان الأخضر الجامبو والمستكة الأصلية.',
      image: '/images/products/hazelnut.jpg',
      badge: 'صوامع حفصة النحاسية ☕',
      origin: 'توليفة حفصة (برازيلي + كولومبي + هندي)',
      nutritionalHighlight: 'غني بمضادات الأكسدة الطبيعية والزيوت العطرية المنشطة للتركيز',
      caloriesPer100g: 12,
      proteinPer100g: '1.2 جم',
      pricePerKg: 560,
      costPerKg: 410,
      roastOptions: ['تحميص وسط محوج', 'تحميص غامق محوج', 'تحميص فاتح أشقر'],
      weights: generateWeightsFromKiloPrice(560, 640),
      inStock: true,
      featured: true,
      rating: 5.0,
      reviewsCount: 312,
    },
    {
      id: 'prod-brazilian-plain-coffee-1',
      slug: 'pure-brazilian-colombian-turkish-coffee',
      name: 'بن تركي سادة صافي (برازيلي سانتوس وكولومبي)',
      subtitle: 'طعم البن الأصلي النقي بدرجات تحميص (فاتح / وسط / غامق)',
      categoryId: 'cat-coffee-espresso',
      subCategoryName: 'بن تركي سادة صافي',
      description:
        'لعشاق فنجان القهوة السادة المضبوط! حبوب بن منتقاة تُحمص وتُطحن بالطلب قبل خروج الأوردر مباشرة.',
      image: '/images/products/hazelnut.jpg',
      badge: 'طحن طازج بالطلب',
      origin: 'برازيلي سانتوس / كولومبي سوبريمو',
      nutritionalHighlight: 'نقي 100% ويعزز النشاط الذهني والبدني',
      caloriesPer100g: 10,
      proteinPer100g: '1 جم',
      pricePerKg: 500,
      costPerKg: 365,
      roastOptions: ['تحميص وسط سادة', 'تحميص فاتح أشقر', 'تحميص غامق محوج'],
      weights: generateWeightsFromKiloPrice(500, 560),
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 174,
    },
    {
      id: 'prod-italian-espresso-1',
      slug: 'italian-espresso-and-french-hazelnut-coffee',
      name: 'بن إسبريسو إيطالي وقهوة فرنساوي بالبندق',
      subtitle: 'كريمة ذهبية كثيفة لماكينات الإسبريسو أو قهوة فرنساوي غنية بالبندق',
      categoryId: 'cat-coffee-espresso',
      subCategoryName: 'بن إسبريسو وفرنساوي',
      description:
        'متوفر بطحنة إسبريسو احترافية أو حبوب كاملة (Whole Beans) أو قهوة فرنساوي بالبندق الطبيعي واللبن.',
      image: '/images/products/hazelnut.jpg',
      badge: 'ركن الإسبريسو ⚡',
      origin: 'خلطة إيطالية فاخرة',
      nutritionalHighlight: 'قوام كريمي غني ومذاق كافيهات احترافي في بيتك',
      caloriesPer100g: 45,
      proteinPer100g: '3 جم',
      pricePerKg: 580,
      costPerKg: 425,
      roastOptions: ['تحميص وسط سادة', 'تشكيلة فاخرة'],
      weights: generateWeightsFromKiloPrice(580, 650),
      inStock: true,
      featured: false,
      rating: 4.9,
      reviewsCount: 118,
    },
    {
      id: 'prod-takeaway-drinks-1',
      slug: 'hafsa-espresso-bar-takeaway-drinks',
      name: 'مشاريب بار القهوة الساخنة والباردة (توصيل فوري للبندر)',
      subtitle: 'دبل إسبريسو • قهوة تركي على الرمل • آيس سبانيش لاتيه • فرابيه بندق',
      categoryId: 'cat-coffee-espresso',
      subCategoryName: 'مشاريب القهوة الساخنة والباردة',
      description:
        'اطلب مشروبك المفضل من بار قهوة حفصة أمام مسجد الزراعيين ليصلك ساخناً أو مثلجاً في أكواب حافظة للحرارة خلال دقائق في بندر بني مزار!',
      image: '/images/products/hazelnut.jpg',
      badge: 'توصيل البندر 30 د 🛵',
      origin: 'بار إسبريسو محمصة حفصة',
      nutritionalHighlight: 'يحضر طازجاً من صوامع حفصة فور تأكيد الطلب',
      caloriesPer100g: 85,
      proteinPer100g: '4 جم',
      pricePerKg: 360,
      costPerKg: 180,
      roastOptions: ['تحميص وسط محوج', 'تحميص وسط سادة', 'تشكيلة فاخرة'],
      weights: [
        { id: 'w-125', label: 'كوب سينجل / تركي (45 ج)', weightGrams: 125, price: 45, originalPrice: 55 },
        { id: 'w-250', label: 'كوب دبل إسبريسو / لاتيه (75 ج)', weightGrams: 250, price: 75, originalPrice: 90 },
        { id: 'w-500', label: 'باكيت مشروبات صحاب (2 كوب - 140 ج)', weightGrams: 500, price: 140, originalPrice: 170 },
        { id: 'w-1000', label: 'بوكس مشروبات الشلة (4 أكواب - 260 ج)', weightGrams: 1000, price: 260, originalPrice: 320 },
      ],
      inStock: true,
      featured: true,
      rating: 5.0,
      reviewsCount: 205,
    },

    // =========================================================================
    // 4. 🍫 استاند الشوكولاتات والكاندي وكوبايات القبة — الفئات 18 إلى 20
    // =========================================================================
    {
      id: 'prod-gummy-candy-1',
      slug: 'happiness-stand-dome-cups-candy',
      name: 'كوبايات القبة الجاهزة (Dome Cups) وكاندي السعادة المشكل',
      subtitle: 'كوبايات القبة الشفافة المليئة بالكاندي المستورد ومارشميلو وشوكولاتة',
      categoryId: 'cat-choco-candy',
      subCategoryName: 'كوبايات القبة والكاندي (Dome Cups)',
      description:
        'استاند السعادة في محمصة حفصة! كوبايات القبة الشفافة (Dome Lid Cups) الجاهزة بـ 35 ج و 50 ج أو بالوزن، يعشقها الأطفال والشباب وتكمل أي أوردر سهرة.',
      image: '/images/products/energy-mix.jpg',
      badge: 'استاند السعادة 🍬',
      origin: 'مستورد فاخر',
      nutritionalHighlight: 'ألوان ونكهات فواكه طبيعية مبهجة للسهرة',
      caloriesPer100g: 340,
      proteinPer100g: '4 جم',
      pricePerKg: 280,
      costPerKg: 180,
      roastOptions: ['تشكيلة فاخرة'],
      weights: [
        { id: 'w-125', label: 'كوباية قبة وسط (125 جم)', weightGrams: 125, price: 35, originalPrice: 45 },
        { id: 'w-250', label: 'كوباية قبة جامبو (250 جم)', weightGrams: 250, price: 50, originalPrice: 65 },
        { id: 'w-500', label: 'نصف 500 جم كاندي مشكل', weightGrams: 500, price: 140, originalPrice: 165 },
        { id: 'w-1000', label: 'كيلو 1000 جم كاندي العيلة', weightGrams: 1000, price: 280, originalPrice: 330 },
      ],
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 240,
    },
    {
      id: 'prod-imported-choco-1',
      slug: 'imported-chocolates-selection',
      name: 'تشكيلة الشوكولاتات المستوردة الفاخرة',
      subtitle: 'ميني سنيكرز، تويكس، باونتي، جالاكسي، وشوكولاتة بلجيكي وسويسري',
      categoryId: 'cat-choco-candy',
      subCategoryName: 'شوكولاتات مستوردة',
      description:
        'تشكيلة مختارة من أشهر الشوكولاتات المستوردة الأصلية المحفوظة في تكييف المحل بدرجة برودة مثالية.',
      image: '/images/products/stuffed-dates.jpg',
      badge: 'مستورد أصلي 🍫',
      origin: 'مستورد (أوروبي / خليجي)',
      nutritionalHighlight: 'كاكاو غني يمنح السعادة والطاقة الفورية',
      caloriesPer100g: 520,
      proteinPer100g: '7 جم',
      pricePerKg: 480,
      costPerKg: 340,
      roastOptions: ['تشكيلة فاخرة'],
      weights: generateWeightsFromKiloPrice(480, 540),
      inStock: true,
      featured: true,
      rating: 4.9,
      reviewsCount: 162,
    },
    {
      id: 'prod-dragee-choco-1',
      slug: 'golden-almond-hazelnut-dragee',
      name: 'درابيه شوكولاتة باللوز والبندق المكرمل',
      subtitle: 'حبات بندق ولوز محمصة مغطاة بطبقة شوكولاتة بلجيكية غنية',
      categoryId: 'cat-choco-candy',
      subCategoryName: 'درابيه بالمكسرات',
      description:
        'حبات كاملة من البندق التركي واللوز الذهبي مغلفة بالشوكولاتة الفاخرة والكرانشي الذهبي للضيافة الراقية.',
      image: '/images/products/stuffed-dates.jpg',
      badge: 'ضيافة ملكية',
      origin: 'صناعة فاخرة',
      nutritionalHighlight: 'يجمع بين فوائد المكسرات ومذاق الشوكولاتة الغنية',
      caloriesPer100g: 545,
      proteinPer100g: '11 جم',
      pricePerKg: 420,
      costPerKg: 295,
      roastOptions: ['تشكيلة فاخرة'],
      weights: generateWeightsFromKiloPrice(420, 480),
      inStock: true,
      featured: false,
      rating: 4.8,
      reviewsCount: 89,
    },

    // =========================================================================
    // 5. 🍯 خلية النحل والعطارة الفاخرة — الفئات 21 إلى 23
    // =========================================================================
    {
      id: 'prod-honey-nuts-jar-1',
      slug: 'royal-honey-with-vip-nuts-jar',
      name: 'برطمان عسل نحل طبيعي غارق بالمكسرات الملكية (خلية حفصة)',
      subtitle: 'عسل سدر وموالح وبرسيم طبيعي 100% مع فستق وكاجو ولوز وعين جمل وبندق',
      categoryId: 'cat-honey-spices',
      subCategoryName: 'برطمانات العسل بالمكسرات',
      description:
        'من قلب ديكور خلية النحل الخشبية في محمصة حفصة! عسل نحل طبيعي مفحوص ومضمون 100% مضاف إليه طبقة كثيفة من المكسرات المحمصة الطازجة للطاقة والمناعة.',
      image: '/images/products/apricots-prunes.jpg',
      badge: 'خلية العسل الملكي 🍯',
      origin: 'مناحل طبيعية + مكسرات مستوردة',
      nutritionalHighlight: 'مقوي طبيعي شامل للمناعة والطاقة والتركيز للأطفال والكبار',
      caloriesPer100g: 380,
      proteinPer100g: '9 جم',
      pricePerKg: 440,
      costPerKg: 310,
      roastOptions: ['طازج طبيعي 100%', 'تشكيلة فاخرة'],
      weights: [
        { id: 'w-125', label: 'برطمان طاقة ميني (125 جم)', weightGrams: 125, price: 65, originalPrice: 80 },
        { id: 'w-250', label: 'برطمان ربع كيلو (250 جم)', weightGrams: 250, price: 115, originalPrice: 135 },
        { id: 'w-500', label: 'برطمان نصف كيلو (500 جم)', weightGrams: 500, price: 220, originalPrice: 255 },
        { id: 'w-1000', label: 'برطمان كيلو عائلي (1000 جم)', weightGrams: 1000, price: 440, originalPrice: 500 },
      ],
      inStock: true,
      featured: true,
      rating: 5.0,
      reviewsCount: 147,
    },
    {
      id: 'prod-royal-spices-1',
      slug: 'pure-roastery-spices-and-cardamom',
      name: 'توابل استاند العطار النقية (حبهان وبن وتوابل محمصة)',
      subtitle: 'حبهان أخضر جامبو، فلفل أسود، كمون بلدي، قرفة سيجار، وسبع بهارات مطحونة بالطلب',
      categoryId: 'cat-honey-spices',
      subCategoryName: 'توابل استاند العطار النقية',
      description:
        'توابل حصى ومطحونة طازجة في محمصة حفصة بدون أي إضافات أو شوائب، برائحة نفاذة تعيد لأكل البيت طعمه الأصلي.',
      image: '/images/products/apricots-prunes.jpg',
      badge: 'نقي 100% بالجرام',
      origin: 'هندي / بلدي نخب أول',
      nutritionalHighlight: 'زيوت طيارة طبيعية 100% محفوظة في عبوات محكمة',
      caloriesPer100g: 310,
      proteinPer100g: '11 جم',
      pricePerKg: 480,
      costPerKg: 340,
      roastOptions: ['طازج طبيعي 100%'],
      weights: generateWeightsFromKiloPrice(480, 540),
      inStock: true,
      featured: false,
      rating: 4.9,
      reviewsCount: 78,
    },
    {
      id: 'prod-dates-stuffed-1',
      slug: 'royal-medjool-dates-stuffed-nuts',
      name: 'تمر مجدول ملكي محشو بالمكسرات الفاخرة',
      subtitle: 'حبات تمر مجدول جامبو محشوة باللوز والفستق والكاجو وعين الجمل',
      categoryId: 'cat-honey-spices',
      subCategoryName: 'تمور ملكية محشوة',
      description:
        'تمر مجدول ملكي طري وفاخر، منزوع النوى ومحشو يدوياً بحبات كاملة من الفستق واللوز المحمص وعين الجمل والكاجو. مثالي مع القهوة العربية وكهدية راقية.',
      image: '/images/products/stuffed-dates.jpg',
      badge: 'ضيافة فاخرة',
      origin: 'تمر مجدول ملكي + مكسرات مستوردة',
      nutritionalHighlight: 'غني بالحديد والبوتاسيوم والسكريات الطبيعية الصحية',
      caloriesPer100g: 390,
      proteinPer100g: '8.5 جم',
      pricePerKg: 460,
      costPerKg: 330,
      roastOptions: ['تشكيلة فاخرة'],
      weights: [
        { id: 'w-125', label: 'ثمن 125 جم', weightGrams: 125, price: 60, originalPrice: 70 },
        { id: 'w-250', label: 'ربع 250 جم', weightGrams: 250, price: 120, originalPrice: 140 },
        { id: 'w-500', label: 'نصف 500 جم', weightGrams: 500, price: 245, originalPrice: 280 },
        { id: 'w-1000', label: 'كيلو 1000 جم', weightGrams: 1000, price: 460, originalPrice: 530 },
      ],
      inStock: true,
      featured: false,
      rating: 4.9,
      reviewsCount: 88,
    },
    {
      id: 'prod-apricot-prunes-1',
      slug: 'turkish-dried-apricots-and-prunes',
      name: 'مشمشية تركي جامبو وقراصيا فاخرة',
      subtitle: 'فواكه مجففة طبيعية طرية وغنية بالفيتامينات',
      categoryId: 'cat-honey-spices',
      subCategoryName: 'فواكه مجففة مستوردة',
      description:
        'مشمشية تركي مقاس جامبو رقم 1 مع قراصيا مستوردة منزوعة النوى، طرية جداً وبطعم طبيعي غني ومثالية للتناول المباشر أو الحلويات.',
      image: '/images/products/apricots-prunes.jpg',
      origin: 'تركي مستورد نخب أول',
      nutritionalHighlight: 'غنية بالحديد والألياف وفيتامين A',
      caloriesPer100g: 241,
      proteinPer100g: '3.4 جم',
      pricePerKg: 420,
      costPerKg: 300,
      roastOptions: ['نيء طبيعي'],
      weights: [
        { id: 'w-125', label: 'ثمن 125 جم', weightGrams: 125, price: 55, originalPrice: 68 },
        { id: 'w-250', label: 'ربع 250 جم', weightGrams: 250, price: 115, originalPrice: 135 },
        { id: 'w-500', label: 'نصف 500 جم', weightGrams: 500, price: 220, originalPrice: 260 },
        { id: 'w-1000', label: 'كيلو 1000 جم', weightGrams: 1000, price: 420, originalPrice: 490 },
      ],
      inStock: true,
      featured: false,
      rating: 4.7,
      reviewsCount: 47,
    },

    // =========================================================================
    // 6. 🎁 البوكسات وعروض السهرة المقسمة — البطل البيعي لبني مزار
    // =========================================================================
    {
      id: 'prod-box-roqan-125',
      slug: 'roqan-4-slots-evening-box-125',
      name: 'بوكس روقان المقسم (4 خانات — 125 ج.م)',
      subtitle: 'مقرمشات وكريك + فول فلسطيني ومكرمل + كاندي وشوكولاتة + ميكس مكسرات VIP',
      categoryId: 'cat-mixed-boxes',
      subCategoryName: 'بوكس روقان 125 ج',
      description:
        'البطل البيعي رقم 1 في بني مزار! بوكس مقسم إلى 4 خانات غنية ومتنوعة (مقرمشات وكريك + فول فلسطيني ومكرمل + كاندي وشوكولاتة + ميكس مكسرات VIP) بسعر 125 ج.م فقط.',
      image: '/images/products/royal-mix.jpg',
      badge: 'البطل البيعي 125 ج 🔥',
      origin: 'استوديو بوكسات محمصة حفصة',
      nutritionalHighlight: '4 خانات تجمع الحلو والحادق والمكسرات في بوكس واحد محكم الغلق',
      caloriesPer100g: 495,
      proteinPer100g: '16 جم',
      pricePerKg: 500,
      costPerKg: 350,
      roastOptions: ['تشكيلة فاخرة', 'محمص مملح'],
      weights: [
        { id: 'w-125', label: 'بوكس روقان (4 خانات - 125 ج)', weightGrams: 125, price: 125, originalPrice: 150 },
        { id: 'w-250', label: 'بوكس العيلة (6 خانات - 250 ج)', weightGrams: 250, price: 250, originalPrice: 295 },
        { id: 'w-500', label: 'بوكس VIP الملكي (6 خانات - 450 ج)', weightGrams: 500, price: 450, originalPrice: 520 },
        { id: 'w-1000', label: 'بوكسان عائليان للتوفير (12 خانة)', weightGrams: 1000, price: 480, originalPrice: 590 },
      ],
      inStock: true,
      featured: true,
      rating: 5.0,
      reviewsCount: 380,
    },
    {
      id: 'prod-box-family-250',
      slug: 'family-6-slots-gathering-box-250',
      name: 'بوكس العيلة واللمة المقسم (6 خانات — 250 ج.م)',
      subtitle: 'يكفي 4 إلى 6 أفراد لسهرة كاملة: لب سوبر + كاجو ولوز + كريك + فول فلسطيني + شوكولاتة + كاندي',
      categoryId: 'cat-mixed-boxes',
      subCategoryName: 'بوكس العيلة واللمة 250 ج',
      description:
        'مصمم خصيصاً لسهرات العيلة والصحاب في بني مزار! 6 خانات كبيرة متنوعة ترضي كل الأذواق وتوفر عليك شراء كل صنف لوحده.',
      image: '/images/products/royal-mix.jpg',
      badge: 'بوكس العيلة 250 ج 👨‍👩‍👧‍👦',
      origin: 'استوديو بوكسات محمصة حفصة',
      nutritionalHighlight: 'تشكيلة عائلية متكاملة مغلفة حرارياً لحفظ القرمشة',
      caloriesPer100g: 515,
      proteinPer100g: '17 جم',
      pricePerKg: 500,
      costPerKg: 350,
      roastOptions: ['تشكيلة فاخرة', 'محمص مملح'],
      weights: [
        { id: 'w-125', label: 'حجم ميني روقان (125 ج)', weightGrams: 125, price: 125, originalPrice: 150 },
        { id: 'w-250', label: 'بوكس العيلة الرسمي (6 خانات - 250 ج)', weightGrams: 250, price: 250, originalPrice: 295 },
        { id: 'w-500', label: 'بوكس العيلة مضاعف (500 ج)', weightGrams: 500, price: 475, originalPrice: 560 },
        { id: 'w-1000', label: 'بوكس اللمة الجامبو (1000 جم)', weightGrams: 1000, price: 890, originalPrice: 1050 },
      ],
      inStock: true,
      featured: true,
      rating: 5.0,
      reviewsCount: 295,
    },
    {
      id: 'prod-royal-mix-1',
      slug: 'royal-vip-mixed-nuts-box',
      name: 'بوكس الزيارات والهدايا الملكي VIP (6 خانات فاخرة — 450 ج.م)',
      subtitle: 'فستق + كاجو جامبو + بندق تركي + لوز كاليفورنيا + عين جمل + شوكولاتة فاخرة',
      categoryId: 'cat-mixed-boxes',
      subCategoryName: 'بوكس هدايا VIP 450 ج',
      description:
        'التشكيلة الملكية التي تشرفك في الزيارات والمناسبات والهدايا! 6 خانات من المكسرات المستوردة الصافية والشوكولاتة الفاخرة بتغليف ذهبي يحمل شعار محمصة حفصة.',
      image: '/images/products/royal-mix.jpg',
      badge: 'بوكس هدايا VIP بـ 450 ج 👑',
      origin: 'تشكيلة ملكية مستوردة 100%',
      nutritionalHighlight: 'مزيج متكامل من الفيتامينات والمعادن والأوميجا 3 والطاقة',
      caloriesPer100g: 590,
      proteinPer100g: '19 جم',
      pricePerKg: 720,
      costPerKg: 540,
      roastOptions: ['محمص مملح', 'محمص بدون ملح', 'نيء طبيعي', 'مدخن بالتوابل'],
      weights: [
        { id: 'w-125', label: 'بوكس هدايا ميني (225 جم)', weightGrams: 125, price: 185, originalPrice: 220 },
        { id: 'w-250', label: 'بوكس الزيارات الملكي VIP (6 خانات - 450 ج)', weightGrams: 250, price: 450, originalPrice: 520 },
        { id: 'w-500', label: 'بوكس 500 جم (نصف كيلو مكسرات VIP)', weightGrams: 500, price: 375, originalPrice: 430 },
        { id: 'w-1000', label: 'بوكس 1 كجم العائلي الملكي', weightGrams: 1000, price: 720, originalPrice: 840 },
      ],
      inStock: true,
      featured: true,
      rating: 5.0,
      reviewsCount: 214,
      reviews: [
        {
          id: 'r5',
          customerName: 'مهندس طارق الشناوي - بني مزار',
          rating: 5,
          comment: 'البوكس الملكي يشرف جداً في الضيافة والهدايا، الخانات مليانة وكل صنف أحلى من التاني.',
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
      subCategoryName: 'بوكس الطاقة والدايت',
      description:
        'مصمم خصيصاً لمحبي الأكل الصحي والرياضيين والطلاب، يجمع بين المكسرات النيئة غير المملحة والفواكه المجففة الطبيعية لمنحك طاقة مستدامة وتركيز عالي طوال اليوم.',
      image: '/images/products/energy-mix.jpg',
      badge: 'طبيعي 100%',
      origin: 'تشكيلة صحية بدون ملح أو سكر مضاف',
      nutritionalHighlight: 'طاقة فورية وألياف طبيعية بدون أي أملاح أو مواد حافظة',
      caloriesPer100g: 510,
      proteinPer100g: '16.5 جم',
      pricePerKg: 630,
      costPerKg: 470,
      roastOptions: ['نيء طبيعي', 'محمص بدون ملح'],
      weights: [
        { id: 'w-125', label: 'ثمن 125 جم', weightGrams: 125, price: 85, originalPrice: 100 },
        { id: 'w-250', label: 'ربع 250 جم', weightGrams: 250, price: 165, originalPrice: 190 },
        { id: 'w-500', label: 'نصف 500 جم', weightGrams: 500, price: 330, originalPrice: 375 },
        { id: 'w-1000', label: 'كيلو 1000 جم', weightGrams: 1000, price: 630, originalPrice: 720 },
      ],
      inStock: true,
      featured: false,
      rating: 4.9,
      reviewsCount: 63,
    },
  ],
  shippingRates: [
    {
      id: 'ship-bandar',
      governorate: 'بندر بني مزار (توصيل فوري 30 - 45 دقيقة)',
      price: 20,
      estimatedDays: 'خلال 30 - 45 دقيقة',
      zoneType: 'bandar',
      minOrderAmount: 0,
    },
    {
      id: 'ship-villages',
      governorate: 'قرى مركز بني مزار (القيس، صندفا، بني علي، شلقام، أبشاق، طمبو، الجندية...)',
      price: 25,
      estimatedDays: 'دورة 2:00 ظهراً أو دورة 8:00 مساءً',
      zoneType: 'village',
      minOrderAmount: 200,
    },
    {
      id: 'ship-pickup',
      governorate: 'استلام سريع من المحل (بني مزار - أمام مسجد الزراعيين)',
      price: 0,
      estimatedDays: 'جاهز فوراً بدون انتظار',
      zoneType: 'pickup',
      minOrderAmount: 0,
    },
    {
      id: 'ship-minya',
      governorate: 'مراكز محافظة المنيا الأخرى (مطاي، مغاغة، سمالوط، المنيا)',
      price: 45,
      estimatedDays: 'نفس اليوم أو خلال 24 ساعة',
      zoneType: 'governorate',
      minOrderAmount: 250,
    },
    {
      id: 'ship-1',
      governorate: 'القاهرة والجيزة',
      price: 50,
      estimatedDays: 'خلال 24 ساعة',
      zoneType: 'governorate',
    },
    {
      id: 'ship-2',
      governorate: 'الإسكندرية',
      price: 60,
      estimatedDays: '1 - 2 يوم عمل',
      zoneType: 'governorate',
    },
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
    {
      id: 'coup-3',
      code: 'HAFSA25',
      discountType: 'fixed',
      value: 25,
      minOrderAmount: 200,
      active: true,
      description: 'هدية افتتاح محمصة حفصة ببني مزار: خصم 25 ج.م للطلبات فوق 200 ج.م',
    },
  ],
  vipMembers: [
    {
      id: 'vip-1001',
      membershipCode: 'HAFSA-VIP-1001',
      name: 'محمد عادل الشافعي',
      customerName: 'محمد عادل الشافعي',
      phone: '01012345678',
      walletBalance: 85,
      pointsBalance: 85,
      totalSpent: 1700,
      ordersCount: 5,
      tier: 'Royal Platinum',
      joinedAt: '2026-10-01T12:00:00.000Z',
      transactions: [
        {
          id: 'tx-1',
          date: '2026-10-14',
          type: 'earn',
          amount: 50,
          orderNumber: 'NUT-1001',
          description: 'كاش باك 5% عن طلب أونلاين رقم NUT-1001',
        },
        {
          id: 'tx-2',
          date: '2026-10-15',
          type: 'cashier_credit',
          amount: 35,
          orderNumber: 'POS-402',
          description: 'إضافة كاش باك 5% من كاشير المحل (أمام مسجد الزراعيين)',
        },
      ],
    },
    {
      id: 'vip-1002',
      membershipCode: 'HAFSA-VIP-1002',
      name: 'سارة حسام الدين',
      customerName: 'سارة حسام الدين',
      phone: '01123456789',
      walletBalance: 45,
      pointsBalance: 45,
      totalSpent: 900,
      ordersCount: 3,
      tier: 'Gold VIP',
      joinedAt: '2026-10-05T15:30:00.000Z',
      transactions: [
        {
          id: 'tx-3',
          date: '2026-10-15',
          type: 'earn',
          amount: 45,
          orderNumber: 'NUT-1002',
          description: 'كاش باك 5% عن فاتورة مشتريات فوق 150 ج.م',
        },
      ],
    },
    {
      id: 'vip-1003',
      membershipCode: 'HAFSA-VIP-1003',
      name: 'م. وسام نصر',
      customerName: 'م. وسام نصر',
      phone: '01234567890',
      walletBalance: 150,
      pointsBalance: 150,
      totalSpent: 3000,
      ordersCount: 8,
      tier: 'Royal Platinum',
      joinedAt: '2026-10-01T10:00:00.000Z',
      transactions: [
        {
          id: 'tx-4',
          date: '2026-10-16',
          type: 'earn',
          amount: 150,
          orderNumber: 'POS-100',
          description: 'رصيد ترحيبي وكاش باك 5% لعضوية حفصة الملكية VIP',
        },
      ],
    },
  ],
  promotions: [
    {
      id: 'promo-thursday-bundle',
      title: 'باقة لمة الخميس الكبرى',
      subtitle: 'بوكس العيلة (6 خانات) + ربع بن تركي محوج بالحبهان + 2 كوباية قبة كاندي (Dome Cups)',
      badge: 'عرض الشريك الرابع الخاطف 🔥',
      items: [
        {
          productId: 'prod-box-family-250',
          productName: 'بوكس العيلة واللمة (6 خانات)',
          weightGrams: 250,
          weightLabel: 'بوكس 6 خانات',
          quantity: 1,
          unitCost: 145,
          unitRetailPrice: 250,
        },
        {
          productId: 'prod-hafsa-turkish-coffee-1',
          productName: 'بن حفصة التركي بالتحويجة السرية',
          weightGrams: 250,
          weightLabel: 'ربع 250 جم',
          quantity: 1,
          unitCost: 102,
          unitRetailPrice: 140,
        },
        {
          productId: 'prod-gummy-candy-1',
          productName: 'كوباية القبة الجاهزة (Dome Cup)',
          weightGrams: 125,
          weightLabel: 'كوباية قبة وسط',
          quantity: 2,
          unitCost: 22,
          unitRetailPrice: 35,
        },
      ],
      packagingCost: 15,
      totalRawCost: 306,
      originalRetailPrice: 460,
      promoPrice: 385,
      netProfitEgp: 79,
      profitMarginPercent: 20.5,
      minSafeMarginPercent: 15,
      isProfitSafe: true,
      active: true,
      isVipOnly: false,
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 14).toISOString(),
      image: '/images/products/royal-mix.jpg',
    },
    {
      id: 'promo-roqan-coffee',
      title: 'عرض المزاج والروقان السريع',
      subtitle: 'بوكس روقان المقسم (4 خانات) + ثمن بن تركي محوج طازج + كوباية كاندي قبة',
      badge: 'وفر 40 جنيه ⚡',
      items: [
        {
          productId: 'prod-box-roqan-125',
          productName: 'بوكس روقان المقسم (4 خانات)',
          weightGrams: 125,
          weightLabel: 'بوكس 4 خانات',
          quantity: 1,
          unitCost: 75,
          unitRetailPrice: 125,
        },
        {
          productId: 'prod-hafsa-turkish-coffee-1',
          productName: 'بن حفصة التركي بالتحويجة السرية',
          weightGrams: 125,
          weightLabel: 'ثمن 125 جم',
          quantity: 1,
          unitCost: 51,
          unitRetailPrice: 70,
        },
        {
          productId: 'prod-gummy-candy-1',
          productName: 'كوباية القبة الجاهزة (Dome Cup)',
          weightGrams: 125,
          weightLabel: 'كوباية قبة',
          quantity: 1,
          unitCost: 20,
          unitRetailPrice: 35,
        },
      ],
      packagingCost: 10,
      totalRawCost: 156,
      originalRetailPrice: 230,
      promoPrice: 190,
      netProfitEgp: 34,
      profitMarginPercent: 17.9,
      minSafeMarginPercent: 15,
      isProfitSafe: true,
      active: true,
      isVipOnly: false,
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 9).toISOString(),
      image: '/images/products/pistachio.jpg',
    },
    {
      id: 'promo-vip-secret-1',
      title: 'عرض نادي حفصة VIP السري (لأعضاء المحفظة)',
      subtitle: 'بوكس هدايا VIP الملكي (6 خانات) + برطمان عسل نحل بالمكسرات + ربع بن محوج ملكي',
      badge: 'حصري لأعضاء VIP 👑',
      items: [
        {
          productId: 'prod-royal-mix-1',
          productName: 'بوكس الزيارات والهدايا الملكي VIP',
          weightGrams: 250,
          weightLabel: 'بوكس VIP 6 خانات',
          quantity: 1,
          unitCost: 310,
          unitRetailPrice: 450,
        },
        {
          productId: 'prod-honey-nuts-jar-1',
          productName: 'برطمان عسل نحل بالمكسرات الملكية',
          weightGrams: 250,
          weightLabel: 'برطمان ربع كيلو',
          quantity: 1,
          unitCost: 78,
          unitRetailPrice: 115,
        },
        {
          productId: 'prod-hafsa-turkish-coffee-1',
          productName: 'بن حفصة التركي بالتحويجة السرية',
          weightGrams: 250,
          weightLabel: 'ربع 250 جم',
          quantity: 1,
          unitCost: 102,
          unitRetailPrice: 140,
        },
      ],
      packagingCost: 20,
      totalRawCost: 510,
      originalRetailPrice: 705,
      promoPrice: 615,
      netProfitEgp: 105,
      profitMarginPercent: 17.1,
      minSafeMarginPercent: 15,
      isProfitSafe: true,
      active: true,
      isVipOnly: true,
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      image: '/images/products/stuffed-dates.jpg',
    },
  ],
  orders: [
    {
      id: 'ord-1001',
      orderNumber: 'NUT-1001',
      customerName: 'محمد عادل الشافعي',
      customerPhone: '01012345678',
      governorate: 'بندر بني مزار (توصيل فوري 30 - 45 دقيقة)',
      address: 'شارع مسجد الزراعيين - بجوار صيدلية النيل - برج الإيمان الدور 3',
      deliveryMethod: 'bandar_fast',
      notes: 'يرجى الاتصال فور الوصول',
      items: [
        {
          cartItemId: 'prod-royal-mix-1-w-1000-محمص مملح',
          productId: 'prod-royal-mix-1',
          productName: 'بوكس الزيارات والهدايا الملكي VIP (6 خانات فاخرة — 450 ج.م)',
          productImage: '/images/products/royal-mix.jpg',
          weightId: 'w-1000',
          weightLabel: 'بوكس 1 كجم العائلي الملكي',
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
          weightLabel: 'نصف 500 جم',
          roastOption: 'محمص بدون ملح',
          unitPrice: 360,
          quantity: 1,
        },
      ],
      subtotal: 1080,
      shippingCost: 0,
      discountAmount: 108,
      couponCode: 'NUTS10',
      vipCashbackEarned: 49,
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
      governorate: 'قرى مركز بني مزار (القيس، صندفا، بني علي، شلقام، أبشاق، طمبو، الجندية...)',
      villageName: 'قرية القيس',
      deliverySlot: 'دورة الساعة 8:00 مساءً',
      deliveryMethod: 'villages_scheduled',
      address: 'قرية القيس - الشارع الرئيسي بجوار المدرسة الإعدادية',
      items: [
        {
          cartItemId: 'prod-pistachio-1-w-500-محمص مملح',
          productId: 'prod-pistachio-1',
          productName: 'فستق أمريكي جامبو محمص',
          productImage: '/images/products/pistachio.jpg',
          weightId: 'w-500',
          weightLabel: 'نصف 500 جم',
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
          weightLabel: 'نصف 500 جم',
          roastOption: 'نيء طبيعي',
          unitPrice: 320,
          quantity: 1,
        },
      ],
      subtotal: 740,
      shippingCost: 0,
      discountAmount: 0,
      vipCashbackEarned: 37,
      total: 740,
      paymentMethod: 'instapay',
      paymentReference: 'تحويل إنستا باي من سارة حسام - رقم مرجعي 983412',
      status: 'delivered',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ],
  posShifts: [
    {
      id: 'shift-101',
      shiftNumber: 'SHIFT-101',
      cashierName: 'كاشير فرع بني مزار (أمام مسجد الزراعيين)',
      shiftPeriod: 'الوردية المسائية',
      status: 'open',
      openingCash: 1000,
      cashSalesTotal: 972,
      vodafoneCashTotal: 0,
      instapayTotal: 740,
      vipRedeemedTotal: 0,
      vipCashbackIssuedTotal: 86,
      expensesTotal: 150,
      expectedCashInDrawer: 1822,
      ordersCount: 2,
      totalRevenue: 1712,
      totalRawCost: 1210,
      totalNetProfit: 502,
      openedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      notes: 'وردية العمل النشطة بفرع بني مزار',
    },
  ],
  posExpenses: [
    {
      id: 'exp-1',
      shiftId: 'shift-101',
      title: 'أكياس تغليف حراري واستيكر ذهبي مطبوع',
      amount: 150,
      category: 'packaging',
      notes: 'توريد سريع للمحل',
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ],
};

function normalizeDatabase(parsed: DatabaseSchema): DatabaseSchema {
  if (parsed.settings) {
    if (parsed.settings.storeName === 'محمصة الواحة الذهبية') {
      parsed.settings = {
        ...structuredClone(initialDatabase.settings),
        adminPassword: parsed.settings.adminPassword || 'admin',
      };
      parsed.categories = structuredClone(initialDatabase.categories);
      parsed.shippingRates = structuredClone(initialDatabase.shippingRates);
      parsed.coupons = structuredClone(initialDatabase.coupons);
    }
    parsed.settings.pageContent = getResolvedPageContent(parsed.settings);
    parsed.settings.themeConfig = getResolvedThemeConfig(parsed.settings);
    if (typeof parsed.settings.vipCashbackPercent !== 'number') {
      parsed.settings.vipCashbackPercent = 5;
    }
    if (typeof parsed.settings.vipMinOrderForCashback !== 'number') {
      parsed.settings.vipMinOrderForCashback = 150;
    }
    if (typeof parsed.settings.villageMinOrderAmount !== 'number') {
      parsed.settings.villageMinOrderAmount = 200;
    }
  }
  if (!Array.isArray(parsed.categories) || parsed.categories.length < 6) {
    parsed.categories = structuredClone(initialDatabase.categories);
  }
  if (!Array.isArray(parsed.products) || parsed.products.length < 20) {
    const existingById = new Map((parsed.products || []).map((p) => [p.id, p]));
    parsed.products = structuredClone(initialDatabase.products).map((initProd) => {
      const existing = existingById.get(initProd.id);
      if (existing && Array.isArray(existing.reviews) && existing.reviews.length > 0) {
        return {
          ...initProd,
          rating: existing.rating,
          reviewsCount: existing.reviewsCount,
          reviews: existing.reviews,
        };
      }
      return initProd;
    });
  }
  if (!Array.isArray(parsed.vipMembers) || parsed.vipMembers.length === 0) {
    parsed.vipMembers = structuredClone(initialDatabase.vipMembers || []);
  }
  if (!Array.isArray(parsed.promotions) || parsed.promotions.length === 0) {
    parsed.promotions = structuredClone(initialDatabase.promotions || []);
  }
  if (!Array.isArray(parsed.posShifts) || parsed.posShifts.length === 0) {
    parsed.posShifts = structuredClone(initialDatabase.posShifts || []);
  }
  if (!Array.isArray(parsed.posExpenses)) {
    parsed.posExpenses = structuredClone(initialDatabase.posExpenses || []);
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
      if (Array.isArray(prod.weights) && !prod.weights.some((w) => w.weightGrams === 125)) {
        const w1000 = prod.weights.find((w) => w.weightGrams === 1000);
        const w250 = prod.weights.find((w) => w.weightGrams === 250);
        const w125Price = w1000
          ? Math.round(w1000.price * 0.125)
          : w250
          ? Math.round(w250.price * 0.5)
          : 50;
        prod.weights.unshift({
          id: 'w-125',
          label: 'ثمن 125 جم',
          weightGrams: 125,
          price: w125Price,
        });
      }
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
    if (getPostgresUrl() && globalThis.__newNutsMemoryDb) {
      return globalThis.__newNutsMemoryDb;
    }

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

async function ensurePostgresTable(sql: NeonQueryFunction<false, false>): Promise<void> {
  if (globalThis.__newNutsTableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS store_state (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  globalThis.__newNutsTableReady = true;
}

export async function getDbAsync(): Promise<DatabaseSchema> {
  const pgUrl = getPostgresUrl();
  if (!pgUrl) {
    return getDb();
  }

  try {
    const sql = neon(pgUrl);
    await ensurePostgresTable(sql);

    const rows = await sql`SELECT data FROM store_state WHERE id = 'main' LIMIT 1`;
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.data) {
      const parsed =
        typeof rows[0].data === 'string'
          ? (JSON.parse(rows[0].data) as DatabaseSchema)
          : (rows[0].data as DatabaseSchema);
      const normalized = normalizeDatabase(parsed);
      globalThis.__newNutsMemoryDb = normalized;
      return normalized;
    }

    const seed = ensureDbFile();
    const serialized = JSON.stringify(seed);
    await sql`
      INSERT INTO store_state (id, data, updated_at)
      VALUES ('main', ${serialized}::jsonb, NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    globalThis.__newNutsMemoryDb = seed;
    return seed;
  } catch (err) {
    console.error('Neon Postgres read error, falling back to local/tmp DB:', err);
    return getDb();
  }
}

export async function saveDbAsync(data: DatabaseSchema): Promise<void> {
  const normalized = normalizeDatabase(data);
  saveDb(normalized);

  const pgUrl = getPostgresUrl();
  if (!pgUrl) {
    return;
  }

  try {
    const sql = neon(pgUrl);
    await ensurePostgresTable(sql);
    const serialized = JSON.stringify(normalized);
    await sql`
      INSERT INTO store_state (id, data, updated_at)
      VALUES ('main', ${serialized}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data,
          updated_at = NOW()
    `;
  } catch (err) {
    console.error('Failed to persist store state to Neon Postgres:', err);
  }
}
