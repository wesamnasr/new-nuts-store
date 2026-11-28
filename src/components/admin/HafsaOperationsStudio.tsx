'use client';

import React, { useState, useMemo } from 'react';
import {
  Crown,
  Flame,
  Scale,
  QrCode,
  Bell,
  Printer,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import {
  generateWeightsFromKiloPrice,
  calculatePromoProfitSafety,
  isUnitProduct,
} from '@/lib/pricing';
import { FlashPromotion, Product, AdminRole } from '@/types/store';
import { getCurrencySymbol, getResolvedFeatureFlags, stripUiEmojis } from '@/lib/defaults';
import PreLaunchResetSafeguard from './PreLaunchResetSafeguard';
import ErpMasterModulesStudio from './ErpMasterModulesStudio';
import {
  updateUrlQueryParams,
  buildUrlWithParams,
  useBrowserUrlSync,
} from '@/lib/url-sync';

interface HafsaOperationsStudioProps {
  adminToken: string | null;
  onUpdateStorePayload: (
    partial: Record<string, any>,
    successToast: string
  ) => Promise<void | boolean>;
  canMutate?: boolean;
  currentRole?: AdminRole;
}

export default function HafsaOperationsStudio({
  adminToken,
  onUpdateStorePayload,
  canMutate = true,
  currentRole = 'super_admin',
}: HafsaOperationsStudioProps) {
  const { storeData, refreshStore, showToast, pixelEvents } = useStore();

  const [subTab, setSubTab] = useState<
    'kilo_updater' | 'erp_modules' | 'partner4_promos' | 'vip_cashier' | 'qr_codes' | 'wesam_marketing' | 'pre_launch_reset'
  >('kilo_updater');

  useBrowserUrlSync((params) => {
    const st = params.get('subtab');
    if (
      st &&
      ['kilo_updater', 'erp_modules', 'partner4_promos', 'vip_cashier', 'qr_codes', 'wesam_marketing', 'pre_launch_reset'].includes(st)
    ) {
      setSubTab(
        st as 'kilo_updater' | 'erp_modules' | 'partner4_promos' | 'vip_cashier' | 'qr_codes' | 'wesam_marketing' | 'pre_launch_reset'
      );
    } else if (!st) {
      setSubTab('kilo_updater');
    }
  });

  const products = storeData?.products || [];
  const categories = storeData?.categories || [];
  const promotions = storeData?.promotions || [];
  const vipMembers = storeData?.vipMembers || [];
  const settings = storeData?.settings;
  const featureFlags = getResolvedFeatureFlags(settings);
  const currency = getCurrencySymbol(settings);

  // Batch Bulk Price Update (% or EGP across category or all)
  const [bulkMode, setBulkMode] = useState<'percent' | 'fixed'>('percent');
  const [bulkValue, setBulkValue] = useState<string>('5');
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('all');
  const [bulkTargetField, setBulkTargetField] = useState<'price' | 'cost'>('price');
  const [bulkApplying, setBulkApplying] = useState<boolean>(false);

  const handleApplyBulkPriceUpdate = async () => {
    const val = Number(bulkValue);
    if (!Number.isFinite(val) || val === 0) {
      showToast('أدخل نسبة أو مبلغاً غير صفري للتعديل الجماعي');
      return;
    }
    setBulkApplying(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
        headers['x-admin-token'] = adminToken;
      }
      const res = await fetch('/api/admin/erp-modules', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'bulk_price_update',
          mode: bulkMode,
          value: val,
          categoryId: bulkCategoryId,
          targetField: bulkTargetField,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'تعذر التعديل الجماعي');
      showToast(`تم تحديث أسعار (${json.updatedCount}) صنف وتوليد الأوزان تلقائياً`);
      refreshStore();
    } catch (e: unknown) {
      showToast('خطأ في التعديل الجماعي', e instanceof Error ? e.message : '');
    } finally {
      setBulkApplying(false);
    }
  };

  // 1. Web Audio Chime Generator for New Orders
  const playOrderChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.15); // A5
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.65);
      showToast('تم تشغيل جرس تنبيه الطلبات الصوتية بنجاح');
    } catch {
      showToast('تنبيه طلب جديد في الفرع الرئيسي');
    }
  };

  // 2. Kilo Price & Cost Updater State
  const [kiloEdits, setKiloEdits] = useState<
    Record<string, { pricePerKg: number; costPerKg: number }>
  >({});
  const [searchKilo, setSearchKilo] = useState('');

  const handleKiloFieldChange = (
    prod: Product,
    field: 'pricePerKg' | 'costPerKg',
    val: number
  ) => {
    const currentPrice =
      kiloEdits[prod.id]?.pricePerKg ??
      prod.pricePerKg ??
      prod.weights.find((w) => w.grams === 1000)?.price ??
      400;
    const currentCost =
      kiloEdits[prod.id]?.costPerKg ?? prod.costPerKg ?? Math.round(currentPrice * 0.68);

    setKiloEdits((prev) => ({
      ...prev,
      [prod.id]: {
        pricePerKg: field === 'pricePerKg' ? val : currentPrice,
        costPerKg: field === 'costPerKg' ? val : currentCost,
      },
    }));
  };

  const handleApplySingleKiloUpdate = async (prod: Product) => {
    const edit = kiloEdits[prod.id];
    const newPricePerKg =
      edit?.pricePerKg ??
      prod.pricePerKg ??
      prod.weights.find((w) => w.grams === 1000)?.price ??
      400;
    const newCostPerKg =
      edit?.costPerKg ?? prod.costPerKg ?? Math.round(newPricePerKg * 0.68);

    const newWeights = generateWeightsFromKiloPrice(
      newPricePerKg,
      Math.round(newPricePerKg * 1.12)
    );

    const updatedProducts = products.map((p) =>
      p.id === prod.id
        ? {
            ...p,
            pricePerKg: newPricePerKg,
            costPerKg: newCostPerKg,
            weights: newWeights,
          }
        : p
    );

    await onUpdateStorePayload(
      { products: updatedProducts },
      `تم تحديث سعر كيلو "${prod.name}" وتوليد الـ 4 أوزان تلقائياً`
    );
  };

  // 3. 4th Partner Promo Studio State + Profit Margin Safety Calculator
  const [promoTitle, setPromoTitle] = useState('عرض السهرة العائلية الخاص');
  const [promoSubtitle, setPromoSubtitle] = useState(
    'بوكس العيلة 6 خانات + ربع كيلو بن وسط محوج مخصوص'
  );
  const [promoBundleSummary, setPromoBundleSummary] = useState(
    'بوكس العيلة (250ج) + ربع التوليفة الملكية (145ج)'
  );
  const [promoOriginalPrice, setPromoOriginalPrice] = useState<number>(395);
  const [promoCostPrice, setPromoCostPrice] = useState<number>(265);
  const [promoProposedPrice, setPromoProposedPrice] = useState<number>(349);
  const [promoIsVipOnly, setPromoIsVipOnly] = useState<boolean>(false);

  const profitSafety = useMemo(
    () =>
      calculatePromoProfitSafety(
        promoOriginalPrice,
        promoCostPrice,
        promoProposedPrice,
        18
      ),
    [promoOriginalPrice, promoCostPrice, promoProposedPrice]
  );

  const handleCreateSafePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profitSafety.isSafe) {
      showToast('لا يمكن نشر العرض لأن هامش الربح أقل من الحد الآمن', profitSafety.warning);
      return;
    }

    const newPromo: FlashPromotion = {
      id: `promo-${Date.now()}`,
      title: promoTitle.trim(),
      subtitle: promoSubtitle.trim(),
      badgeText: `وفّر ${profitSafety.discountAmount} ${currency}`,
      originalPrice: promoOriginalPrice,
      originalRetailPrice: promoOriginalPrice,
      promoPrice: promoProposedPrice,
      costPrice: promoCostPrice,
      totalRawCost: promoCostPrice,
      netProfitEgp: profitSafety.netProfit,
      profitMarginPercent: profitSafety.profitMarginPercent,
      isProfitSafe: profitSafety.isSafe,
      endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      active: true,
      isVipOnly: promoIsVipOnly,
      bundleItemsSummary: promoBundleSummary.trim(),
      image: '/images/products/royal-mix.jpg',
    };

    await onUpdateStorePayload(
      { promotions: [newPromo, ...promotions] },
      'تم اعتماد ونشر عرض الباقة بعد اجتياز فحص هامش الربح الآمن'
    );
  };

  const handleDeletePromo = async (promoId: string) => {
    const updated = promotions.filter((p) => p.id !== promoId);
    await onUpdateStorePayload({ promotions: updated }, 'تم حذف العرض الترويجي');
  };

  // 4. Eng. Wesam's Marketing & Egypt-Wide Logistics Settings
  const [metaPixel, setMetaPixel] = useState(settings?.metaPixelId || '');
  const [metaCapiToken, setMetaCapiToken] = useState(settings?.metaCapiAccessToken || '');
  const [metaCapiTestCode, setMetaCapiTestCode] = useState(settings?.metaCapiTestEventCode || '');
  const [tiktokPixel, setTiktokPixel] = useState(
    settings?.tiktokPixelId || ''
  );
  const [minOrderVillages, setMinOrderVillages] = useState<number>(
    settings?.minOrderVillages || 200
  );
  const [bandarShipping, setBandarShipping] = useState<number>(
    settings?.bandarShippingCost ?? 20
  );
  const [villagesShipping, setVillagesShipping] = useState<number>(
    settings?.villagesShippingCost ?? 25
  );
  const [freeThreshold, setFreeThreshold] = useState<number>(
    settings?.freeShippingThreshold || 300
  );
  const [governoratesFreeThreshold, setGovernoratesFreeThreshold] = useState<number>(
    settings?.governoratesFreeShippingThreshold || 650
  );

  const handleSaveWesamSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    await onUpdateStorePayload(
      {
        settings: {
          ...settings,
          metaPixelId: metaPixel.trim(),
          metaCapiAccessToken: metaCapiToken.trim(),
          metaCapiTestEventCode: metaCapiTestCode.trim(),
          tiktokPixelId: tiktokPixel.trim(),
          minOrderVillages: Number(minOrderVillages) || 200,
          bandarShippingCost: Number(bandarShipping) || 20,
          villagesShippingCost: Number(villagesShipping) || 25,
          freeShippingThreshold: Number(freeThreshold) || 300,
          governoratesFreeShippingThreshold: Number(governoratesFreeThreshold) || 650,
        },
      },
      'تم حفظ إعدادات التسويق (Meta Pixel & CAPI) والتوصيل بنجاح'
    );
  };

  const weightProducts = useMemo(
    () => products.filter((p) => !isUnitProduct(p)),
    [products]
  );

  const filteredKiloProducts = useMemo(() => {
    if (!searchKilo.trim()) return weightProducts.slice(0, 12);
    const q = searchKilo.trim().toLowerCase();
    return weightProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.subCategory || '').toLowerCase().includes(q)
    );
  }, [weightProducts, searchKilo]);

  return (
    <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 sm:p-6 space-y-5 mb-6">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E8E0D5] pb-4">
        <div>
          <h2 className="font-cairo text-lg sm:text-xl font-bold text-[#231710]">
            أدوات التشغيل والعروض ونادي VIP
          </h2>
          <p className="text-xs text-[#6B5644] mt-0.5">
            تحديث أسعار الكيلو والـ 4 أوزان، حاسبة هامش ربح العروض، إدارة نقاط VIP، ورموز الـ QR.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <a
            href="/pos"
            className="min-h-[40px] bg-[#FAF6F0] hover:bg-[#F2ECE2] text-[#231710] border border-[#E8E0D5] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Scale className="w-3.5 h-3.5 text-[#9A6836]" />
            <span>نقطة البيع (POS)</span>
          </a>
          <button
            type="button"
            onClick={playOrderChime}
            className="min-h-[40px] bg-[#231710] hover:bg-[#3A271C] text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>اختبار جرس التنبيه</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-[#FAF6F0] p-1.5 rounded-xl border border-[#E8E0D5]">
        {[
          {
            id: 'kilo_updater',
            label: 'أسعار الكيلو والتعديل الجماعي',
          },
          {
            id: 'erp_modules',
            label: 'المخازن والـ BOM والإضافات والموظفين والصالات',
          },
          {
            id: 'partner4_promos',
            label: 'حاسبة العروض والأرباح',
          },
          {
            id: 'vip_cashier',
            label: 'أعضاء نادي VIP',
          },
          {
            id: 'qr_codes',
            label: 'رموز الـ QR',
          },
          {
            id: 'wesam_marketing',
            label: 'التسويق والتوصيل',
          },
          {
            id: 'pre_launch_reset',
            label: 'تصفير العمليات (الافتتاح)',
          },
        ].map((tab) => (
          <a
            key={tab.id}
            href={buildUrlWithParams('/admin', {
              tab: 'operations',
              subtab: tab.id === 'kilo_updater' ? null : tab.id,
            })}
            onClick={(e) => {
              e.preventDefault();
              setSubTab(tab.id as any);
              updateUrlQueryParams({ subtab: tab.id === 'kilo_updater' ? null : tab.id });
            }}
            className={`min-h-[40px] inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              subTab === tab.id
                ? 'bg-[#231710] text-white'
                : 'text-[#6B5644] hover:text-[#231710]'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* TAB 1: 1-Click Kilo Price & 4-Weights Updater + Batch Bulk Price Editor */}
      {subTab === 'kilo_updater' && (
        <div className="space-y-4">
          {canMutate && (
            <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200 flex flex-wrap items-end gap-2.5">
              <div>
                <span className="text-[11px] font-bold text-[#231710] block mb-1">القسم المستهدف</span>
                <select
                  value={bulkCategoryId}
                  onChange={(e) => setBulkCategoryId(e.target.value)}
                  className="bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-2 text-xs font-bold"
                >
                  <option value="all">جميع الأقسام ({products.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#231710] block mb-1">تعديل</span>
                <select
                  value={bulkTargetField}
                  onChange={(e) => setBulkTargetField(e.target.value as 'price' | 'cost')}
                  className="bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-2 text-xs font-bold"
                >
                  <option value="price">سعر البيع</option>
                  <option value="cost">سعر التكلفة</option>
                </select>
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#231710] block mb-1">نوع التعديل</span>
                <select
                  value={bulkMode}
                  onChange={(e) => setBulkMode(e.target.value as 'percent' | 'fixed')}
                  className="bg-white border border-[#E8E0D5] rounded-lg px-2.5 py-2 text-xs font-bold"
                >
                  <option value="percent">نسبة مئوية (%)</option>
                  <option value="fixed">مبلغ ثابت ({currency})</option>
                </select>
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#231710] block mb-1">القيمة (+/-)</span>
                <input
                  type="number"
                  step="any"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="w-24 bg-white border border-[#9A6836] rounded-lg px-2.5 py-2 text-xs font-bold tabular-nums"
                />
              </div>
              <button
                type="button"
                disabled={bulkApplying}
                onClick={handleApplyBulkPriceUpdate}
                className="min-h-[36px] bg-[#231710] hover:bg-[#3A271C] text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {bulkApplying ? 'جاري التحديث...' : 'تطبيق التعديل الجماعي فوراً'}
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FAF6F0] p-3 rounded-xl border border-[#E8E0D5]">
            <div>
              <p className="text-xs text-[#231710] font-bold">
                تحديث سريع لسعر وتكلفة الكيلو ({weightProducts.length} صنف بالوزن)
              </p>
              <p className="text-[11px] text-[#6B5644]">
                أصناف القطعة والعلب مستثناة تلقائياً لحماية وحداتها من التحويل لأوزان جرامية
              </p>
            </div>
            <input
              type="search"
              value={searchKilo}
              onChange={(e) => setSearchKilo(e.target.value)}
              placeholder="ابحث عن صنف بالوزن لتعديل سعر الكيلو..."
              className="sm:w-64 min-h-[40px] bg-white border border-[#E8E0D5] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#231710]"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E8E0D5]">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF6F0] text-[#231710] border-b border-[#E8E0D5] font-bold">
                  <th className="p-3">الصنف</th>
                  <th className="p-3">تكلفة الكيلو</th>
                  <th className="p-3">سعر بيع الكيلو (1000ج)</th>
                  <th className="p-3">الأوزان الأربعة المتولدة تلقائياً</th>
                  <th className="p-3">إجراء فوري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE2]">
                {filteredKiloProducts.map((prod) => {
                  const kiloPrice =
                    kiloEdits[prod.id]?.pricePerKg ??
                    prod.pricePerKg ??
                    prod.weights.find((w) => w.grams === 1000)?.price ??
                    400;
                  const kiloCost =
                    kiloEdits[prod.id]?.costPerKg ??
                    prod.costPerKg ??
                    Math.round(kiloPrice * 0.68);
                  const previewWeights = generateWeightsFromKiloPrice(kiloPrice);

                  return (
                    <tr key={prod.id} className="hover:bg-[#FAF6F0]/60">
                      <td className="p-3 font-bold text-[#231710]">{prod.name}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={kiloCost}
                          onChange={(e) =>
                            handleKiloFieldChange(
                              prod,
                              'costPerKg',
                              Number(e.target.value)
                            )
                          }
                          className="w-24 bg-[#FAF6F0] border border-[#E8E0D5] rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums"
                        />{' '}
                        ج.م
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={kiloPrice}
                          onChange={(e) =>
                            handleKiloFieldChange(
                              prod,
                              'pricePerKg',
                              Number(e.target.value)
                            )
                          }
                          className="w-24 bg-white border border-[#9A6836] rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums"
                        />{' '}
                        ج.م
                      </td>
                      <td className="p-3 text-[11px] text-[#6B5644] tabular-nums">
                        ثمن: <strong>{previewWeights[0].price}ج</strong> • ربع:{' '}
                        <strong>{previewWeights[1].price}ج</strong> • نصف:{' '}
                        <strong>{previewWeights[2].price}ج</strong> • كيلو:{' '}
                        <strong>{previewWeights[3].price}ج</strong>
                      </td>
                      <td className="p-3">
                        {canMutate ? (
                          <button
                            type="button"
                            onClick={() => handleApplySingleKiloUpdate(prod)}
                            className="min-h-[40px] bg-[#231710] hover:bg-[#3A271C] text-white px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition"
                          >
                            تحديث الـ 4 أوزان
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-[#6B5644] bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#E8E0D5]">
                            عرض محاسبي
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Promo Studio & Profit Margin Safety Calculator */}
      {subTab === 'partner4_promos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleCreateSafePromo}
            className="lg:col-span-7 bg-[#FAF6F0] rounded-2xl p-4 border border-[#E8E0D5] space-y-3"
          >
            <h3 className="font-cairo text-sm font-bold text-[#231710]">
              إضافة عرض ترويجي جديد (مع حماية هامش الربح)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold block mb-1">اسم العرض / الباقة:</label>
                <input
                  type="text"
                  required
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">ملخص مكونات الباقة:</label>
                <input
                  type="text"
                  value={promoBundleSummary}
                  onChange={(e) => setPromoBundleSummary(e.target.value)}
                  className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 tabular-nums">
              <div>
                <label className="text-[11px] font-bold block mb-1">
                  التكلفة الفعلية:
                </label>
                <input
                  type="number"
                  value={promoCostPrice}
                  onChange={(e) => setPromoCostPrice(Number(e.target.value))}
                  className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">سعر البيع الأصلي:</label>
                <input
                  type="number"
                  value={promoOriginalPrice}
                  onChange={(e) => setPromoOriginalPrice(Number(e.target.value))}
                  className="w-full bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">سعر العرض المقترح:</label>
                <input
                  type="number"
                  value={promoProposedPrice}
                  onChange={(e) => setPromoProposedPrice(Number(e.target.value))}
                  className="w-full bg-white border border-[#9A6836] rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
            </div>

            {/* Live Profit Safety Indicator */}
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 tabular-nums ${
                profitSafety.isSafe
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>
                  {profitSafety.isSafe
                    ? 'فحص الأرباح آمن (هامش ≥ 18% — مسموح بنشر العرض)'
                    : 'مرفوض: العرض يكسر الحد الأدنى لهامش الربح (18%)'}
                </span>
                <span>هامش الربح: {profitSafety.profitMarginPercent}%</span>
              </div>
              <div className="text-[11px] font-medium">
                صافي الربح بعد الخصم: <strong>{profitSafety.netProfit} {currency}</strong> • قيمة التوفير
                للعميل: <strong>{profitSafety.discountAmount} {currency}</strong> (
                {profitSafety.discountPercentage}%)
              </div>
              {profitSafety.warning && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-bold">{stripUiEmojis(profitSafety.warning)}</span>
                  {!profitSafety.isSafe && profitSafety.suggestedMinPrice > 0 && (
                    <button
                      type="button"
                      onClick={() => setPromoProposedPrice(profitSafety.suggestedMinPrice)}
                      className="bg-[#D4AF37] hover:bg-[#c5a02d] text-[#231710] px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition shrink-0"
                    >
                      تطبيق السعر المقترح ({profitSafety.suggestedMinPrice} {currency})
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoIsVipOnly}
                  onChange={(e) => setPromoIsVipOnly(e.target.checked)}
                />
                <span>عرض خاص بأعضاء نادي VIP فقط</span>
              </label>

              {canMutate ? (
                <button
                  type="submit"
                  disabled={!profitSafety.isSafe}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    profitSafety.isSafe
                      ? 'bg-[#231710] text-white hover:bg-[#3A271C]'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  + اعتماد ونشر العرض
                </button>
              ) : (
                <span className="text-[11px] font-bold text-[#6B5644] bg-white px-3 py-1.5 rounded-xl border border-[#E8E0D5]">
                  وضع محاكاة الربحية للمحاسب
                </span>
              )}
            </div>
          </form>

          <div className="lg:col-span-5 space-y-2.5">
            <h3 className="font-cairo text-sm font-bold text-[#231710]">
              العروض وحزم التوفير النشطة ({promotions.length})
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {promotions.map((p) => {
                const origPrice = p.originalPrice ?? p.originalRetailPrice;
                const rawCost = p.costPrice ?? p.totalRawCost;
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#231710]">{stripUiEmojis(p.title)}</div>
                      <div className="text-[11px] text-emerald-700 font-bold tabular-nums">
                        سعر العرض: {p.promoPrice} {currency}
                        {typeof origPrice === 'number' && origPrice > 0
                          ? ` • بدلاً من ${origPrice} ${currency}`
                          : ''}
                        {typeof rawCost === 'number' && rawCost > 0
                          ? ` • التكلفة: ${rawCost} ${currency}`
                          : typeof p.profitMarginPercent === 'number'
                            ? ` • الهامش: ${p.profitMarginPercent}%`
                            : ''}
                      </div>
                    </div>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => handleDeletePromo(p.id)}
                        className="text-red-600 p-1 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VIP Club Directory & Direct Link to /pos Terminal */}
      {subTab === 'vip_cashier' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-[#FAF6F0] text-[#231710] rounded-2xl p-5 border border-[#E8E0D5] flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 bg-white text-[#231710] border border-[#E8E0D5] px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                <Scale className="w-3.5 h-3.5 text-[#9A6836]" />
                <span>نظام الكاشير والميزان الموحد</span>
              </span>
              <h3 className="font-cairo text-base sm:text-lg font-bold text-[#231710]">
                شاشة الكاشير والميزان الإلكتروني باللمس
              </h3>
              <p className="text-xs text-[#6B5644] leading-relaxed">
                إدارة عمليات البيع المباشر بالفرع، الوزن بالجرام أو بالجنيه، وإضافة واستبدال رصيد كاش باك محفظة VIP.
              </p>
            </div>

            <a
              href="/pos"
              className="w-full bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-xs py-3 px-4 rounded-xl text-center transition"
            >
              انتقال فوري لشاشة الكاشير والميزان (/pos)
            </a>
          </div>

          <div className="lg:col-span-7 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-cairo text-sm font-bold text-[#231710]">
                أعضاء نادي الولاء VIP المسجلين ({vipMembers.length})
              </h3>
              <div className="text-xs font-bold bg-[#FAF6F0] border border-[#E8E0D5] px-3 py-1 rounded-xl text-[#231710]">
                إجمالي رصيد النقاط المستحق للعملاء:{' '}
                <span className="text-emerald-700">
                  {vipMembers.reduce((s, m) => s + (m.pointsBalance || 0), 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {vipMembers.map((m) => (
                <div
                  key={m.phone}
                  className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-between text-xs tabular-nums"
                >
                  <div>
                    <div className="font-bold text-[#231710]">
                      {m.customerName} ({m.phone})
                    </div>
                    <div className="text-[11px] text-[#6B5644]">
                      إجمالي المشتريات: {m.totalSpent} ج.م • عدد الطلبات: {m.ordersCount}
                    </div>
                  </div>
                  <span className="bg-white text-emerald-700 border border-[#E8E0D5] px-3 py-1 rounded-full font-bold">
                    الرصيد: {m.pointsBalance} ج.م
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 3 Physical Store Printable QR Codes */}
      {subTab === 'qr_codes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-[#6B5644] font-bold">
              لوحات الـ QR الثلاث المعتمدة لوضعها داخل الفرع وعلى عبوات التغليف:
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-[#231710] hover:bg-[#3A271C] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة لوحات الـ QR الثلاث</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: '1. ستاند رخامة الكاشير',
                subtitle: 'امسح الكود وسجّل رقمك في نادي حفصة VIP وابدأ جمع 5% كاش باك فوراً',
                route: '/vip',
                codeLabel: 'HAFSA-QR-VIP-CLUB',
              },
              {
                title: '2. بجوار صوامع البن وركن القهوة',
                subtitle: 'صمّم توليفة قهوتك الخاصة على موبايلك أو اطلب من بار القهوة',
                route: '/coffee-blender',
                codeLabel: 'HAFSA-QR-COFFEE-BAR',
              },
              {
                title: '3. مطبوع على أكياس وبوكسات حفصة',
                subtitle: 'الكود الرسمي المطبوع على الشنط (الصفحة الرئيسية أو /build-box) — اطلب من البيت ليصلك في بني مزار خلال 30 دقيقة',
                route: '/',
                codeLabel: 'HAFSA-QR-BAG-OFFICIAL',
              },
            ].map((qr, i) => (
              <div
                key={i}
                className="bg-[#FAF6F0] text-[#231710] rounded-2xl p-5 border border-[#E8E0D5] text-center space-y-3"
              >
                <span className="text-[11px] font-bold text-[#9A6836] block">
                  {settings?.storeName || 'محمصة حفصة للبن والمكسرات'} • {settings?.cityName || 'بني مزار'}
                </span>
                <h4 className="font-cairo text-sm font-bold text-[#231710]">{qr.title}</h4>
                <div className="bg-white border border-[#E8E0D5] p-4 rounded-2xl w-32 h-32 mx-auto flex flex-col items-center justify-center">
                  <QrCode className="w-16 h-16 text-[#231710]" />
                  <span className="text-[11px] font-mono font-bold text-[#231710] mt-1">
                    {qr.codeLabel}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B5644] leading-relaxed">{qr.subtitle}</p>
                <div className="text-[11px] font-mono text-[#9A6836] break-all" dir="ltr">
                  {`https://hafsahnuts.com${qr.route}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Eng. Wesam's Marketing Pixels & Bani Mazar Logistics */}
      {subTab === 'wesam_marketing' && (
        <form onSubmit={handleSaveWesamSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 tabular-nums">
            <div>
              <label className="text-xs font-extrabold block mb-1">
                معرّف Meta Pixel (فيسبوك وإنستجرام):
              </label>
              <input
                type="text"
                value={metaPixel}
                onChange={(e) => setMetaPixel(e.target.value)}
                placeholder="مثال: 123456789012345"
                className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-mono font-medium outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold block mb-1">
                رمز Meta Conversions API (تتبع السيرفر CAPI):
              </label>
              <input
                type="password"
                value={metaCapiToken}
                onChange={(e) => setMetaCapiToken(e.target.value)}
                placeholder="EAA... (اختياري لرفع دقة تتبع فيسبوك)"
                className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-mono font-medium outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-[#231710]">
                كود اختبار Meta CAPI (اختياري):
              </label>
              <input
                type="text"
                value={metaCapiTestCode}
                onChange={(e) => setMetaCapiTestCode(e.target.value)}
                placeholder="مثال: TEST12345 (اتركه فارغاً وقت الإعلان)"
                className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-mono font-medium outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-[#231710]">
                معرّف بيكسل تيك توك للإعلانات:
              </label>
              <input
                type="text"
                value={tiktokPixel}
                onChange={(e) => setTiktokPixel(e.target.value)}
                className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-mono font-medium outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-[#231710]">
                الحد الأدنى لطلبات الضواحي والقرى (ج.م):
              </label>
              <input
                type="number"
                value={minOrderVillages}
                onChange={(e) => setMinOrderVillages(Number(e.target.value))}
                className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-bold outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-[#231710]">
                رسوم التوصيل السريع داخل المدينة (ج.م):
              </label>
              <input
                type="number"
                value={bandarShipping}
                onChange={(e) => setBandarShipping(Number(e.target.value))}
                className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-bold outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-[#231710]">
                رسوم التوصيل المجدول للضواحي والقرى (ج.م):
              </label>
              <input
                type="number"
                value={villagesShipping}
                onChange={(e) => setVillagesShipping(Number(e.target.value))}
                className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-bold outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-[#231710]">
                حد التوصيل المجاني التلقائي (ج.م):
              </label>
              <input
                type="number"
                value={freeThreshold}
                onChange={(e) => setFreeThreshold(Number(e.target.value))}
                className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-bold outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-[#231710]">
                حد الشحن المجاني لشحن المحافظات (ج.م):
              </label>
              <input
                type="number"
                value={governoratesFreeThreshold}
                onChange={(e) => setGovernoratesFreeThreshold(Number(e.target.value))}
                className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-bold outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-[#3B6E4C] font-bold">
              أحداث التتبع المسجلة في الجلسة الحالية: {pixelEvents.length} حدث
            </span>
            {canMutate && (
              <button
                type="submit"
                className="min-h-[40px] bg-[#231710] hover:bg-[#3a261b] text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                حفظ إعدادات التسويق والتوصيل
              </button>
            )}
          </div>
        </form>
      )}

      {/* TAB ERP MODULES: Multi-Warehouse Transfers, BOM, Modifiers, HR, Delivery Companies, Halls & Blind Close */}
      {subTab === 'erp_modules' && (
        <ErpMasterModulesStudio
          products={products}
          currency={currency}
          canMutate={canMutate}
          enableHallsAndTables={featureFlags.enableHallsAndTables}
          enableBlindShiftClose={featureFlags.enableBlindShiftClose}
          onRefreshStore={refreshStore}
          showToast={showToast}
        />
      )}

      {/* TAB 6: Pre-Launch Operational Reset & Purge (Super Admin Only) */}
      {subTab === 'pre_launch_reset' && (
        <div className="space-y-4">
          {currentRole === 'super_admin' ? (
            <PreLaunchResetSafeguard
              adminToken={adminToken}
              isSuperAdmin={true}
              onResetComplete={refreshStore}
            />
          ) : (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 text-amber-950 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-amber-700 shrink-0" />
              <div>
                <h4 className="text-xs font-bold">أداة مقصورة حصرياً على المدير العام فقط</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  تصفير العمليات التجريبية والورديات قبل الافتتاح الرسمي يتطلب صلاحية المدير العام لتأمين بيانات الفرع.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
