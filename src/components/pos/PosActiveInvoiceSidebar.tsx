'use client';

import React, { useState, useEffect } from 'react';
import {
  Barcode,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Crown,
  Lock,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  QrCode,
  ShoppingBag,
  SlidersHorizontal,
  Split,
  Tag,
  Ticket,
  Trash2,
  User,
  Wallet,
  X,
  Zap,
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
  onScanCode?: (rawCode: string) => boolean;
  lastScanNotice?: { ok: boolean; title: string; subtitle: string } | null;
  currencySymbol?: string;
  vipMinOrder?: number;
}

export const MIN_POS_CART_WIDTH = 200;
export const MAX_POS_CART_WIDTH = 400;
export const DEFAULT_POS_CART_WIDTH = 240;

const fmtNum = (val: number) =>
  Number.isFinite(val) ? Number(Math.round(val * 100) / 100).toLocaleString('en-US') : '0';

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
  embeddedInAdmin = false,
  onScanCode,
  lastScanNotice,
  currencySymbol = 'ج.م',
  vipMinOrder = 150,
}: PosActiveInvoiceSidebarProps) {
  const [scanInput, setScanInput] = useState('');
  const [showHeldList, setShowHeldList] = useState(false);
  const [showExtrasDrawer, setShowExtrasDrawer] = useState(false);
  const [showVipNumpad, setShowVipNumpad] = useState(false);
  const [showDebtPayBox, setShowDebtPayBox] = useState(false);
  const [debtPayAmount, setDebtPayAmount] = useState<number | ''>('');
  const [debtPayMethod, setDebtPayMethod] = useState<PaymentMethod>('cod');
  const [debtPayBusy, setDebtPayBusy] = useState(false);

  const hasExtrasActive =
    posOrderType === 'phone_delivery' ||
    posOrderType === 'glass_bar_dine_in' ||
    Boolean(couponCode.trim()) ||
    cashierDiscount > 0 ||
    useVipWallet ||
    Boolean(customerPhone.trim()) ||
    Boolean(customerName.trim()) ||
    Boolean(invoiceNotes.trim());

  const totalItemsQty = posItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalDiscounts = cashierDiscount + couponDiscount + vipWalletRedeemable;

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

  const splitAllocatedSum =
    Math.round(paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) * 100) / 100;
  const splitRemaining = Math.round((posNetTotal - splitAllocatedSum) * 100) / 100;
  const isSplitMismatch = paymentMethod === 'split' && Math.abs(splitRemaining) > 0.5;
  const isCashShort =
    paymentMethod === 'cod' &&
    cashTenderedInput !== '' &&
    Number(cashTenderedInput) < posNetTotal - 0.01;
  const cashShortRemaining = isCashShort
    ? Math.max(0, Math.round((posNetTotal - Number(cashTenderedInput || 0)) * 100) / 100)
    : 0;
  const showVip150Prompt =
    posItems.length > 0 && posNetTotal >= vipMinOrder && !customerPhone.trim();

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = scanInput.trim();
    if (!trimmed || !onScanCode) return;
    onScanCode(trimmed);
    setScanInput('');
  };

  const handlePrintCartItemSticker = (item: CartItem) => {
    onPrintItemSticker({
      title: item.productName,
      weightLabel: item.weightLabel,
      roastOrSpec: item.roastOption || '',
      price: Math.round(item.unitPrice * item.quantity * 100) / 100,
      barcode: item.barcodeLabel || '200001002507',
      date: new Date().toLocaleDateString('ar-EG'),
    });
  };

  const primaryBtnLabel =
    paymentMethod === 'cod'
      ? `تحصيل كاش وطباعة الفاتورة (${fmtNum(posNetTotal)} ${currencySymbol})`
      : paymentMethod === 'card'
        ? `تأكيد فيزا وطباعة (${fmtNum(posNetTotal)} ${currencySymbol})`
        : paymentMethod === 'instapay'
          ? `تأكيد إنستاباي وطباعة (${fmtNum(posNetTotal)} ${currencySymbol})`
          : paymentMethod === 'vodafone_cash'
            ? `تأكيد فودافون كاش وطباعة (${fmtNum(posNetTotal)} ${currencySymbol})`
            : paymentMethod === 'split'
              ? `تأكيد دفع مقسم وطباعة (${fmtNum(posNetTotal)} ${currencySymbol})`
              : paymentMethod === 'credit'
                ? `تسجيل فاتورة آجل وطباعة (${fmtNum(posNetTotal)} ${currencySymbol})`
                : `تأكيد وطباعة الفاتورة (${fmtNum(posNetTotal)} ${currencySymbol})`;

  return (
    <section
      className={`w-full bg-white rounded-2xl border border-[#E8E0D5] shadow-xs flex flex-col overflow-hidden ${
        embeddedInAdmin
          ? 'lg:h-[calc(100vh-5.2rem)]'
          : 'lg:h-[calc(100vh-4.2rem)]'
      }`}
    >
      {/* ================================================================= */}
      {/* 1. PINNED SMART SCANNER BAR (SCALE QR/BARCODE + ITEM QR/BARCODE)  */}
      {/* ================================================================= */}
      <div className="p-2.5 bg-[#FAF6F0]/90 border-b border-[#E8E0D5] space-y-2 shrink-0">
        {onScanCode && (
          <form onSubmit={handleScanSubmit} className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[#9A6836] pointer-events-none">
                <QrCode className="w-4 h-4" />
                <Barcode className="w-3.5 h-3.5 opacity-75" />
              </div>
              <input
                id="pos-barcode-input"
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="امسح QR / باركود الميزان أو القطعة مباشرة (أو اكتب الكود واضغط Enter)..."
                className="w-full min-h-[40px] bg-white border border-[#DEC9AF] focus:border-[#231710] rounded-xl pr-12 pl-24 py-1.5 text-xs font-bold text-[#231710] placeholder:font-medium placeholder:text-[#8C7A6B] outline-none shadow-2xs transition tabular-nums"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10px] font-bold pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>الماسح جاهز</span>
              </span>
            </div>
            {scanInput.trim() && (
              <button
                type="submit"
                className="min-h-[40px] px-3 rounded-xl bg-[#231710] hover:bg-[#3A271C] text-white text-xs font-bold cursor-pointer shrink-0 transition"
              >
                إضافة
              </button>
            )}
          </form>
        )}

        {/* Instant Scan Feedback Flash */}
        {lastScanNotice && (
          <div
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between gap-2 ${
              lastScanNotice.ok
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <span className="truncate">{lastScanNotice.title}</span>
            <span className="shrink-0 tabular-nums opacity-85">{lastScanNotice.subtitle}</span>
          </div>
        )}

        {/* Invoice Meta Bar: Channel Switcher + Hold / Clear Controls */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          {/* Fast Channel Selector */}
          <div className="flex items-center bg-white border border-[#E8E0D5] rounded-xl p-0.5 gap-0.5">
            {(
              [
                { id: 'counter_takeaway', label: 'بيع فرع' },
                { id: 'whatsapp_online', label: 'واتساب' },
                { id: 'phone_delivery', label: 'دليفري' },
                { id: 'glass_bar_dine_in', label: 'البار' },
              ] as Array<{ id: PosOrderType; label: string }>
            ).map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setPosOrderType(ch.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  posOrderType === ch.id
                    ? ch.id === 'whatsapp_online'
                      ? 'bg-[#3B6E4C] text-white'
                      : 'bg-[#231710] text-white'
                    : 'text-[#6B5A4E] hover:text-[#231710]'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>

          {/* Right Controls: Count, Hold, Restore Held, Clear */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#6B5644] bg-white border border-[#E8E0D5] px-2 py-1 rounded-lg tabular-nums">
              {posItems.length} صنف • {fmtNum(totalItemsQty)} وحدة
            </span>

            {posItems.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={onHoldCurrentInvoice}
                  title="تعليق الفاتورة الحالية"
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F3ECE1] text-[#231710] border border-[#E8E0D5] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <PauseCircle className="w-3.5 h-3.5 text-[#9A6836]" />
                  <span>تعليق</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPosItems([])}
                  title="مسح الفاتورة"
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#B83B2B] border border-red-200/70 cursor-pointer transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {heldInvoices.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHeldList((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg bg-[#231710] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <PlayCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>المعلقة ({heldInvoices.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Held Invoices Dropdown */}
        {showHeldList && heldInvoices.length > 0 && (
          <div className="bg-white border border-[#E8E0D5] rounded-xl p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#231710]">
                الفواتير المعلقة ({heldInvoices.length})
              </span>
              <button
                type="button"
                onClick={() => setShowHeldList(false)}
                className="text-[#6B5B4E] hover:text-[#231710] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {heldInvoices.map((held) => {
                const heldTotal = held.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                return (
                  <div
                    key={held.id}
                    className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-[#231710] truncate block">{held.label}</span>
                      <span className="text-[#6B5B4E] tabular-nums">
                        {held.items.length} أصناف • {fmtNum(heldTotal)} {currencySymbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreHeldInvoice(held.id);
                          setShowHeldList(false);
                        }}
                        className="bg-[#231710] text-white px-2.5 py-1 rounded-md font-bold cursor-pointer"
                      >
                        استرجاع
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteHeldInvoice(held.id)}
                        className="p-1 text-[#B83B2B] hover:bg-red-50 rounded cursor-pointer"
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
      </div>

      {/* ================================================================= */}
      {/* 2. PROFESSIONAL LIVE INVOICE TABLE (SCROLLABLE CORE AREA)         */}
      {/* ================================================================= */}
      <div className="flex-1 overflow-y-auto min-h-[190px] bg-white">
        {posItems.length === 0 ? (
          <div className="h-full min-h-[210px] flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center mb-3">
              <ShoppingBag className="w-6 h-6 text-[#9A6836]" />
            </div>
            <p className="font-cairo font-bold text-sm text-[#231710]">
              الفاتورة الحالية فارغة وجاهزة للبيع
            </p>
            <p className="text-xs text-[#6B5B4E] mt-1 max-w-sm leading-relaxed">
              امسح <strong className="text-[#231710]">QR / باركود الميزان</strong> لمنتجات الوزن، أو{' '}
              <strong className="text-[#231710]">QR القطعة</strong> للمنتجات المعبأة، أو اضغط على أي صنف من الكتالوج السريع بجانبك.
            </p>
          </div>
        ) : (
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 z-10 bg-[#FAF6F0] border-b border-[#E8E0D5] text-[11px] font-bold text-[#6B5644]">
              <tr>
                <th className="py-2 pr-2.5 pl-1 w-7 text-center">#</th>
                <th className="py-2 px-1.5">الصنف والوزن / التفاصيل</th>
                <th className="py-2 px-1.5 text-center w-[96px]">الكمية</th>
                <th className="py-2 px-1.5 text-left w-[72px]">السعر</th>
                <th className="py-2 px-1.5 text-left w-[82px]">الإجمالي</th>
                <th className="py-2 pl-2 pr-1 text-center w-[64px]">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E9DF] text-xs">
              {posItems.map((item, idx) => {
                const lineTotal = Math.round(item.unitPrice * item.quantity * 100) / 100;
                return (
                  <tr
                    key={item.cartItemId || `pos-item-${idx}-${item.productId || 'p'}`}
                    className="hover:bg-[#FAF6F0]/60 transition"
                  >
                    <td className="py-2 pr-2.5 pl-1 text-center text-[11px] font-bold text-[#8C7A6B] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-1.5 min-w-0">
                      <div className="font-bold text-[#231710] leading-snug break-words">
                        {item.productName}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {item.weightLabel && (
                          <span className="text-[10px] font-bold bg-[#FAF6F0] text-[#6B5644] border border-[#E8E0D5] px-1.5 py-0.5 rounded-md">
                            {item.weightLabel}
                          </span>
                        )}
                        {item.roastOption && (
                          <span className="text-[10px] font-medium text-[#9A6836] bg-amber-50/80 border border-amber-200/70 px-1.5 py-0.5 rounded-md">
                            {item.roastOption}
                          </span>
                        )}
                        {item.workerNotes && (
                          <span className="text-[10px] text-[#6B5B4E]">• {item.workerNotes}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-1.5">
                      <div className="inline-flex items-center justify-center bg-[#FAF6F0] rounded-lg border border-[#E8E0D5] p-0.5 mx-auto">
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
                          className="w-8 h-8 rounded-md hover:bg-white flex items-center justify-center text-[#231710] cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold text-xs px-2 tabular-nums text-[#231710]">
                          {fmtNum(item.quantity)}
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
                          className="w-8 h-8 rounded-md hover:bg-white flex items-center justify-center text-[#231710] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2 px-1.5 text-left text-[11px] font-medium text-[#6B5B4E] tabular-nums whitespace-nowrap">
                      {fmtNum(item.unitPrice)}
                    </td>
                    <td className="py-2 px-1.5 text-left font-bold text-[#231710] tabular-nums whitespace-nowrap">
                      {fmtNum(lineTotal)} {currencySymbol}
                    </td>
                    <td className="py-2 pl-2 pr-1">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handlePrintCartItemSticker(item)}
                          title="طباعة استيكر للصنف"
                          className="p-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#EFE6D8] text-[#9A6836] border border-[#E8E0D5] cursor-pointer transition"
                        >
                          <Tag className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPosItems((prev) =>
                              prev.filter((i) => i.cartItemId !== item.cartItemId)
                            )
                          }
                          title="حذف الصنف"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-[#B83B2B] cursor-pointer transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ================================================================= */}
      {/* 3. SMART DIRECT CHECKOUT DOCK (PAYMENT + CASH BILLS + EXTRAS)     */}
      {/* ================================================================= */}
      <div className="border-t border-[#E8E0D5] bg-[#FAF6F0]/80 p-2.5 space-y-2 shrink-0">
        {/* Collapsible Extras Drawer (Customer / VIP / Discount / Coupon / Delivery / Chair) */}
        <div className="bg-white rounded-xl border border-[#E8E0D5] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowExtrasDrawer((prev) => !prev)}
            className="w-full px-3 py-1.5 flex items-center justify-between gap-2 text-xs font-bold text-[#231710] hover:bg-[#FAF6F0]/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#9A6836] shrink-0" />
              <span>العميل VIP • الخصم والكوبون • الملاحظات</span>
              {hasExtrasActive && (
                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                  مفعّل
                </span>
              )}
              {matchedVipMember && (
                <span className="text-[10px] bg-amber-50 text-[#9A6836] border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Crown className="w-3 h-3" />
                  <span>{matchedVipMember.customerName || matchedVipMember.name}</span>
                </span>
              )}
              {totalDiscounts > 0 && (
                <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-full tabular-nums">
                  خصم -{fmtNum(totalDiscounts)} {currencySymbol}
                </span>
              )}
            </div>
            {showExtrasDrawer ? (
              <ChevronDown className="w-4 h-4 text-[#6B5B4E] shrink-0" />
            ) : (
              <ChevronUp className="w-4 h-4 text-[#6B5B4E] shrink-0" />
            )}
          </button>

          {showExtrasDrawer && (
            <div className="p-2.5 border-t border-[#E8E0D5] space-y-2.5 max-h-[230px] overflow-y-auto bg-[#FAF6F0]/40">
              {/* Glass Bar Chair OR Delivery Address */}
              {posOrderType === 'glass_bar_dine_in' && (
                <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-[#E8E0D5]">
                  <span className="text-xs font-bold text-[#231710]">رقم كرسي البار:</span>
                  <div className="flex items-center gap-1">
                    {([1, 2, 3, 4] as const).map((cNum) => (
                      <button
                        key={cNum}
                        type="button"
                        onClick={() => setChairNumber(cNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold cursor-pointer ${
                          chairNumber === cNum
                            ? 'bg-[#231710] text-white'
                            : 'bg-[#FAF6F0] text-[#231710] border border-[#E8E0D5]'
                        }`}
                      >
                        {cNum}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(posOrderType === 'phone_delivery' || posOrderType === 'whatsapp_online') && (
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={
                    posOrderType === 'whatsapp_online'
                      ? 'عنوان طلب الواتساب أو اسم العميل...'
                      : 'أدخل عنوان التوصيل بالتفصيل...'
                  }
                  className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-lg px-2.5 py-1.5 text-xs outline-none"
                />
              )}

              {/* Customer Phone & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-[#9A6836] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="موبايل العميل (VIP / آجل)..."
                    className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-lg pr-8 pl-2.5 py-1.5 text-xs tabular-nums outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم العميل (اختياري)..."
                  className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-lg px-2.5 py-1.5 text-xs outline-none"
                />
              </div>

              {/* Matched VIP Member Card */}
              {matchedVipMember && (() => {
                const walletBal =
                  matchedVipMember.pointsBalance ??
                  matchedVipMember.walletBalance ??
                  matchedVipMember.walletBalanceEgp ??
                  0;
                const currentDebt = matchedVipMember.creditBalanceDue || 0;
                const creditLimit = matchedVipMember.creditLimit || 0;

                return (
                  <div className="bg-white rounded-xl p-2 border border-[#E8E0D5] space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-[#231710] flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5 text-[#9A6836]" />
                          <span>{matchedVipMember.customerName || matchedVipMember.name}</span>
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums mt-0.5">
                          <span className="text-[#3B6E4C] font-bold">
                            المحفظة: {fmtNum(walletBal)} {currencySymbol}
                          </span>
                          {currentDebt > 0 && (
                            <span className="text-[#B83B2B] font-bold">
                              • آجل: {fmtNum(currentDebt)} {currencySymbol}
                            </span>
                          )}
                          {creditConfig?.enableCreditSales && (
                            <span className="text-[#6B5B4E]">
                              •{' '}
                              {matchedVipMember.allowCredit
                                ? `معتمد آجل${creditLimit > 0 ? ` (${fmtNum(creditLimit)})` : ''}`
                                : 'غير معتمد آجل'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {walletBal > 0 && paymentMethod !== 'split' && (
                          <label className="flex items-center gap-1 font-bold text-[#3B6E4C] cursor-pointer text-[11px]">
                            <input
                              type="checkbox"
                              checked={useVipWallet}
                              onChange={(e) => setUseVipWallet(e.target.checked)}
                              className="accent-[#231710] w-3.5 h-3.5"
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
                            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Wallet className="w-3 h-3" />
                            <span>سداد</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {showDebtPayBox && currentDebt > 0 && onCollectCustomerDebt && (
                      <div className="bg-[#FAF6F0] rounded-lg p-2 border border-[#E8E0D5] flex flex-wrap items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={currentDebt}
                          value={debtPayAmount}
                          onChange={(e) =>
                            setDebtPayAmount(e.target.value === '' ? '' : Number(e.target.value))
                          }
                          placeholder="المبلغ"
                          className="w-20 bg-white border border-[#E8E0D5] rounded-lg px-2 py-1 text-xs font-bold tabular-nums outline-none"
                        />
                        <select
                          value={debtPayMethod}
                          onChange={(e) => setDebtPayMethod(e.target.value as PaymentMethod)}
                          className="bg-white border border-[#E8E0D5] rounded-lg px-2 py-1 text-xs font-bold outline-none"
                        >
                          <option value="cod">نقداً بالدرج</option>
                          <option value="instapay">إنستاباي</option>
                          <option value="vodafone_cash">فودافون كاش</option>
                          <option value="card">فيزا</option>
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
                          className="bg-[#3B6E4C] hover:bg-[#2f5a3d] disabled:opacity-40 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{debtPayBusy ? 'جارٍ...' : 'تحصيل السداد'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Discount + Coupon + Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {setCouponCode && (
                  <div className="relative">
                    <Ticket className="w-3.5 h-3.5 text-[#9A6836] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="كود كوبون..."
                      className="w-full bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-lg pr-7 pl-2 py-1.5 text-xs font-bold uppercase outline-none"
                    />
                  </div>
                )}
                <input
                  type="number"
                  min={0}
                  value={cashierDiscount || ''}
                  onChange={(e) => setCashierDiscount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder={`خصم يدوي (${currencySymbol})`}
                  className="bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-lg px-2.5 py-1.5 text-xs tabular-nums outline-none"
                />
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="ملاحظة للفاتورة..."
                  className="bg-white border border-[#E8E0D5] focus:border-[#231710] rounded-lg px-2.5 py-1.5 text-xs outline-none"
                />
              </div>

              {setCouponCode && coupons.length > 0 && !couponCode && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-[#6B5B4E]">كوبونات سريعة:</span>
                  {coupons.slice(0, 4).map((cp) => (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => setCouponCode(cp.code)}
                      className="bg-white hover:bg-[#231710] hover:text-white border border-[#E8E0D5] rounded px-1.5 py-0.5 text-[10px] font-bold cursor-pointer transition"
                    >
                      {cp.code}
                    </button>
                  ))}
                </div>
              )}

              {couponCode && couponDiscount > 0 && (
                <div className="text-[11px] font-bold text-[#3B6E4C]">
                  تم تفعيل الكوبون ({couponCode}): خصم -{fmtNum(couponDiscount)} {currencySymbol}
                </div>
              )}
              {couponCode && couponError && (
                <div className="text-[11px] font-bold text-[#B83B2B]">{couponError}</div>
              )}
            </div>
          )}
        </div>

        {/* Direct Payment Method Selector Pills */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
          {[
            { id: 'cod' as PaymentMethod, label: 'كاش' },
            { id: 'card' as PaymentMethod, label: 'فيزا' },
            { id: 'instapay' as PaymentMethod, label: 'إنستاباي' },
            { id: 'vodafone_cash' as PaymentMethod, label: 'فودافون' },
            { id: 'split' as PaymentMethod, label: 'مقسم' },
          ].map((pm) => (
            <button
              key={pm.id}
              type="button"
              onClick={() => setPaymentMethod(pm.id)}
              className={`min-h-[34px] px-2 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                paymentMethod === pm.id
                  ? 'bg-[#231710] text-white border-[#231710]'
                  : 'bg-white text-[#231710] border-[#E8E0D5] hover:bg-[#F3ECE1]'
              }`}
            >
              {pm.id === 'split' && <Split className="w-3 h-3 shrink-0" />}
              <span>{pm.label}</span>
            </button>
          ))}

          {creditConfig?.enableCreditSales ? (
            <button
              type="button"
              onClick={() => {
                setPaymentMethod('credit');
                setShowExtrasDrawer(true);
              }}
              className={`min-h-[34px] px-2 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                paymentMethod === 'credit'
                  ? 'bg-[#9A6836] text-white border-[#9A6836]'
                  : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
              }`}
            >
              آجل
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="البيع الآجل مقفل من إعدادات الإدارة"
              className="min-h-[34px] px-2 py-1 rounded-xl text-[10px] font-bold border bg-gray-100 text-gray-400 border-gray-200 flex items-center justify-center gap-0.5 cursor-not-allowed"
            >
              <Lock className="w-3 h-3 shrink-0" />
              <span>آجل</span>
            </button>
          )}
        </div>

        {/* Contextual Payment Strip (Cash Quick Bills + Change / Electronic Ref / Split / Credit) */}
        {paymentMethod === 'cod' && (
          <div className="bg-white rounded-xl border border-[#E8E0D5] px-2.5 py-2 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCashTenderedInput(posNetTotal)}
                  className="min-h-[38px] px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#231710] hover:text-white border border-[#E8E0D5] text-xs font-bold cursor-pointer transition"
                >
                  المضبوط
                </button>
                {[50, 100, 200, 500].map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => setCashTenderedInput(bill)}
                    className={`min-h-[38px] px-2.5 py-1 rounded-lg border text-xs font-bold tabular-nums cursor-pointer transition ${
                      cashTenderedInput === bill
                        ? 'bg-[#231710] text-white border-[#231710]'
                        : 'bg-[#FAF6F0] hover:bg-[#231710] hover:text-white text-[#231710] border-[#E8E0D5]'
                    }`}
                  >
                    {bill}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-1 justify-end min-w-[190px]">
                <input
                  type="number"
                  value={cashTenderedInput}
                  onChange={(e) =>
                    setCashTenderedInput(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder={`المدفوع (${fmtNum(posNetTotal)})`}
                  className={`w-24 bg-[#FAF6F0] focus:bg-white border rounded-lg px-2 py-1.5 text-xs font-bold tabular-nums outline-none text-center ${
                    isCashShort
                      ? 'border-[#B91C1C] bg-red-50 text-[#B91C1C]'
                      : 'border-[#E8E0D5] focus:border-[#231710]'
                  }`}
                />
                <div
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-extrabold tabular-nums whitespace-nowrap ${
                    isCashShort
                      ? 'bg-red-50 border-red-200 text-[#B91C1C]'
                      : 'bg-emerald-50 border-emerald-200 text-[#166534]'
                  }`}
                >
                  {isCashShort
                    ? `ناقص: ${fmtNum(cashShortRemaining)} ${currencySymbol}`
                    : `الباقي: ${fmtNum(changeDue)} ${currencySymbol}`}
                </div>
              </div>
            </div>

            {isCashShort && (
              <div className="bg-[#B91C1C] text-white rounded-lg px-2.5 py-1.5 text-[11px] font-bold flex items-center justify-between gap-2">
                <span>
                  لا يمكن إغلاق الفاتورة بمبلغ ناقص — باقي {fmtNum(cashShortRemaining)} {currencySymbol} لإتمام الدفع.
                </span>
                <button
                  type="button"
                  onClick={() => setCashTenderedInput(posNetTotal)}
                  className="bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded text-[10px] font-bold shrink-0 cursor-pointer"
                >
                  المضبوط
                </button>
              </div>
            )}
          </div>
        )}

        {(paymentMethod === 'instapay' ||
          paymentMethod === 'vodafone_cash' ||
          paymentMethod === 'card') && (
          <div className="flex items-center gap-2 bg-white rounded-xl border border-[#E8E0D5] px-2.5 py-1.5">
            <CreditCard className="w-3.5 h-3.5 text-[#9A6836] shrink-0" />
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="رقم مرجع التحويل / إيصال الفيزا (اختياري)..."
              className="flex-1 bg-transparent text-xs text-[#231710] outline-none"
            />
          </div>
        )}

        {paymentMethod === 'credit' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-[11px] font-bold text-amber-950">
            فاتورة بيع آجل ({fmtNum(posNetTotal)} {currencySymbol}) — يرجى التأكد من إدخال رقم موبايل العميل المعتمد أعلاه.
          </div>
        )}

        {paymentMethod === 'split' && setPaymentSplits && (
          <div className="bg-white rounded-xl p-2 border border-[#E8E0D5] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#231710]">توزيع الدفع المقسم:</span>
              <button
                type="button"
                onClick={() =>
                  setPaymentSplits((prev) => [
                    ...prev,
                    { method: 'vodafone_cash', amount: Math.max(0, splitRemaining) },
                  ])
                }
                className="text-[11px] font-bold bg-[#FAF6F0] border border-[#E8E0D5] hover:border-[#231710] px-2 py-0.5 rounded-md cursor-pointer"
              >
                + وسيلة
              </button>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {paymentSplits.map((sp, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <select
                    value={sp.method}
                    onChange={(e) => {
                      const val = e.target.value as PosPaymentSplit['method'];
                      setPaymentSplits((prev) =>
                        prev.map((row, rIdx) => (rIdx === idx ? { ...row, method: val } : row))
                      );
                    }}
                    className="bg-[#FAF6F0] border border-[#E8E0D5] rounded-lg px-2 py-1 text-xs font-bold outline-none"
                  >
                    <option value="cod">كاش</option>
                    <option value="card">فيزا</option>
                    <option value="instapay">إنستاباي</option>
                    <option value="vodafone_cash">فودافون كاش</option>
                    <option value="vip_wallet">محفظة VIP</option>
                    {creditConfig?.enableCreditSales && <option value="credit">آجل</option>}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={sp.amount || ''}
                    onChange={(e) => {
                      const amt = Math.max(0, Number(e.target.value) || 0);
                      setPaymentSplits((prev) =>
                        prev.map((row, rIdx) => (rIdx === idx ? { ...row, amount: amt } : row))
                      );
                    }}
                    placeholder="المبلغ"
                    className="w-24 bg-white border border-[#E8E0D5] rounded-lg px-2 py-1 text-xs font-bold tabular-nums outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const othersSum = paymentSplits.reduce(
                        (s, row, rIdx) => (rIdx === idx ? s : s + (Number(row.amount) || 0)),
                        0
                      );
                      const rem = Math.max(0, Math.round((posNetTotal - othersSum) * 100) / 100);
                      setPaymentSplits((prev) =>
                        prev.map((row, rIdx) => (rIdx === idx ? { ...row, amount: rem } : row))
                      );
                    }}
                    className="text-[10px] font-bold bg-[#FAF6F0] border border-[#E8E0D5] hover:bg-[#231710] hover:text-white px-2 py-1 rounded-lg cursor-pointer"
                  >
                    المتبقي
                  </button>
                  {paymentSplits.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentSplits((prev) => prev.filter((_, rIdx) => rIdx !== idx))
                      }
                      className="p-1 text-[#B83B2B] hover:bg-red-50 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div
              className={`text-[10px] font-bold px-2 py-1 rounded-lg flex justify-between tabular-nums ${
                isSplitMismatch
                  ? 'bg-red-50 text-[#B83B2B] border border-red-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              <span>الموزع: {fmtNum(splitAllocatedSum)} {currencySymbol}</span>
              <span>
                {isSplitMismatch ? `متبقي: ${fmtNum(splitRemaining)} ${currencySymbol}` : 'مطابق 100%'}
              </span>
            </div>
          </div>
        )}

        {/* Royal Gold 150 EGP VIP Cashback Alert Bar (High Contrast: #D4AF37 bg + #231710 text = 8.2:1) */}
        {showVip150Prompt && (
          <div className="bg-[#D4AF37] text-[#231710] border border-[#B89220] rounded-xl p-2 space-y-1.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-cairo font-extrabold">
                <Crown className="w-4 h-4 text-[#231710] shrink-0" />
                <span>
                  الفاتورة مؤهلة لكاش باك 5% — أدخل رقم هاتف العميل
                </span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="01XXXXXXXXX"
                  className="w-28 bg-white text-[#231710] border border-[#231710]/30 rounded-lg px-2 py-1 text-xs font-bold tabular-nums outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowVipNumpad((v) => !v)}
                  className="bg-[#231710] text-[#FAF6F0] hover:bg-[#3A271C] px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition"
                >
                  {showVipNumpad ? 'إخفاء' : 'لوحة أرقام'}
                </button>
              </div>
            </div>
            {showVipNumpad && (
              <div className="grid grid-cols-6 gap-1 pt-0.5" dir="ltr">
                {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setCustomerPhone((customerPhone + d).replace(/\D/g, '').slice(0, 11))
                    }
                    className="min-h-[38px] rounded-lg bg-[#FAF6F0] hover:bg-[#231710] hover:text-white text-[#231710] font-cairo font-black text-sm tabular-nums cursor-pointer transition"
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomerPhone(customerPhone.slice(0, -1))}
                  className="col-span-2 min-h-[38px] rounded-lg bg-[#231710] text-[#FAF6F0] text-xs font-bold cursor-pointer"
                >
                  حذف ⌫
                </button>
              </div>
            )}
          </div>
        )}

        {/* Final Totals + Primary Complete & Print CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-3 text-[11px] text-[#6B5B4E] tabular-nums flex-wrap">
            <span>المجموع: {fmtNum(posSubtotal)}</span>
            {posShipping > 0 && <span>توصيل: +{fmtNum(posShipping)}</span>}
            {totalDiscounts > 0 && (
              <span className="text-rose-700 font-bold">خصم: -{fmtNum(totalDiscounts)}</span>
            )}
            {taxConfig?.enableTax && <span>ض.ق.م: {fmtNum(posTaxAmount)}</span>}
            {posVipCashbackEarned > 0 && (
              <span className="text-[#166534] font-bold">
                كاش باك: +{fmtNum(posVipCashbackEarned)}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-bold text-[#6B5644]">الإجمالي:</span>
            <span className="font-cairo font-black text-2xl text-[#231710] tabular-nums">
              {fmtNum(posNetTotal)}
            </span>
            <span className="text-xs font-bold text-[#6B5644]">{currencySymbol}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={posItems.length === 0 || posLoading || isSplitMismatch || isCashShort}
          onClick={() => onCompleteInvoice()}
          className={`w-full min-h-[60px] disabled:opacity-40 disabled:cursor-not-allowed text-white font-cairo font-bold text-base py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
            paymentMethod === 'cod'
              ? 'bg-[#166534] hover:bg-[#14532d]'
              : 'bg-[#231710] hover:bg-[#3A271C]'
          }`}
        >
          {paymentMethod === 'cod' ? (
            <Zap className="w-5 h-5 shrink-0" />
          ) : (
            <Printer className="w-5 h-5 shrink-0" />
          )}
          <span>{posLoading ? 'جارٍ الحفظ والطباعة...' : primaryBtnLabel}</span>
        </button>
      </div>
    </section>
  );
}
