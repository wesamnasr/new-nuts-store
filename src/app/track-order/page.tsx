'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Package,
  Flame,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { Order, OrderStatus } from '@/types/store';
import { useStore } from '@/context/StoreContext';
import { getResolvedPageContent, getSafeImageUrl } from '@/lib/defaults';

const STATUS_STEPS: { key: OrderStatus; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    key: 'pending',
    label: 'تم استلام الطلب',
    desc: 'تم تسجيل طلبك في النظام وبانتظار المراجعة',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    key: 'confirmed',
    label: 'تم تأكيد الطلب',
    desc: 'تمت مراجعة وتأكيد بيانات التوصيل',
    icon: <Package className="w-4 h-4" />,
  },
  {
    key: 'roasting_packing',
    label: 'جاري التحميص والتغليف الطازج',
    desc: 'نحمص مكسراتك الآن ونغلفها حرارياً لحفظ القرمشة',
    icon: <Flame className="w-4 h-4" />,
  },
  {
    key: 'shipped',
    label: 'خرج للتوصيل مع المندوب',
    desc: 'طلبك في الطريق إليك الآن',
    icon: <Truck className="w-4 h-4" />,
  },
  {
    key: 'delivered',
    label: 'تم التسليم بنجاح',
    desc: 'بالهناء والشفاء! نسعد دائماً بخدمتك',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
];

function TrackOrderContent() {
  const { storeData, addToCart, addCustomBoxToCart, setIsCartOpen, showToast } = useStore();
  const pageContent = getResolvedPageContent(storeData?.settings);
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentOrderNumbers, setRecentOrderNumbers] = useState<string[]>([]);

  const performSearch = async (searchVal: string) => {
    if (!searchVal.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?q=${encodeURIComponent(searchVal.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearched(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('oasis_recent_orders');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentOrderNumbers(parsed);
          if (!initialQ && parsed.length > 0) {
            setQuery(parsed[0]);
            performSearch(parsed[0]);
          }
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [initialQ]);

  useEffect(() => {
    if (initialQ) {
      performSearch(initialQ);
    }
  }, [initialQ]);

  const handleReorder = (order: Order) => {
    const products = storeData?.products || [];
    let addedCount = 0;

    order.items.forEach((item) => {
      if (item.isCustomMix && item.customBreakdown && item.customBreakdown.length > 0) {
        const cap =
          item.boxCapacityGrams === 500 ||
          item.boxCapacityGrams === 1000 ||
          item.boxCapacityGrams === 2000
            ? item.boxCapacityGrams
            : 1000;
        for (let i = 0; i < item.quantity; i++) {
          addCustomBoxToCart(cap, item.customBreakdown, item.unitPrice);
        }
        addedCount += item.quantity;
      } else {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          const weightVariant =
            prod.weights.find((w) => w.id === item.weightId) ||
            prod.weights.find((w) => w.label === item.weightLabel) ||
            prod.weights[0];
          if (weightVariant) {
            addToCart(prod, weightVariant, item.roastOption, item.quantity);
            addedCount += item.quantity;
          }
        }
      }
    });

    if (addedCount > 0) {
      showToast('تمت إعادة الطلب للسلة بنجاح 🥜', `تمت إضافة أصناف الطلب ${order.orderNumber} إلى سلتك`);
      setIsCartOpen(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const getStepIndex = (status: OrderStatus) => {
    return STATUS_STEPS.findIndex((s) => s.key === status);
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-5 py-7 space-y-5">
      <div className="text-center space-y-1.5">
        <span className="text-[11px] font-extrabold bg-amber-100 text-brand-900 px-3 py-0.5 rounded-full">
          {pageContent.trackOrderPageBadge}
        </span>
        <h1 className="text-xl sm:text-2xl font-black text-brand-950">
          {pageContent.trackOrderPageTitle}
        </h1>
        <p className="text-xs text-brand-700 max-w-md mx-auto">
          {pageContent.trackOrderPageDesc}
        </p>
      </div>

      {/* Search Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-2.5 rounded-2xl border border-brand-200 shadow-sm flex flex-col sm:flex-row gap-2 max-w-xl mx-auto"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-brand-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="اكتب رقم الطلب (NUT-1001) أو رقم الهاتف (01012345678)..."
            className="w-full bg-brand-50 border border-brand-200 rounded-xl pr-10 pl-3 py-2.5 text-xs font-bold focus:outline-none focus:border-brand-700"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-900 hover:bg-brand-950 text-white font-extrabold px-6 py-2.5 rounded-xl transition text-xs cursor-pointer"
        >
          {loading ? 'جاري البحث...' : 'تتبع الآن'}
        </button>
      </form>

      {/* Zero-Login Recent Orders from This Device */}
      {recentOrderNumbers.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 max-w-xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold text-brand-900">
            📦 طلباتي الأخيرة من هذا الجهاز:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recentOrderNumbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setQuery(num);
                  performSearch(num);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-black border transition cursor-pointer ${
                  query === num
                    ? 'bg-brand-900 text-gold-400 border-brand-900 shadow-2xs'
                    : 'bg-white text-brand-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Demo Buttons for Client Presentation */}
      <div className="text-center text-[11px] text-brand-600">
        <span>للتجربة السريعة اضغط على: </span>
        <button
          type="button"
          onClick={() => {
            setQuery('NUT-1001');
            performSearch('NUT-1001');
          }}
          className="underline font-bold text-brand-900 mx-1 cursor-pointer"
        >
          NUT-1001
        </button>
        <span>أو</span>
        <button
          type="button"
          onClick={() => {
            setQuery('01012345678');
            performSearch('01012345678');
          }}
          className="underline font-bold text-brand-900 mx-1 cursor-pointer"
        >
          01012345678
        </button>
      </div>

      {/* Results */}
      {searched && orders.length === 0 && (
        <div className="bg-white p-6 rounded-2xl border border-brand-200 text-center space-y-1.5">
          <div className="text-3xl">🔍</div>
          <h3 className="text-sm sm:text-base font-extrabold text-brand-950">
            لم يتم العثور على طلب بهذا الرقم
          </h3>
          <p className="text-xs text-brand-600">
            تأكد من كتابة رقم الطلب بشكل صحيح (مثل NUT-1001) أو رقم الموبايل المسجل في الطلب.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {orders.map((order) => {
          const currentStepIdx = getStepIndex(order.status);

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-brand-200 shadow-sm overflow-hidden"
            >
              {/* Header */}
              <div className="bg-brand-950 text-white p-3.5 sm:p-5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-brand-200 block">رقم الطلب</span>
                    <div className="text-base sm:text-lg font-black text-gold-400 font-mono">
                      {order.orderNumber}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] sm:text-[11px] text-brand-200 block">العميل والمحافظة</span>
                    <span className="text-xs font-bold">
                      {order.customerName} • {order.governorate}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2.5 sm:pt-0 border-t border-white/10 sm:border-0">
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-brand-200 block">الإجمالي</span>
                    <span className="text-sm font-black text-gold-400">
                      {order.total} ج.م
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReorder(order)}
                    className="bg-gold-500 hover:bg-gold-400 text-brand-950 font-black text-[11px] px-3 py-2 rounded-xl shadow flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>إعادة طلب نفس السلة</span>
                  </button>
                </div>
              </div>

              {/* Status Timeline */}
              <div className="p-4 sm:p-5">
                {order.status === 'cancelled' ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                    <XCircle className="w-5 h-5 shrink-0" />
                    <span>تم إلغاء هذا الطلب. للاستفسار يرجى التواصل مع خدمة العملاء.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {STATUS_STEPS.map((step, index) => {
                      const isDone = index <= currentStepIdx;
                      const isCurrent = index === currentStepIdx;
                      return (
                        <div
                          key={step.key}
                          className={`p-2.5 rounded-xl border transition flex sm:flex-col items-center sm:text-center gap-2 ${
                            isCurrent
                              ? 'bg-amber-50 border-brand-800 ring-1 ring-gold-400/50'
                              : isDone
                              ? 'bg-pistachio-50/70 border-pistachio-200'
                              : 'bg-gray-50 border-gray-200 opacity-60'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                              isCurrent
                                ? 'bg-brand-900 text-gold-400'
                                : isDone
                                ? 'bg-pistachio-600 text-white'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {step.icon}
                          </div>
                          <div>
                            <div className="text-[11px] font-extrabold text-brand-950">
                              {step.label}
                            </div>
                            {isCurrent && (
                              <div className="text-[10px] text-brand-600 mt-0.5 leading-snug">
                                {step.desc}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Order Items */}
                <div className="mt-4 pt-4 border-t border-brand-100">
                  <h4 className="text-xs font-extrabold text-brand-900 mb-2.5 flex items-center justify-between">
                    <span>الأصناف داخل الطلب:</span>
                    <span className="text-[11px] text-brand-600 font-normal">
                      {order.items.length} أصناف
                    </span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {order.items.map((item) => {
                      if (item.isCustomMix && item.customBreakdown && item.customBreakdown.length > 0) {
                        return (
                          <div
                            key={item.cartItemId}
                            className="sm:col-span-2 bg-gradient-to-br from-brand-50 to-amber-50/50 p-3 rounded-xl border border-amber-200/80 shadow-xs space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="relative shrink-0">
                                  <img
                                    src={getSafeImageUrl(item.productImage)}
                                    alt={item.productName}
                                    className="w-11 h-11 rounded-lg object-cover border border-amber-200 bg-white"
                                  />
                                  <span className="absolute -top-1 -right-1 bg-gold-500 text-brand-950 text-[8px] font-black px-1 py-0.5 rounded-full shadow-xs">
                                    مخصص
                                  </span>
                                </div>
                                <div>
                                  <div className="flex flex-wrap items-center gap-1">
                                    <h5 className="font-black text-xs text-brand-950">
                                      {item.productName}
                                    </h5>
                                    <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-full font-bold">
                                      كوّن علبتك
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-brand-700 font-medium mt-0.5 flex items-center gap-1.5">
                                    <span>
                                      سعة {item.boxCapacityGrams ? (item.boxCapacityGrams >= 1000 ? `${item.boxCapacityGrams / 1000} كجم` : `${item.boxCapacityGrams} جم`) : item.weightLabel}
                                    </span>
                                    <span>•</span>
                                    <span>الكمية: {item.quantity} علبة</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-left font-black text-brand-950 text-xs shrink-0">
                                {item.unitPrice * item.quantity} ج.م
                              </div>
                            </div>

                            {/* Constituent Breakdown Recipe */}
                            <div className="bg-white/90 rounded-lg p-2.5 border border-amber-100 space-y-1">
                              <div className="text-[10px] font-extrabold text-brand-900 flex items-center justify-between border-b border-brand-100 pb-1">
                                <span className="flex items-center gap-1 text-brand-950">
                                  <span>🥜</span>
                                  <span>مكونات الخلطة المحمصة ({item.customBreakdown.length} أصناف):</span>
                                </span>
                                <span className="text-brand-600 font-semibold text-[9px]">
                                  نسبة الامتلاء 100%
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                                {item.customBreakdown.map((part, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className="flex items-center justify-between text-[11px] bg-brand-50/70 px-2 py-1 rounded-md border border-brand-100/70"
                                  >
                                    <span className="font-bold text-brand-950 flex items-center gap-1 truncate">
                                      <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                                      <span className="truncate">{part.productName}</span>
                                      <span className="text-[9px] text-brand-600 font-normal shrink-0">
                                        ({part.roastOption})
                                      </span>
                                    </span>
                                    <span className="shrink-0 font-extrabold text-brand-900 font-mono text-[10px]">
                                      {part.percentage}%{' '}
                                      <span className="text-brand-600 font-normal text-[9px]">
                                        ({part.weightGrams}جم)
                                      </span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={item.cartItemId}
                          className="flex items-center justify-between gap-2.5 bg-brand-50 p-2.5 rounded-xl border border-brand-100"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={getSafeImageUrl(item.productImage)}
                              alt={item.productName}
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                            <div className="text-xs min-w-0">
                              <div className="font-extrabold text-brand-950 truncate">
                                {item.productName}
                              </div>
                              <div className="text-[11px] text-brand-700">
                                {item.weightLabel} • {item.roastOption} × {item.quantity}
                              </div>
                            </div>
                          </div>
                          <span className="font-extrabold text-brand-950 text-xs shrink-0">
                            {item.unitPrice * item.quantity} ج.م
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-bold text-xs">جاري التحميل...</div>}>
      <TrackOrderContent />
    </Suspense>
  );
}
