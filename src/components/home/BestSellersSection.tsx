'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Product } from '@/types/store';
import ProductCard from '@/components/ProductCard';

interface BestSellersSectionProps {
  products: Product[];
}

export default function BestSellersSection({
  products,
}: BestSellersSectionProps) {
  const [activeFilter, setActiveFilter] = useState<string>('featured');

  const displayedProducts = useMemo(() => {
    if (activeFilter === 'featured') {
      const feat = products.filter((p) => p.featured);
      return (feat.length >= 8 ? feat : products).slice(0, 8);
    }
    return products.filter((p) => p.categoryId === activeFilter).slice(0, 8);
  }, [products, activeFilter]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-black text-[#3B6E4C] block">
            🔥 الأصناف الأكثر طلباً في فرع مسجد الزراعيين
          </span>
          <h2 className="font-cairo text-2xl sm:text-3xl font-black text-[#231710]">
            الأكثر مبيعاً في بني مزار
          </h2>
          <p className="text-xs sm:text-sm text-[#6E5D4F] mt-0.5">
            اختر الوزن المناسب لك مباشرة من الكارت (ثمن 125 جم • ربع 250 جم • نصف 500 جم • كيلو)
          </p>
        </div>

        {/* Simple Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-[#F3ECE1] p-1.5 rounded-2xl border border-[#E6DFD3]">
          {[
            { id: 'featured', label: '🌟 الأكثر مبيعاً' },
            { id: 'cat-luxury-nuts', label: '🥜 مكسرات فاخرة' },
            { id: 'cat-seeds-crackers', label: '🌻 لب وتسالي' },
            { id: 'cat-coffee-roastery', label: '☕ بن وقهوة' },
            { id: 'cat-dates-yameesh', label: '🍯 عسل وتمور' },
            { id: 'cat-sweets-savory', label: '🍫 حلو وحادق' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-[#231710] text-[#D4AF37] shadow-xs font-black'
                  : 'text-[#6E5D4F] hover:text-[#231710]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
        {displayedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="text-center pt-2">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 bg-[#231710] hover:bg-[#3A2519] text-[#D4AF37] border border-[#D4AF37] font-cairo font-black text-xs sm:text-sm px-6 py-3 rounded-2xl shadow transition"
        >
          <span>تصفح جميع الـ {products.length} صنفاً في كتالوج المتجر الكامل</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
