'use client';

import React from 'react';
import { Flame, CheckCircle2 } from 'lucide-react';
import { Product, NutritionalInfo } from '@/types/store';
import { getProductNutritionalInfo } from '@/lib/nutrition';

interface NutritionFactsCardProps {
  product: Product;
}

export default function NutritionFactsCard({ product }: NutritionFactsCardProps) {
  const nutrition: NutritionalInfo = getProductNutritionalInfo(product);

  const totalMacros = Math.max(0.1, nutrition.protein + nutrition.fats + nutrition.carbohydrates);
  const proteinPercent = Math.round((nutrition.protein / totalMacros) * 100);
  const fatsPercent = Math.round((nutrition.fats / totalMacros) * 100);
  const carbsPercent = Math.round((nutrition.carbohydrates / totalMacros) * 100);

  return (
    <div className="bg-white rounded-xl border border-brand-200/90 shadow-2xs p-3.5 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-brand-100">
        <h3 className="text-sm sm:text-base font-extrabold text-brand-950">
          القيمة الغذائية ({nutrition.servingSize})
        </h3>
        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
          <Flame className="w-3.5 h-3.5 text-amber-600" />
          {nutrition.calories} سعرة
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-2 text-center">
          <div className="text-[10px] text-amber-800 font-bold">الدهون الصحية</div>
          <div className="text-xs font-extrabold text-amber-950 mt-0.5">{nutrition.fats} جم ({fatsPercent}%)</div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-lg p-2 text-center">
          <div className="text-[10px] text-emerald-800 font-bold">البروتين</div>
          <div className="text-xs font-extrabold text-emerald-950 mt-0.5">{nutrition.protein} جم ({proteinPercent}%)</div>
        </div>

        <div className="bg-sky-50/70 border border-sky-200/60 rounded-lg p-2 text-center">
          <div className="text-[10px] text-sky-800 font-bold">الكربوهيدرات</div>
          <div className="text-xs font-extrabold text-sky-950 mt-0.5">{nutrition.carbohydrates} جم ({carbsPercent}%)</div>
        </div>

        <div className="bg-purple-50/70 border border-purple-200/60 rounded-lg p-2 text-center">
          <div className="text-[10px] text-purple-800 font-bold">الألياف</div>
          <div className="text-xs font-extrabold text-purple-950 mt-0.5">{nutrition.fiber} جم</div>
        </div>
      </div>

      {nutrition.healthBenefits.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {nutrition.healthBenefits.slice(0, 3).map((benefit, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-brand-50 border border-brand-200/70 rounded-lg px-2.5 py-1 text-[10px] text-brand-900 font-bold"
            >
              <CheckCircle2 className="w-3 h-3 text-gold-500 shrink-0" />
              <span>{benefit}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
