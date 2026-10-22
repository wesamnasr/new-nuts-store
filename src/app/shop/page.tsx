'use client';

import React, { useState, useMemo, Suspense } from 'react';
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
import { updateUrlQueryParams, useBrowserUrlSync, buildUrlWithParams } from '@/lib/url-sync';

function ShopCatalogContent() {
  const { storeData } = useStore();
  const searchParams = useSearchParams();

  const initialCat = searchParams.get('cat') || searchParams.get('category') || 'all';
  const initialSub = searchParams.get('sub') || 'all';
  const initialQuery = searchParams.get('q') || '';
  const initialSort =
    (searchParams.get('sort') as 'popular' | 'price_asc' | 'price_desc' | 'rating') || 'popular';

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(initialSub);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [sortBy, setSortBy] = useState<'popular' | 'price_asc' | 'price_desc' | 'rating'>(initialSort);

  useBrowserUrlSync((params) => {
    const c = params.get('cat') || params.get('category') || 'all';
    const sub = params.get('sub') || 'all';
    const q = params.get('q') || '';
    const s = (params.get('sort') as 'popular' | 'price_asc' | 'price_desc' | 'rating') || 'popular';
    setSelectedCategory(c);
    setSelectedSubCategory(sub);
    setSearchQuery(q);
    setSortBy(s);
  });

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
              <span>متجر محمصة حفصة</span>
            </div>
            <h1 className="font-cairo text-2xl sm:text-3xl font-black text-white">
              جميع الأصناف الطازجة
            </h1>
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

      {/* Sticky 6 Main Category Tabs with Dedicated URLs */}
      <div className="sticky top-14 sm:top-16 z-30 bg-[#FAF6F0]/95 backdrop-blur-md border-b border-[#E6DFD3] shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <a
            href="/shop"
            onClick={(e) => {
              e.preventDefault();
              setSelectedCategory('all');
              setSelectedSubCategory('all');
              updateUrlQueryParams({ cat: null, category: null, sub: null });
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-cairo font-black whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#231710] text-[#D4AF37] shadow-sm'
                : 'bg-[#F3ECE1] text-[#231710] hover:bg-[#E6DFD3]'
            }`}
          >
            🌟 كل الأصناف ({products.length})
          </a>

          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            const catHref = buildUrlWithParams('/shop', {
              cat: cat.id,
              sort: sortBy === 'popular' ? null : sortBy,
            });
            return (
              <a
                key={cat.id}
                href={catHref}
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedCategory(cat.id);
                  setSelectedSubCategory('all');
                  updateUrlQueryParams({ cat: cat.id, category: null, sub: null });
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
              </a>
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
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                updateUrlQueryParams({ q: val.trim() || null }, { replace: true });
              }}
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
              onChange={(e) => {
                const val = e.target.value as any;
                setSortBy(val);
                updateUrlQueryParams({ sort: val === 'popular' ? null : val });
              }}
              className="bg-[#F3ECE1] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-extrabold text-[#231710] focus:outline-none"
            >
              <option value="popular">الأكثر مبيعاً في بني مزار</option>
              <option value="price_asc">السعر: من الأقل للأعلى</option>
              <option value="price_desc">السعر: من الأعلى للأقل</option>
              <option value="rating">الأعلى تقييماً</option>
            </select>
          </div>
        </div>

        {/* Sub-category Pills with Dedicated URLs */}
        {subCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <a
              href={buildUrlWithParams('/shop', {
                cat: selectedCategory === 'all' ? null : selectedCategory,
              })}
              onClick={(e) => {
                e.preventDefault();
                setSelectedSubCategory('all');
                updateUrlQueryParams({ sub: null });
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap border transition cursor-pointer ${
                selectedSubCategory === 'all'
                  ? 'bg-[#C88A4B] text-white border-[#C88A4B]'
                  : 'bg-white text-[#6E5D4F] border-[#E6DFD3] hover:border-[#C88A4B]'
              }`}
            >
              جميع الفئات الفرعية
            </a>
            {subCategories.map((sub) => (
              <a
                key={sub}
                href={buildUrlWithParams('/shop', {
                  cat: selectedCategory === 'all' ? null : selectedCategory,
                  sub,
                })}
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedSubCategory(sub);
                  updateUrlQueryParams({ sub });
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap border transition cursor-pointer ${
                  selectedSubCategory === sub
                    ? 'bg-[#C88A4B] text-white border-[#C88A4B]'
                    : 'bg-white text-[#6E5D4F] border-[#E6DFD3] hover:border-[#C88A4B]'
                }`}
              >
                {sub}
              </a>
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
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedSubCategory('all');
                setSearchQuery('');
                updateUrlQueryParams({ cat: null, category: null, sub: null, q: null });
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
