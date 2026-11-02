'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  Coffee,
  Flame,
  Gift,
  Heart,
  Leaf,
  Package,
} from 'lucide-react';
import { Category, Product } from '@/types/store';
import { formatCategoryName } from '@/lib/defaults';

interface CategoriesGridSectionProps {
  categories: Category[];
  products?: Product[];
}

const CATEGORY_META: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }>; href?: string }
> = {
  'cat-luxury-nuts': { Icon: Award },
  'cat-snacks': { Icon: Flame },
  'cat-coffee-espresso': { Icon: Coffee },
  'cat-choco-candy': { Icon: Heart },
  'cat-honey-spices': { Icon: Leaf },
  'cat-mixed-boxes': { Icon: Gift, href: '/build-box' },
};

export default function CategoriesGridSection({
  categories,
}: CategoriesGridSectionProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710]">
          أقسام المحمصة
        </h2>
        <Link
          href="/shop"
          className="text-xs sm:text-sm font-cairo font-bold text-[#5C4A3D] hover:text-[#231710] flex items-center gap-1 transition"
        >
          <span>عرض جميع الأقسام</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat.id] || { Icon: Package };
          const IconComponent = meta.Icon;
          const targetHref = meta.href || `/shop?cat=${cat.id}`;
          const cleanName = formatCategoryName(cat.name);

          return (
            <Link
              key={cat.id}
              href={targetHref}
              className="group rounded-2xl p-4 bg-white border border-[#E8E0D5] hover:border-[#231710]/30 transition-all duration-200 flex flex-col justify-between gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center text-[#231710] group-hover:bg-[#231710] group-hover:text-[#FAF6F0] transition-colors">
                <IconComponent className="w-4 h-4 stroke-[1.75]" />
              </div>

              <h3 className="font-cairo font-bold text-sm text-[#231710] line-clamp-1">
                {cleanName}
              </h3>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
