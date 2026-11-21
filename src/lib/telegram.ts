/**
 * Telegram Bot Webhook & Instant Push Notifications Engine
 * Target: ميزان كلاود للتجارة الذكية (MizanPOS White-Label Blueprint)
 * 
 * Provides automated instant alerts to roastery management on:
 * 1. New Online Orders (Delivery/Pickup, Items, Customer, Address, Total)
 * 2. Supply Invoices (Arafat's Stock Replenishment, Quantities, Costs, Status)
 * 3. Cashier Shift Closing Z-Report (Revenue, Cash in Drawer, Card Sales, Expenses, Variance)
 */

import type { Order, PosShift, StoreSettings, SupplyInvoice, InventoryAdjustment } from '@/types/store';

export interface TelegramNotificationResult {
  success: boolean;
  skipped?: boolean;
  messageId?: number;
  error?: string;
}

export type TelegramNotificationEventType = 'new_order' | 'supply_invoice' | 'z_report' | 'low_stock' | 'inventory_adjustment';

export interface LowStockAlertItem {
  productId: string;
  productName: string;
  previousStockKg: number;
  remainingStockKg: number;
}

/**
 * Escapes characters that have special meaning in Telegram HTML mode
 */
export function escapeTelegramHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sends a raw HTML-formatted message to Telegram Bot API
 */
export async function sendRawTelegramMessage(
  token?: string | null,
  chatId?: string | null,
  htmlText?: string | null,
  timeoutMs = 5000
): Promise<TelegramNotificationResult> {
  const cleanToken = (token || '').trim();
  const cleanChatId = (chatId || '').trim();
  const cleanText = (htmlText || '').trim();

  if (!cleanToken || !cleanChatId || !cleanText) {
    return {
      success: false,
      skipped: true,
      error: 'Missing Telegram bot token, chat ID, or message text',
    };
  }

  // Reject obvious placeholder / dummy tokens
  if (
    cleanToken.startsWith('YOUR_') ||
    cleanToken === 'TELEGRAM_BOT_TOKEN' ||
    cleanToken.length < 15 ||
    !cleanToken.includes(':')
  ) {
    return {
      success: false,
      skipped: true,
      error: 'Invalid or placeholder Telegram bot token',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: cleanText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      return {
        success: true,
        messageId: json.result?.message_id,
      };
    }

    return {
      success: false,
      error: json.description || `HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      success: false,
      error:
        err.name === 'AbortError'
          ? 'Telegram Bot API request timed out'
          : err?.message || 'Network communication error',
    };
  }
}

/**
 * Formats a new incoming online order into a rich, readable Arabic Telegram message
 */
export function formatOrderTelegramMessage(
  order: Order,
  storeSettings?: StoreSettings
): string {
  const storeName = storeSettings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const currency = storeSettings?.currencySymbol?.trim() || 'ج.م';
  const currencyFull = currency === 'ج.م' ? 'جنيه مصري' : currency;
  const cityName = storeSettings?.cityName?.trim() || 'المدينة';

  const deliveryLabel =
    order.deliveryMethod === 'bandar_fast'
      ? `🛵 توصيل فوري داخل ${escapeTelegramHtml(cityName)}`
      : order.deliveryMethod === 'villages_scheduled'
      ? `🚚 دورة توصيل مجدولة (${escapeTelegramHtml(order.villageName || 'المناطق الفرعية')} - ${escapeTelegramHtml(order.deliverySlot || 'دورة مجدولة')})`
      : '🏪 استلام فوري من الفرع';

  const paymentLabel =
    order.paymentMethod === 'cod'
      ? '💵 الدفع عند الاستلام (COD)'
      : order.paymentMethod === 'instapay'
      ? '📱 إنستاباي (InstaPay)'
      : order.paymentMethod === 'vodafone_cash'
      ? '💳 محفظة إلكترونية'
      : order.paymentMethod === 'card'
      ? '💳 ماكينة فيزا بالفرع'
      : '👑 محفظة ولاء VIP';

  const itemsFormatted = (order.items || [])
    .map((item, idx) => {
      const weightDesc = item.weightLabel ? ` (${escapeTelegramHtml(item.weightLabel)})` : '';
      const roastDesc = item.roastOption ? ` [${escapeTelegramHtml(item.roastOption)}]` : '';
      const lineTotal = item.unitPrice * (item.quantity || 1);
      return `${idx + 1}. <b>${escapeTelegramHtml(item.productName)}</b>${weightDesc}${roastDesc} × ${item.quantity} = <b>${lineTotal} ${escapeTelegramHtml(currency)}</b>`;
    })
    .slice(0, 8)
    .join('\n');

  const extraCount = (order.items?.length || 0) - 8;
  const extraText = extraCount > 0 ? `\n<i>... وعدد ${extraCount} أصناف أخرى بالطلب</i>` : '';

  const discountText =
    order.discountAmount > 0
      ? `\n🎟 <b>الخصم المطبق:</b> -${order.discountAmount} ${escapeTelegramHtml(currency)} ${order.couponCode ? `(كوبون: ${escapeTelegramHtml(order.couponCode)})` : ''}`
      : '';

  const vipRedeemedText =
    (order.vipRedeemedAmount || order.vipWalletRedeemed || 0) > 0
      ? `\n👑 <b>كاش باك VIP مخصوم:</b> -${order.vipRedeemedAmount || order.vipWalletRedeemed} ${escapeTelegramHtml(currency)}`
      : '';

  const cashbackEarnedText =
    (order.vipCashbackEarned || 0) > 0
      ? `\n✨ <b>كاش باك مكتسب:</b> +${order.vipCashbackEarned} ${escapeTelegramHtml(currency)}`
      : '';

  return `🔔 <b>طلب أونلاين جديد! | ${escapeTelegramHtml(storeName)}</b>
━━━━━━━━━━━━━━━━━━━━
📦 <b>رقم الطلب:</b> <code>${escapeTelegramHtml(order.orderNumber)}</code>
👤 <b>العميل:</b> ${escapeTelegramHtml(order.customerName)}
📞 <b>رقم الهاتف:</b> <code>${escapeTelegramHtml(order.customerPhone)}</code>
📍 <b>العنوان:</b> ${escapeTelegramHtml(order.address || cityName)}
🚚 <b>نوع الاستلام:</b> ${deliveryLabel}
${order.notes ? `📝 <b>ملاحظات:</b> <i>${escapeTelegramHtml(order.notes)}</i>\n` : ''}
📋 <b>الأصناف المطلوبة (${order.items?.length || 0}):</b>
${itemsFormatted}${extraText}
━━━━━━━━━━━━━━━━━━━━
💰 <b>قيمة الطلب:</b> ${order.subtotal} ${escapeTelegramHtml(currency)}
🛵 <b>تكلفة الشحن:</b> ${order.shippingCost} ${escapeTelegramHtml(currency)}${discountText}${vipRedeemedText}${cashbackEarnedText}
🏷 <b>المبلغ الإجمالي المستحق:</b> <b>${order.total} ${escapeTelegramHtml(currencyFull)}</b>
💳 <b>طريقة الدفع:</b> ${paymentLabel}
⏰ <b>توقيت الطلب:</b> ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Formats a supply invoice update into an Arabic Telegram alert
 */
export function formatSupplyInvoiceTelegramMessage(
  invoice: SupplyInvoice,
  storeSettings?: StoreSettings
): string {
  const storeName = storeSettings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const currency = storeSettings?.currencySymbol?.trim() || 'ج.م';
  const statusLabel =
    invoice.status === 'approved'
      ? '✅ تم اعتماد الفاتورة وتحديث المخزون الفعلي'
      : invoice.status === 'rejected'
      ? '❌ تم رفض الفاتورة من الإدارة'
      : '⏳ مسودة توريد جديدة مرفوعة بانتظار اعتماد الإدارة';

  const itemsFormatted = (invoice.items || [])
    .map((item, idx) => {
      return `${idx + 1}. <b>${escapeTelegramHtml(item.productName)}</b>: ${item.quantityKg} × ${item.costPerKg} = <b>${item.totalCost} ${escapeTelegramHtml(currency)}</b>`;
    })
    .slice(0, 8)
    .join('\n');

  const extraCount = (invoice.items?.length || 0) - 8;
  const extraText = extraCount > 0 ? `\n<i>... وعدد ${extraCount} أصناف توريد أخرى</i>` : '';

  return `📦 <b>فاتورة توريد مخزون | ${escapeTelegramHtml(storeName)}</b>
━━━━━━━━━━━━━━━━━━━━
📑 <b>رقم الفاتورة:</b> <code>${escapeTelegramHtml(invoice.invoiceNumber)}</code>
🏢 <b>المورد:</b> ${escapeTelegramHtml(invoice.supplierName)}
📊 <b>الحالة:</b> ${statusLabel}
💵 <b>إجمالي قيمة التوريد:</b> <b>${invoice.totalAmount} ${escapeTelegramHtml(currency)}</b>
${invoice.notes ? `📝 <b>ملاحظات المورد:</b> <i>${escapeTelegramHtml(invoice.notes)}</i>\n` : ''}${invoice.adminNotes ? `✍️ <b>ملاحظات الإدارة:</b> <i>${escapeTelegramHtml(invoice.adminNotes)}</i>\n` : ''}
📋 <b>أصناف الفاتورة:</b>
${itemsFormatted}${extraText}
━━━━━━━━━━━━━━━━━━━━
⏰ <b>التوقيت:</b> ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Formats a cashier shift closing Z-Report into an Arabic Telegram alert
 */
export function formatShiftZReportTelegramMessage(
  shift: PosShift,
  storeSettings?: StoreSettings
): string {
  const storeName = storeSettings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const currency = storeSettings?.currencySymbol?.trim() || 'ج.م';
  const variance = shift.variance ?? shift.cashDifference ?? 0;
  const varianceLabel =
    variance === 0
      ? `✅ مطابق تماماً (0 ${escapeTelegramHtml(currency)} عجز / زيادة)`
      : variance > 0
      ? `🟢 زيادة بالدرج: +${variance} ${escapeTelegramHtml(currency)}`
      : `🔴 عجز بالدرج: ${variance} ${escapeTelegramHtml(currency)}`;

  return `🧾 <b>تقفيل وردية الكاشير (Z-Report) | ${escapeTelegramHtml(storeName)}</b>
━━━━━━━━━━━━━━━━━━━━
🔢 <b>رقم الوردية:</b> <code>${escapeTelegramHtml(shift.shiftNumber)}</code>
👤 <b>كاشير الصالة:</b> ${escapeTelegramHtml(shift.cashierName)}
🕒 <b>فترة الوردية:</b> ${escapeTelegramHtml(shift.shiftPeriod)}
📦 <b>إجمالي الفواتير الصادرة:</b> ${shift.ordersCount} فاتورة
━━━━━━━━━━━━━━━━━━━━
💵 <b>إجمالي المبيعات الكلي:</b> <b>${shift.totalRevenue} ${escapeTelegramHtml(currency)}</b>
💰 <b>عهدة الكاش الفعلية بالدرج:</b> <b>${shift.actualClosingCash ?? shift.actualCash ?? 0} ${escapeTelegramHtml(currency)}</b>
   (المتوقع دفترياً: ${shift.expectedCashInDrawer ?? shift.expectedCash ?? 0} ${escapeTelegramHtml(currency)})${(shift.riderCodSettledTotal || 0) > 0 ? `\n🛵 <b>توريدات عهدة المناديب (COD) بالدرج:</b> <b>+${shift.riderCodSettledTotal} ${escapeTelegramHtml(currency)}</b>` : ''}
💳 <b>مبيعات ماكينة الفيزا (Card):</b> <b>${shift.cardSalesTotal ?? shift.cardSales ?? 0} ${escapeTelegramHtml(currency)}</b>
📱 <b>مدفوعات المحافظ الإلكترونية:</b> ${(shift.vodafoneCashTotal || 0) + (shift.instapayTotal || 0)} ${escapeTelegramHtml(currency)}
💸 <b>مصروفات الوردية المسجلة:</b> <b>${shift.expensesTotal ?? shift.expenses ?? 0} ${escapeTelegramHtml(currency)}</b>
⚖️ <b>نتيجة مطابقة درج النقدية:</b> ${varianceLabel}
━━━━━━━━━━━━━━━━━━━━
⏰ <b>توقيت تقفيل الوردية:</b> ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Formats a critical low-stock (<= 5) or out-of-stock alert into an Arabic Telegram message
 */
export function formatLowStockTelegramMessage(
  items: LowStockAlertItem[],
  sourceLabel = 'مبيعات الفرع / المتجر الإلكتروني',
  storeSettings?: StoreSettings
): string {
  const storeName = storeSettings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const lines = (items || [])
    .map((item, idx) => {
      const statusBadge =
        item.remainingStockKg <= 0
          ? '🚨 <b>نفد بالكامل (0 رصيد متاح)</b>'
          : `⚠️ <b>حد حرج (${item.remainingStockKg} متبقي)</b>`;
      return `${idx + 1}. <b>${escapeTelegramHtml(item.productName)}</b> — ${statusBadge} <i>(كان ${item.previousStockKg})</i>`;
    })
    .join('\n');

  return `⚠️ <b>تنبيه نقص مخزون حرج (≤ 5) | ${escapeTelegramHtml(storeName)}</b>
━━━━━━━━━━━━━━━━━━━━
📡 <b>مصدر السحب:</b> ${escapeTelegramHtml(sourceLabel)}
📋 <b>الأصناف التي تتطلب توريداً عاجلاً (${items?.length || 0}):</b>
${lines}
━━━━━━━━━━━━━━━━━━━━
📦 <i>يرجى مراجعة بوابة التوريد والمخزون لرفع فاتورة استعاضة فورية.</i>
⏰ <b>التوقيت:</b> ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatInventoryAdjustmentTelegramMessage(
  adj: InventoryAdjustment,
  storeSettings?: StoreSettings
): string {
  const storeName = storeSettings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const currency = storeSettings?.currencySymbol?.trim() || 'ج.م';
  const diffSign = adj.differenceKg > 0 ? '+' : '';
  const diffFormatted = `${diffSign}${adj.differenceKg}`;
  const costImpactFormatted = `${adj.totalCostImpact > 0 ? '+' : ''}${adj.totalCostImpact} ${escapeTelegramHtml(currency)}`;

  return `⚖️ <b>إشعار تسوية جرد المخزون | ${escapeTelegramHtml(storeName)}</b>
━━━━━━━━━━━━━━━━━━━━
🔢 <b>رقم الحركة:</b> <code>#${escapeTelegramHtml(adj.adjustmentNumber)}</code>
📦 <b>الصنف:</b> <b>${escapeTelegramHtml(adj.productName)}</b>
🏷️ <b>السبب:</b> ${escapeTelegramHtml(adj.reasonLabel || adj.reason)}
━━━━━━━━━━━━━━━━━━━━
📉 <b>الرصيد السابق:</b> ${adj.previousStockKg}
📈 <b>الرصيد الفعلي بعد الجرد:</b> ${adj.newStockKg}
⚖️ <b>الفارق الجردي:</b> <b>${diffFormatted}</b>
💰 <b>الأثر المالي للتكلفة:</b> <b>${costImpactFormatted}</b>
👤 <b>القائم بالتسوية:</b> ${escapeTelegramHtml(adj.adjustedBy)} (${escapeTelegramHtml(adj.adjustedByRole)})
${adj.notes ? `📝 <b>ملاحظات:</b> ${escapeTelegramHtml(adj.notes)}\n` : ''}━━━━━━━━━━━━━━━━━━━━
⏰ <b>التوقيت:</b> ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * High-level automated dispatcher that checks store settings and dispatches Telegram notifications safely
 */
export async function sendStoreTelegramAlert(
  settings: StoreSettings | undefined | null,
  eventType: TelegramNotificationEventType,
  data: any
): Promise<TelegramNotificationResult> {
  if (!settings) {
    return { success: false, skipped: true, error: 'No store settings provided' };
  }

  // Master notification switch
  if (!settings.telegramNotificationsEnabled) {
    return { success: false, skipped: true, error: 'Telegram notifications disabled in store settings' };
  }

  const token = settings.telegramBotToken;
  const chatId = settings.telegramChatId;

  if (!token || !chatId) {
    return { success: false, skipped: true, error: 'Telegram bot token or chat ID is missing' };
  }

  // Check event-specific granular toggles (default to true if not explicitly false)
  if (eventType === 'new_order' && settings.telegramNotifyNewOrders === false) {
    return { success: false, skipped: true, error: 'New order Telegram notifications disabled' };
  }
  if (eventType === 'supply_invoice' && settings.telegramNotifySupplyInvoices === false) {
    return { success: false, skipped: true, error: 'Supply invoice Telegram notifications disabled' };
  }
  if (eventType === 'z_report' && settings.telegramNotifyZReport === false) {
    return { success: false, skipped: true, error: 'Z-Report Telegram notifications disabled' };
  }
  if (eventType === 'low_stock' && settings.telegramNotifyLowStock === false) {
    return { success: false, skipped: true, error: 'Low stock Telegram notifications disabled' };
  }

  let messageHtml = '';

  try {
    if (eventType === 'new_order') {
      messageHtml = formatOrderTelegramMessage(data as Order, settings);
    } else if (eventType === 'supply_invoice') {
      messageHtml = formatSupplyInvoiceTelegramMessage(data as SupplyInvoice, settings);
    } else if (eventType === 'z_report') {
      messageHtml = formatShiftZReportTelegramMessage(data as PosShift, settings);
    } else if (eventType === 'low_stock') {
      const payload = Array.isArray(data)
        ? { items: data as LowStockAlertItem[], sourceLabel: undefined }
        : (data as { items: LowStockAlertItem[]; sourceLabel?: string });
      if (!Array.isArray(payload?.items) || payload.items.length === 0) {
        return { success: false, skipped: true, error: 'No low-stock items to notify' };
      }
      messageHtml = formatLowStockTelegramMessage(payload.items, payload.sourceLabel, settings);
    } else if (eventType === 'inventory_adjustment') {
      messageHtml = formatInventoryAdjustmentTelegramMessage(data as InventoryAdjustment, settings);
    }
  } catch (err: any) {
    return { success: false, error: `Failed to format Telegram message: ${err?.message || err}` };
  }

  if (!messageHtml) {
    return { success: false, skipped: true, error: 'Empty message generated' };
  }

  return await sendRawTelegramMessage(token, chatId, messageHtml);
}
