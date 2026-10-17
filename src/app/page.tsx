'use client';

import React, { useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import HeroSection from '@/components/home/HeroSection';
import CategoriesGridSection from '@/components/home/CategoriesGridSection';
import SpecialOffersAndBoxesSection from '@/components/home/SpecialOffersAndBoxesSection';
import BestSellersSection from '@/components/home/BestSellersSection';
import StoreBranchAndVipSection from '@/components/home/StoreBranchAndVipSection';

export default function HomePage() {
  const { storeData, isLoading } = useStore();

  const categories = storeData?.categories || [];
  const products = storeData?.products || [];
  const promotions = useMemo(
    () => (storeData?.promotions || []).filter((p) => p.active),
    [storeData?.promotions]
  );

  if (isLoading && !storeData) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAF6F0]">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#231710] text-[#D4AF37] mx-auto flex items-center justify-center text-2xl animate-pulse border-2 border-[#D4AF37]">
            ☕
          </div>
          <p className="font-cairo text-sm font-black text-[#231710]">
            جاري تجهيز محمصة حفصة للبن والمكسرات...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF6F0] text-[#231710] space-y-10 sm:space-y-14 pb-10">
      <HeroSection />
      <CategoriesGridSection categories={categories} products={products} />
      <SpecialOffersAndBoxesSection promotions={promotions} products={products} />
      <BestSellersSection products={products} />
      <StoreBranchAndVipSection />
    </div>
  );
}
