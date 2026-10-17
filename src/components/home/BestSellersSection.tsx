'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Flame, ArrowLeft } from 'lucide-react';
import { Product } from '@/types/store';
import ProductCard from '@/components/ProductCard';

interface BestSellersSectionProps {
  products: Product[];
}

const FILTER_TABS = [
  { id: 'all', label: '🔥 الأكثر مبيعاً' },
  { id: 'cat-snacks', label: '🌻 التسالي واللب الساخن' },
  { id: 'cat-luxury-nuts', label: '🥜 المكسرات الملكية' },
  { id: 'cat-coffee-espresso', label: '☕ البن والقهوة' },
  { id: 'cat-honey-spices', label: '🍯 العسل والتمور' },
  { id: 'cat-choco-candy', label: '🍫 الشوكولاتة والكاندي' },
];

export default function BestSellersSection({
  products,
}: BestSellersSectionProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const displayedProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    if (activeFilter === 'all') {
      const featured = products.filter((p) => p.featured);
      return (featured.length >= 8 ? featured : products).slice(0, 8);
    }
    return products.filter((p) => p.categoryId === activeFilter).slice(0, 8);
  }, [products, activeFilter]);

  if (!products || products.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 pt-8 sm:pt-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#B83B2B] mb-1">
            <Flame className="w-3.5 h-3.5" />
            <span>من الفرن والمحمصة مباشرة إليك</span>
          </span>
          <h2 className="font-cairo text-xl sm:text-2xl font-black text-[#231710]">
            الأصناف الأكثر طلباً في بني مزار
          </h2>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-black whitespace-nowrap transition cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-[#231710] text-[#D4AF37] shadow-sm'
                  : 'bg-white text-[#231710] border border-[#E6DFD3] hover:bg-[#F3ECE1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Traditional 4-Column Product Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          href={
            activeFilter === 'all' ? '/shop' : `/shop?category=${activeFilter}`
          }
          className="inline-flex items-center gap-2 bg-[#231710] hover:bg-[#3a261a] text-[#D4AF37] font-cairo font-black text-xs sm:text-sm px-6 py-3 rounded-2xl shadow transition"
        >
          <span>عرض جميع المنتجات في الكتالوج الكامل ({products.length} صنفاً)</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
