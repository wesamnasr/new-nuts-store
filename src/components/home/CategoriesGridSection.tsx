'use client';

import React from 'react';
import Link from 'next/link';
import { Percent } from 'lucide-react';
import { Category, Product } from '@/types/store';
import { formatCategoryName, getSafeImageUrl } from '@/lib/defaults';

interface CategoriesGridSectionProps {
  categories: Category[];
  products?: Product[];
}

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  'cat-luxury-nuts': '/images/products/pistachio.jpg',
  'cat-snacks': '/images/products/savory-snacks.jpg',
  'cat-coffee-espresso': '/images/products/royal-mix.jpg',
  'cat-coffee-bar': '/images/branch/store-interior.jpg',
  'cat-choco-candy': '/images/products/hazelnut.jpg',
  'cat-quick-cups': '/images/products/energy-mix.jpg',
  'cat-honey-spices': '/images/products/stuffed-dates.jpg',
  'cat-mixed-boxes': '/images/products/royal-mix.jpg',
};

const CATEGORY_CUSTOM_HREF: Record<string, string> = {
  'cat-mixed-boxes': '/build-box',
};

export default function CategoriesGridSection({
  categories,
  products = [],
}: CategoriesGridSectionProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-1">
      {/* Centered Section Title */}
      <div className="text-center space-y-1.5 mb-4 sm:mb-7">
        <span className="text-[11px] sm:text-xs font-bold text-[#9A6836] block">
          تصفح حسب التصنيف
        </span>
        <h2 className="font-cairo text-lg sm:text-2xl lg:text-[28px] font-black text-[#261A13]">
          تسوق من الأقسام
        </h2>
        <div className="w-12 h-1 bg-gradient-to-l from-[#9A6836] to-[#E5B869] rounded-full mx-auto" />
      </div>

      {/* Circular Photographic Category Thumbnails */}
      <div className="flex items-start justify-start sm:justify-center gap-3 sm:gap-6 lg:gap-7 overflow-x-auto no-scrollbar py-2 px-1">
        {/* 1. Harmonious "العروض والخصومات" Circle */}
        <Link
          href="/#special-offers"
          className="group flex flex-col items-center text-center gap-2 shrink-0 w-20 sm:w-28 lg:w-30"
        >
          <div className="relative w-16 h-16 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden bg-gradient-to-br from-[#2C1D14] via-[#4A3122] to-[#9A6836] p-1 sm:p-1.5 shadow-sm ring-2 ring-[#E8DFD3] ring-offset-2 ring-offset-[#FAF7F2] group-hover:ring-[#C88A4B] transition-all duration-300 ease-out group-hover:-translate-y-1 flex items-center justify-center">
            <div className="w-full h-full rounded-full border border-dashed border-[#E5B869]/65 flex flex-col items-center justify-center text-[#FAF7F2] gap-0.5">
              <Percent className="w-4 h-4 sm:w-6 sm:h-6 text-[#E5B869] stroke-[2.4]" />
              <span className="font-cairo text-[10px] sm:text-xs font-extrabold text-[#FAF7F2]">
                خصومات
              </span>
            </div>
          </div>
          <span className="font-cairo font-extrabold text-[11px] sm:text-sm text-[#261A13] group-hover:text-[#9A6836] leading-snug line-clamp-2 transition-colors">
            العروض والخصومات
          </span>
        </Link>

        {/* 2. Dynamic Store Categories with Circular Studio Photography */}
        {categories.map((cat) => {
          const sampleProductImg = products.find(
            (p) => p.categoryId === cat.id && p.image
          )?.image;
          const resolvedImg = getSafeImageUrl(
            cat.image ||
              sampleProductImg ||
              CATEGORY_FALLBACK_IMAGES[cat.id] ||
              '/images/products/royal-mix.jpg'
          );
          const targetHref =
            CATEGORY_CUSTOM_HREF[cat.id] || `/shop?cat=${cat.id}`;
          const cleanName = formatCategoryName(cat.name);

          return (
            <Link
              key={cat.id}
              href={targetHref}
              className="group flex flex-col items-center text-center gap-2 shrink-0 w-20 sm:w-28 lg:w-30"
            >
              <div className="w-16 h-16 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden bg-white ring-2 ring-[#E8DFD3] ring-offset-2 ring-offset-[#FAF7F2] group-hover:ring-[#C88A4B] shadow-2xs transition-all duration-300 ease-out group-hover:-translate-y-1">
                <img
                  src={resolvedImg}
                  alt={cleanName}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
                />
              </div>

              <h3 className="font-cairo font-extrabold text-[11px] sm:text-sm text-[#261A13] group-hover:text-[#9A6836] leading-snug line-clamp-2 transition-colors">
                {cleanName}
              </h3>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
