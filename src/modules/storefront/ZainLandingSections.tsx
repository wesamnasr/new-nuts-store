'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  HelpCircle,
  MessageCircle,
  Minus,
  Plus,
  Star,
} from 'lucide-react';
import { Product } from '@/types/store';
import { useStore } from '@/context/StoreContext';
import { getCurrencySymbol } from '@/lib/defaults';
import { getFreeShippingThresholdForMethod } from '@/lib/egypt-shipping';

interface ZainLandingSectionsProps {
  products: Product[];
}

interface FaqItem {
  question: string;
  answer: string;
}

export default function ZainLandingSections({
  products,
}: ZainLandingSectionsProps) {
  const { storeData } = useStore();
  const settings = storeData?.settings;
  const currency = getCurrencySymbol(settings);
  const localFreeThreshold = getFreeShippingThresholdForMethod('bandar_fast', settings);
  const govFreeThreshold = getFreeShippingThresholdForMethod('governorate_shipping', settings);

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Pull genuine customer reviews stored on products (zero fabricated testimonials)
  const realCustomerReviews = useMemo(() => {
    const collected: Array<{
      id: string;
      customerName: string;
      productName: string;
      rating: number;
      comment: string;
      date: string;
      verified: boolean;
    }> = [];

    for (const p of products || []) {
      if (!Array.isArray(p.reviews) || p.reviews.length === 0) continue;
      for (const r of p.reviews) {
        if (!r?.comment?.trim()) continue;
        collected.push({
          id: `${p.id}-${r.id}`,
          customerName: r.customerName || 'عميل حفصة',
          productName: p.name,
          rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))),
          comment: r.comment.trim(),
          date: r.date || '',
          verified: Boolean(r.verified),
        });
      }
    }

    return collected.slice(0, 3);
  }, [products]);

  const faqItems: FaqItem[] = useMemo(
    () => [
      {
        question: 'المكسرات والبن هيوصلوني طازة ومقرمشين؟',
        answer:
          'أكيد، في محمصة حفصة بنحمص ونعبّي طلبك طازج يومياً في أكياس محكمة الغلق حرارياً تحفظ القرمشة والريحة طول رحلة الشحن لحد باب بيتك.',
      },
      {
        question: 'إزاي الشحن لكل محافظات مصر وبني مزار شغال؟',
        answer: `عندنا مخزنين (مخزن ٦ أكتوبر للقاهرة الكبرى والوجه البحري، ومخزن بني مزار للمنيا والصعيد)؛ القاهرة والجيزة والمنيا خلال ٢٤ ساعة وباقي المحافظات من يوم ليومين عمل، وكمان في بني مزار توصيل فوري خلال ٣٠–٤٥ دقيقة ودورية يومية للقرى.`,
      },
      {
        question: 'أقدر أعاين الطلب قبل ما أدفع للمندوب؟',
        answer:
          'طبعاً! الدفع عند الاستلام متاح لكل محافظات مصر، ومش هتدفع مليم غير لما تستلم وتعاين طلبك بنفسك، كما يتاح الدفع عبر فودافون كاش وإنستا باي.',
      },
      {
        question: 'إمتى باخد شحن مجاني أو كاش باك VIP؟',
        answer: `بتحصل على شحن مجاني تلقائياً داخل بني مزار للطلبات فوق ${localFreeThreshold} ${currency} ولكل المحافظات للطلبات فوق ${govFreeThreshold} ${currency}، وكمان ٥٪ كاش باك في محفظة VIP برقم موبايلك.`,
      },
    ],
    [localFreeThreshold, govFreeThreshold, currency]
  );

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* 1. Concise Single-Column FAQ Accordion */}
      <section className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-cairo font-extrabold text-[#9A6836] bg-[#F6F1EA] border border-[#EAE0D3] px-3 py-1 rounded-full">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>إجابات سريعة وواضحة</span>
          </div>
          <h2 className="font-cairo text-lg sm:text-2xl lg:text-[28px] font-black text-[#261A13]">
            الأسئلة الشائعة
          </h2>
          <div className="w-12 h-1 bg-gradient-to-r from-[#9A6836] to-[#E5B869] rounded-full mx-auto pt-0.5" />
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {faqItems.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl border bg-white overflow-hidden transition-colors duration-200 ${
                  isOpen
                    ? 'border-[#C88A4B]/60 shadow-[0_6px_22px_-12px_rgba(35,23,16,0.08)]'
                    : 'border-[#E8DFD3]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full min-h-[48px] sm:min-h-[56px] px-3.5 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3 text-right hover:bg-[#FAF7F2]/80 transition-colors cursor-pointer"
                >
                  <span className="font-cairo text-xs sm:text-base font-extrabold text-[#261A13]">
                    {item.question}
                  </span>
                  <span
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
                      isOpen
                        ? 'bg-[#2C1D14] text-[#FAF7F2]'
                        : 'bg-[#F6F1EA] text-[#5E4D40] border border-[#EAE0D3]'
                    }`}
                  >
                    {isOpen ? (
                      <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-3.5 sm:px-5 pb-3.5 sm:pb-4 pt-1 text-[11px] sm:text-sm text-[#5E4D40] leading-relaxed border-t border-[#F4EFE6]">
                      {item.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Genuine Customer Reviews (rendered only when real reviews exist) */}
      {realCustomerReviews.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-cairo font-extrabold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-1 rounded-full">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>تجارب موثقة من عملائنا</span>
            </div>
            <h2 className="font-cairo text-lg sm:text-2xl lg:text-[28px] font-black text-[#261A13]">
              آراء عملائنا
            </h2>
            <div className="w-12 h-1 bg-gradient-to-r from-[#9A6836] to-[#E5B869] rounded-full mx-auto pt-0.5" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-5">
            {realCustomerReviews.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-[#E8DFD3] bg-white p-3.5 sm:p-5 flex flex-col justify-between gap-3 shadow-[0_4px_20px_-10px_rgba(35,23,16,0.06)]"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#F2ECE3] pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#F6F1EA] text-[#9A6836] border border-[#EAE0D3] font-cairo font-extrabold text-xs flex items-center justify-center">
                      {t.customerName.trim()[0] || 'ع'}
                    </div>
                    <div>
                      <div className="font-cairo text-xs sm:text-sm font-extrabold text-[#261A13]">
                        {t.customerName}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-[#15803D] font-bold inline-flex items-center gap-1">
                        {t.verified && <CheckCircle2 className="w-3 h-3" />}
                        <span>{t.verified ? 'مشتري موثق' : t.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                          s <= t.rating
                            ? 'fill-[#D99B26] text-[#D99B26]'
                            : 'text-[#D8CFC3]'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-[#FAF7F2] rounded-xl p-3 border border-[#EAE0D3] space-y-1.5">
                  <p className="text-xs sm:text-sm text-[#261A13] leading-relaxed">
                    {t.comment}
                  </p>
                  <div className="text-[10px] font-bold text-[#9A6836] truncate">
                    {t.productName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
