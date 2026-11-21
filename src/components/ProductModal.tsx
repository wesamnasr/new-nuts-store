'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Zap,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { RoastOption, WeightVariant } from '@/types/store';
import { getCurrencySymbol, getSafeImageUrl } from '@/lib/defaults';
import { formatWhatsAppPhone } from '@/lib/validation';
import { getResolvedProductWeights, isUnitProduct } from '@/lib/pricing';
import ProductAutoSlideshow from '@/modules/catalog/ProductAutoSlideshow';

export default function ProductModal() {
  const { selectedProductModal, setSelectedProductModal, addToCart, storeData } =
    useStore();
  const currency = getCurrencySymbol(storeData?.settings);

  const [selectedWeight, setSelectedWeight] = useState<WeightVariant | null>(
    null
  );
  const [selectedRoast, setSelectedRoast] = useState<RoastOption>('');
  const [quantity, setQuantity] = useState(1);

  const resolvedWeights = useMemo(
    () =>
      selectedProductModal
        ? getResolvedProductWeights(selectedProductModal)
        : [],
    [selectedProductModal]
  );

  const modalImages = useMemo(() => {
    if (!selectedProductModal) return [];
    const primary = getSafeImageUrl(selectedProductModal.image);
    const extras = (selectedProductModal.gallery || [])
      .filter((img) => Boolean(img && img.trim()))
      .map((img) => getSafeImageUrl(img));
    return [primary, ...extras.filter((u) => u !== primary)];
  }, [selectedProductModal]);

  useEffect(() => {
    if (selectedProductModal && resolvedWeights.length > 0) {
      const unitMode = isUnitProduct(selectedProductModal);
      const params =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null;
      const qvW = params?.get('qvWeight');
      const qvR = params?.get('qvRoast');
      const matchedW =
        (qvW &&
          resolvedWeights.find(
            (w) => w.id === qvW || String(w.weightGrams) === qvW
          )) ||
        (unitMode
          ? resolvedWeights[0]
          : resolvedWeights.find((w) => (w.grams || w.weightGrams) === 250) ||
            resolvedWeights[1] ||
            resolvedWeights[0]) ||
        null;
      const matchedR =
        (qvR && selectedProductModal.roastOptions?.find((r) => r === qvR)) ||
        selectedProductModal.roastOptions?.[0] ||
        '';
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

  useEffect(() => {
    if (!selectedProductModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedProductModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProductModal, setSelectedProductModal]);

  if (!selectedProductModal || !selectedWeight) return null;

  const product = selectedProductModal;
  const unitMode = isUnitProduct(product);
  const whatsappNumber = formatWhatsAppPhone(storeData?.settings.whatsappNumber);

  const discountPercent =
    selectedWeight.originalPrice &&
    selectedWeight.originalPrice > selectedWeight.price
      ? Math.round(
          ((selectedWeight.originalPrice - selectedWeight.price) /
            selectedWeight.originalPrice) *
            100
        )
      : null;

  const handleAddToCart = () => {
    addToCart(product, selectedWeight, selectedRoast, quantity);
    setSelectedProductModal(null);
  };

  const whatsappInquiryUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `مرحباً، أود الاستفسار عن منتج: ${product.name} (${selectedWeight.label}${
      selectedRoast ? ` - ${selectedRoast}` : ''
    })`
  )}`;

  const directOrderUrl = `/product/${
    product.slug || product.id
  }?weight=${encodeURIComponent(selectedWeight.id)}&roast=${encodeURIComponent(
    selectedRoast
  )}#direct-order-box`;

  return (
    <div
      onClick={() => setSelectedProductModal(null)}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#1A110B]/50 backdrop-blur-xs overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="storefront-modal-enter bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E8DFD3] my-auto relative p-4 sm:p-6"
      >
        <button
          type="button"
          onClick={() => setSelectedProductModal(null)}
          className="absolute top-3 left-3 z-30 bg-white hover:bg-[#FAF7F2] text-[#261A13] p-2 rounded-xl border border-[#E8DFD3] shadow-xs transition cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Auto-Slideshow Image Column */}
          <div className="md:col-span-5">
            <ProductAutoSlideshow
              images={modalImages}
              productName={product.name}
              discountPercent={discountPercent}
              badgeText={product.badge}
              originText={product.origin}
            />
          </div>

          {/* Details Column */}
          <div className="md:col-span-7 flex flex-col justify-between gap-4 pt-1">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2 text-xs text-[#6E5D4F] pl-8">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#9A6836]" />
                  <span>{product.origin}</span>
                </span>
                {product.reviewsCount > 0 && (
                  <span className="flex items-center gap-1 tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-[#D99B26] text-[#D99B26]" />
                    <span>
                      {product.rating} ({product.reviewsCount})
                    </span>
                  </span>
                )}
              </div>

              <h2 className="font-cairo text-lg sm:text-xl font-extrabold text-[#261A13] leading-snug">
                {product.name}
              </h2>

              <p className="text-xs text-[#5E4D40] leading-relaxed">
                {product.description}
              </p>

              {/* Weight / Unit selection — All variants preserved */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#261A13] block">
                  {unitMode ? 'اختر العبوة / الوحدة:' : 'اختر الوزن / الكمية:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {resolvedWeights.map((w) => {
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
                            ? 'bg-[#2C1D14] text-[#FAF7F2] border-[#2C1D14]'
                            : 'bg-[#FAF7F2] text-[#261A13] border-[#E8DFD3] hover:border-[#C88A4B]'
                        }`}
                      >
                        <div className="text-[11px] font-bold">{w.label}</div>
                        <div
                          className={`text-xs font-bold mt-0.5 ${
                            active ? 'text-[#E5B869]' : 'text-[#9A6836]'
                          }`}
                        >
                          {w.price} {currency}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Roast / Option selection */}
              {product.roastOptions && product.roastOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#261A13] block">
                    {unitMode ? 'الخيار / النوع:' : 'درجة التحميص / النكهة:'}
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
                              ? 'bg-[#2C1D14] text-[#FAF7F2] border-[#2C1D14] font-bold'
                              : 'bg-[#FAF7F2] text-[#5E4D40] border-[#E8DFD3] hover:border-[#C88A4B]'
                          }`}
                        >
                          {roast}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {product.reviews && product.reviews.length > 0 && (
                <div className="pt-2 border-t border-[#F0EAE0] space-y-1.5">
                  <h4 className="text-xs font-bold text-[#261A13]">
                    تقييمات المشترين:
                  </h4>
                  <div className="space-y-1.5">
                    {product.reviews.slice(0, 1).map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-[#FAF7F2] p-2.5 rounded-xl border border-[#E8DFD3] text-xs"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-[#261A13] flex items-center gap-1">
                            {rev.customerName}
                            {rev.verified && (
                              <CheckCircle2 className="w-3 h-3 text-[#3B6E4C]" />
                            )}
                          </span>
                          <span className="text-[11px] text-[#8A7968]">
                            {rev.date}
                          </span>
                        </div>
                        <p className="text-[#5E4D40]">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-3 border-t border-[#E8DFD3] space-y-2.5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center border border-[#E8DFD3] rounded-xl bg-[#FAF7F2]">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2 text-[#261A13] hover:bg-white rounded-r-xl transition cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 text-xs font-bold text-[#261A13] tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-2 text-[#261A13] hover:bg-white rounded-l-xl transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 bg-[#2C1D14] hover:bg-[#3D291D] text-[#FAF7F2] py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer tabular-nums"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span>
                    أضف للسلة • {selectedWeight.price * quantity} {currency}
                  </span>
                </button>
              </div>

              <Link
                href={directOrderUrl}
                onClick={() => setSelectedProductModal(null)}
                className="w-full min-h-[40px] py-2 px-3 rounded-xl border border-[#EBD8B8] bg-[#FBF3E4] hover:bg-[#F3E3C6] text-[#8C5828] font-cairo font-extrabold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Zap className="w-3.5 h-3.5 fill-[#D99B26] text-[#9A6836]" />
                <span>افتح صفحة المنتج للطلب المباشر والسلايد شو</span>
              </Link>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E5D4F]">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#3B6E4C] shrink-0" />
                  <span>تغليف محكم يحفظ النكهة</span>
                </span>
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[#261A13] hover:text-[#3B6E4C] font-medium transition"
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
