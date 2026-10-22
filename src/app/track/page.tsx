'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Package,
  Flame,
  Truck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Crown,
  Gift,
  Coffee,
  MapPin,
} from 'lucide-react';
import { Order, OrderStatus } from '@/types/store';
import { useStore } from '@/context/StoreContext';
import { updateUrlQueryParams, useBrowserUrlSync } from '@/lib/url-sync';

const STATUS_STEPS: { key: OrderStatus; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    key: 'pending',
    label: 'تم استلام الطلب',
    desc: 'وصل طلبك لشاشة فرع بني مزار (أمام مسجد الزراعيين)',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    key: 'roasting_packing',
    label: 'جاري التحميص والتجهيز',
    desc: 'فريق محمصة حفصة يجهز طلبك طازجاً الآن ويطبع ستيكر البارستا',
    icon: <Flame className="w-4 h-4" />,
  },
  {
    key: 'shipped',
    label: 'خرج للتوصيل',
    desc: 'طلبك في الطريق إليك الآن مع مندوب المحمصة',
    icon: <Truck className="w-4 h-4" />,
  },
  {
    key: 'delivered',
    label: 'تم التسليم بنجاح 🎉',
    desc: 'بالهناء والشفاء! تمت إضافة نقاط الكاش باك لمحفظة حفصة VIP',
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

  const performSearch = async (searchVal: string, pushUrl = true) => { if (pushUrl && searchVal.trim()) updateUrlQueryParams({ q: searchVal.trim() });
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

  useBrowserUrlSync((params) => { const qParam = params.get('q'); if (qParam && qParam !== query) { setQuery(qParam); performSearch(qParam, false); } });
  const getStepIndex = (status: OrderStatus) => {
    if (status === 'pending' || status === 'confirmed') return 0;
    if (status === 'roasting_packing') return 1;
    if (status === 'shipped') return 2;
    if (status === 'delivered') return 3;
    return 0;
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#231710] py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[#231710] text-[#FAF6F0] rounded-3xl p-6 sm:p-8 border-2 border-[#D4AF37] shadow-xl space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-black text-[#D4AF37] block">
              📦 تتبع الطلبات
            </span>
            <h1 className="font-cairo text-2xl sm:text-3xl font-black text-white">
              تتبع حالة طلبك
            </h1>
            <p className="hidden">
              أدخل رقم الطلب (مثال: NUT-1024) أو رقم الموبايل (مثال: 01012345678) لمعرفة مرحلة تجهيز وتوصيل طلبك
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
                className="w-full bg-white text-[#231710] rounded-2xl py-3 pr-10 pl-4 text-xs sm:text-sm font-bold focus:outline-none"
              />
              <Search className="w-4 h-4 text-[#6E5D4F] absolute right-3.5 top-3.5" />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#D4AF37] hover:bg-[#C88A4B] text-[#231710] font-cairo font-black text-xs sm:text-sm px-6 py-3 rounded-2xl shadow transition cursor-pointer shrink-0"
            >
              {loading ? 'جاري البحث...' : 'تتبع الآن'}
            </button>
          </form>

          {recentOrderNumbers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-[#D4AF37] font-bold">طلباتك الأخيرة على هذا الجهاز:</span>
              {recentOrderNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setQuery(num);
                    performSearch(num);
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white border border-[#D4AF37]/40 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer"
                >
                  {num}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {searched && orders.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-[#E6DFD3] space-y-2">
            <Package className="w-10 h-10 text-[#C88A4B] mx-auto" />
            <h2 className="font-cairo text-base font-black text-[#231710]">
              لم يتم العثور على طلب مطابق لـ &quot;{query}&quot;
            </h2>
            <p className="text-xs text-[#6E5D4F]">
              تأكد من كتابة رقم الطلب أو رقم الموبايل المكون من 11 رقماً بشكل صحيح (أو جرب الرقم التجريبي 01012345678).
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {orders.map((order) => {
              const currentStepIdx = getStepIndex(order.status);
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-[#D4AF37]/60 shadow-md space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6DFD3] pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-cairo text-lg font-black text-[#231710] font-mono">
                          #{order.orderNumber}
                        </span>
                        <span className="bg-[#3B6E4C]/15 text-[#3B6E4C] text-xs font-black px-3 py-0.5 rounded-full">
                          {STATUS_STEPS[currentStepIdx]?.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#6E5D4F] mt-1">
                        العميل: <strong>{order.customerName}</strong> • {order.governorate} —{' '}
                        {order.address}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleReorder(order)}
                      className="bg-[#231710] hover:bg-[#3A2519] text-[#D4AF37] font-cairo font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition"
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
                          className={`p-3.5 rounded-2xl border-2 transition ${
                            isCurrent
                              ? 'bg-[#231710] text-[#FAF6F0] border-[#D4AF37] shadow-md'
                              : isCompleted
                                ? 'bg-[#3B6E4C]/10 text-[#231710] border-[#3B6E4C]/40'
                                : 'bg-[#FAF6F0] text-[#6E5D4F] border-[#E6DFD3] opacity-65'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-cairo text-xs font-black">
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isCurrent
                                  ? 'bg-[#D4AF37] text-[#231710]'
                                  : isCompleted
                                    ? 'bg-[#3B6E4C] text-white'
                                    : 'bg-[#E6DFD3] text-[#6E5D4F]'
                              }`}
                            >
                              {step.icon}
                            </span>
                            <span>{step.label}</span>
                          </div>
                          <p
                            className="hidden"
                            data-active={isCurrent ? '1' : '0'}
                            data-step="desc"
                          >
                            {step.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Order Items Summary */}
                  <div className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E6DFD3] space-y-2">
                    <div className="text-xs font-black text-[#231710]">
                      محتويات الطلب ({order.items.length} أصناف):
                    </div>
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs border-b border-[#E6DFD3]/70 last:border-0 pb-1.5 last:pb-0"
                      >
                        <div>
                          <span className="font-extrabold text-[#231710]">
                            {item.productName} ({item.weightLabel}) × {item.quantity}
                          </span>
                          {item.isPartitionedBox && item.partitionedSlots && (
                            <span className="block text-[10.5px] text-[#C88A4B] font-bold">
                              🎁 الخانات: {item.partitionedSlots.map((s) => s.productName).join(' + ')}
                            </span>
                          )}
                          {item.isCoffeeBlend && item.coffeeBlendSpec && (
                            <span className="block text-[10.5px] text-[#3B6E4C] font-bold">
                              ☕ البارستا: {item.coffeeBlendSpec.baristaLabel}
                            </span>
                          )}
                        </div>
                        <span className="font-black text-[#231710] tabular-nums">
                          {item.unitPrice * item.quantity} ج.م
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-[#E6DFD3] flex items-center justify-between font-cairo font-black text-sm text-[#231710] tabular-nums">
                      <span>الإجمالي النهائي شامل التوصيل:</span>
                      <span className="text-[#3B6E4C]">{order.total} ج.م</span>
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
          <p className="font-cairo text-sm font-black text-[#231710]">
            جاري تحميل صفحة تتبع الطلبات...
          </p>
        </div>
      }
    >
      <TrackContent />
    </Suspense>
  );
}
