'use client';

import React, { useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import type {
  Category,
  FlashPromotion,
  Product,
  StoreSettings,
} from '@/types/store';
import HeroSection from '@/components/home/HeroSection';
import CategoriesGridSection from '@/components/home/CategoriesGridSection';
import BestSellersSection from '@/components/home/BestSellersSection';
import SpecialOffersAndBoxesSection from '@/components/home/SpecialOffersAndBoxesSection';
import StoreBranchAndVipSection from '@/components/home/StoreBranchAndVipSection';
import ZainLandingSections from '@/modules/storefront/ZainLandingSections';

interface HomePageClientProps {
  initialCategories: Category[];
  initialProducts: Product[];
  initialPromotions: FlashPromotion[];
  initialSettings?: StoreSettings;
}

export default function HomePageClient({
  initialCategories,
  initialProducts,
  initialPromotions,
  initialSettings,
}: HomePageClientProps) {
  const { storeData } = useStore();

  const categories = storeData?.categories?.length
    ? storeData.categories
    : initialCategories;

  const products = useMemo(
    () =>
      (storeData?.products?.length ? storeData.products : initialProducts).filter(
        (p) => p.showOnline !== false
      ),
    [storeData?.products, initialProducts]
  );

  const promotions = useMemo(
    () =>
      (storeData?.promotions?.length
        ? storeData.promotions
        : initialPromotions
      ).filter((p) => p.active),
    [storeData?.promotions, initialPromotions]
  );

  return (
    <div className="bg-[#FAF7F2] text-[#261A13] space-y-7 sm:space-y-14 pb-8">
      <HeroSection initialSettings={initialSettings} />
      <CategoriesGridSection categories={categories} products={products} />
      <SpecialOffersAndBoxesSection promotions={promotions} products={products} />
      <BestSellersSection products={products} />
      <ZainLandingSections products={products} />
      <StoreBranchAndVipSection />
    </div>
  );
}
