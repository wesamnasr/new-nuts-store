'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, MessageCircle, Usb, Archive } from 'lucide-react';
import { Order, PosReturnRecord, PosShift, StoreSettings } from '@/types/store';
import { formatWhatsAppPhone } from '@/lib/validation';
import { getCityName, getCurrencySymbol } from '@/lib/defaults';
import { Code128BarcodeSvg, QrCodeSvg } from '@/lib/barcode-svg';
import { buildTaxReceiptQrValue } from '@/lib/tax';
import {
  openCashDrawerDirect,
  printReceiptElementEscPos,
} from '@/lib/escpos-printer';

export interface StickerPreviewData {
  title: string;
  weightLabel: string;
  roastOrSpec: string;
  price: number;
  barcode: string;
  date: string;
  recipeLines?: string[];
  baristaNotes?: string;
}

interface SupermarketReceiptModalProps {
  order?: Order | null;
  sticker?: StickerPreviewData | null;
  shift?: PosShift | null;
  returnRecord?: PosReturnRecord | null;
  mode?: 'receipt' | 'sticker' | 'zreport' | 'return';
  settings?: StoreSettings;
  autoPrintOnMount?: boolean;
  showProfit?: boolean;
  onClose: () => void;
}

export default function SupermarketReceiptModal({
  order,
  sticker,
  shift,
  returnRecord,
  mode = 'receipt',
  settings,
  autoPrintOnMount = false,
  showProfit = false,
  onClose,
}: SupermarketReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [escPosStatus, setEscPosStatus] = useState<string>('');
  const [escPosBusy, setEscPosBusy] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const configuredPaperWidthMm = settings?.thermalPaperWidthMm === 58 ? 58 : 80;
  const isNarrow58 = mode === 'sticker' || configuredPaperWidthMm === 58;

  // Print strictly the receipt/sticker/Z-report HTML in an isolated 80mm/58mm auto-height frame
  // so the paper length matches ONLY the items on the receipt (like any supermarket POS).
  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;

    const receiptHtml = receiptRef.current.innerHTML;
    const isSticker = mode === 'sticker';
    const pageWidth = isSticker || configuredPaperWidthMm === 58 ? '58mm' : '80mm';
    const bodyWidth = isSticker ? '54mm' : configuredPaperWidthMm === 58 ? '52mm' : '74mm';
    const baseFontPx = configuredPaperWidthMm === 58 && !isSticker ? '10px' : '11px';

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${order ? `فاتورة ${order.orderNumber}` : `بون ${settings?.storeName || 'المتجر'}`}</title>
  <style>
    @page {
      size: ${pageWidth} auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      color: #000000 !important;
      background: transparent !important;
    }
    html, body {
      width: ${bodyWidth};
      max-width: ${bodyWidth};
      height: fit-content !important;
      min-height: 0 !important;
      max-height: fit-content !important;
      margin: 0 auto !important;
      padding: 1.5mm 1.5mm 3mm 1.5mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Tahoma', 'Arial', sans-serif;
      font-size: ${baseFontPx};
      line-height: 1.25;
      direction: rtl;
      overflow: hidden !important;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    svg {
      max-width: 100%;
      display: block;
      margin: 0 auto;
    }
    .sr-center { text-align: center; }
    .sr-left { text-align: left; }
    .sr-right { text-align: right; }
    .sr-bold { font-weight: 700; }
    .sr-black { font-weight: 900; }
    .sr-divider {
      border: 0;
      border-top: 1px dashed #000;
      margin: 4px 0;
    }
    .sr-double-divider {
      border: 0;
      border-top: 2px solid #000;
      margin: 4px 0;
    }
    .sr-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 4px;
      margin: 1.5px 0;
    }
    table.sr-table {
      width: 100%;
      border-collapse: collapse;
      margin: 3px 0;
      font-size: ${baseFontPx};
    }
    table.sr-table th {
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      padding: 2.5px 1px;
      font-weight: 900;
      text-align: right;
    }
    table.sr-table td {
      padding: 2.5px 1px;
      vertical-align: top;
      border-bottom: 1px dotted #ccc;
    }
    table.sr-table tr:last-child td {
      border-bottom: none;
    }
    .sr-sub {
      font-size: 11px;
      line-height: 1.25;
      margin-top: 1px;
    }
    .sr-total-box {
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      padding: 3px 0;
      margin: 4px 0;
      font-size: 13px;
      font-weight: 900;
    }
    .sr-barcode {
      text-align: center;
      margin: 4px 0 2px 0;
    }
  </style>
</head>
<body>
  ${receiptHtml}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 120);
  };

  const handleDirectEscPosPrint = async (kickDrawer?: boolean) => {
    if (!receiptRef.current || escPosBusy) return;
    setEscPosBusy(true);
    setEscPosStatus('');
    try {
      const shouldKick =
        kickDrawer ??
        (settings?.autoOpenCashDrawer !== false &&
          (mode === 'receipt' || mode === 'return'));
      const res = await printReceiptElementEscPos(receiptRef.current, {
        paperWidthMm: isNarrow58 ? 58 : 80,
        openCashDrawer: shouldKick,
        cutPaper: true,
      });
      if (res.success) {
        setEscPosStatus(
          shouldKick
            ? 'تمت الطباعة الحرارية الصامتة وفتح الدرج بنجاح'
            : 'تمت الطباعة الحرارية الصامتة بنجاح'
        );
      } else {
        setEscPosStatus(res.error || 'تعذر الاتصال بالطابعة الحرارية المباشرة');
      }
    } finally {
      setEscPosBusy(false);
    }
  };

  const handleKickDrawerOnly = async () => {
    if (escPosBusy) return;
    setEscPosBusy(true);
    setEscPosStatus('');
    try {
      const res = await openCashDrawerDirect();
      if (res.success) {
        setEscPosStatus('تم إرسال نبضة فتح درج النقدية (ESC p) بنجاح');
      } else {
        setEscPosStatus(res.error || 'تعذر فتح درج النقدية');
      }
    } finally {
      setEscPosBusy(false);
    }
  };

  useEffect(() => {
    if (!mounted || (!order && !sticker && !shift && !returnRecord)) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, order, sticker, shift, returnRecord, onClose]);

  useEffect(() => {
    if (mounted && autoPrintOnMount && (order || sticker || shift || returnRecord)) {
      const timer = setTimeout(async () => {
        if (settings?.enableDirectEscPosPrint && receiptRef.current) {
          const res = await printReceiptElementEscPos(receiptRef.current, {
            paperWidthMm: isNarrow58 ? 58 : 80,
            openCashDrawer:
              settings?.autoOpenCashDrawer !== false &&
              (mode === 'receipt' || mode === 'return'),
            cutPaper: true,
          });
          if (res.success) {
            setEscPosStatus('تمت الطباعة الصامتة (ESC/POS) تلقائياً');
            return;
          }
        }
        handlePrintReceipt();
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [mounted, autoPrintOnMount, order, sticker, shift, returnRecord]);

  if (!mounted || (!order && !sticker && !shift && !returnRecord)) return null;

  const totalItemsQty = order
    ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
    : 0;

  const storePhone = settings?.supportPhone || settings?.whatsappNumber || '01107677672';
  const storeName = settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const storeAddress = settings?.address || 'مركز بني مزار — أمام مسجد الزراعيين مباشرة';
  const cityName = getCityName(settings);
  const currency = getCurrencySymbol(settings);

  const isTaxReceipt = Boolean(
    settings?.enableTax || (order?.taxAmount && order.taxAmount > 0)
  );

  const paymentLabel =
    order?.paymentMethod === 'cod'
      ? 'نقدي (كاش)'
      : order?.paymentMethod === 'card'
      ? 'فيزا ماكينة الفرع'
      : order?.paymentMethod === 'vodafone_cash'
        ? 'فودافون كاش'
        : order?.paymentMethod === 'instapay'
          ? 'إنستا باي'
          : order?.paymentMethod === 'split'
            ? 'دفع مقسم'
            : order?.paymentMethod === 'credit'
              ? 'بيع آجل (ذمم)'
              : 'محفظة VIP';

  const splitMethodLabel = (m: string) => {
    if (m === 'cod') return 'كاش';
    if (m === 'card') return 'فيزا الفرع';
    if (m === 'vodafone_cash') return 'فودافون كاش';
    if (m === 'instapay') return 'إنستاباي';
    if (m === 'vip_wallet') return 'محفظة VIP';
    if (m === 'credit') return 'آجل بذمة العميل';
    return m;
  };

  const modalContent = (
    <div
      id="supermarket-receipt-portal"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto print:static print:bg-white print:p-0 print:block"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body > *:not(#supermarket-receipt-portal) {
                display: none !important;
              }
              #supermarket-receipt-portal {
                position: static !important;
                width: ${isNarrow58 ? '52mm' : '74mm'} !important;
                max-width: ${isNarrow58 ? '52mm' : '74mm'} !important;
                height: fit-content !important;
                min-height: 0 !important;
                margin: 0 auto !important;
                padding: 1.5mm !important;
                background: #ffffff !important;
              }
            }
          `,
        }}
      />

      <div
        className={`flex flex-col items-center max-h-[94vh] w-full ${
          isNarrow58 ? 'max-w-[260px]' : 'max-w-[325px]'
        } print:max-h-none print:max-w-none print:w-full`}
      >
        {/* Top Action Bar (Hidden in Print) */}
        <div className="w-full bg-[#231710] text-white rounded-t-2xl px-3.5 py-2.5 flex items-center justify-between border-b border-[#D4AF37]/40 no-print print:hidden">
          <span className="font-cairo font-black text-xs text-[#D4AF37]">
            {mode === 'sticker'
              ? 'استيكر الميزان'
              : mode === 'zreport'
                ? 'تقرير تقفيل الوردية (Z-Report)'
                : mode === 'return'
                  ? 'إيصال مرتجع مبيعات حراري'
                  : isTaxReceipt
                    ? 'إيصال ضريبي إلكتروني حراري'
                    : 'بون سوبر ماركت حراري'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleKickDrawerOnly}
              disabled={escPosBusy}
              title="فتح درج النقدية مباشرة (ESC p)"
              className="bg-white/10 hover:bg-white/20 text-[#D4AF37] p-1.5 rounded-lg cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="bg-[#D4AF37] hover:bg-[#c9a12b] text-[#231710] font-cairo font-black text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة البون</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 text-white p-1 rounded-lg cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {escPosStatus && (
          <div className="w-full bg-amber-50 text-amber-950 text-[11px] font-cairo font-bold px-3 py-1.5 border-x border-amber-200 text-center no-print print:hidden">
            {escPosStatus}
          </div>
        )}

        {/* Thermal Receipt Paper Roll (Exact Supermarket Width & Auto Height by Items) */}
        <div className="w-full bg-white text-black shadow-2xl overflow-y-auto px-3 py-2.5 border-x border-gray-300 print:shadow-none print:border-0 print:p-0 print:overflow-visible">
          <div id="supermarket-receipt-print-area" ref={receiptRef}>
            {mode === 'sticker' && sticker ? (
              /* COMPACT 58x40mm BARCODE SCALE / BARISTA STICKER */
              <div className="sr-center space-y-1">
                <div className="sr-black text-xs">{storeName}</div>
                <hr className="sr-divider" />
                <div className="sr-black text-sm">{sticker.title}</div>
                <div className="sr-bold text-[11px]">
                  {sticker.weightLabel} • {sticker.roastOrSpec}
                </div>
                {Array.isArray(sticker.recipeLines) && sticker.recipeLines.length > 0 && (
                  <div className="text-[11px] border border-dashed border-black/40 rounded p-1 text-right space-y-0.5 my-1 bg-black/5">
                    <div className="font-bold text-[11px] text-center">مكونات الخلطة / البوكس:</div>
                    {sticker.recipeLines.map((line, idx) => (
                      <div key={idx} className="leading-tight">• {line}</div>
                    ))}
                  </div>
                )}
                {sticker.baristaNotes && (
                  <div className="text-[11px] italic text-center text-black/80">{sticker.baristaNotes}</div>
                )}
                <div className="sr-total-box sr-center">السعر: {sticker.price} ج.م</div>
                <div className="sr-barcode">
                  <Code128BarcodeSvg value={sticker.barcode} height={32} showText={true} />
                </div>
                <div className="text-[11px]">تاريخ التعبئة: {sticker.date} • {cityName}</div>
              </div>
            ) : mode === 'zreport' && shift ? (
              /* COMPACT 80mm SHIFT Z-REPORT SLIP */
              <div>
                <div className="sr-center">
                  <div className="sr-black text-sm">{storeName}</div>
                  <div className="text-[11px] sr-bold">تقرير تقفيل وردية الكاشير (Z-Report)</div>
                  {shift.registerName && (
                    <div className="text-[11px] sr-bold">الجهاز: {shift.registerName}</div>
                  )}
                </div>
                <hr className="sr-divider" />
                <div className="text-[11px]">
                  <div className="sr-row">
                    <span>رقم الوردية:</span>
                    <span className="sr-black">{shift.shiftNumber}</span>
                  </div>
                  <div className="sr-row">
                    <span>الكاشير:</span>
                    <span className="sr-bold">{shift.cashierName}</span>
                  </div>
                  <div className="sr-row">
                    <span>الفترة:</span>
                    <span>{shift.shiftPeriod}</span>
                  </div>
                  <hr className="sr-divider" />
                  <div className="sr-row">
                    <span>رصيد بداية الدرج:</span>
                    <span>{shift.openingCash} ج.م</span>
                  </div>
                  <div className="sr-row">
                    <span>مبيعات الكاش النقدية:</span>
                    <span className="sr-bold">+{shift.cashSalesTotal} ج.م</span>
                  </div>
                  <div className="sr-row">
                    <span>مبيعات ماكينة الفيزا:</span>
                    <span className="sr-bold">+{shift.cardSales || shift.cardSalesTotal || 0} ج.م</span>
                  </div>
                  <div className="sr-row">
                    <span>فودافون كاش + إنستاباي:</span>
                    <span>{shift.vodafoneCashTotal + shift.instapayTotal} ج.م</span>
                  </div>
                  {(shift.creditSalesTotal || 0) > 0 && (
                    <div className="sr-row">
                      <span>مبيعات آجلة (ذمم):</span>
                      <span>{shift.creditSalesTotal} ج.م</span>
                    </div>
                  )}
                  {(shift.debtCollectionsCashTotal || 0) > 0 && (
                    <div className="sr-row">
                      <span>تحصيل مديونيات نقداً:</span>
                      <span className="sr-bold">+{shift.debtCollectionsCashTotal} ج.م</span>
                    </div>
                  )}
                  <div className="sr-row">
                    <span>مصروفات الدرج النثرية:</span>
                    <span>-{shift.expensesTotal} ج.م</span>
                  </div>
                  {shift && (shift.riderCodSettledTotal || 0) > 0 && (
                    <div className="sr-row">
                      <span>توريدات عهدة المناديب (COD):</span>
                      <span className="sr-bold">+{shift.riderCodSettledTotal} ج.م</span>
                    </div>
                  )}
                  {(shift.cashReturnsTotal || 0) > 0 && (
                    <div className="sr-row">
                      <span>مرتجعات مبيعات نقدية:</span>
                      <span>-{shift.cashReturnsTotal} ج.م</span>
                    </div>
                  )}
                  <div className="sr-total-box sr-row">
                    <span>النقدية بالدرج:</span>
                    <span>{shift.expectedCashInDrawer} ج.م</span>
                  </div>
                  {showProfit && typeof shift.totalNetProfit === 'number' && (
                    <div className="sr-row sr-bold">
                      <span>صافي الربح الفعلي:</span>
                      <span>+{shift.totalNetProfit} ج.م</span>
                    </div>
                  )}
                </div>
                <hr className="sr-divider" />
                <div className="sr-center text-[11px]">
                  تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}
                </div>
              </div>
            ) : mode === 'return' && returnRecord ? (
              /* COMPACT 80mm POS RETURN / REFUND RECEIPT */
              <div>
                <div className="sr-center">
                  <div className="sr-black text-sm">{storeName}</div>
                  <div className="text-[11px] sr-black">إيصال مرتجع مبيعات (بون استرداد)</div>
                  <div className="text-[11px]">ت: {storePhone}</div>
                </div>
                <hr className="sr-divider" />
                <div className="text-[11px]">
                  <div className="sr-row">
                    <span className="sr-black">رقم المرتجع: {returnRecord.returnNumber}</span>
                    <span>{new Date(returnRecord.createdAt).toLocaleString('ar-EG')}</span>
                  </div>
                  <div className="sr-row">
                    <span>الفاتورة الأصلية: #{returnRecord.orderNumber}</span>
                    <span>الموظف: {returnRecord.processedBy}</span>
                  </div>
                  <div className="sr-row">
                    <span>طريقة الرد:</span>
                    <span className="sr-bold">
                      {returnRecord.refundMethod === 'cash'
                        ? 'نقداً من الدرج'
                        : returnRecord.refundMethod === 'vip_wallet'
                          ? 'إضافة بمحفظة VIP'
                          : returnRecord.refundMethod === 'credit_deduction'
                            ? 'خصم مديونية آجلة'
                            : 'رد إلكتروني'}
                    </span>
                  </div>
                  {returnRecord.reason && (
                    <div className="text-[11px] mt-0.5">السبب: {returnRecord.reason}</div>
                  )}
                </div>

                <table className="sr-table">
                  <thead>
                    <tr>
                      <th style={{ width: '58%' }}>الصنف المرتجع</th>
                      <th style={{ width: '16%', textAlign: 'center' }}>كمية</th>
                      <th style={{ width: '26%', textAlign: 'left' }}>المسترد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnRecord.items.map((ri, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="sr-black">
                            {ri.productName}
                            {ri.unitLabel ? ` (${ri.unitLabel})` : ''}
                          </div>
                          <div className="sr-sub">
                            {ri.condition === 'damaged' ? 'حالة: تالف/هالك' : 'حالة: سليم للمخزن'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }} className="sr-bold">
                          {ri.returnQty}
                        </td>
                        <td style={{ textAlign: 'left' }} className="sr-black">
                          {ri.refundAmount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="sr-total-box sr-row">
                  <span>إجمالي المبلغ المسترد:</span>
                  <span>{returnRecord.totalRefundAmount} ج.م</span>
                </div>
                <div className="sr-barcode">
                  <Code128BarcodeSvg value={returnRecord.returnNumber} height={34} showText={true} />
                </div>
                <div className="sr-center text-[11px] sr-bold">
                  شكراً لتعاملكم مع {storeName}
                </div>
              </div>
            ) : (
              order && (
                /* COMPACT 80mm SUPERMARKET THERMAL RECEIPT */
                <div>
                  {/* 1. Supermarket Header */}
                  <div className="sr-center">
                    <img
                      src="/images/brand/hafsa-logo-icon.png"
                      alt={storeName}
                      className="w-12 h-12 mx-auto mb-1 object-contain grayscale contrast-125"
                    />
                    <div className="sr-black text-sm">{storeName}</div>
                    <div className="text-[11px] sr-bold">{storeAddress}</div>
                    <div className="text-[11px]">ت / واتساب: {storePhone}</div>
                    {isTaxReceipt && settings?.taxRegistrationNumber && (
                      <div className="text-[11px] sr-black mt-0.5">
                        إيصال ضريبي مبسط • ر.ت.ض: {settings.taxRegistrationNumber}
                        {settings.taxBranchId ? ` • فرع: ${settings.taxBranchId}` : ''}
                      </div>
                    )}
                  </div>

                  <hr className="sr-divider" />

                  {/* 2. Compact Receipt Meta */}
                  <div className="text-[11px]">
                    <div className="sr-row">
                      <span className="sr-black">بون: #{order.orderNumber}</span>
                      <span>
                        {new Date(order.createdAt).toLocaleString('ar-EG', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="sr-row">
                      <span>العميل: {order.customerName}</span>
                      <span>الدفع: {paymentLabel}</span>
                    </div>
                    {order.customerPhone && order.customerPhone !== '01000000000' && (
                      <div className="sr-row">
                        <span>هاتف: {order.customerPhone}</span>
                        {order.governorate && <span>{order.governorate}</span>}
                      </div>
                    )}
                    {order.address &&
                      !order.address.includes('استلام فوري من كاونتر') && (
                        <div className="text-[11px] sr-bold mt-0.5">
                          العنوان: {order.address}
                        </div>
                      )}
                  </div>

                  {/* 3. Supermarket Items Table (Height grows ONLY by items) */}
                  <table className="sr-table">
                    <thead>
                      <tr>
                        <th style={{ width: '54%' }}>الصنف</th>
                        <th style={{ width: '12%', textAlign: 'center' }}>كمية</th>
                        <th style={{ width: '16%', textAlign: 'left' }}>سعر</th>
                        <th style={{ width: '18%', textAlign: 'left' }}>إجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((it, idx) => {
                        const lineTotal = Math.round(it.unitPrice * it.quantity * 10) / 10;
                        return (
                          <tr key={idx}>
                            <td>
                              <div className="sr-black">
                                {it.productName}
                                {it.weightLabel ? ` (${it.weightLabel})` : ''}
                              </div>
                              {it.roastOption && (
                                <div className="sr-sub">
                                  {it.roastOption}
                                  {it.workerNotes ? ` - ${it.workerNotes}` : ''}
                                </div>
                              )}
                              {it.isPartitionedBox && it.partitionedSlots && (
                                <div className="sr-sub">
                                  {it.partitionedSlots
                                    .map((s) => `${s.productName} (${s.slotGrams}جم)`)
                                    .join(' + ')}
                                </div>
                              )}
                              {it.isCoffeeBlend && it.coffeeBlendSpec && (
                                <div className="sr-sub">
                                  {it.coffeeBlendSpec.baristaLabel}
                                </div>
                              )}
                              {it.isCustomMix && it.customBreakdown && it.customBreakdown.length > 0 && (
                                <div className="sr-sub">
                                  {it.customBreakdown
                                    .map((b) => `${b.productName} (${b.roastOption} • ${b.percentage}% • ${b.weightGrams}جم)`)
                                    .join(' + ')}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }} className="sr-bold">
                              {it.quantity}
                            </td>
                            <td style={{ textAlign: 'left' }}>{it.unitPrice}</td>
                            <td style={{ textAlign: 'left' }} className="sr-black">
                              {lineTotal}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <hr className="sr-divider" />

                  {/* 4. Compact Supermarket Totals */}
                  <div className="text-[11px]">
                    <div className="sr-row">
                      <span>عدد القطع: {totalItemsQty}</span>
                      <span>المجموع: {order.subtotal} ج.م</span>
                    </div>

                    {order.discountAmount > 0 && (
                      <div className="sr-row">
                        <span>
                          الخصم{order.couponCode ? ` (${order.couponCode})` : ''}:
                        </span>
                        <span>-{order.discountAmount} ج.م</span>
                      </div>
                    )}

                    {(order.vipWalletRedeemed || 0) > 0 && (
                      <div className="sr-row sr-bold">
                        <span>خصم محفظة VIP:</span>
                        <span>-{order.vipWalletRedeemed} ج.م</span>
                      </div>
                    )}

                    {isTaxReceipt && (order.taxAmount || 0) > 0 && (
                      <div className="sr-row">
                        <span>
                          ض.ق.م ({order.taxRatePercent ?? settings?.taxRatePercent ?? 14}%{' '}
                          {order.taxInclusive !== false ? 'شامل' : 'مضاف'}):
                        </span>
                        <span>{order.taxAmount} ج.م</span>
                      </div>
                    )}

                    {order.shippingCost > 0 && (
                      <div className="sr-row">
                        <span>التوصيل:</span>
                        <span>+{order.shippingCost} ج.م</span>
                      </div>
                    )}

                    {shift && (shift.riderCodSettledTotal || 0) > 0 && (
                      <div className="sr-row">
                        <span>توريدات عهدة المناديب (COD):</span>
                        <span className="sr-bold">+{shift.riderCodSettledTotal} ج.م</span>
                      </div>
                    )}

                    <div className="sr-total-box sr-row">
                      <span>الإجمالي المطلوب:</span>
                      <span>{order.total} ج.م</span>
                    </div>

                    {/* Split Payments Breakdown */}
                    {Array.isArray(order.paymentSplits) && order.paymentSplits.length > 0 && (
                      <div className="text-[11px] border border-dashed border-black/40 rounded p-1 my-1 space-y-0.5">
                        <div className="sr-bold">تفصيل الدفع المقسم:</div>
                        {order.paymentSplits.map((sp, i) => (
                          <div key={i} className="sr-row">
                            <span>• {splitMethodLabel(sp.method)}:</span>
                            <span className="sr-bold">{sp.amount} ج.م</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Credit Due Breakdown */}
                    {(order.creditDueAmount || 0) > 0 && (
                      <div className="sr-row text-[11px] sr-black">
                        <span>مسجل آجل بذمة العميل:</span>
                        <span>{order.creditDueAmount} ج.م</span>
                      </div>
                    )}

                    {order.cashTendered !== undefined && order.cashTendered > 0 && (
                      <div className="sr-row text-[11px]">
                        <span>المدفوع: {order.cashTendered} ج.م</span>
                        <span className="sr-black">
                          الباقي: {order.changeDue || 0} ج.م
                        </span>
                      </div>
                    )}

                    {(order.vipCashbackEarned || 0) > 0 && (
                      <div className="sr-row text-[11px] sr-bold mt-0.5">
                        <span>كاش باك VIP المضاف (5%):</span>
                        <span>+{order.vipCashbackEarned} ج.م</span>
                      </div>
                    )}
                  </div>

                  <hr className="sr-divider" />

                  {/* 5. Scannable 1D Barcode + Optional ETA Tax QR Code & Footer */}
                  <div className="sr-barcode">
                    <Code128BarcodeSvg
                      value={order.orderNumber}
                      height={34}
                      showText={true}
                    />
                  </div>

                  {isTaxReceipt && (
                    <div className="my-1.5 flex flex-col items-center">
                      <QrCodeSvg
                        value={buildTaxReceiptQrValue(order, settings)}
                        size={84}
                        caption={
                          order.etaReceiptUuid
                            ? `ETA UUID: ${order.etaReceiptUuid.slice(0, 18)}...`
                            : 'رمز التحقق الضريبي الإلكتروني (ETA QR)'
                        }
                      />
                    </div>
                  )}

                  <div className="sr-center text-[11px] sr-bold mt-1">
                    اطلب أونلاين وخد 5% كاش باك في محفظتك!
                  </div>
                  <div className="sr-center text-[10px] mt-0.5">
                    شكراً لتسوقكم من {storeName} • نتشرف بخدمتكم دائماً
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Bottom Action Bar (Hidden in Print) */}
        <div className="w-full bg-[#231710] text-white rounded-b-2xl p-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#D4AF37]/40 no-print print:hidden">
          <button
            type="button"
            autoFocus={!autoPrintOnMount}
            onClick={handlePrintReceipt}
            className="flex-1 min-w-[130px] bg-[#D4AF37] hover:bg-[#c9a12b] text-[#231710] font-cairo font-black text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>طباعة المتصفح</span>
          </button>

          <button
            type="button"
            disabled={escPosBusy}
            onClick={() => handleDirectEscPosPrint()}
            title="طباعة حرارية صامتة مباشرة عبر USB/Serial + فتح الدرج"
            className="bg-white/15 hover:bg-white/25 text-white font-cairo font-bold text-[11px] py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
          >
            <Usb className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span>{escPosBusy ? 'جارٍ...' : 'ESC/POS + الدرج'}</span>
          </button>

          {order &&
            order.customerPhone &&
            order.customerPhone !== '01000000000' && (
              <a
                href={`https://wa.me/${formatWhatsAppPhone(
                  order.customerPhone
                )}?text=${encodeURIComponent(
                  `فاتورة ${storeName} #${order.orderNumber}\nالإجمالي: ${order.total} ${currency}\nكاش باك VIP: +${
                    order.vipCashbackEarned || 0
                  } ${currency}\nشكراً لزيارتك ${storeName} (${storeAddress})`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="bg-[#3B6E4C] hover:bg-[#2f5a3d] text-white font-cairo font-black text-xs px-2.5 py-2 rounded-xl flex items-center gap-1"
                title="إرسال واتساب"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>واتساب</span>
              </a>
            )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
