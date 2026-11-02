'use client';

import React, { useMemo } from 'react';
import { Coffee } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import HeroSection from '@/components/home/HeroSection';
import CategoriesGridSection from '@/components/home/CategoriesGridSection';
import BestSellersSection from '@/components/home/BestSellersSection';
import SpecialOffersAndBoxesSection from '@/components/home/SpecialOffersAndBoxesSection';
import StoreBranchAndVipSection from '@/components/home/StoreBranchAndVipSection';

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
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAF6F0]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#E8E0D5] text-[#231710] mx-auto flex items-center justify-center animate-pulse">
            <Coffee className="w-5 h-5 stroke-[1.75]" />
          </div>
          <p className="font-cairo text-sm font-bold text-[#5C4A3D]">
            جاري تحميل المتجر...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF6F0] text-[#231710] space-y-14 sm:space-y-20 pb-12">
      <HeroSection />
      <CategoriesGridSection categories={categories} products={products} />
      <BestSellersSection products={products} />
      <SpecialOffersAndBoxesSection promotions={promotions} products={products} />
      <StoreBranchAndVipSection />
    </div>
  );
}
