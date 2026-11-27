'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  HelpCircle,
  Camera,
  X,
  ZoomIn,
} from 'lucide-react';
import { Product, StoreSettings } from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';
import {
  getProductComparisonRows,
  getProductFaqs,
} from '@/lib/product-conversion-copy';

export function ProductComparisonCard({ product }: { product: Product }) {
  const rows = getProductComparisonRows(product);
  if (!rows.length) return null;

  return (
    <section className="bg-white rounded-2xl border border-[#E8DFD3] p-5 sm:p-6 space-y-4 shadow-[0_6px_24px_-12px_rgba(35,23,16,0.06)]">
      <div className="space-y-1">
        <span className="inline-block text-[11px] font-extrabold text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-0.5 rounded-full">
          مقارنة صريحة قبل ما تشتري
        </span>
        <h2 className="font-cairo text-base sm:text-xl font-extrabold text-[#261A13]">
          ليه {product.name} من محمصة حفصة غير العادي؟
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-[#E8DFD3]">
              <th className="py-2.5 px-3 font-cairo font-bold text-[#6E5D4F] w-[26%]">
                المقارنة
              </th>
              <th className="py-2.5 px-3 font-cairo font-extrabold text-[#15803D] bg-[#F0FDF4]/80 rounded-tr-xl w-[39%]">
                محمصة حفصة
              </th>
              <th className="py-2.5 px-3 font-cairo font-bold text-[#8A7968] bg-[#FAF7F2] rounded-tl-xl w-[35%]">
                السوق العادي
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EAE0]">
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="py-3 px-3 font-bold text-[#261A13] align-top">
                  {row.feature}
                </td>
                <td className="py-3 px-3 bg-[#F0FDF4]/55 text-[#14532D] font-bold align-top">
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                    <span>{row.hafsa}</span>
                  </div>
                </td>
                <td className="py-3 px-3 bg-[#FAF7F2]/60 text-[#7A6B5D] align-top">
                  <div className="flex items-start gap-1.5">
                    <XCircle className="w-4 h-4 text-[#C26A5A] shrink-0 mt-0.5" />
                    <span>{row.others}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CustomerProofGallery({
  images,
  productName,
}: {
  images?: string[];
  productName: string;
}) {
  const cleanImages = (images || []).map((u) => u.trim()).filter(Boolean);
  const [zoomedImg, setZoomedImg] = useState<string | null>(null);

  if (cleanImages.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E8DFD3] p-5 sm:p-6 space-y-4 shadow-[0_6px_24px_-12px_rgba(35,23,16,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#9A6836] bg-[#FAF7F2] border border-[#E8DFD3] px-2.5 py-0.5 rounded-full">
            <Camera className="w-3.5 h-3.5" />
            <span>صور ورسائل حقيقية من عملائنا</span>
          </span>
          <h2 className="font-cairo text-base sm:text-xl font-extrabold text-[#261A13]">
            تجارب ناس جربت {productName} وطلبت تاني
          </h2>
        </div>
        <span className="text-[11px] text-[#6E5D4F]">اضغط على أي صورة للتكبير</span>
      </div>

      <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-1">
        {cleanImages.map((imgUrl, idx) => {
          const safeSrc = getSafeImageUrl(imgUrl);
          return (
            <button
              key={`${imgUrl}-${idx}`}
              type="button"
              onClick={() => setZoomedImg(safeSrc)}
              className="group relative w-44 sm:w-52 aspect-[3/4] rounded-2xl overflow-hidden border border-[#E8DFD3] bg-[#FAF7F2] shrink-0 cursor-pointer shadow-2xs hover:border-[#9A6836] transition"
            >
              <img
                src={safeSrc}
                alt={`رأي عميل حول ${productName} - ${idx + 1}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              <span className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center opacity-85 group-hover:opacity-100 transition">
                <ZoomIn className="w-3.5 h-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      {zoomedImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomedImg(null)}
        >
          <div
            className="relative max-w-lg w-full bg-[#1C1410] rounded-2xl overflow-hidden border border-white/15 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedImg(null)}
              aria-label="إغلاق الصورة"
              className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={zoomedImg}
              alt={`صورة تجربة عميل لـ ${productName}`}
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </section>
  );
}

export function ProductFaqAccordion({
  product,
  settings,
}: {
  product: Product;
  settings?: StoreSettings | null;
}) {
  const faqs = getProductFaqs(product, settings);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!faqs.length) return null;

  return (
    <section className="bg-white rounded-2xl border border-[#E8DFD3] p-5 sm:p-6 space-y-4 shadow-[0_6px_24px_-12px_rgba(35,23,16,0.06)]">
      <div className="space-y-0.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#9A6836] bg-[#FAF7F2] border border-[#E8DFD3] px-2.5 py-0.5 rounded-full">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>أسئلة بتيجي على بال كل عميل</span>
        </span>
        <h2 className="font-cairo text-base sm:text-xl font-extrabold text-[#261A13]">
          كل اللي محتاج تطمن منه قبل ما تطلب
        </h2>
      </div>

      <div className="divide-y divide-[#EFE7DC] border border-[#E8DFD3] rounded-2xl overflow-hidden bg-[#FAF7F2]/50">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div key={idx} className="bg-white/90">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                aria-expanded={isOpen}
                className="w-full px-4 py-3.5 text-right flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FAF7F2] transition"
              >
                <span className="font-cairo text-xs sm:text-sm font-extrabold text-[#261A13]">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#9A6836] shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-xs sm:text-sm text-[#5E4D40] leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
