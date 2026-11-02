'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { updateUrlQueryParams, useBrowserUrlSync } from '@/lib/url-sync';
import {
  X,
  Star,
  ShieldCheck,
  MapPin,
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  MessageCircle,
  ArrowUpLeft,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { RoastOption, WeightVariant } from '@/types/store';
import { getSafeImageUrl } from '@/lib/defaults';
import { formatWhatsAppPhone } from '@/lib/validation';
import { getResolvedProductWeights } from '@/lib/pricing';

export default function ProductModal() {
  const { selectedProductModal, setSelectedProductModal, addToCart, storeData } = useStore();

  const [selectedWeight, setSelectedWeight] = useState<WeightVariant | null>(null);
  const [selectedRoast, setSelectedRoast] = useState<RoastOption>('محمص مملح');
  const [quantity, setQuantity] = useState(1);

  const resolvedWeights = React.useMemo(
    () => (selectedProductModal ? getResolvedProductWeights(selectedProductModal) : []),
    [selectedProductModal]
  );

  useEffect(() => {
    if (selectedProductModal && resolvedWeights.length > 0) {
      const params =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null;
      const qvW = params?.get('qvWeight');
      const qvR = params?.get('qvRoast');
      const matchedW =
        (qvW && resolvedWeights.find((w) => w.id === qvW || String(w.weightGrams) === qvW)) ||
        resolvedWeights[1] ||
        resolvedWeights[0] ||
        null;
      const matchedR =
        (qvR && selectedProductModal.roastOptions.find((r) => r === qvR)) ||
        selectedProductModal.roastOptions[0] ||
        'محمص مملح';
      setSelectedWeight(matchedW);
      setSelectedRoast(matchedR);
      setQuantity(1);
    }
  }, [selectedProductModal, resolvedWeights]);

  useBrowserUrlSync((params) => {
    if (!selectedProductModal || resolvedWeights.length === 0) return;
    const qvW = params.get('qvWeight');
    const qvR = params.get('qvRoast');
    if (qvW) {
      const matchedW = resolvedWeights.find(
        (w) => w.id === qvW || String(w.weightGrams) === qvW
      );
      if (matchedW) setSelectedWeight(matchedW);
    }
    if (qvR) {
      const matchedR = selectedProductModal.roastOptions.find((r) => r === qvR);
      if (matchedR) setSelectedRoast(matchedR);
    }
  });

  if (!selectedProductModal || !selectedWeight) return null;

  const product = selectedProductModal;
  const whatsappNumber = formatWhatsAppPhone(storeData?.settings.whatsappNumber);

  const handleAddToCart = () => {
    addToCart(product, selectedWeight, selectedRoast, quantity);
    setSelectedProductModal(null);
  };

  const whatsappInquiryUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `مرحباً، أود الاستفسار عن منتج: ${product.name} (${selectedWeight.label} - ${selectedRoast})`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto md:overflow-hidden shadow-xl border border-[#E8E0D5] my-auto relative">
        {/* Close button */}
        <button
          type="button"
          onClick={() => setSelectedProductModal(null)}
          className="sticky md:absolute top-3 left-3 float-left md:float-none z-20 m-2 md:m-0 bg-white hover:bg-[#FAF6F0] text-[#231710] p-2 rounded-xl border border-[#E8E0D5] transition cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 clear-both">
          {/* Image Column */}
          <div className="relative bg-[#FAF6F0] h-52 sm:h-60 md:h-auto md:min-h-[340px]">
            <img
              src={getSafeImageUrl(product.image)}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details Column */}
          <div className="p-5 flex flex-col justify-between md:max-h-[82vh] md:overflow-y-auto gap-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-xs text-[#6E5D4F]">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#9A6836]" />
                  <span>{product.origin}</span>
                </span>
                {product.reviewsCount > 0 && (
                  <span className="flex items-center gap-1 tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                    <span>{product.rating} ({product.reviewsCount})</span>
                  </span>
                )}
              </div>

              <div className="flex items-start justify-between gap-2">
                <h2 className="font-cairo text-lg font-bold text-[#231710] leading-snug">
                  {product.name}
                </h2>
                <Link
                  href={`/product/${product.slug || product.id}?weight=${encodeURIComponent(
                    selectedWeight.id
                  )}&roast=${encodeURIComponent(selectedRoast)}`}
                  onClick={() => setSelectedProductModal(null)}
                  className="text-xs font-bold text-[#5C4A3D] hover:text-[#231710] bg-[#FAF6F0] border border-[#E8E0D5] px-2.5 py-1 rounded-lg transition shrink-0 inline-flex items-center gap-1"
                >
                  <span>التفاصيل</span>
                  <ArrowUpLeft className="w-3 h-3" />
                </Link>
              </div>

              <p className="text-xs text-[#5C4A3D] leading-relaxed">
                {product.description}
              </p>

              {/* Weight selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#231710] block">
                  اختر الوزن:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {resolvedWeights.slice(0, 4).map((w) => {
                    const active = selectedWeight.id === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setSelectedWeight(w);
                          updateUrlQueryParams({ qvWeight: w.id });
                        }}
                        className={`p-2 rounded-xl border text-center transition cursor-pointer tabular-nums ${
                          active
                            ? 'bg-[#231710] text-[#FAF6F0] border-[#231710]'
                            : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:border-[#231710]/30'
                        }`}
                      >
                        <div className="text-[11px] font-bold">{w.label}</div>
                        <div
                          className={`text-xs font-bold mt-0.5 ${
                            active ? 'text-[#E8E0D5]' : 'text-[#6E5D4F]'
                          }`}
                        >
                          {w.price} ج.م
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Roast selection (Primary home for roast customization on quick view) */}
              {product.roastOptions && product.roastOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#231710] block">
                    درجة التحميص / النكهة:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {product.roastOptions.map((roast) => {
                      const active = selectedRoast === roast;
                      return (
                        <button
                          key={roast}
                          type="button"
                          onClick={() => {
                            setSelectedRoast(roast);
                            updateUrlQueryParams({ qvRoast: roast });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                            active
                              ? 'bg-[#231710] text-[#FAF6F0] border-[#231710] font-bold'
                              : 'bg-white text-[#5C4A3D] border-[#E8E0D5] hover:bg-[#FAF6F0]'
                          }`}
                        >
                          {roast}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Verified Customer Reviews Preview (if any exist) */}
              {product.reviews && product.reviews.length > 0 && (
                <div className="pt-2 border-t border-[#F0EAE0] space-y-1.5">
                  <h4 className="text-xs font-bold text-[#231710]">
                    تقييمات المشترين:
                  </h4>
                  <div className="space-y-1.5">
                    {product.reviews.slice(0, 2).map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-[#FAF6F0] p-2.5 rounded-xl border border-[#E8E0D5] text-xs"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-[#231710] flex items-center gap-1">
                            {rev.customerName}
                            {rev.verified && (
                              <CheckCircle2 className="w-3 h-3 text-[#3B6E4C]" />
                            )}
                          </span>
                          <span className="text-[11px] text-[#8A7968]">{rev.date}</span>
                        </div>
                        <p className="text-[#5C4A3D]">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-3 border-t border-[#E8E0D5] space-y-2.5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center border border-[#E8E0D5] rounded-xl bg-[#FAF6F0]">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2 text-[#231710] hover:bg-white rounded-r-xl transition cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 text-xs font-bold text-[#231710] tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-2 text-[#231710] hover:bg-white rounded-l-xl transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer tabular-nums"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span>أضف للسلة • {selectedWeight.price * quantity} ج.م</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E5D4F]">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#3B6E4C] shrink-0" />
                  <span>تغليف محكم يحفظ النكهة</span>
                </span>
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[#231710] hover:text-[#3B6E4C] font-medium transition"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#3B6E4C] shrink-0" />
                  <span>استفسار واتساب</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
