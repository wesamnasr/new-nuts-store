import { Product, StoreSettings } from '@/types/store';

export interface ProductHighlightBullet {
  icon: 'flame' | 'shield' | 'truck' | 'sparkles';
  title: string;
  subtitle: string;
}

export interface ProductComparisonRow {
  feature: string;
  hafsa: string;
  others: string;
}

export interface ProductFaqItem {
  question: string;
  answer: string;
}

function detectProductKind(product: Product): 'peanut' | 'coffee' | 'nuts' | 'dates_honey' | 'general' {
  const hay = `${product.name} ${product.subtitle} ${product.categoryId}`.toLowerCase();
  if (
    hay.includes('سوداني') ||
    hay.includes('فول') ||
    hay.includes('لب') ||
    hay.includes('حمص') ||
    hay.includes('تسالي')
  ) {
    return 'peanut';
  }
  if (
    hay.includes('بن ') ||
    hay.includes('قهوة') ||
    hay.includes('إسبريسو') ||
    hay.includes('اسبريسو') ||
    hay.includes('coffee')
  ) {
    return 'coffee';
  }
  if (
    hay.includes('فستق') ||
    hay.includes('كاجو') ||
    hay.includes('لوز') ||
    hay.includes('بندق') ||
    hay.includes('عين جمل') ||
    hay.includes('مكسرات')
  ) {
    return 'nuts';
  }
  if (hay.includes('تمر') || hay.includes('بلح') || hay.includes('عسل')) {
    return 'dates_honey';
  }
  return 'general';
}

/**
 * Returns a warm, sensory Egyptian Arabic headline tailored for the product landing hero.
 */
export function getProductAdHeadline(product: Product): string {
  if (product.adHeadline?.trim()) {
    return product.adHeadline.trim();
  }

  const kind = detectProductKind(product);
  if (kind === 'peanut') {
    return `${product.name} — قرمشة طازجة من المحمصة لبيتك`;
  }
  if (kind === 'coffee') {
    return `${product.name} — ريحة وطعم قهوة مطحونة طازج يومياً`;
  }
  if (kind === 'nuts') {
    return `${product.name} — فرز أول طازج وقرمشة مضمونة`;
  }
  if (kind === 'dates_honey') {
    return `${product.name} — طعم طبيعي أصلي وجودة منقية بالواحدة`;
  }
  return `${product.name} — طازج يومياً من محمصة حفصة لبيتك`;
}

/**
 * Returns 3 concise, scannable benefit bullets in warm Egyptian Arabic.
 */
export function getProductHighlights(product: Product): ProductHighlightBullet[] {
  const customLines = (product.adHighlights || []).map((s) => s.trim()).filter(Boolean);
  const icons: Array<'flame' | 'shield' | 'truck' | 'sparkles'> = ['sparkles', 'flame', 'truck'];

  if (customLines.length > 0) {
    return customLines.slice(0, 3).map((line, idx) => ({
      icon: icons[idx % icons.length],
      title: line,
      subtitle: '',
    }));
  }

  const kind = detectProductKind(product);

  if (kind === 'coffee') {
    return [
      {
        icon: 'sparkles',
        title: 'حبوب مختارة وطحنة طازجة على الطلب',
        subtitle: 'بنطحن ونعبّي بعد طلبك مباشرة عشان الوش والريحة يفضلوا في القمة',
      },
      {
        icon: 'flame',
        title: 'تحميص مظبوط على الهادي في محمصة حفصة',
        subtitle: 'كيس محكم الغلق يحفظ الزيوت العطرية لحد آخر فنجان',
      },
      {
        icon: 'truck',
        title: 'شحن سريع لكل مصر ومعاينة قبل الدفع',
        subtitle: 'يخرج من أقرب مخزن ليك (٦ أكتوبر أو بني مزار)',
      },
    ];
  }

  if (kind === 'dates_honey') {
    return [
      {
        icon: 'sparkles',
        title: 'فرز أول طبيعي ١٠٠٪ بدون إضافات',
        subtitle: 'متنقي بعناية وطعمه غني ونظيف من أول لقمة',
      },
      {
        icon: 'shield',
        title: 'تغليف محكم وآمن يحافظ على الطزاجة',
        subtitle: 'معبأ بطريقة تحمي الجودة والنظافة طول رحلة الشحن',
      },
      {
        icon: 'truck',
        title: 'توصيل لباب البيت لكل المحافظات',
        subtitle: 'شحن من مخزن ٦ أكتوبر ومخزن بني مزار والدفع عند الاستلام',
      },
    ];
  }

  return [
    {
      icon: 'sparkles',
      title: 'حباية فرز أول منقية بالواحدة',
      subtitle: 'بدون ولا حباية محروقة أو فاضية أو مكسرة',
    },
    {
      icon: 'flame',
      title: 'تحميص يومي على الهادي بدون زيت زايد',
      subtitle: 'متعبّي في أكياس محكمة الغلق حرارياً عشان القرمشة تفضل زي ما هي',
    },
    {
      icon: 'truck',
      title: 'شحن سريع لكل مصر من مخزنين (أكتوبر وبني مزار)',
      subtitle: 'الدفع عند الاستلام وتعاين طلبك بنفسك قبل ما تدفع مليم',
    },
  ];
}

/**
 * Returns 4 comparison rows contrasting Hafsa Roastery against ordinary market snacks.
 */
export function getProductComparisonRows(product: Product): ProductComparisonRow[] {
  if (Array.isArray(product.comparisonPoints) && product.comparisonPoints.length > 0) {
    return product.comparisonPoints;
  }

  const kind = detectProductKind(product);
  if (kind === 'coffee') {
    return [
      {
        feature: 'طزاجة التحميص والطحن',
        hafsa: 'بيتحمص ويتطحن طازج لطلبك بنفس اليوم',
        others: 'مطحون ومتخزن بالشهور وريحة البن طايرة',
      },
      {
        feature: 'نقاء الحبوب والتحويجة',
        hafsa: 'حبوب أرابيكا/روبوستا نقية وحبهان مطحون صافي',
        others: 'خلطات غير متوازنة أو نكهات صناعية',
      },
      {
        feature: 'التغليف وحفظ الريحة',
        hafsa: 'أكياس محكمة الغلق تحفظ الوش والكثافة',
        others: 'تغليف خفيف بيسرّب الرطوبة بسرعة',
      },
      {
        feature: 'الأمان عند الاستلام',
        hafsa: 'الدفع عند الاستلام وتعاين طلبك قبل الدفع',
        others: 'بدون ضمان استبدال لو الطعم معجبكش',
      },
    ];
  }

  return [
    {
      feature: 'جودة وفرز الحباية',
      hafsa: 'فرز أول جامبو منقية بالواحدة',
      others: 'أحجام مخلوطة وفيها حبات فاضية أو محروقة',
    },
    {
      feature: 'طزاجة التحميص',
      hafsa: 'بيتحمص ويتعبى طازج يومياً على الطلب',
      others: 'مخزن ومكشوف بالأسابيع وشارب رطوبة',
    },
    {
      feature: 'التغليف والقرمشة',
      hafsa: 'أكياس محكمة الغلق حرارياً تحفظ القرمشة في الشحن',
      others: 'أكياس عادية بتطرى بعد يوم واحد',
    },
    {
      feature: 'الأمان عند الاستلام',
      hafsa: 'تعاين طلبك بنفسك قبل ما تدفع مليم',
      others: 'دفع بدون ضمان استبدال أو معاينة',
    },
  ];
}

/**
 * Returns 4 objection-busting FAQs specific to food shipping and COD trust in Egypt.
 */
export function getProductFaqs(
  product: Product,
  settings?: StoreSettings | null
): ProductFaqItem[] {
  if (Array.isArray(product.adFaqs) && product.adFaqs.length > 0) {
    return product.adFaqs;
  }

  const cityName = settings?.cityName?.trim() || 'بني مزار';

  return [
    {
      question: 'المنتج هيوصلني مقرمش وطازج في الشحن ولا هيطرى؟',
      answer:
        'بنحمص ونعبّي طلبك في أكياس محكمة الغلق حرارياً قبل الشحن مباشرة، عشان يوصلك بنفس القرمشة والريحة كأنك لسه واخده من المحمصة.',
    },
    {
      question: 'أقدر أعاين الطلب قبل ما أدفع للمندوب؟',
      answer:
        'طبعاً! الدفع عند الاستلام متاح لكل محافظات مصر، ومش هتدفع مليم غير لما تستلم وتعاين طلبك بنفسك، ولو فيه أي مشكلة بنبدلهولك فوراً.',
    },
    {
      question: 'الطلب بيوصل في خلال كام يوم؟',
      answer: `عندنا مخزنين (مخزن ٦ أكتوبر للقاهرة والوجه البحري، ومخزن ${cityName} للمنيا والصعيد): القاهرة والجيزة والمنيا خلال ٢٤ ساعة، وباقي المحافظات من يوم ليومين عمل.`,
    },
    {
      question: 'إزاي أحافظ عليه مقرمش بعد ما أفتح الكيس؟',
      answer:
        'اقفل الكيس كويس بعد الاستخدام أو انقله في برطمان محكم في مكان جاف وبعيد عن الشمس، هيفضل مقرمش وطازج معاك لآخر حباية.',
    },
  ];
}
