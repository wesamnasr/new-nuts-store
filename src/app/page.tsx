'use client';

import React, { useMemo } from 'react';
import { Nut } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import HeroSection from '@/components/home/HeroSection';
import CategoriesGridSection from '@/components/home/CategoriesGridSection';
import BestSellersSection from '@/components/home/BestSellersSection';
import SpecialOffersAndBoxesSection from '@/components/home/SpecialOffersAndBoxesSection';
import StoreBranchAndVipSection from '@/components/home/StoreBranchAndVipSection';
import ZainLandingSections from '@/modules/storefront/ZainLandingSections';

export default function HomePage() {
  const { storeData, isLoading } = useStore();

  const categories = storeData?.categories || [];
  const products = useMemo(
    () => (storeData?.products || []).filter((p) => p.showOnline !== false),
    [storeData?.products]
  );
  const promotions = useMemo(
    () => (storeData?.promotions || []).filter((p) => p.active),
    [storeData?.promotions]
  );

  if (isLoading && !storeData) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAF7F2]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#E8DFD3] text-[#9A6836] mx-auto flex items-center justify-center animate-pulse shadow-xs">
            <Nut className="w-5 h-5 stroke-[2]" />
          </div>
          <p className="font-cairo text-sm font-bold text-[#261A13]">
            جاري تحميل المتجر...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF7F2] text-[#261A13] space-y-12 sm:space-y-16 pb-12">
      <HeroSection />
      <CategoriesGridSection categories={categories} products={products} />
      <SpecialOffersAndBoxesSection promotions={promotions} products={products} />
      <BestSellersSection products={products} />
      <ZainLandingSections products={products} />
      <StoreBranchAndVipSection />
    </div>
  );
}
