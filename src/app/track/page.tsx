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
  RotateCcw,
} from 'lucide-react';
import { Order, OrderStatus } from '@/types/store';
import { useStore } from '@/context/StoreContext';
import { updateUrlQueryParams, useBrowserUrlSync } from '@/lib/url-sync';

const STATUS_STEPS: { key: OrderStatus; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    key: 'pending',
    label: 'تم استلام الطلب',
    desc: 'وصل طلبك لشاشة التجهيز في فرع بني مزار',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    key: 'roasting_packing',
    label: 'جاري التحميص والتجهيز',
    desc: 'يتم تجهيز وتغليف أصناف طلبك طازجة الآن',
    icon: <Flame className="w-4 h-4" />,
  },
  {
    key: 'shipped',
    label: 'خرج للتوصيل',
    desc: 'الطلب في الطريق إليك مع مندوب المحمصة',
    icon: <Truck className="w-4 h-4" />,
  },
  {
    key: 'delivered',
    label: 'تم التسليم بنجاح',
    desc: 'تم تسليم الطلب وإضافة نقاط الكاش باك لمحفظتك',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
];

function TrackContent() {
  const {
    storeData,
    addToCart,
    addPartitionedBoxToCart,
    addCoffeeBlendToCart,
    addCustomBoxToCart,
    setIsCartOpen,
  } = useStore();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentOrderNumbers, setRecentOrderNumbers] = useState<string[]>([]);

  const performSearch = async (searchVal: string, pushUrl = true) => {
    if (pushUrl && searchVal.trim()) updateUrlQueryParams({ q: searchVal.trim() });
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
      // Ignore storage error
    }
  }, [initialQ]);

  useEffect(() => {
    if (initialQ) {
      performSearch(initialQ);
    }
  }, [initialQ]);

  const handleReorder = (order: Order) => {
    const products = storeData?.products || [];
    order.items.forEach((item) => {
      if (item.isPartitionedBox && item.partitionedBoxSize && item.partitionedSlots) {
        addPartitionedBoxToCart(
          item.partitionedBoxSize,
          item.partitionedSlots,
          item.unitPrice,
          item.quantity
        );
      } else if (item.isCoffeeBlend && item.coffeeBlendSpec) {
        addCoffeeBlendToCart(item.coffeeBlendSpec, item.unitPrice, item.quantity);
      } else if (item.isCustomMix && item.customBreakdown) {
        addCustomBoxToCart(
          (item.boxCapacityGrams as 500 | 1000 | 2000) || 1000,
          item.customBreakdown,
          item.unitPrice
        );
      } else {
        const prod = products.find((p) => p.id === item.productId);
        const w = prod?.weights.find((x) => x.id === item.weightId) || prod?.weights[0];
        if (prod && w) {
          addToCart(prod, w, item.roastOption, item.quantity, item.workerNotes);
        }
      }
    });
    setIsCartOpen(true);
  };

  useBrowserUrlSync((params) => {
    const qParam = params.get('q');
    if (qParam && qParam !== query) {
      setQuery(qParam);
      performSearch(qParam, false);
    }
  });

  const getStepIndex = (status: OrderStatus) => {
    if (status === 'pending' || status === 'confirmed') return 0;
    if (status === 'roasting_packing') return 1;
    if (status === 'shipped') return 2;
    if (status === 'delivered') return 3;
    return 0;
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] pb-16">
      {/* Calm Light Page Header */}
      <div className="bg-white border-b border-[#E8E0D5] py-8 sm:py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-5">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#9A6836] block">
              متابعة الطلبات
            </span>
            <h1 className="font-cairo text-2xl sm:text-3xl font-bold text-[#231710]">
              تتبع حالة طلبك
            </h1>
            <p className="text-xs sm:text-sm text-[#5C4A3D]">
              أدخل رقم الطلب أو رقم الموبايل المسجل لمعرفة مرحلة التجهيز والتوصيل.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              performSearch(query);
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="رقم الطلب أو رقم الموبايل..."
                className="w-full bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] focus:bg-white text-[#231710] rounded-xl py-3 pr-10 pl-4 text-xs sm:text-sm font-medium focus:outline-none transition"
              />
              <Search className="w-4 h-4 text-[#8A7968] absolute right-3.5 top-3.5" />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition cursor-pointer shrink-0"
            >
              {loading ? 'جاري البحث...' : 'بحث وتتبع'}
            </button>
          </form>

          {recentOrderNumbers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#6E5D4F] font-medium">طلباتك الأخيرة:</span>
              {recentOrderNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setQuery(num);
                    performSearch(num);
                  }}
                  className="bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition"
                >
                  {num}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-8">
        {searched && orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-[#E8E0D5] space-y-2">
            <Package className="w-8 h-8 text-[#8A7968] mx-auto" />
            <h2 className="font-cairo text-base font-bold text-[#231710]">
              لم يتم العثور على طلب مطابق لـ &quot;{query}&quot;
            </h2>
            <p className="text-xs text-[#6E5D4F]">
              تأكد من كتابة رقم الطلب أو رقم الموبايل المكون من 11 رقماً بشكل صحيح.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {orders.map((order) => {
              const currentStepIdx = getStepIndex(order.status);
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-6 border border-[#E8E0D5] space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EAE0] pb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-cairo text-lg font-bold text-[#231710] font-mono">
                          #{order.orderNumber}
                        </span>
                        <span className="bg-[#EEF5F0] text-[#3B6E4C] text-xs font-bold px-3 py-0.5 rounded-lg">
                          {STATUS_STEPS[currentStepIdx]?.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#5C4A3D] mt-1">
                        العميل: <strong>{order.customerName}</strong> • {order.governorate} —{' '}
                        {order.address}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleReorder(order)}
                      className="bg-[#FAF6F0] hover:bg-[#F4EFE6] text-[#231710] border border-[#E8E0D5] font-cairo font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة طلب نفس السلة</span>
                    </button>
                  </div>

                  {/* 4-Step Visual Progress Tracker */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {STATUS_STEPS.map((step, idx) => {
                      const isCompleted = idx <= currentStepIdx;
                      const isCurrent = idx === currentStepIdx;
                      return (
                        <div
                          key={step.key}
                          className={`p-3.5 rounded-xl border transition ${
                            isCurrent
                              ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                              : isCompleted
                                ? 'bg-[#EEF5F0] text-[#231710] border-[#D4E8DA]'
                                : 'bg-[#FAF6F0] text-[#8A7968] border-[#E8E0D5]'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-cairo text-xs font-bold">
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isCurrent
                                  ? 'bg-white/15 text-white'
                                  : isCompleted
                                    ? 'bg-[#3B6E4C] text-white'
                                    : 'bg-white text-[#8A7968] border border-[#E8E0D5]'
                              }`}
                            >
                              {step.icon}
                            </span>
                            <span>{step.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Order Items Summary */}
                  <div className="bg-[#FAF6F0] rounded-xl p-4 border border-[#E8E0D5] space-y-2.5">
                    <div className="text-xs font-bold text-[#231710]">
                      محتويات الطلب ({order.items.length} أصناف):
                    </div>
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs border-b border-[#E8E0D5]/70 last:border-0 pb-2 last:pb-0"
                      >
                        <div>
                          <span className="font-bold text-[#231710]">
                            {item.productName} ({item.weightLabel}) × {item.quantity}
                          </span>
                          {item.isPartitionedBox && item.partitionedSlots && (
                            <span className="block text-[11px] text-[#5C4A3D] mt-0.5">
                              الأقسام: {item.partitionedSlots.map((s) => s.productName).join(' + ')}
                            </span>
                          )}
                          {item.isCoffeeBlend && item.coffeeBlendSpec && (
                            <span className="block text-[11px] text-[#5C4A3D] mt-0.5">
                              التوليفة: {item.coffeeBlendSpec.baristaLabel}
                            </span>
                          )}
                          {item.isCustomMix && item.customBreakdown && item.customBreakdown.length > 0 && (
                            <span className="block text-[11px] text-[#5C4A3D] mt-0.5">
                              المكونات: {item.customBreakdown
                                .map((b) => `${b.productName} (${b.roastOption} - ${b.percentage}% - ${b.weightGrams}جم)`)
                                .join(' + ')}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-[#231710] tabular-nums">
                          {item.unitPrice * item.quantity} ج.م
                        </span>
                      </div>
                    ))}
                    <div className="pt-2.5 border-t border-[#E8E0D5] flex items-center justify-between font-cairo font-bold text-sm text-[#231710] tabular-nums">
                      <span>الإجمالي النهائي شامل التوصيل</span>
                      <span>{order.total} ج.م</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center bg-[#FAF6F0]">
          <p className="font-cairo text-sm font-bold text-[#5C4A3D]">
            جاري تحميل صفحة تتبع الطلبات...
          </p>
        </div>
      }
    >
      <TrackContent />
    </Suspense>
  );
}
