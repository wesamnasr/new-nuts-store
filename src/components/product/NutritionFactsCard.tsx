'use client';

import React from 'react';
import { Flame, CheckCircle2, ShieldCheck, HeartPulse, Activity } from 'lucide-react';
import { Product, NutritionalInfo } from '@/types/store';
import { getProductNutritionalInfo } from '@/lib/nutrition';

interface NutritionFactsCardProps {
  product: Product;
}

export default function NutritionFactsCard({ product }: NutritionFactsCardProps) {
  const nutrition: NutritionalInfo = getProductNutritionalInfo(product);

  // Total macronutrient mass for bar proportions
  const totalMacros = Math.max(0.1, nutrition.protein + nutrition.fats + nutrition.carbohydrates);
  const proteinPercent = Math.round((nutrition.protein / totalMacros) * 100);
  const fatsPercent = Math.round((nutrition.fats / totalMacros) * 100);
  const carbsPercent = Math.round((nutrition.carbohydrates / totalMacros) * 100);

  // Per 100g estimations
  const calPer100 = product.caloriesPer100g || Math.round((nutrition.calories / 28) * 100);
  const protPer100 = product.proteinPer100g || `${Math.round((nutrition.protein / 28) * 100)} جم`;
  const fatsPer100 = `${Math.round((nutrition.fats / 28) * 100)} جم`;
  const carbsPer100 = `${Math.round((nutrition.carbohydrates / 28) * 100)} جم`;
  const fiberPer100 = `${Math.round((nutrition.fiber / 28) * 100)} جم`;

  return (
    <div className="bg-white rounded-xl border border-brand-200/90 shadow-2xs p-3.5 sm:p-4 space-y-3">
      {/* Header with Title and Serving Size */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-brand-100">
        <div>
          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-pistachio-700 bg-pistachio-50 px-2 py-0.5 rounded-full mb-0.5">
            <HeartPulse className="w-2.5 h-2.5" />
            <span>قيمة غذائية موثقة علمياً</span>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-brand-950">
            الحقائق الغذائية والقيمة الصحية
          </h3>
        </div>

        <div className="bg-brand-50 border border-brand-200/70 rounded-lg px-2.5 py-1 text-right">
          <span className="text-[9.5px] text-brand-600 block font-semibold">حجم الحصة المقترحة:</span>
          <span className="text-[11px] font-extrabold text-brand-950">{nutrition.servingSize}</span>
        </div>
      </div>

      {/* Calories Hero Badge & Macro Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
        {/* Calories Card */}
        <div className="md:col-span-4 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-850 rounded-xl p-3 text-white shadow-sm text-center relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-16 h-16 bg-gold-500/20 rounded-full blur-xl pointer-events-none" />
          <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gold-500/20 text-gold-400 mb-1">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-gold-400">
            {nutrition.calories}
          </div>
          <div className="text-[10px] font-bold text-brand-100 mt-0.5">سعرة حرارية (لكل حصة)</div>
          <div className="mt-1 pt-1 border-t border-brand-800 text-[9.5px] text-brand-300">
            يعادل {calPer100} سعرة حرارية لكل 100 جم
          </div>
        </div>

        {/* Macronutrient Distribution Bars */}
        <div className="md:col-span-8 space-y-2">
          <div className="flex items-center justify-between text-[10.5px] font-extrabold text-brand-900">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-brand-700" />
              توزيع العناصر الكبرى (Macronutrients) للحصة:
            </span>
            <span className="text-brand-600 font-semibold text-[9.5px]">
              إجمالي {totalMacros.toFixed(1)} جم
            </span>
          </div>

          {/* Visual Stacked Progress Bar */}
          <div className="w-full h-2 rounded-full bg-brand-100 flex overflow-hidden shadow-inner">
            <div
              style={{ width: `${fatsPercent}%` }}
              className="bg-amber-500 transition-all duration-500"
              title={`دهون صحية: ${nutrition.fats} جم (${fatsPercent}%)`}
            />
            <div
              style={{ width: `${proteinPercent}%` }}
              className="bg-emerald-600 transition-all duration-500"
              title={`بروتين: ${nutrition.protein} جم (${proteinPercent}%)`}
            />
            <div
              style={{ width: `${carbsPercent}%` }}
              className="bg-sky-500 transition-all duration-500"
              title={`كربوهيدرات: ${nutrition.carbohydrates} جم (${carbsPercent}%)`}
            />
          </div>

          {/* Individual Macro Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
            <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-1.5 text-center">
              <div className="text-[9.5px] text-amber-800 font-bold">الدهون الصحية</div>
              <div className="text-[11px] font-extrabold text-amber-950 mt-0.5">{nutrition.fats} جم</div>
              <div className="text-[8.5px] text-amber-700 font-medium">{fatsPercent}% من الكتلة</div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-lg p-1.5 text-center">
              <div className="text-[9.5px] text-emerald-800 font-bold">البروتين النباتي</div>
              <div className="text-[11px] font-extrabold text-emerald-950 mt-0.5">{nutrition.protein} جم</div>
              <div className="text-[8.5px] text-emerald-700 font-medium">{proteinPercent}% من الكتلة</div>
            </div>

            <div className="bg-sky-50/70 border border-sky-200/60 rounded-lg p-1.5 text-center">
              <div className="text-[9.5px] text-sky-800 font-bold">الكربوهيدرات</div>
              <div className="text-[11px] font-extrabold text-sky-950 mt-0.5">{nutrition.carbohydrates} جم</div>
              <div className="text-[8.5px] text-sky-700 font-medium">{carbsPercent}% من الكتلة</div>
            </div>

            <div className="bg-purple-50/70 border border-purple-200/60 rounded-lg p-1.5 text-center">
              <div className="text-[9.5px] text-purple-800 font-bold">الألياف الغذائية</div>
              <div className="text-[11px] font-extrabold text-purple-950 mt-0.5">{nutrition.fiber} جم</div>
              <div className="text-[8.5px] text-purple-700 font-medium">تعزز الشبع</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulleted Health Benefits */}
      <div className="pt-1 border-t border-brand-100">
        <h4 className="text-[10px] font-extrabold text-brand-900 uppercase tracking-wider mb-1.5 pt-1.5">
          الفوائد الصحية لهذا الصنف:
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
          {nutrition.healthBenefits.map((benefit, idx) => (
            <div
              key={idx}
              className="bg-brand-50/80 border border-brand-200/70 hover:border-brand-400 rounded-lg p-2 flex items-start gap-1.5 transition"
            >
              <CheckCircle2 className="w-3 h-3 text-gold-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-brand-900 font-semibold leading-snug">
                {benefit}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
