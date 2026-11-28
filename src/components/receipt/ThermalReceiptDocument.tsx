'use client';

import React from 'react';
import { Order, PosShift, ReceiptConfig, StoreSettings } from '@/types/store';
import { getCurrencySymbol, getResolvedReceiptConfig } from '@/lib/defaults';
import { Code128BarcodeSvg, QrCodeSvg } from '@/lib/barcode-svg';
import { buildTaxReceiptQrValue } from '@/lib/tax';

export interface ReceiptPaperMetrics {
  paperWidthMm: 58 | 80;
  pageWidthCss: string;
  bodyWidthCss: string;
  previewWidthPx: number;
  baseFontPx: number;
  subFontPx: number;
  titleFontPx: number;
  totalFontPx: number;
  dividerBorderCss: string;
}

export function getReceiptPaperMetrics(
  config: Required<ReceiptConfig>,
  isSticker = false
): ReceiptPaperMetrics {
  const paperWidthMm: 58 | 80 = isSticker || config.paperWidthMm === 58 ? 58 : 80;
  const is58 = paperWidthMm === 58;

  const fontDelta =
    config.fontSizeMode === 'compact' ? -1 : config.fontSizeMode === 'large' ? 1.5 : 0;

  const baseFontPx = Math.max(9, Math.round((is58 ? 10 : 11) + fontDelta));
  const subFontPx = Math.max(8.5, baseFontPx - 1);
  const titleFontPx = Math.round(baseFontPx + 3.5);
  const totalFontPx = Math.round(baseFontPx + 2);

  const dividerBorderCss =
    config.dividerStyle === 'solid'
      ? '1px solid #000000'
      : config.dividerStyle === 'double'
        ? '3px double #000000'
        : '1px dashed #000000';

  return {
    paperWidthMm,
    pageWidthCss: is58 ? '58mm' : '80mm',
    bodyWidthCss: isSticker ? '54mm' : is58 ? '52mm' : '74mm',
    previewWidthPx: is58 ? 236 : 316,
    baseFontPx,
    subFontPx,
    titleFontPx,
    totalFontPx,
    dividerBorderCss,
  };
}

export function buildThermalReceiptPrintHtml(params: {
  receiptHtml: string;
  title: string;
  config: Required<ReceiptConfig>;
  isSticker?: boolean;
}): string {
  const { receiptHtml, title, config, isSticker = false } = params;
  const m = getReceiptPaperMetrics(config, isSticker);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page {
      size: ${m.pageWidthCss} auto;
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
      width: ${m.bodyWidthCss};
      max-width: ${m.bodyWidthCss};
      height: fit-content !important;
      min-height: 0 !important;
      max-height: fit-content !important;
      margin: 0 auto !important;
      padding: 1.5mm 1.5mm 3mm 1.5mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Tahoma', 'Arial', sans-serif;
      font-size: ${m.baseFontPx}px;
      line-height: 1.28;
      direction: rtl;
      overflow: hidden !important;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    img {
      max-width: 100%;
      display: block;
      margin: 0 auto;
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
    .sr-header-boxed {
      border: 1.5px solid #000000;
      padding: 5px 4px;
      margin-bottom: 4px;
      border-radius: 3px;
    }
    .sr-invoice-badge {
      display: inline-block;
      border: 1px solid #000000;
      padding: 1px 8px;
      margin-top: 3px;
      font-weight: 900;
      font-size: ${m.baseFontPx}px;
    }
    .sr-divider {
      border: 0;
      border-top: ${m.dividerBorderCss};
      margin: 4px 0;
    }
    .sr-double-divider {
      border: 0;
      border-top: 2px solid #000000;
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
      font-size: ${m.baseFontPx}px;
    }
    table.sr-table th {
      border-top: ${m.dividerBorderCss};
      border-bottom: ${m.dividerBorderCss};
      padding: 2.5px 1px;
      font-weight: 900;
      text-align: right;
    }
    table.sr-table td {
      padding: 2.5px 1px;
      vertical-align: top;
      border-bottom: 1px dotted #999999;
    }
    table.sr-table tr:last-child td {
      border-bottom: none;
    }
    .sr-sub {
      font-size: ${m.subFontPx}px;
      line-height: 1.25;
      margin-top: 1px;
    }
    .sr-total-box {
      border-top: 1.5px solid #000000;
      border-bottom: 1.5px solid #000000;
      padding: 3px 0;
      margin: 4px 0;
      font-size: ${m.totalFontPx}px;
      font-weight: 900;
    }
    .sr-policy-box {
      border: 1px dashed #000000;
      padding: 3px 4px;
      margin: 4px 0;
      text-align: center;
      font-size: ${m.subFontPx}px;
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
</html>`;
}

export function formatReceiptPaymentLabel(paymentMethod?: Order['paymentMethod']): string {
  switch (paymentMethod) {
    case 'cod':
      return 'نقدي (كاش)';
    case 'card':
      return 'فيزا ماكينة الفرع';
    case 'vodafone_cash':
      return 'فودافون كاش';
    case 'instapay':
      return 'إنستا باي';
    case 'split':
      return 'دفع مقسم';
    case 'credit':
      return 'بيع آجل (ذمم)';
    default:
      return 'محفظة VIP';
  }
}

export function formatReceiptSplitMethodLabel(method: string): string {
  if (method === 'cod') return 'كاش';
  if (method === 'card') return 'فيزا الفرع';
  if (method === 'vodafone_cash') return 'فودافون كاش';
  if (method === 'instapay') return 'إنستاباي';
  if (method === 'vip_wallet') return 'محفظة VIP';
  if (method === 'credit') return 'آجل بذمة العميل';
  return method;
}

interface ThermalReceiptOrderContentProps {
  order: Order;
  settings?: StoreSettings | null;
  receiptConfig?: ReceiptConfig | null;
  shift?: PosShift | null;
  forceTaxPreview?: boolean;
}

export function ThermalReceiptOrderContent({
  order,
  settings,
  receiptConfig,
  shift,
  forceTaxPreview = false,
}: ThermalReceiptOrderContentProps) {
  const cfg = getResolvedReceiptConfig(
    receiptConfig
      ? ({ ...(settings || {}), receiptConfig } as StoreSettings)
      : settings
  );
  const metrics = getReceiptPaperMetrics(cfg, false);

  const currency = getCurrencySymbol(settings);
  const storeName =
    cfg.customStoreName.trim() || settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const storeAddress =
    cfg.customAddress.trim() ||
    settings?.address ||
    'مركز بني مزار — أمام مسجد الزراعيين مباشرة';
  const storePhone =
    cfg.customPhone.trim() ||
    settings?.supportPhone ||
    settings?.whatsappNumber ||
    '01107677672';

  const isTaxReceipt = Boolean(
    forceTaxPreview || settings?.enableTax || (order.taxAmount && order.taxAmount > 0)
  );
  const effectiveTaxReg =
    settings?.taxRegistrationNumber?.trim() || (forceTaxPreview ? '304-819-520' : '');
  const effectiveTaxBranch = settings?.taxBranchId?.trim() || (forceTaxPreview ? '0' : '');

  const totalItemsQty = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const paymentLabel = formatReceiptPaymentLabel(order.paymentMethod);
  const vipRedeemed = order.vipWalletRedeemed ?? order.vipRedeemedAmount ?? 0;

  const dividerStyleObj: React.CSSProperties = {
    border: 0,
    borderTop: metrics.dividerBorderCss,
    margin: '5px 0',
  };

  const qrSize = cfg.paperWidthMm === 58 ? 64 : isTaxReceipt ? 82 : 72;
  const barcodeHeight = cfg.paperWidthMm === 58 ? 28 : 34;

  const formatNum = (val: number) =>
    Number.isFinite(val)
      ? Number(Math.round(val * 100) / 100).toLocaleString('en-US')
      : '0';

  const hasHeaderContent = Boolean(
    (cfg.showLogo && cfg.logoUrl && cfg.headerStyle !== 'minimal') ||
      cfg.showStoreName ||
      (cfg.showHeaderSubtitle && cfg.headerSubtitle.trim()) ||
      (cfg.showAddress && storeAddress) ||
      (cfg.showPhone && storePhone) ||
      (cfg.showInvoiceTitle && cfg.invoiceTitle.trim()) ||
      (isTaxReceipt && cfg.showTaxDetails && effectiveTaxReg)
  );

  const hasPhoneLine = Boolean(
    cfg.showCustomerPhone && order.customerPhone && order.customerPhone !== '01000000000'
  );
  const hasGovLine = Boolean(cfg.showCustomerGovernorate && order.governorate);
  const hasAddressLine = Boolean(
    cfg.showCustomerAddress &&
      order.address &&
      !order.address.includes('استلام فوري من كاونتر')
  );

  const hasMetaContent = Boolean(
    cfg.showOrderNumber ||
      cfg.showOrderTime ||
      cfg.showCustomerName ||
      cfg.showPaymentMethod ||
      hasPhoneLine ||
      hasGovLine ||
      hasAddressLine
  );

  const hasBottomContent = Boolean(
    cfg.showBarcode ||
      (cfg.showQrCode && (isTaxReceipt || cfg.qrCodeUrl.trim())) ||
      (cfg.showPromoLine && cfg.promoLine.trim()) ||
      (cfg.showFooterMessage && cfg.footerMessage.trim())
  );

  const nameColWidth =
    cfg.showQuantityColumn && cfg.showUnitPriceColumn
      ? '52%'
      : cfg.showQuantityColumn && !cfg.showUnitPriceColumn
        ? '64%'
        : !cfg.showQuantityColumn && cfg.showUnitPriceColumn
          ? '62%'
          : '76%';

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Tahoma', 'Arial', sans-serif",
        fontSize: `${metrics.baseFontPx}px`,
        lineHeight: 1.32,
        color: '#000000',
      }}
    >
      {/* 1. Receipt Header */}
      {hasHeaderContent && (
        <div
          className={`sr-center ${cfg.headerStyle === 'boxed' ? 'sr-header-boxed' : ''}`}
          style={
            cfg.headerStyle === 'boxed'
              ? {
                  border: '1.5px solid #000000',
                  padding: '6px 5px',
                  marginBottom: '5px',
                  borderRadius: '3px',
                }
              : cfg.headerStyle === 'minimal'
                ? { paddingBottom: '2px' }
                : undefined
          }
        >
          {cfg.showLogo && cfg.logoUrl && cfg.headerStyle !== 'minimal' && (
            <img
              src={cfg.logoUrl}
              alt=""
              aria-hidden="true"
              style={{
                width: `${cfg.logoSizePx}px`,
                height: `${cfg.logoSizePx}px`,
                objectFit: 'contain',
                margin: '0 auto 4px auto',
                filter: 'grayscale(100%) contrast(125%)',
              }}
            />
          )}

          {cfg.showStoreName && (
            <div
              className="sr-black"
              style={{
                fontSize: `${metrics.titleFontPx}px`,
                fontWeight: 900,
                lineHeight: 1.25,
              }}
            >
              {storeName}
            </div>
          )}

          {cfg.showHeaderSubtitle && cfg.headerSubtitle.trim() && (
            <div
              className="sr-bold"
              style={{
                fontSize: `${metrics.subFontPx}px`,
                fontWeight: 700,
                marginTop: '1px',
              }}
            >
              {cfg.headerSubtitle.trim()}
            </div>
          )}

          {cfg.showAddress && storeAddress && (
            <div
              className="sr-bold"
              style={{
                fontSize: `${metrics.subFontPx}px`,
                fontWeight: 700,
                marginTop: '1px',
              }}
            >
              {storeAddress}
            </div>
          )}

          {cfg.showPhone && storePhone && (
            <div style={{ fontSize: `${metrics.subFontPx}px`, marginTop: '1px' }}>
              ت / واتساب: {storePhone}
            </div>
          )}

          {cfg.showInvoiceTitle && cfg.invoiceTitle.trim() && (
            <div
              className="sr-invoice-badge"
              style={{
                display: 'inline-block',
                border: '1px solid #000000',
                padding: '1px 8px',
                marginTop: '4px',
                fontWeight: 900,
                fontSize: `${metrics.baseFontPx}px`,
              }}
            >
              {cfg.invoiceTitle.trim()}
            </div>
          )}

          {isTaxReceipt && cfg.showTaxDetails && effectiveTaxReg && (
            <div
              className="sr-black"
              style={{
                fontSize: `${metrics.subFontPx}px`,
                fontWeight: 900,
                marginTop: '3px',
              }}
            >
              إيصال ضريبي مبسط • ر.ت.ض: {effectiveTaxReg}
              {effectiveTaxBranch ? ` • فرع: ${effectiveTaxBranch}` : ''}
            </div>
          )}
        </div>
      )}

      {hasHeaderContent && hasMetaContent && <hr className="sr-divider" style={dividerStyleObj} />}

      {/* 2. Receipt & Customer Meta Lines */}
      {hasMetaContent && (
        <div style={{ fontSize: `${metrics.baseFontPx}px` }}>
          {(cfg.showOrderNumber || cfg.showOrderTime) && (
            <div
              className="sr-row"
              style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '1.5px 0' }}
            >
              {cfg.showOrderNumber ? (
                <span className="sr-black" style={{ fontWeight: 900 }}>
                  بون: #{order.orderNumber}
                </span>
              ) : (
                <span />
              )}
              {cfg.showOrderTime && (
                <span>
                  {new Date(order.createdAt).toLocaleString('ar-EG', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          )}

          {(cfg.showCustomerName || cfg.showPaymentMethod) && (
            <div
              className="sr-row"
              style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '1.5px 0' }}
            >
              {cfg.showCustomerName ? (
                <span>العميل: {order.customerName}</span>
              ) : (
                <span />
              )}
              {cfg.showPaymentMethod && <span>الدفع: {paymentLabel}</span>}
            </div>
          )}

          {(hasPhoneLine || hasGovLine) && (
            <div
              className="sr-row"
              style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '1.5px 0' }}
            >
              {hasPhoneLine ? <span>هاتف: {order.customerPhone}</span> : <span />}
              {hasGovLine && <span>{order.governorate}</span>}
            </div>
          )}

          {hasAddressLine && (
            <div
              className="sr-bold"
              style={{ fontSize: `${metrics.subFontPx}px`, fontWeight: 700, marginTop: '2px' }}
            >
              العنوان: {order.address}
            </div>
          )}
        </div>
      )}

      {/* 3. Items Table */}
      <table
        className="sr-table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          margin: '4px 0',
          fontSize: `${metrics.baseFontPx}px`,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: nameColWidth,
                borderTop: metrics.dividerBorderCss,
                borderBottom: metrics.dividerBorderCss,
                padding: '3px 1px',
                fontWeight: 900,
                textAlign: 'right',
              }}
            >
              الصنف
            </th>
            {cfg.showQuantityColumn && (
              <th
                style={{
                  width: cfg.showUnitPriceColumn ? '12%' : '14%',
                  borderTop: metrics.dividerBorderCss,
                  borderBottom: metrics.dividerBorderCss,
                  padding: '3px 1px',
                  fontWeight: 900,
                  textAlign: 'center',
                }}
              >
                كمية
              </th>
            )}
            {cfg.showUnitPriceColumn && (
              <th
                style={{
                  width: '17%',
                  borderTop: metrics.dividerBorderCss,
                  borderBottom: metrics.dividerBorderCss,
                  padding: '3px 1px',
                  fontWeight: 900,
                  textAlign: 'left',
                }}
              >
                سعر
              </th>
            )}
            <th
              style={{
                width: cfg.showUnitPriceColumn ? '19%' : '22%',
                borderTop: metrics.dividerBorderCss,
                borderBottom: metrics.dividerBorderCss,
                padding: '3px 1px',
                fontWeight: 900,
                textAlign: 'left',
              }}
            >
              إجمالي
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, idx) => {
            const lineTotal = Math.round(it.unitPrice * it.quantity * 10) / 10;
            const isLast = idx === order.items.length - 1;
            const cellStyle: React.CSSProperties = {
              padding: '3px 1px',
              verticalAlign: 'top',
              borderBottom: isLast ? 'none' : '1px dotted #bbbbbb',
            };
            return (
              <tr key={idx}>
                <td style={cellStyle}>
                  <div className="sr-black" style={{ fontWeight: 900 }}>
                    {it.productName}
                    {cfg.showItemWeight && it.weightLabel ? ` (${it.weightLabel})` : ''}
                  </div>
                  {cfg.showItemDetails && it.roastOption && (
                    <div
                      className="sr-sub"
                      style={{ fontSize: `${metrics.subFontPx}px`, marginTop: '1px' }}
                    >
                      {it.roastOption}
                      {it.workerNotes ? ` - ${it.workerNotes}` : ''}
                    </div>
                  )}
                  {cfg.showItemDetails && it.isPartitionedBox && it.partitionedSlots && (
                    <div
                      className="sr-sub"
                      style={{ fontSize: `${metrics.subFontPx}px`, marginTop: '1px' }}
                    >
                      {it.partitionedSlots
                        .map((s) => `${s.productName} (${s.slotGrams || s.weightGrams || 0}جم)`)
                        .join(' + ')}
                    </div>
                  )}
                  {cfg.showItemDetails && it.isCoffeeBlend && it.coffeeBlendSpec && (
                    <div
                      className="sr-sub"
                      style={{ fontSize: `${metrics.subFontPx}px`, marginTop: '1px' }}
                    >
                      {it.coffeeBlendSpec.baristaLabel}
                    </div>
                  )}
                  {cfg.showItemDetails &&
                    it.isCustomMix &&
                    it.customBreakdown &&
                    it.customBreakdown.length > 0 && (
                      <div
                        className="sr-sub"
                        style={{ fontSize: `${metrics.subFontPx}px`, marginTop: '1px' }}
                      >
                        {it.customBreakdown
                          .map(
                            (b) =>
                              `${b.productName} (${b.roastOption} • ${b.percentage}% • ${b.weightGrams}جم)`
                          )
                          .join(' + ')}
                      </div>
                    )}
                </td>
                {cfg.showQuantityColumn && (
                  <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }} className="sr-bold">
                    {formatNum(it.quantity)}
                  </td>
                )}
                {cfg.showUnitPriceColumn && (
                  <td style={{ ...cellStyle, textAlign: 'left' }}>{formatNum(it.unitPrice)}</td>
                )}
                <td style={{ ...cellStyle, textAlign: 'left', fontWeight: 900 }} className="sr-black">
                  {formatNum(lineTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <hr className="sr-divider" style={dividerStyleObj} />

      {/* 4. Totals & Payment Lines */}
      <div style={{ fontSize: `${metrics.baseFontPx}px` }}>
        {(cfg.showItemCount || cfg.showSubtotal) && (
          <div
            className="sr-row"
            style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '1.5px 0' }}
          >
            {cfg.showItemCount ? (
              <span>عدد القطع: {formatNum(totalItemsQty)}</span>
            ) : (
              <span>المجموع الفرعي:</span>
            )}
            {cfg.showSubtotal && (
              <span>
                {cfg.showItemCount
                  ? `المجموع: ${formatNum(order.subtotal)} ${currency}`
                  : `${formatNum(order.subtotal)} ${currency}`}
              </span>
            )}
          </div>
        )}

        {cfg.showDiscount && order.discountAmount > 0 && (
          <div
            className="sr-row"
            style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '1.5px 0' }}
          >
            <span>الخصم{order.couponCode ? ` (${order.couponCode})` : ''}:</span>
            <span>
              -{formatNum(order.discountAmount)} {currency}
            </span>
          </div>
        )}

        {cfg.showVipRedeemed && vipRedeemed > 0 && (
          <div
            className="sr-row sr-bold"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '4px',
              margin: '1.5px 0',
              fontWeight: 700,
            }}
          >
            <span>خصم محفظة VIP:</span>
            <span>
              -{formatNum(vipRedeemed)} {currency}
            </span>
          </div>
        )}

        {isTaxReceipt && cfg.showTaxDetails && (order.taxAmount || 0) > 0 && (
          <div
            className="sr-row"
            style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '1.5px 0' }}
          >
            <span>
              ض.ق.م ({order.taxRatePercent ?? settings?.taxRatePercent ?? 14}%{' '}
              {order.taxInclusive !== false ? 'شامل' : 'مضاف'}):
            </span>
            <span>
              {formatNum(order.taxAmount || 0)} {currency}
            </span>
          </div>
        )}

        {cfg.showShippingCost && order.shippingCost > 0 && (
          <div
            className="sr-row"
            style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '1.5px 0' }}
          >
            <span>التوصيل:</span>
            <span>
              +{formatNum(order.shippingCost)} {currency}
            </span>
          </div>
        )}

        {shift && (shift.riderCodSettledTotal || 0) > 0 && (
          <div
            className="sr-row"
            style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '1.5px 0' }}
          >
            <span>توريدات عهدة المناديب (COD):</span>
            <span className="sr-bold" style={{ fontWeight: 700 }}>
              +{formatNum(shift.riderCodSettledTotal || 0)} {currency}
            </span>
          </div>
        )}

        <div
          className="sr-total-box sr-row"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderTop: '1.5px solid #000000',
            borderBottom: '1.5px solid #000000',
            padding: '4px 0',
            margin: '5px 0',
            fontSize: `${metrics.totalFontPx}px`,
            fontWeight: 900,
          }}
        >
          <span>{cfg.totalLabel.trim() || 'الإجمالي المطلوب:'}</span>
          <span>
            {formatNum(order.total)} {currency}
          </span>
        </div>

        {/* Split Payments Breakdown */}
        {cfg.showPaymentBreakdown &&
          Array.isArray(order.paymentSplits) &&
          order.paymentSplits.length > 0 && (
            <div
              style={{
                fontSize: `${metrics.subFontPx}px`,
                border: '1px dashed #666666',
                borderRadius: '3px',
                padding: '3px 5px',
                margin: '4px 0',
              }}
            >
              <div className="sr-bold" style={{ fontWeight: 700 }}>
                تفصيل الدفع المقسم:
              </div>
              {order.paymentSplits.map((sp, i) => (
                <div
                  key={i}
                  className="sr-row"
                  style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}
                >
                  <span>• {formatReceiptSplitMethodLabel(sp.method)}:</span>
                  <span className="sr-bold" style={{ fontWeight: 700 }}>
                    {formatNum(sp.amount)} {currency}
                  </span>
                </div>
              ))}
            </div>
          )}

        {/* Credit Due Breakdown */}
        {cfg.showPaymentBreakdown && (order.creditDueAmount || 0) > 0 && (
          <div
            className="sr-row sr-black"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '4px',
              margin: '2px 0',
              fontWeight: 900,
            }}
          >
            <span>مسجل آجل بذمة العميل:</span>
            <span>
              {formatNum(order.creditDueAmount || 0)} {currency}
            </span>
          </div>
        )}

        {cfg.showCashTenderedAndChange &&
          order.cashTendered !== undefined &&
          order.cashTendered > 0 && (
            <div
              className="sr-row"
              style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '2px 0' }}
            >
              <span>
                المدفوع: {formatNum(order.cashTendered)} {currency}
              </span>
              <span className="sr-black" style={{ fontWeight: 900 }}>
                الباقي: {formatNum(order.changeDue || 0)} {currency}
              </span>
            </div>
          )}

        {cfg.showVipCashback && (order.vipCashbackEarned || 0) > 0 && (
          <div
            className="sr-row sr-bold"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '4px',
              marginTop: '3px',
              fontWeight: 700,
            }}
          >
            <span>كاش باك VIP المضاف:</span>
            <span>
              +{formatNum(order.vipCashbackEarned || 0)} {currency}
            </span>
          </div>
        )}
      </div>

      {/* 5. Return Policy Box */}
      {cfg.showReturnPolicy && cfg.returnPolicyText.trim() && (
        <div
          className="sr-policy-box"
          style={{
            border: '1px dashed #000000',
            padding: '4px 5px',
            margin: '5px 0',
            textAlign: 'center',
            fontSize: `${metrics.subFontPx}px`,
            lineHeight: 1.3,
          }}
        >
          {cfg.returnPolicyText.trim()}
        </div>
      )}

      {hasBottomContent && <hr className="sr-divider" style={dividerStyleObj} />}

      {/* 6. Scannable 1D Barcode */}
      {cfg.showBarcode && (
        <div className="sr-barcode" style={{ textAlign: 'center', margin: '4px 0 2px 0' }}>
          <Code128BarcodeSvg
            value={order.orderNumber}
            height={barcodeHeight}
            showText={true}
          />
        </div>
      )}

      {/* 7. ETA Tax QR or Storefront Online Order QR */}
      {cfg.showQrCode &&
        (isTaxReceipt ? (
          <div className="my-1.5 flex flex-col items-center">
            <QrCodeSvg
              value={buildTaxReceiptQrValue(order, settings || undefined)}
              size={qrSize}
              caption={
                order.etaReceiptUuid
                  ? `ETA UUID: ${order.etaReceiptUuid.slice(0, 18)}...`
                  : 'رمز التحقق الضريبي الإلكتروني (ETA QR)'
              }
            />
          </div>
        ) : cfg.qrCodeUrl.trim() ? (
          <div className="my-1.5 flex flex-col items-center">
            <QrCodeSvg
              value={cfg.qrCodeUrl.trim()}
              size={qrSize}
              caption={cfg.qrCodeCaption.trim() || undefined}
            />
          </div>
        ) : null)}

      {/* 8. Promo Line & Footer Message */}
      {cfg.showPromoLine && cfg.promoLine.trim() && (
        <div
          className="sr-center sr-bold"
          style={{
            textAlign: 'center',
            fontSize: `${metrics.subFontPx}px`,
            fontWeight: 700,
            marginTop: '4px',
          }}
        >
          {cfg.promoLine.trim()}
        </div>
      )}

      {cfg.showFooterMessage && cfg.footerMessage.trim() && (
        <div
          className="sr-center"
          style={{
            textAlign: 'center',
            fontSize: `${Math.max(9, metrics.subFontPx)}px`,
            marginTop: '3px',
          }}
        >
          {cfg.footerMessage.trim()}
        </div>
      )}
    </div>
  );
}
