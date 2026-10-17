'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, MessageCircle } from 'lucide-react';
import { Order, PosShift, StoreSettings } from '@/types/store';
import { formatWhatsAppPhone } from '@/lib/defaults';

export interface StickerPreviewData {
  title: string;
  weightLabel: string;
  roastOrSpec: string;
  price: number;
  barcode: string;
  date: string;
}

interface SupermarketReceiptModalProps {
  order?: Order | null;
  sticker?: StickerPreviewData | null;
  shift?: PosShift | null;
  mode?: 'receipt' | 'sticker' | 'zreport';
  settings?: StoreSettings;
  autoPrintOnMount?: boolean;
  onClose: () => void;
}

export default function SupermarketReceiptModal({
  order,
  sticker,
  shift,
  mode = 'receipt',
  settings,
  autoPrintOnMount = false,
  onClose,
}: SupermarketReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Print strictly the receipt/sticker/Z-report HTML in an isolated 80mm/58mm auto-height frame
  // so the paper length matches ONLY the items on the receipt (like any supermarket POS).
  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;

    const receiptHtml = receiptRef.current.innerHTML;
    const isSticker = mode === 'sticker';
    const pageWidth = isSticker ? '58mm' : '80mm';
    const bodyWidth = isSticker ? '54mm' : '74mm';

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
  <title>${order ? `فاتورة ${order.orderNumber}` : 'بون محمصة حفصة'}</title>
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
      font-size: 11px;
      line-height: 1.25;
      direction: rtl;
      overflow: hidden !important;
      page-break-inside: avoid;
      break-inside: avoid;
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
      font-size: 10.5px;
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
      font-size: 9.5px;
      line-height: 1.2;
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
      font-family: monospace;
      font-size: 11px;
      letter-spacing: 2px;
      text-align: center;
      margin: 4px 0 2px 0;
      font-weight: 700;
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

  useEffect(() => {
    if (mounted && autoPrintOnMount && (order || sticker || shift)) {
      const timer = setTimeout(() => {
        handlePrintReceipt();
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [mounted, autoPrintOnMount, order, sticker, shift]);

  if (!mounted || (!order && !sticker && !shift)) return null;

  const totalItemsQty = order
    ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
    : 0;

  const storePhone = settings?.supportPhone || settings?.whatsappNumber || '01000000000';

  const paymentLabel =
    order?.paymentMethod === 'cod'
      ? 'نقدي (كاش)'
      : order?.paymentMethod === 'vodafone_cash'
        ? 'فودافون كاش'
        : order?.paymentMethod === 'instapay'
          ? 'إنستا باي'
          : 'محفظة VIP';

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
                width: 74mm !important;
                max-width: 74mm !important;
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

      <div className="flex flex-col items-center max-h-[94vh] w-full max-w-[310px] print:max-h-none print:max-w-none print:w-full">
        {/* Top Action Bar (Hidden in Print) */}
        <div className="w-full bg-[#231710] text-white rounded-t-2xl px-3.5 py-2.5 flex items-center justify-between border-b border-[#D4AF37]/40 no-print print:hidden">
          <span className="font-cairo font-black text-xs text-[#D4AF37]">
            {mode === 'sticker'
              ? '🏷️ استيكر الميزان'
              : mode === 'zreport'
                ? '📊 تقرير تقفيل الوردية (Z-Report)'
                : '🧾 بون سوبر ماركت حراري'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="bg-[#D4AF37] hover:bg-[#c9a12b] text-[#231710] font-cairo font-black text-xs px-3 py-1 rounded-lg flex items-center gap-1 cursor-pointer shadow"
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

        {/* Thermal Receipt Paper Roll (Exact Supermarket Width & Auto Height by Items) */}
        <div className="w-full bg-white text-black shadow-2xl overflow-y-auto px-3 py-2.5 border-x border-gray-300 print:shadow-none print:border-0 print:p-0 print:overflow-visible">
          <div id="supermarket-receipt-print-area" ref={receiptRef}>
            {mode === 'sticker' && sticker ? (
              /* COMPACT 58x40mm BARCODE SCALE / BARISTA STICKER */
              <div className="sr-center space-y-1">
                <div className="sr-black text-xs">محمصة حفصة للبن والمكسرات</div>
                <hr className="sr-divider" />
                <div className="sr-black text-sm">{sticker.title}</div>
                <div className="sr-bold text-[10.5px]">
                  {sticker.weightLabel} • {sticker.roastOrSpec}
                </div>
                <div className="sr-total-box sr-center">السعر: {sticker.price} ج.م</div>
                <div className="sr-barcode">||{sticker.barcode}||</div>
                <div className="text-[9px]">تاريخ التعبئة: {sticker.date} • بني مزار</div>
              </div>
            ) : mode === 'zreport' && shift ? (
              /* COMPACT 80mm SHIFT Z-REPORT SLIP */
              <div>
                <div className="sr-center">
                  <div className="sr-black text-sm">محمصة حفصة للبن والمكسرات</div>
                  <div className="text-[10px] sr-bold">تقرير تقفيل وردية الكاشير (Z-Report)</div>
                </div>
                <hr className="sr-divider" />
                <div className="text-[10.5px]">
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
                    <span>فودافون كاش + إنستاباي:</span>
                    <span>{shift.vodafoneCashTotal + shift.instapayTotal} ج.م</span>
                  </div>
                  <div className="sr-row">
                    <span>مصروفات الدرج النثرية:</span>
                    <span>-{shift.expensesTotal} ج.م</span>
                  </div>
                  <div className="sr-total-box sr-row">
                    <span>النقدية بالدرج:</span>
                    <span>{shift.expectedCashInDrawer} ج.م</span>
                  </div>
                  <div className="sr-row sr-bold">
                    <span>صافي الربح الفعلي:</span>
                    <span>+{shift.totalNetProfit} ج.م</span>
                  </div>
                </div>
                <hr className="sr-divider" />
                <div className="sr-center text-[9.5px]">
                  تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}
                </div>
              </div>
            ) : (
              order && (
                /* COMPACT 80mm SUPERMARKET THERMAL RECEIPT */
                <div>
                  {/* 1. Supermarket Header */}
                  <div className="sr-center">
                    <div className="sr-black text-sm">محمصة حفصة للبن والمكسرات</div>
                    <div className="text-[10px] sr-bold">
                      بني مزار - أمام مسجد الزراعيين
                    </div>
                    <div className="text-[10px]">ت: {storePhone}</div>
                  </div>

                  <hr className="sr-divider" />

                  {/* 2. Compact Receipt Meta */}
                  <div className="text-[10px]">
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
                        <div className="text-[9.5px] sr-bold mt-0.5">
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
                  <div className="text-[10.5px]">
                    <div className="sr-row">
                      <span>عدد القطع: {totalItemsQty}</span>
                      <span>المجموع: {order.subtotal} ج.م</span>
                    </div>

                    {order.discountAmount > 0 && (
                      <div className="sr-row">
                        <span>الخصم:</span>
                        <span>-{order.discountAmount} ج.م</span>
                      </div>
                    )}

                    {(order.vipWalletRedeemed || 0) > 0 && (
                      <div className="sr-row sr-bold">
                        <span>خصم محفظة VIP:</span>
                        <span>-{order.vipWalletRedeemed} ج.م</span>
                      </div>
                    )}

                    {order.shippingCost > 0 && (
                      <div className="sr-row">
                        <span>التوصيل:</span>
                        <span>+{order.shippingCost} ج.م</span>
                      </div>
                    )}

                    <div className="sr-total-box sr-row">
                      <span>الإجمالي المطلوب:</span>
                      <span>{order.total} ج.م</span>
                    </div>

                    {order.cashTendered !== undefined && order.cashTendered > 0 && (
                      <div className="sr-row text-[10px]">
                        <span>المدفوع: {order.cashTendered} ج.م</span>
                        <span className="sr-black">
                          الباقي: {order.changeDue || 0} ج.م
                        </span>
                      </div>
                    )}

                    {(order.vipCashbackEarned || 0) > 0 && (
                      <div className="sr-row text-[10px] sr-bold mt-0.5">
                        <span>كاش باك VIP المضاف (5%):</span>
                        <span>+{order.vipCashbackEarned} ج.م</span>
                      </div>
                    )}
                  </div>

                  <hr className="sr-divider" />

                  {/* 5. Compact Barcode & Footer */}
                  <div className="sr-barcode">*{order.orderNumber}*</div>
                  <div className="sr-center text-[9.5px] sr-bold">
                    شكراً لتسوقكم من محمصة حفصة • بالهنا والعافية
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Bottom Action Bar (Hidden in Print) */}
        <div className="w-full bg-[#231710] text-white rounded-b-2xl p-2.5 flex items-center gap-2 border-t border-[#D4AF37]/40 no-print print:hidden">
          <button
            type="button"
            onClick={handlePrintReceipt}
            className="flex-1 bg-[#D4AF37] hover:bg-[#c9a12b] text-[#231710] font-cairo font-black text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة فورية (حجم الأصناف فقط)</span>
          </button>

          {order &&
            order.customerPhone &&
            order.customerPhone !== '01000000000' && (
              <a
                href={`https://wa.me/${formatWhatsAppPhone(
                  order.customerPhone
                )}?text=${encodeURIComponent(
                  `فاتورة محمصة حفصة #${order.orderNumber}\nالإجمالي: ${order.total} ج.م\nكاش باك VIP: +${
                    order.vipCashbackEarned || 0
                  } ج.م\nشكراً لزيارتك محمصة حفصة (بني مزار - أمام مسجد الزراعيين)`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="bg-[#3B6E4C] hover:bg-[#2f5a3d] text-white font-cairo font-black text-xs px-3 py-2 rounded-xl flex items-center gap-1"
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
