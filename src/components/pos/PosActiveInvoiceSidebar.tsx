'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown,
  Printer,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  PlayCircle,
  Tag,
  ShoppingBag,
  X,
  Zap,
  CreditCard,
  GripVertical,
} from 'lucide-react';
import {
  CartItem,
  PaymentMethod,
  PosOrderType,
  VipMember,
} from '@/types/store';
import { StickerPreviewData } from '@/components/SupermarketReceiptModal';

export interface HeldPosInvoice {
  id: string;
  label: string;
  createdAt: string;
  items: CartItem[];
  posOrderType: PosOrderType;
  chairNumber: 1 | 2 | 3 | 4;
  customerPhone: string;
  customerName: string;
  deliveryAddress: string;
  invoiceNotes: string;
  cashierDiscount: number;
}

interface PosActiveInvoiceSidebarProps {
  posItems: CartItem[];
  setPosItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  posOrderType: PosOrderType;
  setPosOrderType: (type: PosOrderType) => void;
  chairNumber: 1 | 2 | 3 | 4;
  setChairNumber: (chair: 1 | 2 | 3 | 4) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  deliveryAddress: string;
  setDeliveryAddress: (addr: string) => void;
  invoiceNotes: string;
  setInvoiceNotes: (notes: string) => void;
  cashierDiscount: number;
  setCashierDiscount: (disc: number) => void;
  useVipWallet: boolean;
  setUseVipWallet: (use: boolean) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (pm: PaymentMethod) => void;
  paymentReference: string;
  setPaymentReference: (ref: string) => void;
  cashTenderedInput: number | '';
  setCashTenderedInput: (val: number | '') => void;
  matchedVipMember: VipMember | null;
  posSubtotal: number;
  posShipping: number;
  vipWalletRedeemable: number;
  posNetTotal: number;
  posRawCostTotal: number;
  posNetProfit: number;
  posProfitMargin: number;
  posVipCashbackEarned: number;
  changeDue: number;
  canSeeProfits: boolean;
  posLoading: boolean;
  onCompleteInvoice: () => void;
  onPrintItemSticker: (sticker: StickerPreviewData) => void;
  heldInvoices: HeldPosInvoice[];
  onHoldCurrentInvoice: () => void;
  onRestoreHeldInvoice: (id: string) => void;
  onDeleteHeldInvoice: (id: string) => void;
  cartWidth?: number;
  onChangeCartWidth?: (newWidth: number) => void;
}

export const MIN_POS_CART_WIDTH = 240;
export const MAX_POS_CART_WIDTH = 480;
export const DEFAULT_POS_CART_WIDTH = 290;

export default function PosActiveInvoiceSidebar({
  posItems,
  setPosItems,
  posOrderType,
  setPosOrderType,
  chairNumber,
  setChairNumber,
  customerPhone,
  setCustomerPhone,
  customerName,
  setCustomerName,
  deliveryAddress,
  setDeliveryAddress,
  invoiceNotes,
  setInvoiceNotes,
  cashierDiscount,
  setCashierDiscount,
  useVipWallet,
  setUseVipWallet,
  paymentMethod,
  setPaymentMethod,
  paymentReference,
  setPaymentReference,
  cashTenderedInput,
  setCashTenderedInput,
  matchedVipMember,
  posSubtotal,
  posShipping,
  vipWalletRedeemable,
  posNetTotal,
  posVipCashbackEarned,
  changeDue,
  posLoading,
  onCompleteInvoice,
  onPrintItemSticker,
  heldInvoices,
  onHoldCurrentInvoice,
  onRestoreHeldInvoice,
  onDeleteHeldInvoice,
  cartWidth = DEFAULT_POS_CART_WIDTH,
  onChangeCartWidth,
}: PosActiveInvoiceSidebarProps) {
  const [showHeldList, setShowHeldList] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [isDraggingResize, setIsDraggingResize] = useState(false);

  const totalItemsQty = posItems.reduce((sum, i) => sum + i.quantity, 0);

  const clampWidth = useCallback((w: number) => {
    return Math.min(MAX_POS_CART_WIDTH, Math.max(MIN_POS_CART_WIDTH, Math.round(w)));
  }, []);

  // Mouse drag resize handler (Cart is on the LEFT in RTL, so dragging right increases width = clientX - leftEdge)
  useEffect(() => {
    if (!isDraggingResize || !onChangeCartWidth) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Since cart is anchored at left: 12px, new width is e.clientX - 12
      const nextWidth = clampWidth(e.clientX - 12);
      onChangeCartWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingResize(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingResize, onChangeCartWidth, clampWidth]);

  const handlePrintCartItemSticker = (item: CartItem) => {
    onPrintItemSticker({
      title: item.productName,
      weightLabel: item.weightLabel,
      roastOrSpec: item.roastOption || '',
      price: item.unitPrice * item.quantity,
      barcode: item.barcodeLabel || `200001002507`,
      date: new Date().toLocaleDateString('ar-EG'),
    });
  };

  return (
    <>
      {/* ================================================================= */}
      {/* FIXED-POSITION COMPACT CART SIDEBAR WITH RESIZABLE WIDTH          */}
      {/* ================================================================= */}
      <aside
        style={{ width: `${cartWidth}px`, maxWidth: '100%' }}
        className="w-full lg:fixed lg:left-3 lg:top-3 lg:bottom-3 lg:z-30 bg-white rounded-2xl p-3 border-2 border-[#D4AF37] shadow-xl flex flex-col justify-between select-none transition-[box-shadow]"
      >
        {/* Drag-to-Resize Handle on Right Edge (Desktop) */}
        {onChangeCartWidth && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingResize(true);
            }}
            title="اسحب بالماوس لتغيير عرض السلة"
            className={`hidden lg:flex items-center justify-center absolute -right-2.5 top-1/2 -translate-y-1/2 w-4 h-16 rounded-full border cursor-ew-resize z-40 transition ${
              isDraggingResize
                ? 'bg-[#D4AF37] text-[#231710] border-[#231710] scale-110'
                : 'bg-[#231710] text-[#D4AF37] border-[#D4AF37] hover:scale-105'
            }`}
          >
            <GripVertical className="w-3 h-3" />
          </div>
        )}

        {/* Top Header (Compact Font) */}
        <div className="border-b border-[#E6DFD3] pb-2 shrink-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#231710] text-[#D4AF37] flex items-center justify-center font-black text-xs shrink-0">
                🧾
              </div>
              <div className="min-w-0">
                <h2 className="font-cairo font-black text-xs text-[#231710] truncate">
                  السلة ({posItems.length})
                </h2>
                <span className="text-[10px] font-bold text-[#6E5D4F] tabular-nums block">
                  {totalItemsQty} وحدة
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {posItems.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={onHoldCurrentInvoice}
                    title="تعليق الفاتورة مؤقتاً"
                    className="bg-[#FAF6F0] hover:bg-[#D4AF37]/25 text-[#231710] border border-[#E6DFD3] px-2 py-1 rounded-lg text-[10px] font-cairo font-black flex items-center gap-1 cursor-pointer"
                  >
                    <PauseCircle className="w-3 h-3 text-[#C88A4B]" />
                    <span>تعليق</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosItems([])}
                    title="مسح السلة"
                    className="bg-red-50 hover:bg-red-100 text-[#B83B2B] p-1 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {heldInvoices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHeldList(!showHeldList)}
                  className="bg-[#231710] text-[#D4AF37] px-2 py-1 rounded-lg text-[10px] font-cairo font-black flex items-center gap-0.5 cursor-pointer"
                >
                  <PlayCircle className="w-3 h-3" />
                  <span>{heldInvoices.length}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Held Invoices List (if opened) */}
        {showHeldList && heldInvoices.length > 0 && (
          <div className="bg-[#231710] text-white rounded-xl p-2.5 my-1.5 space-y-1.5 shrink-0">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-cairo font-black text-[#D4AF37]">
                فواتير معلقة ({heldInvoices.length})
              </span>
              <button
                type="button"
                onClick={() => setShowHeldList(false)}
                className="text-[10px] text-white/70 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {heldInvoices.map((held) => {
                const heldTotal = held.items.reduce(
                  (s, i) => s + i.unitPrice * i.quantity,
                  0
                );
                return (
                  <div
                    key={held.id}
                    className="bg-white/10 rounded-lg p-1.5 flex items-center justify-between text-[10.5px]"
                  >
                    <div className="truncate">
                      <span className="font-bold block truncate">{held.label}</span>
                      <span className="text-[9.5px] text-[#D4AF37] tabular-nums">
                        {held.items.length} أصناف • {heldTotal} ج.م
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreHeldInvoice(held.id);
                          setShowHeldList(false);
                        }}
                        className="bg-[#D4AF37] text-[#231710] px-2 py-0.5 rounded text-[10px] font-black cursor-pointer"
                      >
                        استرجاع
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteHeldInvoice(held.id)}
                        className="text-red-300 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Middle: Scrollable Cart Items List (Compact Font) */}
        <div className="flex-1 overflow-y-auto my-2 space-y-1.5 pr-0.5">
          {posItems.length === 0 ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-4 bg-[#FAF6F0]/60 rounded-xl border border-dashed border-[#E6DFD3]">
              <ShoppingBag className="w-7 h-7 text-[#C88A4B]/50 mb-1.5" />
              <p className="font-cairo font-black text-xs text-[#231710]">
                السلة فارغة
              </p>
              <p className="text-[10.5px] font-bold text-[#6E5D4F] mt-0.5">
                اضغط على أي صنف لإضافته
              </p>
            </div>
          ) : (
            posItems.map((item, idx) => (
              <div
                key={item.cartItemId || `pos-item-${idx}-${item.productId || 'p'}`}
                className="bg-[#FAF6F0] rounded-xl p-2 border border-[#E6DFD3] space-y-1"
              >
                {/* Row 1: Item Name + Delete */}
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="font-cairo font-black text-[11px] text-[#231710] leading-tight truncate">
                      {item.productName}
                    </div>
                    <div className="text-[9.5px] font-bold text-[#6E5D4F] truncate">
                      {item.weightLabel}
                      {item.roastOption ? ` • ${item.roastOption}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPosItems((prev) =>
                        prev.filter((i) => i.cartItemId !== item.cartItemId)
                      )
                    }
                    className="p-0.5 rounded text-[#B83B2B] hover:bg-red-50 cursor-pointer shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Row 2: Qty Controls + Sticker + Total Price */}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-0.5 bg-white rounded-lg border border-[#E6DFD3] px-1 py-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPosItems((prev) =>
                            prev
                              .map((i) =>
                                i.cartItemId === item.cartItemId
                                  ? { ...i, quantity: i.quantity - 1 }
                                  : i
                              )
                              .filter((i) => i.quantity > 0)
                          )
                        }
                        className="w-5 h-5 rounded hover:bg-[#FAF6F0] flex items-center justify-center text-[#231710] cursor-pointer"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="font-black text-[10.5px] px-1 tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPosItems((prev) =>
                            prev.map((i) =>
                              i.cartItemId === item.cartItemId
                                ? { ...i, quantity: i.quantity + 1 }
                                : i
                            )
                          )
                        }
                        className="w-5 h-5 rounded hover:bg-[#FAF6F0] flex items-center justify-center text-[#231710] cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePrintCartItemSticker(item)}
                      title="طباعة استيكر"
                      className="p-1 rounded-lg bg-white hover:bg-[#D4AF37]/20 text-[#C88A4B] border border-[#E6DFD3] cursor-pointer"
                    >
                      <Tag className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="font-cairo font-black text-xs text-[#3B6E4C] tabular-nums">
                    {item.unitPrice * item.quantity} ج.م
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Footer: Compact Total & Checkout Buttons */}
        <div className="pt-2 border-t border-[#E6DFD3] space-y-1.5 shrink-0">
          <div className="bg-[#231710] text-white rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="font-cairo font-bold text-[11px] text-[#D4AF37]">
              الإجمالي:
            </span>
            <span className="font-cairo font-black text-lg text-white tabular-nums">
              {posNetTotal} <span className="text-[10px] text-[#D4AF37]">ج.م</span>
            </span>
          </div>

          <button
            type="button"
            disabled={posItems.length === 0 || posLoading}
            onClick={() => setShowCheckoutModal(true)}
            className="w-full bg-[#3B6E4C] hover:bg-[#2F5A3D] disabled:opacity-40 text-white font-cairo font-black text-xs py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>إتمام البيع والدفع ({posNetTotal} ج)</span>
          </button>

          {posItems.length > 0 && (
            <button
              type="button"
              disabled={posLoading}
              onClick={() => {
                setPosOrderType('counter_takeaway');
                setPaymentMethod('cod');
                onCompleteInvoice();
              }}
              className="w-full bg-[#FAF6F0] hover:bg-[#D4AF37] text-[#231710] border border-[#D4AF37] font-cairo font-black text-[11px] py-1.5 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <Zap className="w-3 h-3 text-[#C88A4B]" />
              <span>تحصيل كاش سريع وطباعة</span>
            </button>
          )}
        </div>
      </aside>

      {/* ================================================================= */}
      {/* ON-DEMAND CHECKOUT MODAL (PAYMENT, DELIVERY, VIP, CHANGE)         */}
      {/* ================================================================= */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 border-2 border-[#D4AF37] shadow-2xl space-y-3.5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E6DFD3] pb-2.5">
              <div>
                <h3 className="font-cairo font-black text-base text-[#231710]">
                  إتمام البيع وتحصيل الفاتورة
                </h3>
                <p className="text-xs font-bold text-[#6E5D4F] tabular-nums">
                  {posItems.length} أصناف • الصافي المطلوب: {posNetTotal} ج.م
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="w-8 h-8 rounded-xl bg-[#FAF6F0] hover:bg-red-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Order Type (Counter / Glass Bar / Delivery) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-cairo font-black text-[#231710]">
                نوع الطلب:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'counter_takeaway' as PosOrderType, label: '🛍️ كاونتر مباشر' },
                  { id: 'glass_bar_dine_in' as PosOrderType, label: '☕ البار (4 كراسي)' },
                  { id: 'phone_delivery' as PosOrderType, label: '🛵 دليفري (+20ج)' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPosOrderType(t.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-cairo font-black border transition cursor-pointer ${
                      posOrderType === t.id
                        ? 'bg-[#231710] text-[#D4AF37] border-[#231710]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {posOrderType === 'glass_bar_dine_in' && (
                <div className="flex items-center justify-between bg-[#FAF6F0] px-3 py-2 rounded-xl border border-[#E6DFD3]">
                  <span className="text-xs font-black text-[#231710]">رقم الكرسي:</span>
                  <div className="flex items-center gap-1.5">
                    {([1, 2, 3, 4] as const).map((cNum) => (
                      <button
                        key={cNum}
                        type="button"
                        onClick={() => setChairNumber(cNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-black cursor-pointer ${
                          chairNumber === cNum
                            ? 'bg-[#231710] text-[#D4AF37]'
                            : 'bg-white text-[#231710] border border-[#E6DFD3]'
                        }`}
                      >
                        {cNum}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {posOrderType === 'phone_delivery' && (
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="أدخل عنوان التوصيل بالتفصيل..."
                  className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                />
              )}
            </div>

            {/* 2. Payment Method */}
            <div className="space-y-1.5">
              <label className="block text-xs font-cairo font-black text-[#231710]">
                وسيلة الدفع:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'cod' as PaymentMethod, label: '💵 كاش' },
                  { id: 'instapay' as PaymentMethod, label: '⚡ إنستا باي' },
                  { id: 'vodafone_cash' as PaymentMethod, label: '📱 فودافون كاش' },
                  { id: 'card' as PaymentMethod, label: '💳 فيزا' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-cairo font-black border transition cursor-pointer ${
                      paymentMethod === pm.id
                        ? 'bg-[#3B6E4C] text-white border-[#3B6E4C]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E6DFD3]'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'cod' ? (
                <div className="bg-[#FAF6F0] rounded-2xl p-3 border border-[#E6DFD3] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#231710]">
                      المدفوع من العميل:
                    </span>
                    <div className="flex items-center gap-1">
                      {[50, 100, 200, 500].map((bill) => (
                        <button
                          key={bill}
                          type="button"
                          onClick={() => setCashTenderedInput(bill)}
                          className="bg-white hover:bg-[#231710] hover:text-[#D4AF37] border border-[#E6DFD3] px-2 py-0.5 rounded-lg text-xs font-black tabular-nums cursor-pointer"
                        >
                          {bill}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <input
                      type="number"
                      value={cashTenderedInput}
                      onChange={(e) =>
                        setCashTenderedInput(
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder={`${posNetTotal} ج.م`}
                      className="bg-white border border-[#E6DFD3] rounded-xl px-3 py-1.5 text-sm font-black tabular-nums outline-none"
                    />
                    <div className="bg-white border border-[#E6DFD3] rounded-xl px-3 py-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#6E5D4F]">الباقي:</span>
                      <span className="font-cairo font-black text-sm text-[#3B6E4C] tabular-nums">
                        {changeDue} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="رقم مرجع التحويل / الإيصال (اختياري)..."
                  className="w-full bg-[#FAF6F0] border border-[#E6DFD3] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                />
              )}
            </div>

            {/* 3. Optional Customer / VIP / Discount */}
            <div className="bg-[#FAF6F0] rounded-2xl p-3 border border-[#E6DFD3] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-cairo font-black text-[#231710] flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-[#C88A4B]" />
                  <span>بيانات العميل ومحفظة VIP (اختياري)</span>
                </span>
                {posVipCashbackEarned > 0 && (
                  <span className="text-[10.5px] font-black text-[#3B6E4C]">
                    +{posVipCashbackEarned} ج.م كاش باك
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="موبايل العميل (01XXXXXXXXX)"
                  className="bg-white border border-[#E6DFD3] rounded-xl px-2.5 py-1.5 text-xs font-bold tabular-nums outline-none"
                />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم العميل"
                  className="bg-white border border-[#E6DFD3] rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                />
              </div>

              {matchedVipMember && (
                <div className="bg-white rounded-xl p-2 border border-[#3B6E4C]/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-[#231710] block">
                      👑 {matchedVipMember.name}
                    </span>
                    <span className="text-[#3B6E4C] font-bold tabular-nums">
                      رصيد المحفظة: {matchedVipMember.walletBalanceEgp || 0} ج.م
                    </span>
                  </div>
                  {(matchedVipMember.walletBalanceEgp || 0) > 0 && (
                    <label className="flex items-center gap-1.5 font-black text-[#3B6E4C] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useVipWallet}
                        onChange={(e) => setUseVipWallet(e.target.checked)}
                        className="accent-[#3B6E4C] w-3.5 h-3.5"
                      />
                      <span>خصم من المحفظة</span>
                    </label>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={cashierDiscount || ''}
                  onChange={(e) =>
                    setCashierDiscount(Math.max(0, Number(e.target.value) || 0))
                  }
                  placeholder="خصم خاص بالجنيه (اختياري)"
                  className="bg-white border border-[#E6DFD3] rounded-xl px-2.5 py-1.5 text-xs font-bold tabular-nums outline-none"
                />
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="ملاحظة على الفاتورة..."
                  className="bg-white border border-[#E6DFD3] rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                />
              </div>
            </div>

            {/* Final Summary & Confirm Button */}
            <div className="bg-[#231710] text-white rounded-2xl p-3.5 flex items-center justify-between">
              <div className="text-xs space-y-0.5 text-white/80 tabular-nums">
                <div>المجموع: {posSubtotal} ج.م</div>
                {posShipping > 0 && <div>التوصيل: +{posShipping} ج.م</div>}
                {(cashierDiscount > 0 || vipWalletRedeemable > 0) && (
                  <div className="text-[#D4AF37]">
                    الخصم: -{cashierDiscount + vipWalletRedeemable} ج.م
                  </div>
                )}
              </div>
              <div className="text-left">
                <span className="text-[11px] text-[#D4AF37] block">الصافي النهائي</span>
                <span className="font-cairo font-black text-xl text-white tabular-nums">
                  {posNetTotal} ج.م
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={posLoading}
              onClick={() => {
                setShowCheckoutModal(false);
                onCompleteInvoice();
              }}
              className="w-full bg-[#3B6E4C] hover:bg-[#2F5A3D] text-white font-cairo font-black text-sm py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>تأكيد الدفع وطباعة الفاتورة ({posNetTotal} ج.م)</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
