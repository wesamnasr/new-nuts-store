'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Product } from '@/types/store';
import ProductCard from '@/components/ProductCard';
import {
  updateUrlQueryParams,
  useBrowserUrlSync,
  buildUrlWithParams,
} from '@/lib/url-sync';

interface BestSellersSectionProps {
  products: Product[];
}

const FILTER_TABS = [
  { id: 'all', label: 'الأكثر مبيعاً' },
  { id: 'cat-luxury-nuts', label: 'المكسرات الفاخرة' },
  { id: 'cat-coffee-bar', label: 'ركن القهوة والبار' },
  { id: 'cat-snacks', label: 'اللب والتسالي' },
  { id: 'cat-coffee-espresso', label: 'البن والمحمصة' },
  { id: 'cat-quick-cups', label: 'كوبايات التسلية' },
  { id: 'cat-honey-spices', label: 'العسل والتمور' },
  { id: 'cat-choco-candy', label: 'الشوكولاتة والكاندي' },
];

export default function BestSellersSection({
  products,
}: BestSellersSectionProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useBrowserUrlSync((params) => {
    const catParam = params.get('category') || params.get('cat');
    if (catParam && FILTER_TABS.some((t) => t.id === catParam)) {
      setActiveFilter(catParam);
    } else {
      setActiveFilter('all');
    }
  });

  const displayedProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const onlineProds = products.filter((p) => p.showOnline !== false);
    if (activeFilter === 'all') {
      const nutsFirst = onlineProds.filter(
        (p) => p.categoryId === 'cat-luxury-nuts'
      );
      const featured = onlineProds.filter((p) => p.featured);
      const merged = Array.from(new Set([...nutsFirst, ...featured, ...onlineProds]));
      return merged.slice(0, 8);
    }
    return onlineProds
      .filter((p) => p.categoryId === activeFilter)
      .slice(0, 8);
  }, [products, activeFilter]);

  if (!products || products.length === 0) return null;

  return (
    <section
      id="best-sellers"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
    >
      {/* Centered Section Heading */}
      <div className="text-center space-y-1.5">
        <h2 className="font-cairo text-xl sm:text-2xl lg:text-[28px] font-black text-[#261A13]">
          المكسرات والأكثر مبيعاً
        </h2>
        <p className="text-xs sm:text-sm text-[#6E5D4F]">
          اختر الوزن المناسب لك مباشرة من ثمن كيلو حتى كيلو كامل بأعلى جودة تحميص
        </p>
        <div className="w-14 h-1 bg-gradient-to-r from-[#9A6836] to-[#E5B869] rounded-full mx-auto pt-0.5" />
      </div>

      {/* Centered Filter Pills */}
      <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTER_TABS.map((tab) => {
          const href = buildUrlWithParams('/', {
            category: tab.id === 'all' ? null : tab.id,
          });
          const isActive = activeFilter === tab.id;
          return (
            <a
              key={tab.id}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                setActiveFilter(tab.id);
                updateUrlQueryParams({
                  category: tab.id === 'all' ? null : tab.id,
                });
              }}
              className={`px-4 py-2 rounded-full text-xs font-cairo font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#2C1D14] text-[#FAF7F2] shadow-xs'
                  : 'bg-white text-[#5E4D40] border border-[#E8DFD3] hover:text-[#261A13] hover:border-[#C88A4B]'
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* Responsive 2-Col Mobile / 3-Col Tablet / 4-Col Desktop Product Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
        {displayedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="pt-2 text-center">
        <Link
          href={activeFilter === 'all' ? '/shop' : `/shop?cat=${activeFilter}`}
          className="inline-flex items-center gap-2 bg-white hover:bg-[#261A13] text-[#261A13] hover:text-[#FAF7F2] border border-[#D5C4AE] hover:border-[#261A13] font-cairo font-extrabold text-xs sm:text-sm px-7 py-3 rounded-full shadow-2xs transition-all duration-200"
        >
          <span>عرض جميع المنتجات في المتجر</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
