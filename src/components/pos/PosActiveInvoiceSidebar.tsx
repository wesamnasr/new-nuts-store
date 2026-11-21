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
  Lock,
  Ticket,
  Split,
  Wallet,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  CartItem,
  Coupon,
  PaymentMethod,
  PosOrderType,
  PosPaymentSplit,
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
  couponCode?: string;
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
  couponCode?: string;
  setCouponCode?: (code: string) => void;
  couponDiscount?: number;
  couponError?: string;
  coupons?: Coupon[];
  useVipWallet: boolean;
  setUseVipWallet: (use: boolean) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (pm: PaymentMethod) => void;
  paymentSplits?: PosPaymentSplit[];
  setPaymentSplits?: React.Dispatch<React.SetStateAction<PosPaymentSplit[]>>;
  paymentReference: string;
  setPaymentReference: (ref: string) => void;
  cashTenderedInput: number | '';
  setCashTenderedInput: (val: number | '') => void;
  matchedVipMember: VipMember | null;
  creditConfig?: {
    enableCreditSales: boolean;
    creditSalesRequireApproval: boolean;
  };
  taxConfig?: {
    enableTax: boolean;
    taxRatePercent: number;
    taxPricingMode: 'inclusive' | 'exclusive';
    taxRegistrationNumber?: string;
  };
  posTaxAmount?: number;
  onCollectCustomerDebt?: (
    phone: string,
    amount: number,
    method: PaymentMethod
  ) => Promise<boolean>;
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
  onCompleteInvoice: (overridePaymentMethod?: PaymentMethod) => void;
  onPrintItemSticker: (sticker: StickerPreviewData) => void;
  heldInvoices: HeldPosInvoice[];
  onHoldCurrentInvoice: () => void;
  onRestoreHeldInvoice: (id: string) => void;
  onDeleteHeldInvoice: (id: string) => void;
  cartWidth?: number;
  onChangeCartWidth?: (newWidth: number) => void;
  embeddedInAdmin?: boolean;
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
  couponCode = '',
  setCouponCode,
  couponDiscount = 0,
  couponError = '',
  coupons = [],
  useVipWallet,
  setUseVipWallet,
  paymentMethod,
  setPaymentMethod,
  paymentSplits = [],
  setPaymentSplits,
  paymentReference,
  setPaymentReference,
  cashTenderedInput,
  setCashTenderedInput,
  matchedVipMember,
  creditConfig,
  taxConfig,
  posTaxAmount = 0,
  onCollectCustomerDebt,
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
  embeddedInAdmin = false,
}: PosActiveInvoiceSidebarProps) {
  const [showHeldList, setShowHeldList] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showAdvancedCheckout, setShowAdvancedCheckout] = useState(false);
  const [isDraggingResize, setIsDraggingResize] = useState(false);
  const [showDebtPayBox, setShowDebtPayBox] = useState(false);
  const [debtPayAmount, setDebtPayAmount] = useState<number | ''>('');
  const [debtPayMethod, setDebtPayMethod] = useState<PaymentMethod>('cod');
  const [debtPayBusy, setDebtPayBusy] = useState(false);

  const hasAdvancedActive =
    posOrderType === 'phone_delivery' ||
    posOrderType === 'glass_bar_dine_in' ||
    paymentMethod === 'split' ||
    paymentMethod === 'credit' ||
    Boolean(couponCode.trim()) ||
    cashierDiscount > 0 ||
    useVipWallet ||
    Boolean(customerPhone.trim());

  useEffect(() => {
    if (hasAdvancedActive) {
      setShowAdvancedCheckout(true);
    }
  }, [hasAdvancedActive]);

  const totalItemsQty = posItems.reduce((sum, i) => sum + i.quantity, 0);

  // Initialize default split rows when switching to split payment
  useEffect(() => {
    if (paymentMethod === 'split' && setPaymentSplits && paymentSplits.length < 2) {
      const half = Math.floor(posNetTotal / 2);
      setPaymentSplits([
        { method: 'cod', amount: half },
        { method: 'card', amount: Math.max(0, Math.round((posNetTotal - half) * 100) / 100) },
      ]);
    }
  }, [paymentMethod, posNetTotal, paymentSplits.length, setPaymentSplits]);

  const splitAllocatedSum = Math.round(
    paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) * 100
  ) / 100;
  const splitRemaining = Math.round((posNetTotal - splitAllocatedSum) * 100) / 100;
  const isSplitMismatch = paymentMethod === 'split' && Math.abs(splitRemaining) > 0.5;

  const clampWidth = useCallback((w: number) => {
    return Math.min(MAX_POS_CART_WIDTH, Math.max(MIN_POS_CART_WIDTH, Math.round(w)));
  }, []);

  // Mouse drag resize handler (Cart is on the LEFT in RTL, so dragging right increases width = clientX - leftEdge)
  useEffect(() => {
    if (!isDraggingResize || !onChangeCartWidth) return;

    const handleMouseMove = (e: MouseEvent) => {
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
      {/* STICKY COMPACT CART SIDEBAR WITH RESIZABLE WIDTH                  */}
      {/* ================================================================= */}
      <aside
        style={{ '--pos-cart-width': `${cartWidth}px` } as React.CSSProperties}
        className={`w-full lg:w-[var(--pos-cart-width)] ${embeddedInAdmin ? 'relative lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:z-10' : 'relative lg:sticky lg:top-[76px] lg:h-[calc(100vh-5.5rem)] lg:z-20'} bg-white rounded-2xl p-3 border border-[#E8E0D5] shadow-sm flex flex-col justify-between select-none transition-[box-shadow]`}
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
                ? 'bg-[#231710] text-white border-[#231710] scale-110'
                : 'bg-white text-[#6B5B4E] border-[#E8E0D5] hover:border-[#C5B8A8] hover:scale-105'
            }`}
          >
            <GripVertical className="w-3 h-3" />
          </div>
        )}

        {/* Top Header */}
        <div className="border-b border-[#E8E0D5] pb-2 shrink-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4 text-[#9A6836]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-cairo font-bold text-xs text-[#231710] truncate">
                  السلة ({posItems.length})
                </h2>
                <span className="text-[11px] font-medium text-[#6B5B4E] tabular-nums block">
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
                    className="min-h-[36px] bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] px-2.5 py-1 rounded-lg text-[11px] font-cairo font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <PauseCircle className="w-3.5 h-3.5 text-[#9A6836]" />
                    <span>تعليق</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosItems([])}
                    title="مسح السلة"
                    className="min-h-[36px] min-w-[36px] bg-red-50 hover:bg-red-100 text-[#B83B2B] p-1.5 rounded-lg flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}

              {heldInvoices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHeldList(!showHeldList)}
                  className="min-h-[36px] bg-[#231710] text-white px-2.5 py-1 rounded-lg text-[11px] font-cairo font-bold flex items-center gap-1 cursor-pointer"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>{heldInvoices.length}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Held Invoices List (if opened) */}
        {showHeldList && heldInvoices.length > 0 && (
          <div className="bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5] rounded-xl p-2.5 my-1.5 space-y-1.5 shrink-0">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-cairo font-bold text-[#231710]">
                فواتير معلقة ({heldInvoices.length})
              </span>
              <button
                type="button"
                onClick={() => setShowHeldList(false)}
                className="text-[11px] text-[#6B5B4E] hover:text-[#231710] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
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
                    className="bg-white border border-[#E8E0D5] rounded-lg p-2 flex items-center justify-between text-[11px]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold block truncate text-[#231710]">{held.label}</span>
                      <span className="text-[11px] text-[#6B5B4E] tabular-nums">
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
                        className="bg-[#231710] text-white px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer"
                      >
                        استرجاع
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteHeldInvoice(held.id)}
                        className="text-[#B83B2B] hover:bg-red-50 rounded p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Middle: Scrollable Cart Items List */}
        <div className="flex-1 overflow-y-auto my-2 space-y-1.5 pr-0.5">
          {posItems.length === 0 ? (
            <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-4 bg-[#FAF6F0]/60 rounded-xl border border-dashed border-[#E8E0D5]">
              <ShoppingBag className="w-6 h-6 text-[#9A6836]/60 mb-1.5" />
              <p className="font-cairo font-bold text-xs text-[#231710]">
                السلة فارغة
              </p>
              <p className="text-[11px] font-medium text-[#6B5B4E] mt-0.5">
                اضغط على أي صنف لإضافته
              </p>
            </div>
          ) : (
            posItems.map((item, idx) => (
              <div
                key={item.cartItemId || `pos-item-${idx}-${item.productId || 'p'}`}
                className="bg-[#FAF6F0] rounded-xl p-2.5 border border-[#E8E0D5] space-y-1.5"
              >
                {/* Row 1: Item Name + Delete */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-cairo font-bold text-xs text-[#231710] leading-snug break-words">
                      {item.productName}
                    </div>
                    <div className="text-[11px] font-medium text-[#6B5B4E] leading-snug break-words">
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
                    className="p-1 rounded text-[#B83B2B] hover:bg-red-50 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Row 2: Qty Controls + Sticker + Total Price */}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5 bg-white rounded-lg border border-[#E8E0D5] px-1 py-0.5">
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
                        className="w-7 h-7 rounded hover:bg-[#FAF6F0] flex items-center justify-center text-[#231710] cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-xs px-1.5 tabular-nums">
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
                        className="w-7 h-7 rounded hover:bg-[#FAF6F0] flex items-center justify-center text-[#231710] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePrintCartItemSticker(item)}
                      title="طباعة استيكر"
                      className="w-8 h-8 rounded-lg bg-white hover:bg-[#FAF6F0] text-[#9A6836] border border-[#E8E0D5] flex items-center justify-center cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="font-cairo font-bold text-xs text-[#231710] tabular-nums">
                    {item.unitPrice * item.quantity} ج.م
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Footer: Total & 1-Click Cash + Full Payment Options */}
        <div className="pt-2 border-t border-[#E8E0D5] space-y-2 shrink-0">
          <div className="bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="font-cairo font-bold text-xs text-[#6B5B4E]">
              الإجمالي:
            </span>
            <span className="font-cairo font-bold text-lg text-[#231710] tabular-nums">
              {posNetTotal} <span className="text-[11px] text-[#6B5B4E]">ج.م</span>
            </span>
          </div>

          {/* 1-Click Instant Cash Sale ("3-Click Sale" Step 3) */}
          <button
            type="button"
            disabled={posItems.length === 0 || posLoading}
            onClick={() => {
              setPosOrderType('counter_takeaway');
              setPaymentMethod('cod');
              onCompleteInvoice('cod');
            }}
            className="w-full min-h-[44px] bg-[#3B6E4C] hover:bg-[#2f5a3d] disabled:opacity-40 text-white font-cairo font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Zap className="w-4 h-4 shrink-0" />
            <span>تحصيل كاش فوري ({posNetTotal} ج.م)</span>
          </button>

          {/* Other Payment Methods & Checkout Modal */}
          <button
            type="button"
            disabled={posItems.length === 0 || posLoading}
            onClick={() => setShowCheckoutModal(true)}
            className="w-full min-h-[44px] bg-[#231710] hover:bg-[#3A271C] disabled:opacity-40 text-white font-cairo font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>الدفع والخيارات الأخرى</span>
          </button>
        </div>
      </aside>

      {/* ================================================================= */}
      {/* PROGRESSIVE "80/20" CHECKOUT MODAL                                */}
      {/* ================================================================= */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 border border-[#E8E0D5] shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-2.5">
              <div>
                <h3 className="font-cairo font-bold text-base text-[#231710]">
                  الدفع وتأكيد الفاتورة
                </h3>
                <p className="text-xs font-medium text-[#6B5B4E] tabular-nums">
                  {posItems.length} أصناف • الصافي المطلوب: {posNetTotal} ج.م
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="w-10 h-10 rounded-xl bg-[#FAF6F0] hover:bg-red-50 text-[#231710] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 80% Daily Path: Primary Payment Methods */}
            <div className="space-y-2.5">
              <label className="block text-xs font-cairo font-bold text-[#231710]">
                وسيلة الدفع:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'cod' as PaymentMethod, label: 'كاش' },
                  { id: 'card' as PaymentMethod, label: 'فيزا' },
                  { id: 'instapay' as PaymentMethod, label: 'إنستا باي' },
                  { id: 'vodafone_cash' as PaymentMethod, label: 'فودافون كاش' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`min-h-[44px] py-2.5 px-2 rounded-xl text-xs font-cairo font-bold border transition cursor-pointer flex items-center justify-center ${
                      paymentMethod === pm.id
                        ? 'bg-[#231710] text-white border-[#231710]'
                        : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5] hover:border-[#C5B8A8]'
                    }`}
                  >
                    <span>{pm.label}</span>
                  </button>
                ))}
              </div>

              {paymentMethod === 'cod' && (
                <div className="bg-[#FAF6F0] rounded-2xl p-3 border border-[#E8E0D5] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#231710]">
                      المدفوع من العميل:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[50, 100, 200, 500].map((bill) => (
                        <button
                          key={bill}
                          type="button"
                          onClick={() => setCashTenderedInput(bill)}
                          className="min-h-[36px] min-w-[48px] bg-white hover:bg-[#231710] hover:text-white border border-[#E8E0D5] px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums cursor-pointer transition"
                        >
                          {bill}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                    <input
                      type="number"
                      value={cashTenderedInput}
                      onChange={(e) =>
                        setCashTenderedInput(
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder={`${posNetTotal} ج.م`}
                      className="min-h-[42px] bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-sm font-bold tabular-nums outline-none"
                    />
                    <div className="min-h-[42px] bg-white border border-[#E8E0D5] rounded-xl px-3 py-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-[#6B5B4E]">الباقي للعميل:</span>
                      <span className="font-cairo font-bold text-sm text-[#3B6E4C] tabular-nums">
                        {changeDue} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(paymentMethod === 'instapay' ||
                paymentMethod === 'vodafone_cash' ||
                paymentMethod === 'card') && (
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="رقم مرجع التحويل / الإيصال (اختياري)..."
                  className="w-full min-h-[42px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-medium outline-none"
                />
              )}
            </div>

            {/* 20% Edge Cases: Progressive Disclosure Toggle */}
            <div className="border border-[#E8E0D5] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedCheckout((prev) => !prev)}
                aria-expanded={showAdvancedCheckout}
                className="w-full min-h-[44px] bg-[#FAF6F0] hover:bg-[#F3ECE1] px-3.5 py-2.5 flex items-center justify-between text-xs font-cairo font-bold text-[#231710] cursor-pointer transition"
              >
                <span className="flex items-center gap-2">
                  <span>خيارات متقدمة / إضافية {showAdvancedCheckout ? '▴' : '▾'}</span>
                  {hasAdvancedActive && (
                    <span className="text-[11px] bg-[#231710] text-white px-2 py-0.5 rounded-full">
                      مفعّل
                    </span>
                  )}
                </span>
                {showAdvancedCheckout ? (
                  <ChevronUp className="w-4 h-4 text-[#6B5B4E]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#6B5B4E]" />
                )}
              </button>

              {showAdvancedCheckout && (
                <div className="p-3.5 space-y-3.5 border-t border-[#E8E0D5] bg-white">
                  {/* Order Type (Counter / Glass Bar / Delivery) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-cairo font-bold text-[#231710]">
                      نوع الطلب:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'counter_takeaway' as PosOrderType, label: 'كاونتر مباشر' },
                        { id: 'glass_bar_dine_in' as PosOrderType, label: 'البار (4 كراسي)' },
                        { id: 'phone_delivery' as PosOrderType, label: 'دليفري (+20ج)' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setPosOrderType(t.id)}
                          className={`min-h-[40px] py-2 px-2 rounded-xl text-xs font-cairo font-bold border transition cursor-pointer ${
                            posOrderType === t.id
                              ? 'bg-[#231710] text-white border-[#231710]'
                              : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {posOrderType === 'glass_bar_dine_in' && (
                      <div className="flex items-center justify-between bg-[#FAF6F0] px-3 py-2 rounded-xl border border-[#E8E0D5]">
                        <span className="text-xs font-bold text-[#231710]">رقم الكرسي:</span>
                        <div className="flex items-center gap-1.5">
                          {([1, 2, 3, 4] as const).map((cNum) => (
                            <button
                              key={cNum}
                              type="button"
                              onClick={() => setChairNumber(cNum)}
                              className={`w-9 h-9 rounded-lg text-xs font-bold cursor-pointer ${
                                chairNumber === cNum
                                  ? 'bg-[#231710] text-white'
                                  : 'bg-white text-[#231710] border border-[#E8E0D5]'
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
                        className="w-full min-h-[40px] bg-[#FAF6F0] border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-3 py-2 text-xs font-medium outline-none"
                      />
                    )}
                  </div>

                  {/* Advanced Payment Methods: Split & Credit */}
                  <div className="space-y-2">
                    <label className="block text-xs font-cairo font-bold text-[#231710]">
                      طرق دفع إضافية (مقسم / آجل):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('split')}
                        className={`min-h-[40px] py-2 px-2 rounded-xl text-xs font-cairo font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          paymentMethod === 'split'
                            ? 'bg-[#231710] text-white border-[#231710]'
                            : 'bg-[#FAF6F0] text-[#231710] border-[#E8E0D5]'
                        }`}
                      >
                        <Split className="w-3.5 h-3.5 shrink-0" />
                        <span>دفع مقسم</span>
                      </button>

                      {creditConfig?.enableCreditSales ? (
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('credit')}
                          className={`min-h-[40px] py-2 px-2 rounded-xl text-xs font-cairo font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            paymentMethod === 'credit'
                              ? 'bg-[#9A6836] text-white border-[#9A6836]'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}
                        >
                          <span>بيع آجل (ذمم)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="البيع الآجل مقفل من إعدادات الإدارة — يمكن للأدمن فقط تفعيله"
                          className="min-h-[40px] py-2 px-2 rounded-xl text-[11px] font-cairo font-bold border bg-gray-100 text-gray-500 border-gray-200 flex items-center justify-center gap-1 cursor-not-allowed"
                        >
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span>آجل (مقفل)</span>
                        </button>
                      )}
                    </div>

                    {paymentMethod === 'credit' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-950 space-y-1">
                        <div className="font-cairo font-bold">
                          فاتورة بيع آجل (ذمم عملاء) — سيتم قيد {posNetTotal} ج.م على حساب العميل
                        </div>
                        <p className="text-[11px] text-amber-800">
                          يجب إدخال رقم موبايل العميل بالأسفل والتأكد من اعتماده للبيع الآجل وعدم تجاوز الحد الائتماني.
                        </p>
                      </div>
                    )}

                    {paymentMethod === 'split' && setPaymentSplits && (
                      <div className="bg-[#FAF6F0] rounded-2xl p-3 border border-[#E8E0D5] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-cairo font-bold text-[#231710] flex items-center gap-1">
                            <Split className="w-3.5 h-3.5 text-[#9A6836]" />
                            <span>توزيع الدفع المقسم</span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentSplits((prev) => [
                                ...prev,
                                {
                                  method: 'vodafone_cash',
                                  amount: Math.max(0, splitRemaining),
                                },
                              ])
                            }
                            className="min-h-[34px] text-[11px] font-cairo font-bold bg-white border border-[#E8E0D5] hover:border-[#231710] px-2.5 py-1 rounded-lg cursor-pointer"
                          >
                            + إضافة وسيلة
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {paymentSplits.map((sp, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-1.5">
                              <select
                                value={sp.method}
                                onChange={(e) => {
                                  const val = e.target.value as PosPaymentSplit['method'];
                                  setPaymentSplits((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx ? { ...row, method: val } : row
                                    )
                                  );
                                }}
                                className="min-h-[38px] bg-white border border-[#E8E0D5] rounded-xl px-2 py-1.5 text-xs font-bold text-[#231710] outline-none"
                              >
                                <option value="cod">نقدي (كاش)</option>
                                <option value="card">فيزا الفرع</option>
                                <option value="instapay">إنستا باي</option>
                                <option value="vodafone_cash">فودافون كاش</option>
                                <option value="vip_wallet">محفظة VIP</option>
                                {creditConfig?.enableCreditSales && (
                                  <option value="credit">آجل (ذمم)</option>
                                )}
                              </select>

                              <input
                                type="number"
                                min={0}
                                step="0.5"
                                value={sp.amount || ''}
                                onChange={(e) => {
                                  const amt = Math.max(0, Number(e.target.value) || 0);
                                  setPaymentSplits((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx ? { ...row, amount: amt } : row
                                    )
                                  );
                                }}
                                placeholder="المبلغ"
                                className="w-24 min-h-[38px] bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-2.5 py-1.5 text-xs font-bold tabular-nums outline-none"
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  const othersSum = paymentSplits.reduce(
                                    (s, row, rIdx) => (rIdx === idx ? s : s + (Number(row.amount) || 0)),
                                    0
                                  );
                                  const rem = Math.max(
                                    0,
                                    Math.round((posNetTotal - othersSum) * 100) / 100
                                  );
                                  setPaymentSplits((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx ? { ...row, amount: rem } : row
                                    )
                                  );
                                }}
                                title="تعبئة المبلغ المتبقي تلقائياً"
                                className="min-h-[38px] text-[11px] font-bold bg-white border border-[#E8E0D5] hover:bg-[#231710] hover:text-white px-2.5 py-1.5 rounded-xl cursor-pointer transition"
                              >
                                المتبقي
                              </button>

                              {paymentSplits.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPaymentSplits((prev) =>
                                      prev.filter((_, rIdx) => rIdx !== idx)
                                    )
                                  }
                                  className="p-1.5 text-[#B83B2B] hover:bg-red-50 rounded-lg cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <div
                          className={`flex items-center justify-between text-[11px] font-bold px-2.5 py-1.5 rounded-xl tabular-nums ${
                            isSplitMismatch
                              ? 'bg-red-50 text-[#B83B2B] border border-red-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <span>الموزع: {splitAllocatedSum} ج.م</span>
                          <span>
                            {isSplitMismatch
                              ? `المتبقي للتوزيع: ${splitRemaining} ج.م`
                              : 'التوزيع مطابق 100% لإجمالي الفاتورة'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Customer / VIP Wallet / Credit Status & Debt Repayment / Coupons */}
                  <div className="bg-[#FAF6F0] rounded-2xl p-3 border border-[#E8E0D5] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-cairo font-bold text-[#231710] flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5 text-[#9A6836]" />
                        <span>العميل، محفظة VIP، الكوبونات والخصم</span>
                      </span>
                      {posVipCashbackEarned > 0 && (
                        <span className="text-[11px] font-bold text-[#3B6E4C]">
                          +{posVipCashbackEarned} ج.م كاش باك
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="موبايل العميل (01XXXXXXXXX)"
                        className="min-h-[40px] bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-2.5 py-1.5 text-xs font-medium tabular-nums outline-none"
                      />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="اسم العميل"
                        className="min-h-[40px] bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none"
                      />
                    </div>

                    {matchedVipMember && (() => {
                      const walletBal =
                        matchedVipMember.pointsBalance ??
                        matchedVipMember.walletBalance ??
                        matchedVipMember.walletBalanceEgp ??
                        0;
                      const currentDebt = matchedVipMember.creditBalanceDue || 0;
                      const creditLimit = matchedVipMember.creditLimit || 0;

                      return (
                        <div className="bg-white rounded-xl p-2.5 border border-[#E8E0D5] space-y-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-[#231710] flex items-center gap-1">
                                <Crown className="w-3.5 h-3.5 text-[#9A6836]" />
                                <span>{matchedVipMember.customerName || matchedVipMember.name}</span>
                              </span>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 tabular-nums text-[11px]">
                                <span className="text-[#3B6E4C] font-bold">
                                  المحفظة: {walletBal} ج.م
                                </span>
                                {currentDebt > 0 && (
                                  <span className="text-[#B83B2B] font-bold">
                                    • مديونية آجلة: {currentDebt} ج.م
                                  </span>
                                )}
                                {creditConfig?.enableCreditSales && (
                                  <span className="text-[#6B5B4E]">
                                    • {matchedVipMember.allowCredit ? `معتمد آجل${creditLimit > 0 ? ` (حد ${creditLimit}ج)` : ''}` : 'غير معتمد للآجل'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {walletBal > 0 && paymentMethod !== 'split' && (
                                <label className="flex items-center gap-1.5 font-bold text-[#3B6E4C] cursor-pointer text-[11px] min-h-[36px]">
                                  <input
                                    type="checkbox"
                                    checked={useVipWallet}
                                    onChange={(e) => setUseVipWallet(e.target.checked)}
                                    className="accent-[#231710] w-4 h-4"
                                  />
                                  <span>خصم المحفظة</span>
                                </label>
                              )}
                              {currentDebt > 0 && onCollectCustomerDebt && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowDebtPayBox(!showDebtPayBox);
                                    setDebtPayAmount(currentDebt);
                                  }}
                                  className="min-h-[36px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg text-[11px] font-cairo font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                  <span>سداد مديونية</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {showDebtPayBox && currentDebt > 0 && onCollectCustomerDebt && (
                            <div className="bg-[#FAF6F0] rounded-xl p-2 border border-[#E8E0D5] space-y-1.5">
                              <div className="text-[11px] font-cairo font-bold text-[#231710]">
                                تحصيل دفعة سداد من مديونية العميل ({currentDebt} ج.م):
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={currentDebt}
                                  value={debtPayAmount}
                                  onChange={(e) =>
                                    setDebtPayAmount(
                                      e.target.value === '' ? '' : Number(e.target.value)
                                    )
                                  }
                                  placeholder="المبلغ المسدد"
                                  className="w-24 min-h-[38px] bg-white border border-[#E8E0D5] rounded-lg px-2 py-1 text-xs font-bold tabular-nums outline-none"
                                />
                                <select
                                  value={debtPayMethod}
                                  onChange={(e) => setDebtPayMethod(e.target.value as PaymentMethod)}
                                  className="min-h-[38px] bg-white border border-[#E8E0D5] rounded-lg px-2 py-1 text-xs font-bold outline-none"
                                >
                                  <option value="cod">نقداً بالدرج</option>
                                  <option value="instapay">إنستا باي</option>
                                  <option value="vodafone_cash">فودافون كاش</option>
                                  <option value="card">فيزا الفرع</option>
                                </select>
                                <button
                                  type="button"
                                  disabled={debtPayBusy || !debtPayAmount || Number(debtPayAmount) <= 0}
                                  onClick={async () => {
                                    if (!debtPayAmount) return;
                                    setDebtPayBusy(true);
                                    const ok = await onCollectCustomerDebt(
                                      matchedVipMember.phone,
                                      Number(debtPayAmount),
                                      debtPayMethod
                                    );
                                    setDebtPayBusy(false);
                                    if (ok) {
                                      setShowDebtPayBox(false);
                                      setDebtPayAmount('');
                                    }
                                  }}
                                  className="min-h-[38px] bg-[#3B6E4C] hover:bg-[#2f5a3d] disabled:opacity-40 text-white px-3 py-1 rounded-lg text-[11px] font-cairo font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{debtPayBusy ? 'جارٍ التحصيل...' : 'تأكيد التحصيل'}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* POS Coupon Code Input & Quick Active Pills */}
                    {setCouponCode && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex-1">
                            <Ticket className="w-3.5 h-3.5 text-[#9A6836] absolute right-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              placeholder="كود كوبون خصم (اختياري)..."
                              className="w-full min-h-[40px] bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl pr-8 pl-2.5 py-1.5 text-xs font-bold uppercase outline-none"
                            />
                          </div>
                          {couponCode && (
                            <button
                              type="button"
                              onClick={() => setCouponCode('')}
                              className="min-h-[40px] text-[11px] text-[#B83B2B] hover:bg-red-50 px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                            >
                              إلغاء الكوبون
                            </button>
                          )}
                        </div>

                        {coupons.length > 0 && !couponCode && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-[#6B5B4E]">كوبونات متاحة:</span>
                            {coupons.slice(0, 4).map((cp) => (
                              <button
                                key={cp.id}
                                type="button"
                                onClick={() => setCouponCode(cp.code)}
                                className="bg-white hover:bg-[#231710] hover:text-white border border-[#E8E0D5] rounded-md px-2 py-1 text-[11px] font-bold cursor-pointer transition"
                              >
                                {cp.code}
                              </button>
                            ))}
                          </div>
                        )}

                        {couponCode && couponDiscount > 0 && (
                          <div className="text-[11px] font-bold text-[#3B6E4C]">
                            تم تفعيل الكوبون ({couponCode}): خصم -{couponDiscount} ج.م
                          </div>
                        )}
                        {couponCode && couponError && (
                          <div className="text-[11px] font-bold text-[#B83B2B]">
                            {couponError}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={0}
                        value={cashierDiscount || ''}
                        onChange={(e) =>
                          setCashierDiscount(Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder="خصم إضافي بالجنيه (اختياري)"
                        className="min-h-[40px] bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-2.5 py-1.5 text-xs font-medium tabular-nums outline-none"
                      />
                      <input
                        type="text"
                        value={invoiceNotes}
                        onChange={(e) => setInvoiceNotes(e.target.value)}
                        placeholder="ملاحظة على الفاتورة..."
                        className="min-h-[40px] bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Final Summary & Primary CTA */}
            <div className="bg-[#FAF6F0] border border-[#E8E0D5] text-[#231710] rounded-2xl p-3.5 flex items-center justify-between">
              <div className="text-xs space-y-0.5 text-[#6B5B4E] tabular-nums">
                <div>المجموع: {posSubtotal} ج.م</div>
                {posShipping > 0 && <div>التوصيل: +{posShipping} ج.م</div>}
                {(cashierDiscount > 0 || couponDiscount > 0 || vipWalletRedeemable > 0) && (
                  <div className="text-[#9A6836] font-bold">
                    الخصم: -{cashierDiscount + couponDiscount + vipWalletRedeemable} ج.م
                  </div>
                )}
                {taxConfig?.enableTax && (
                  <div className="text-[#231710] font-medium">
                    ضريبة ق.م ({taxConfig.taxRatePercent}%{' '}
                    {taxConfig.taxPricingMode === 'inclusive' ? 'شاملة' : 'مضافة'}):{' '}
                    {posTaxAmount} ج.م
                  </div>
                )}
              </div>
              <div className="text-left">
                <span className="text-[11px] text-[#6B5B4E] block">الصافي النهائي</span>
                <span className="font-cairo font-bold text-xl text-[#231710] tabular-nums">
                  {posNetTotal} ج.م
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={posLoading || isSplitMismatch}
              onClick={() => {
                setShowCheckoutModal(false);
                onCompleteInvoice();
              }}
              className="w-full min-h-[48px] bg-[#231710] hover:bg-[#3A271C] disabled:opacity-40 text-white font-cairo font-bold text-sm py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>تأكيد وطباعة الفاتورة ({posNetTotal} ج.م)</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
