import React from 'react';
import { getDbAsync } from '@/lib/db';
import { sanitizePublicStoreData } from '@/lib/auth';
import HomePageClient from '@/components/home/HomePageClient';

export const revalidate = 60;

export default async function HomePage() {
  const db = await getDbAsync();
  const pub = sanitizePublicStoreData(db);

  const initialCategories = pub.categories || [];
  const initialProducts = (pub.products || []).filter((p) => p.showOnline !== false);
  const initialPromotions = (pub.promotions || []).filter((p) => p.active);

  return (
    <HomePageClient
      initialCategories={initialCategories}
      initialProducts={initialProducts}
      initialPromotions={initialPromotions}
      initialSettings={pub.settings}
    />
  );
}
