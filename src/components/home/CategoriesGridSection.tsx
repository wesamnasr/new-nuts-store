'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Category, Product } from '@/types/store';

interface CategoriesGridSectionProps {
  categories: Category[];
  products?: Product[];
}

const CATEGORY_STYLES: Record<
  string,
  { badge: string; emoji: string; accent: string; href?: string }
> = {
  'cat-luxury-nuts': {
    badge: 'نخب أول ملكي',
    emoji: '🥜',
    accent: 'border-[#D4AF37]/50 bg-gradient-to-b from-[#FAF6F0] to-[#F3ECE1]',
  },
  'cat-snacks': {
    badge: 'تحميص يومي ساخن',
    emoji: '🌻',
    accent: 'border-[#C88A4B]/40 bg-[#FAF6F0]',
  },
  'cat-coffee-espresso': {
    badge: 'تحويجة وطحن بالطلب',
    emoji: '☕',
    accent: 'border-[#231710]/30 bg-[#FAF6F0]',
  },
  'cat-choco-candy': {
    badge: 'مستوردة ومقرمشات',
    emoji: '🍫',
    accent: 'border-[#C88A4B]/30 bg-[#FAF6F0]',
  },
  'cat-honey-spices': {
    badge: 'عسل طبيعي وعطارة',
    emoji: '🍯',
    accent: 'border-[#C88A4B]/30 bg-[#FAF6F0]',
  },
  'cat-mixed-boxes': {
    badge: 'وفّر حتى 25%',
    emoji: '🎁',
    accent: 'border-[#3B6E4C]/40 bg-[#EEF5F0]',
    href: '/build-box',
  },
};

export default function CategoriesGridSection({
  categories,
}: CategoriesGridSectionProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 pt-8 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <span className="text-xs font-black text-[#C88A4B] block mb-0.5">
            تسوّق حسب القسم
          </span>
          <h2 className="font-cairo text-xl sm:text-2xl font-black text-[#231710]">
            أقسام محمصة حفصة الرئيسية
          </h2>
        </div>
        <Link
          href="/shop"
          className="text-xs font-cairo font-black text-[#231710] hover:text-[#C88A4B] flex items-center gap-1 transition"
        >
          <span>تصفح جميع الأصناف في المتجر</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {categories.map((cat) => {
          const meta = CATEGORY_STYLES[cat.id] || {
            badge: 'طازج يومياً',
            emoji: '🌰',
            accent: 'border-[#E6DFD3] bg-[#FAF6F0]',
          };
          const targetHref = meta.href || `/shop?category=${cat.id}`;
          const cleanName = cat.name.replace(/^[^\w\u0600-\u06FF]+\s*/, '');

          return (
            <Link
              key={cat.id}
              href={targetHref}
              className={`group rounded-2xl p-3.5 border ${meta.accent} hover:border-[#D4AF37] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between gap-2.5 shadow-2xs hover:shadow-md`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="w-10 h-10 rounded-xl bg-white border border-[#E6DFD3] flex items-center justify-center text-xl shadow-2xs group-hover:scale-105 transition">
                  {meta.emoji}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#231710] text-[#D4AF37]">
                  {meta.badge}
                </span>
              </div>

              <div>
                <h3 className="font-cairo font-black text-xs sm:text-sm text-[#231710] group-hover:text-[#C88A4B] transition line-clamp-1">
                  {cleanName}
                </h3>
                <p className="text-[10.5px] text-[#6E5D4F] line-clamp-2 mt-0.5 leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#E6DFD3]/70 text-[10.5px] font-cairo font-black text-[#231710]">
                <span>استعرض القسم</span>
                <ArrowLeft className="w-3 h-3 text-[#C88A4B] group-hover:-translate-x-1 transition" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
