'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
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
    <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#F0EAE0]">
        <h3 className="font-cairo text-base font-bold text-[#231710]">
          القيمة الغذائية ({nutrition.servingSize})
        </h3>
        <span className="text-xs font-bold text-[#231710] bg-[#FAF6F0] border border-[#E8E0D5] px-3 py-1 rounded-xl tabular-nums">
          {nutrition.calories} سعرة حرارية
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
        <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3 text-center">
          <div className="text-xs text-[#6E5D4F] font-medium">الدهون الصحية</div>
          <div className="text-sm font-bold text-[#231710] mt-1">
            {nutrition.fats} جم ({fatsPercent}%)
          </div>
        </div>

        <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3 text-center">
          <div className="text-xs text-[#6E5D4F] font-medium">البروتين</div>
          <div className="text-sm font-bold text-[#231710] mt-1">
            {nutrition.protein} جم ({proteinPercent}%)
          </div>
        </div>

        <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3 text-center">
          <div className="text-xs text-[#6E5D4F] font-medium">الكربوهيدرات</div>
          <div className="text-sm font-bold text-[#231710] mt-1">
            {nutrition.carbohydrates} جم ({carbsPercent}%)
          </div>
        </div>

        <div className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl p-3 text-center">
          <div className="text-xs text-[#6E5D4F] font-medium">الألياف</div>
          <div className="text-sm font-bold text-[#231710] mt-1">
            {nutrition.fiber} جم
          </div>
        </div>
      </div>

      {nutrition.healthBenefits.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {nutrition.healthBenefits.slice(0, 3).map((benefit, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 bg-[#FAF6F0] border border-[#E8E0D5] rounded-xl px-3 py-1.5 text-xs text-[#5C4A3D] font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3B6E4C] shrink-0" />
              <span>{benefit}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
