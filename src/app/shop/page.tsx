'use client';

import React, { useState, useMemo, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  Gift,
  Coffee,
  Sparkles,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import ProductCard from '@/components/ProductCard';

function ShopCatalogContent() {
  const { storeData } = useStore();
  const searchParams = useSearchParams();

  const initialCat = searchParams.get('cat') || 'all';
  const initialQuery = searchParams.get('q') || '';

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [sortBy, setSortBy] = useState<'popular' | 'price_asc' | 'price_desc' | 'rating'>('popular');

  useEffect(() => {
    const q = searchParams.get('q');
    const c = searchParams.get('cat');
    if (q !== null) setSearchQuery(q);
    if (c !== null) setSelectedCategory(c);
  }, [searchParams]);

  const categories = storeData?.categories || [];
  const products = useMemo(
    () => (storeData?.products || []).filter((p) => p.showOnline !== false),
    [storeData?.products]
  );

  // Extract distinct subCategories for current category
  const subCategories = useMemo(() => {
    const relevant =
      selectedCategory === 'all'
        ? products
        : products.filter((p) => p.categoryId === selectedCategory);
    const set = new Set<string>();
    relevant.forEach((p) => {
      if (p.subCategory) set.add(p.subCategory);
    });
    return Array.from(set);
  }, [products, selectedCategory]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
        if (selectedSubCategory !== 'all' && p.subCategory !== selectedSubCategory) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchSub = (p.subtitle || '').toLowerCase().includes(q);
          const matchDesc = (p.description || '').toLowerCase().includes(q);
          const matchSubCat = (p.subCategory || '').toLowerCase().includes(q);
          return matchName || matchSub || matchDesc || matchSubCat;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = a.weights?.[1]?.price || a.weights?.[0]?.price || 0;
        const priceB = b.weights?.[1]?.price || b.weights?.[0]?.price || 0;
        if (sortBy === 'price_asc') return priceA - priceB;
        if (sortBy === 'price_desc') return priceB - priceA;
        if (sortBy === 'rating') return (b.rating || 5) - (a.rating || 5);
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      });
  }, [products, selectedCategory, selectedSubCategory, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-14">
      {/* Top Banner */}
      <div className="bg-[#231710] text-[#FAF6F0] border-b border-[#D4AF37]/40 py-6 sm:py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[#D4AF37] text-xs font-extrabold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>كتالوج محمصة حفصة الشامل • 6 أقسام رئيسية • 24 عين مكسرات و4 صوامع بن</span>
            </div>
            <h1 className="font-cairo text-2xl sm:text-3xl font-black text-white">
              تصفح جميع أصناف البن والمكسرات والياميش والعسل
            </h1>
            <p className="text-xs sm:text-sm text-[#F3ECE1]/80">
              اختر الوزن مباشرة من الكارت (ثمن 125ج • ربع 250ج • نصف 500ج • كيلو 1000ج)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/build-box"
              className="bg-[#D4AF37] text-[#231710] font-cairo font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow"
            >
              <Gift className="w-4 h-4" />
              <span>صمّم بوكس 125ج</span>
            </Link>
            <Link
              href="/coffee-blender"
              className="bg-white/10 hover:bg-white/20 text-[#FAF6F0] border border-[#D4AF37]/50 font-cairo font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5"
            >
              <Coffee className="w-4 h-4 text-[#D4AF37]" />
              <span>معمل توليفة البن</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Sticky 6 Main Category Tabs */}
      <div className="sticky top-14 sm:top-16 z-30 bg-[#FAF6F0]/95 backdrop-blur-md border-b border-[#E6DFD3] shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSelectedSubCategory('all');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-black whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#231710] text-[#D4AF37] shadow-sm'
                : 'bg-[#F3ECE1] text-[#231710] hover:bg-[#E6DFD3]'
            }`}
          >
            🌟 كل الأصناف ({products.length})
          </button>

          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedSubCategory('all');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#231710] text-[#D4AF37] shadow-sm'
                    : 'bg-[#F3ECE1] text-[#231710] hover:bg-[#E6DFD3]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                <span className="text-[10px] opacity-75 tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search, Sub-category Pills & Sort Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-3.5 rounded-2xl border border-[#E6DFD3] shadow-2xs">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم: فستق، كاجو، لب سوبر، بن عميد، عسل سدر، كاسات السعادة..."
              className="w-full bg-[#FAF6F0] border border-[#E6DFD3] focus:border-[#C88A4B] rounded-xl py-2 pr-9 pl-3 text-xs text-[#231710] focus:outline-none"
            />
            <Search className="w-4 h-4 text-[#6E5D4F] absolute right-3 top-2.5" />
          </div>

          {/* Sort Select */}
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-[#C88A4B]" />
            <span className="text-xs font-extrabold text-[#6E5D4F]">ترتيب حسب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#F3ECE1] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-extrabold text-[#231710] focus:outline-none"
            >
              <option value="popular">الأكثر مبيعاً في بني مزار</option>
              <option value="price_asc">السعر: من الأقل للأعلى</option>
              <option value="price_desc">السعر: من الأعلى للأقل</option>
              <option value="rating">الأعلى تقييماً</option>
            </select>
          </div>
        </div>

        {/* Sub-category Pills */}
        {subCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setSelectedSubCategory('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap border transition cursor-pointer ${
                selectedSubCategory === 'all'
                  ? 'bg-[#C88A4B] text-white border-[#C88A4B]'
                  : 'bg-white text-[#6E5D4F] border-[#E6DFD3] hover:border-[#C88A4B]'
              }`}
            >
              جميع الفئات الفرعية
            </button>
            {subCategories.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSubCategory(sub)}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap border transition cursor-pointer ${
                  selectedSubCategory === sub
                    ? 'bg-[#C88A4B] text-white border-[#C88A4B]'
                    : 'bg-white text-[#6E5D4F] border-[#E6DFD3] hover:border-[#C88A4B]'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-[#E6DFD3] space-y-3">
            <div className="text-3xl">🥜</div>
            <h3 className="font-cairo text-base font-black text-[#231710]">
              لا توجد أصناف مطابقة لبحثك حالياً
            </h3>
            <p className="text-xs text-[#6E5D4F]">
              جرّب البحث بكلمة أخرى أو استعرض جميع الأقسام الستة لمحمصة حفصة
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedSubCategory('all');
                setSearchQuery('');
              }}
              className="bg-[#231710] text-[#D4AF37] px-5 py-2 rounded-xl text-xs font-black cursor-pointer"
            >
              عرض كل المنتجات
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center bg-[#FAF6F0]">
          <p className="font-cairo text-sm font-black text-[#231710]">
            جاري تحميل كتالوج محمصة حفصة...
          </p>
        </div>
      }
    >
      <ShopCatalogContent />
    </Suspense>
  );
}
