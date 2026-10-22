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
} from '@/lib/pricing';
import { FlashPromotion, Product } from '@/types/store';
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
}

export default function HafsaOperationsStudio({
  adminToken,
  onUpdateStorePayload,
}: HafsaOperationsStudioProps) {
  const { storeData, refreshStore, showToast, pixelEvents } = useStore();

  const [subTab, setSubTab] = useState<
    'kilo_updater' | 'partner4_promos' | 'vip_cashier' | 'qr_codes' | 'wesam_marketing'
  >('kilo_updater');

  useBrowserUrlSync((params) => {
    const st = params.get('subtab');
    if (
      st &&
      ['kilo_updater', 'partner4_promos', 'vip_cashier', 'qr_codes', 'wesam_marketing'].includes(st)
    ) {
      setSubTab(
        st as 'kilo_updater' | 'partner4_promos' | 'vip_cashier' | 'qr_codes' | 'wesam_marketing'
      );
    } else if (!st) {
      setSubTab('kilo_updater');
    }
  });

  const products = storeData?.products || [];
  const promotions = storeData?.promotions || [];
  const vipMembers = storeData?.vipMembers || [];
  const settings = storeData?.settings;

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
      showToast('🔔 تم تشغيل جرس تنبيه الطلبات الصوتية بنجاح');
    } catch {
      showToast('🔔 تنبيه طلب جديد في فرع بني مزار!');
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
      `⚡ تم تحديث سعر كيلو "${prod.name}" وتوليد الـ 4 أوزان (ثمن/ربع/نصف/كيلو) تلقائياً!`
    );
  };

  // 3. 4th Partner Promo Studio State + Profit Margin Safety Calculator
  const [promoTitle, setPromoTitle] = useState('عرض السهرة العائلية — بني مزار');
  const [promoSubtitle, setPromoSubtitle] = useState(
    'بوكس العيلة 6 خانات + ربع كيلو بن وسط محوج مخصوص'
  );
  const [promoBundleSummary, setPromoBundleSummary] = useState(
    'بوكس العيلة (250ج) + ربع بن حفصة الملكي (145ج)'
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
        15
      ),
    [promoOriginalPrice, promoCostPrice, promoProposedPrice]
  );

  const handleCreateSafePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profitSafety.isSafe) {
      showToast('⚠️ لا يمكن نشر العرض لأن هامش الربح أقل من الحد الآمن', profitSafety.warning);
      return;
    }

    const newPromo: FlashPromotion = {
      id: `promo-${Date.now()}`,
      title: promoTitle.trim(),
      subtitle: promoSubtitle.trim(),
      badgeText: `وفّر ${profitSafety.discountAmount} ج.م 🔥`,
      originalPrice: promoOriginalPrice,
      promoPrice: promoProposedPrice,
      costPrice: promoCostPrice,
      endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      active: true,
      isVipOnly: promoIsVipOnly,
      bundleItemsSummary: promoBundleSummary.trim(),
      image: '/images/products/royal-mix.jpg',
    };

    await onUpdateStorePayload(
      { promotions: [newPromo, ...promotions] },
      '🎉 تم اعتماد ونشر عرض الشريك الرابع بعد اجتياز فحص هامش الربح الآمن!'
    );
  };

  const handleDeletePromo = async (promoId: string) => {
    const updated = promotions.filter((p) => p.id !== promoId);
    await onUpdateStorePayload({ promotions: updated }, 'تم حذف العرض الترويجي');
  };

  // 4. Eng. Wesam's Marketing & Bani Mazar Logistics Settings
  const [metaPixel, setMetaPixel] = useState(settings?.metaPixelId || 'HAFSA-META-PIXEL-BM01');
  const [tiktokPixel, setTiktokPixel] = useState(
    settings?.tiktokPixelId || 'HAFSA-TIKTOK-PIXEL-BM01'
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

  const handleSaveWesamSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    await onUpdateStorePayload(
      {
        settings: {
          ...settings,
          metaPixelId: metaPixel.trim(),
          tiktokPixelId: tiktokPixel.trim(),
          minOrderVillages: Number(minOrderVillages) || 200,
          bandarShippingCost: Number(bandarShipping) || 20,
          villagesShippingCost: Number(villagesShipping) || 25,
          freeShippingThreshold: Number(freeThreshold) || 300,
        },
      },
      '✅ تم حفظ إعدادات بيكسل الإعلانات ولوجستيات توصيل بني مزار بنجاح!'
    );
  };

  const filteredKiloProducts = useMemo(() => {
    if (!searchKilo.trim()) return products.slice(0, 12);
    const q = searchKilo.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.subCategory || '').toLowerCase().includes(q)
    );
  }, [products, searchKilo]);

  return (
    <div className="bg-white rounded-2xl border-2 border-[#D4AF37] p-4 sm:p-5 shadow-md space-y-5 mb-6">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E6DFD3] pb-4">
        <div>
          <span className="text-[10.5px] font-black text-[#C88A4B] uppercase tracking-wider block">
            ★ أدوات التشغيل الذكية • محمصة حفصة ★
          </span>
          <h2 className="font-cairo text-lg sm:text-xl font-black text-[#231710]">
            الأوزان الأربعة • حاسبة العروض • نادي VIP • رموز الـ QR
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <a
            href="/pos"
            className="bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>⚖️ شاشة الكاشير (POS)</span>
          </a>
          <button
            type="button"
            onClick={playOrderChime}
            className="bg-[#231710] hover:bg-[#3A2519] text-[#D4AF37] border border-[#D4AF37] px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>🔔 اختبار جرس التنبيه</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-[#F3ECE1] p-1.5 rounded-xl border border-[#E6DFD3]">
        {[
          {
            id: 'kilo_updater',
            label: '⚖️ أسعار الكيلو والـ 4 أوزان',
          },
          {
            id: 'partner4_promos',
            label: '🔥 حاسبة العروض والأرباح',
          },
          {
            id: 'vip_cashier',
            label: '👑 أعضاء نادي VIP',
          },
          {
            id: 'qr_codes',
            label: '📱 رموز الـ QR',
          },
          {
            id: 'wesam_marketing',
            label: '📈 التسويق والتوصيل',
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
            className={`px-3 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
              subTab === tab.id
                ? 'bg-[#231710] text-[#D4AF37] shadow-xs font-black'
                : 'text-[#6E5D4F] hover:text-[#231710]'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* TAB 1: 1-Click Kilo Price & 4-Weights Updater */}
      {subTab === 'kilo_updater' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FAF6F0] p-3 rounded-xl border border-[#E6DFD3]">
            <p className="text-xs text-[#231710] font-bold">تحديث سريع لسعر وتكلفة الكيلو</p>
            <p className="hidden">
              💡 عدّل <strong>سعر بيع الكيلو</strong> أو <strong>تكلفة الكيلو (شيت أ. عرفات)</strong>{' '}
              واضغط حفظ ليقوم النظام تلقائياً بتحديث أسعار (ثمن 125ج • ربع 250ج • نصف 500ج • كيلو 1000ج).
            </p>
            <input
              type="search"
              value={searchKilo}
              onChange={(e) => setSearchKilo(e.target.value)}
              placeholder="ابحث عن صنف لتعديل سعر الكيلو..."
              className="sm:w-64 bg-white border border-[#E6DFD3] rounded-lg px-3 py-1.5 text-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-[#231710] text-[#D4AF37]">
                  <th className="p-2.5 rounded-r-lg">الصنف</th>
                  <th className="p-2.5">تكلفة الكيلو (أ. عرفات)</th>
                  <th className="p-2.5">سعر بيع الكيلو (1000ج)</th>
                  <th className="p-2.5">الأوزان الأربعة المتولدة تلقائياً</th>
                  <th className="p-2.5 rounded-l-lg">إجراء فوري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DFD3]">
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
                    <tr key={prod.id} className="hover:bg-[#FAF6F0]">
                      <td className="p-2.5 font-extrabold text-[#231710]">{prod.name}</td>
                      <td className="p-2.5">
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
                          className="w-24 bg-[#FAF6F0] border border-[#E6DFD3] rounded-lg px-2 py-1 text-xs font-bold tabular-nums"
                        />{' '}
                        ج.م
                      </td>
                      <td className="p-2.5">
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
                          className="w-24 bg-white border-2 border-[#C88A4B] rounded-lg px-2 py-1 text-xs font-black tabular-nums"
                        />{' '}
                        ج.م
                      </td>
                      <td className="p-2.5 text-[11px] text-[#6E5D4F] tabular-nums">
                        ثمن: <strong>{previewWeights[0].price}ج</strong> • ربع:{' '}
                        <strong>{previewWeights[1].price}ج</strong> • نصف:{' '}
                        <strong>{previewWeights[2].price}ج</strong> • كيلو:{' '}
                        <strong>{previewWeights[3].price}ج</strong>
                      </td>
                      <td className="p-2.5">
                        <button
                          type="button"
                          onClick={() => handleApplySingleKiloUpdate(prod)}
                          className="bg-[#3B6E4C] hover:opacity-90 text-white px-3 py-1.5 rounded-lg text-[11px] font-black cursor-pointer"
                        >
                          ⚡ تحديث الـ 4 أوزان
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: 4th Partner Promo Studio & Profit Margin Safety Calculator */}
      {subTab === 'partner4_promos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleCreateSafePromo}
            className="lg:col-span-7 bg-[#FAF6F0] rounded-2xl p-4 border border-[#E6DFD3] space-y-3"
          >
            <h3 className="font-cairo text-sm font-black text-[#231710]">
              إضافة عرض ترويجي جديد (بإشراف الشريك الرابع وحماية هامش الربح)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold block mb-1">اسم العرض / الباقة:</label>
                <input
                  type="text"
                  required
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  className="w-full bg-white border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">ملخص مكونات الباقة:</label>
                <input
                  type="text"
                  value={promoBundleSummary}
                  onChange={(e) => setPromoBundleSummary(e.target.value)}
                  className="w-full bg-white border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 tabular-nums">
              <div>
                <label className="text-[11px] font-bold block mb-1">
                  التكلفة الفعلية (شيت أ. عرفات):
                </label>
                <input
                  type="number"
                  value={promoCostPrice}
                  onChange={(e) => setPromoCostPrice(Number(e.target.value))}
                  className="w-full bg-white border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-black"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">سعر البيع الأصلي:</label>
                <input
                  type="number"
                  value={promoOriginalPrice}
                  onChange={(e) => setPromoOriginalPrice(Number(e.target.value))}
                  className="w-full bg-white border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-black"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold block mb-1">سعر العرض المقترح:</label>
                <input
                  type="number"
                  value={promoProposedPrice}
                  onChange={(e) => setPromoProposedPrice(Number(e.target.value))}
                  className="w-full bg-white border-2 border-[#C88A4B] rounded-xl px-3 py-2 text-xs font-black"
                />
              </div>
            </div>

            {/* Live Profit Safety Indicator */}
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 tabular-nums ${
                profitSafety.isSafe
                  ? 'bg-[#3B6E4C]/10 border-[#3B6E4C] text-[#231710]'
                  : 'bg-[#B83B2B]/15 border-[#B83B2B] text-[#B83B2B]'
              }`}
            >
              <div className="flex items-center justify-between font-black">
                <span>
                  {profitSafety.isSafe
                    ? '✅ فحص الأرباح آمن (مسموح بنشر العرض)'
                    : '⛔ مرفوض: العرض يسبب خسارة أو يكسر الحد الأدنى للربح (15%)'}
                </span>
                <span>هامش الربح: {profitSafety.profitMarginPercent}%</span>
              </div>
              <div className="text-[11px] font-bold">
                صافي الربح بعد الخصم: <strong>{profitSafety.netProfit} ج.م</strong> • قيمة التوفير
                للعميل: <strong>{profitSafety.discountAmount} ج.م</strong> (
                {profitSafety.discountPercentage}%)
              </div>
              {profitSafety.warning && (
                <div className="text-[11px] font-extrabold">{profitSafety.warning}</div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoIsVipOnly}
                  onChange={(e) => setPromoIsVipOnly(e.target.checked)}
                />
                <span>👑 عرض سري خاص بأعضاء نادي حفصة VIP فقط</span>
              </label>

              <button
                type="submit"
                disabled={!profitSafety.isSafe}
                className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer ${
                  profitSafety.isSafe
                    ? 'bg-[#231710] text-[#D4AF37]'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                + اعتماد ونشر العرض
              </button>
            </div>
          </form>

          <div className="lg:col-span-5 space-y-2.5">
            <h3 className="font-cairo text-sm font-black text-[#231710]">
              العروض وحزم التوفير النشطة ({promotions.length})
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E6DFD3] flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-black text-[#231710]">{p.title}</div>
                    <div className="text-[11px] text-[#3B6E4C] font-bold tabular-nums">
                      سعر العرض: {p.promoPrice} ج.م (بدلاً من {p.originalPrice} ج.م • التكلفة:{' '}
                      {p.costPrice} ج.م)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePromo(p.id)}
                    className="text-[#B83B2B] p-1 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VIP Club Directory & Direct Link to /pos Terminal */}
      {subTab === 'vip_cashier' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-gradient-to-br from-[#231710] to-[#3A2519] text-[#FAF6F0] rounded-2xl p-5 border-2 border-[#D4AF37] flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 bg-[#D4AF37] text-[#231710] px-2.5 py-0.5 rounded-full text-[10.5px] font-black">
                <Scale className="w-3.5 h-3.5" />
                <span>نظام الكاشير والميزان الموحد</span>
              </span>
              <h3 className="font-cairo text-base sm:text-lg font-black text-white">
                شاشة الكاشير والميزان الإلكتروني باللمس (POS)
              </h3>
              <p className="hidden">
                تم توحيد جميع عمليات البيع المباشر، الوزن بالجرام أو بالجنيه، قراءة باركود الميزان،
                وخصم وإضافة كاش باك محفظة VIP (5%) وتقفيل الورديات داخل شاشة الكاشير المخصصة.
              </p>
            </div>

            <a
              href="/pos"
              className="w-full bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] font-cairo font-black text-xs py-3 px-4 rounded-xl text-center shadow transition"
            >
              ⚖️ انتقال فوري لشاشة الكاشير والميزان (/pos) ←
            </a>
          </div>

          <div className="lg:col-span-7 space-y-2">
            <h3 className="font-cairo text-sm font-black text-[#231710]">
              أعضاء نادي حفصة VIP المسجلين ({vipMembers.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {vipMembers.map((m) => (
                <div
                  key={m.phone}
                  className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E6DFD3] flex items-center justify-between text-xs tabular-nums"
                >
                  <div>
                    <div className="font-black text-[#231710]">
                      {m.customerName} ({m.phone})
                    </div>
                    <div className="text-[10.5px] text-[#6E5D4F]">
                      إجمالي المشتريات: {m.totalSpent} ج.م • عدد الطلبات: {m.ordersCount}
                    </div>
                  </div>
                  <span className="bg-[#3B6E4C] text-white px-3 py-1 rounded-full font-black">
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
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#6E5D4F] font-bold">
              لوحات الـ QR الثلاث المعتمدة لوضعها داخل فرع بني مزار (أمام مسجد الزراعيين) وعلى الأكياس:
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-[#231710] text-[#D4AF37] px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة لوحات الـ QR الثلاث</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: '1. ستاند رخامة الكاشير',
                subtitle: 'امسح الكود وسجّل رقمك في نادي حفصة VIP وابدأ جمع 5% كاش باك فوراً!',
                route: '/vip',
                codeLabel: 'HAFSA-QR-VIP-CLUB',
              },
              {
                title: '2. بجوار صوامع البن الأربعة',
                subtitle: 'صمّم توليفة قهوتك الخاصة بالجرام والتحويجة على موبايلك واحفظها!',
                route: '/coffee-blender',
                codeLabel: 'HAFSA-QR-COFFEE-STUDIO',
              },
              {
                title: '3. مطبوع على أكياس وبوكسات التغليف',
                subtitle: 'اطلب بوكس السهرة والـ 125 جنيه القادم بضغطة واحدة ليصلك لباب البيت!',
                route: '/build-box',
                codeLabel: 'HAFSA-QR-BOX-125',
              },
            ].map((qr, i) => (
              <div
                key={i}
                className="bg-[#231710] text-[#FAF6F0] rounded-2xl p-5 border-2 border-[#D4AF37] text-center space-y-3"
              >
                <span className="text-[10px] font-black text-[#D4AF37] block">
                  محمصة حفصة للبن والمكسرات • بني مزار
                </span>
                <h4 className="font-cairo text-sm font-black text-white">{qr.title}</h4>
                <div className="bg-white p-4 rounded-2xl w-28 h-28 mx-auto flex flex-col items-center justify-center">
                  <QrCode className="w-16 h-16 text-[#231710]" />
                  <span className="text-[8px] font-mono font-black text-[#231710] mt-1">
                    {qr.codeLabel}
                  </span>
                </div>
                <p className="text-[11px] text-[#F3ECE1]/85 leading-relaxed">{qr.subtitle}</p>
                <div className="text-[10px] font-mono text-[#D4AF37]">
                  الرابط: {qr.route}
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
                معرّف Meta Pixel (فيسبوك وإنستجرام - م. وسام):
              </label>
              <input
                type="text"
                value={metaPixel}
                onChange={(e) => setMetaPixel(e.target.value)}
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold block mb-1">
                معرّف TikTok Pixel (إعلانات تيك توك بني مزار):
              </label>
              <input
                type="text"
                value={tiktokPixel}
                onChange={(e) => setTiktokPixel(e.target.value)}
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold block mb-1">
                الحد الأدنى لطلبات قرى مركز بني مزار (ج.م):
              </label>
              <input
                type="number"
                value={minOrderVillages}
                onChange={(e) => setMinOrderVillages(Number(e.target.value))}
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-black"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold block mb-1">
                توصيل بندر بني مزار السريع (ج.م):
              </label>
              <input
                type="number"
                value={bandarShipping}
                onChange={(e) => setBandarShipping(Number(e.target.value))}
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-black"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold block mb-1">
                توصيل قرى مركز بني مزار المجدول (ج.م):
              </label>
              <input
                type="number"
                value={villagesShipping}
                onChange={(e) => setVillagesShipping(Number(e.target.value))}
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-black"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold block mb-1">
                حد التوصيل المجاني داخل بني مزار (ج.م):
              </label>
              <input
                type="number"
                value={freeThreshold}
                onChange={(e) => setFreeThreshold(Number(e.target.value))}
                className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-black"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[#3B6E4C] font-bold">
              📊 أحداث البيكسل المسجلة في الجلسة الحالية: {pixelEvents.length} حدث (AddToCart /
              CustomizeProduct / Purchase)
            </span>
            <button
              type="submit"
              className="bg-[#231710] text-[#D4AF37] px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer"
            >
              حفظ إعدادات التسويق والتوصيل
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
