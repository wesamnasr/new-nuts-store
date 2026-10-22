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
  { id: 'all', label: '🔥 الأكثر مبيعاً' },
  { id: 'cat-snacks', label: '🌻 التسالي واللب' },
  { id: 'cat-luxury-nuts', label: '🥜 المكسرات' },
  { id: 'cat-coffee-espresso', label: '☕ البن والقهوة' },
  { id: 'cat-honey-spices', label: '🍯 العسل والتمور' },
  { id: 'cat-choco-candy', label: '🍫 الشوكولاتة' },
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
    <section id="best-sellers" className="max-w-7xl mx-auto px-4 pt-8 sm:pt-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="font-cairo text-xl sm:text-2xl font-black text-[#231710]">
          الأكثر طلباً
        </h2>

        {/* Category Filter Pills with Dedicated URLs & History Support */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
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
                className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-black whitespace-nowrap transition cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-[#231710] text-[#D4AF37] shadow-sm'
                    : 'bg-white text-[#231710] border border-[#E6DFD3] hover:bg-[#F3ECE1]'
                }`}
              >
                {tab.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* 4-Column Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          href={
            activeFilter === 'all' ? '/shop' : `/shop?cat=${activeFilter}`
          }
          className="inline-flex items-center gap-2 bg-[#231710] hover:bg-[#3a261a] text-[#D4AF37] font-cairo font-black text-xs sm:text-sm px-6 py-3 rounded-2xl shadow transition"
        >
          <span>عرض كل المنتجات</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
