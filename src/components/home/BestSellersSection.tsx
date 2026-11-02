'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Product } from '@/types/store';
import ProductCard from '@/components/ProductCard';
import { updateUrlQueryParams, useBrowserUrlSync, buildUrlWithParams } from '@/lib/url-sync';

interface BestSellersSectionProps {
  products: Product[];
}

const FILTER_TABS = [
  { id: 'all', label: 'الأكثر مبيعاً' },
  { id: 'cat-snacks', label: 'التسالي واللب' },
  { id: 'cat-luxury-nuts', label: 'المكسرات الفاخرة' },
  { id: 'cat-coffee-espresso', label: 'البن والقهوة' },
  { id: 'cat-honey-spices', label: 'العسل والتمور' },
  { id: 'cat-choco-candy', label: 'الشوكولاتة' },
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
      const featured = onlineProds.filter((p) => p.featured);
      return (featured.length >= 8 ? featured : onlineProds).slice(0, 8);
    }
    return onlineProds.filter((p) => p.categoryId === activeFilter).slice(0, 8);
  }, [products, activeFilter]);

  if (!products || products.length === 0) return null;

  return (
    <section id="best-sellers" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-cairo text-xl sm:text-2xl font-bold text-[#231710]">
            مختارات المحمصة
          </h2>
          <p className="text-xs sm:text-sm text-[#6E5D4F] mt-0.5">
            اختر الوزن المناسب لك مباشرة من ثمن كيلو حتى كيلو كامل
          </p>
        </div>

        {/* Clean Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTER_TABS.map((tab) => {
            const href = buildUrlWithParams('/', {
              category: tab.id === 'all' ? null : tab.id,
            });
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
                className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-bold whitespace-nowrap transition cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-[#231710] text-[#FAF6F0]'
                    : 'bg-white text-[#5C4A3D] border border-[#E8E0D5] hover:text-[#231710] hover:border-[#231710]/30'
                }`}
              >
                {tab.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* 4-Column Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {displayedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          href={activeFilter === 'all' ? '/shop' : `/shop?cat=${activeFilter}`}
          className="inline-flex items-center gap-2 bg-white hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-sm px-6 py-3 rounded-xl transition"
        >
          <span>عرض جميع المنتجات</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
