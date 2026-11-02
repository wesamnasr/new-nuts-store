'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  Gift,
  Coffee,
  Package,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import ProductCard from '@/components/ProductCard';
import { formatCategoryName } from '@/lib/defaults';
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
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      {/* Calm Light Page Header */}
      <div className="bg-white border-b border-[#E8E0D5] py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#9A6836]">كتالوج المحمصة</span>
            <h1 className="font-cairo text-2xl sm:text-3xl font-bold text-[#231710]">
              جميع الأصناف الطازجة
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/build-box"
              className="bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition"
            >
              <Gift className="w-4 h-4 text-[#9A6836]" />
              <span>بوكس السهرة</span>
            </Link>
            <Link
              href="/coffee-blender"
              className="bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition"
            >
              <Coffee className="w-4 h-4 text-[#9A6836]" />
              <span>معمل توليفة البن</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Sticky Main Category Tabs */}
      <div
        style={{ top: 'var(--navbar-height, 96px)' }}
        className="sticky z-30 bg-[#FAF6F0]/95 backdrop-blur-md border-b border-[#E8E0D5]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <a
            href="/shop"
            onClick={(e) => {
              e.preventDefault();
              setSelectedCategory('all');
              setSelectedSubCategory('all');
              updateUrlQueryParams({ cat: null, category: null, sub: null });
            }}
            className={`px-4 py-2 rounded-xl text-xs font-cairo font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#231710] text-[#FAF6F0]'
                : 'bg-white text-[#5C4A3D] border border-[#E8E0D5] hover:text-[#231710]'
            }`}
          >
            كل الأصناف ({products.length})
          </a>

          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            const cleanCatName = formatCategoryName(cat.name);
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
                className={`px-4 py-2 rounded-xl text-xs font-cairo font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#231710] text-[#FAF6F0]'
                    : 'bg-white text-[#5C4A3D] border border-[#E8E0D5] hover:text-[#231710]'
                }`}
              >
                <span>{cleanCatName}</span>
                <span className="text-[11px] opacity-70 tabular-nums">({count})</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Search, Sub-category Pills & Sort Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-2xl border border-[#E8E0D5]">
          <div className="relative flex-1">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                updateUrlQueryParams({ q: val.trim() || null }, { replace: true });
              }}
              placeholder="ابحث بالاسم: فستق، كاجو، لب سوبر، بن، عسل سدر..."
              className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white rounded-xl py-2.5 pr-9 pl-3 text-xs text-[#231710] focus:outline-none transition"
            />
            <Search className="w-4 h-4 text-[#8A7968] absolute right-3 top-3" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-[#8A7968]" />
            <span className="text-xs font-medium text-[#6E5D4F]">ترتيب:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                const val = e.target.value as 'popular' | 'price_asc' | 'price_desc' | 'rating';
                setSortBy(val);
                updateUrlQueryParams({ sort: val === 'popular' ? null : val });
              }}
              className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold text-[#231710] focus:outline-none focus:border-[#231710]"
            >
              <option value="popular">الأكثر طلباً</option>
              <option value="price_asc">السعر: من الأقل للأعلى</option>
              <option value="price_desc">السعر: من الأعلى للأقل</option>
              <option value="rating">الأعلى تقييماً</option>
            </select>
          </div>
        </div>

        {/* Sub-category Pills */}
        {subCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <a
              href={buildUrlWithParams('/shop', {
                cat: selectedCategory === 'all' ? null : selectedCategory,
              })}
              onClick={(e) => {
                e.preventDefault();
                setSelectedSubCategory('all');
                updateUrlQueryParams({ sub: null });
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                selectedSubCategory === 'all'
                  ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                  : 'bg-white text-[#6E5D4F] border-[#E8E0D5] hover:border-[#231710]/30'
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                  selectedSubCategory === sub
                    ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                    : 'bg-white text-[#6E5D4F] border-[#E8E0D5] hover:border-[#231710]/30'
                }`}
              >
                {sub}
              </a>
            ))}
          </div>
        )}

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-[#E8E0D5] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center mx-auto text-[#8A7968]">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-cairo text-base font-bold text-[#231710]">
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
              className="bg-[#231710] text-[#FAF6F0] px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              عرض كل المنتجات
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
          <p className="font-cairo text-sm font-bold text-[#5C4A3D]">
            جاري تحميل المتجر...
          </p>
        </div>
      }
    >
      <ShopCatalogContent />
    </Suspense>
  );
}
