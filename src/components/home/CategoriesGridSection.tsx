'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Category, Product } from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';

interface CategoriesGridSectionProps {
  categories: Category[];
  products: Product[];
}

export default function CategoriesGridSection({
  categories,
  products,
}: CategoriesGridSectionProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-black text-[#C88A4B] block">
            🛍️ تسوق حسب القسم الرئيسي
          </span>
          <h2 className="font-cairo text-2xl sm:text-3xl font-black text-[#231710]">
            أقسام محمصة حفصة الستة
          </h2>
          <p className="text-xs sm:text-sm text-[#6E5D4F] mt-0.5">
            اختر القسم لتصفح جميع أصنافه الطازجة بأربعة أوزان قياسية (ثمن • ربع • نصف • كيلو)
          </p>
        </div>

        <Link
          href="/shop"
          className="text-xs sm:text-sm font-cairo font-black text-[#231710] hover:text-[#C88A4B] flex items-center gap-1.5 self-start sm:self-auto transition"
        >
          <span>عرض جميع الأقسام والأصناف ({products.length})</span>
          <ArrowLeft className="w-4 h-4 text-[#C88A4B]" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
        {categories.map((cat) => {
          const count = products.filter((p) => p.categoryId === cat.id).length;
          return (
            <Link
              key={cat.id}
              href={`/shop?cat=${cat.id}`}
              className="group bg-white rounded-2xl border border-[#E6DFD3] hover:border-[#D4AF37] shadow-2xs hover:shadow-md overflow-hidden flex flex-col justify-between transition-all duration-300"
            >
              <div className="relative h-28 sm:h-32 bg-[#F3ECE1] overflow-hidden">
                <img
                  src={getSafeImageUrl(cat.image)}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#231710]/80 via-[#231710]/20 to-transparent" />
                <span className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-[#231710]/90 border border-[#D4AF37]/50 flex items-center justify-center text-base shadow">
                  {cat.icon}
                </span>
                <span className="absolute bottom-2 left-2 bg-[#D4AF37] text-[#231710] text-[10px] font-black px-2 py-0.5 rounded-full tabular-nums">
                  {count} صنف
                </span>
              </div>

              <div className="p-3 space-y-1">
                <h3 className="font-cairo text-xs sm:text-sm font-black text-[#231710] group-hover:text-[#C88A4B] transition line-clamp-1">
                  {cat.name}
                </h3>
                <p className="text-[10.5px] text-[#6E5D4F] line-clamp-2 leading-snug">
                  {cat.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
