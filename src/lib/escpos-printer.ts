/**
 * Direct Silent ESC/POS Hardware Thermal Printing & Cash Drawer Driver
 * Supports Browser WebUSB & WebSerial APIs with Arabic-safe GS v 0 raster bitmap rendering.
 */

export interface EscPosPrintOptions {
  paperWidthMm?: 80 | 58;
  openCashDrawer?: boolean;
  cutPaper?: boolean;
}

export interface EscPosResult {
  success: boolean;
  transport?: 'webusb' | 'webserial';
  error?: string;
}

/**
 * Standard ESC/POS initialization + RJ11 Cash Drawer Kick pulses (Pin 2 & Pin 5).
 * ESC p m t1 t2 -> [0x1B, 0x70, m, 0x19, 0xFA]
 */
export function buildCashDrawerKickBytes(): Uint8Array {
  return new Uint8Array([
    0x1b, 0x40, // ESC @ Initialize
    0x1b, 0x70, 0x00, 0x19, 0xfa, // Pin 2 pulse (50ms on, 500ms off)
    0x1b, 0x70, 0x01, 0x19, 0xfa, // Pin 5 pulse fallback
  ]);
}

/**
 * Standard ESC/POS feed + partial cut command (GS V 66 0).
 */
export function buildPaperCutBytes(): Uint8Array {
  return new Uint8Array([
    0x1b, 0x64, 0x04, // ESC d 4 (feed 4 lines)
    0x1d, 0x56, 0x42, 0x00, // GS V 66 0 (feed & partial cut)
  ]);
}

/**
 * Encodes an HTMLCanvasElement's RGBA pixels into ESC/POS `GS v 0` monochrome raster bands.
 */
export function canvasToEscPosRasterBytes(
  canvas: HTMLCanvasElement,
  options: { openCashDrawer?: boolean; cutPaper?: boolean } = {}
): Uint8Array {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر قراءة سياق الرسم للطباعة الحرارية');
  }

  const width = canvas.width;
  const height = canvas.height;
  const bytesPerRow = Math.ceil(width / 8);
  const imgData = ctx.getImageData(0, 0, width, height).data;

  const chunks: Uint8Array[] = [new Uint8Array([0x1b, 0x40])]; // ESC @ Initialize

  // Send in bands of up to 128 vertical dots so small printer buffers never overflow
  const bandHeight = 128;
  for (let yStart = 0; yStart < height; yStart += bandHeight) {
    const currentBandH = Math.min(bandHeight, height - yStart);
    const xL = bytesPerRow & 0xff;
    const xH = (bytesPerRow >> 8) & 0xff;
    const yL = currentBandH & 0xff;
    const yH = (currentBandH >> 8) & 0xff;

    const bandBuffer = new Uint8Array(8 + bytesPerRow * currentBandH);
    bandBuffer.set([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH], 0);

    let offset = 8;
    for (let y = 0; y < currentBandH; y++) {
      const py = yStart + y;
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let byteVal = 0;
        for (let bit = 0; bit < 8; bit++) {
          const px = bx * 8 + bit;
          if (px < width) {
            const idx = (py * width + px) * 4;
            const alpha = imgData[idx + 3];
            // Composite over white background
            const r = alpha === 0 ? 255 : imgData[idx];
            const g = alpha === 0 ? 255 : imgData[idx + 1];
            const b = alpha === 0 ? 255 : imgData[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < 170) {
              byteVal |= 1 << (7 - bit);
            }
          }
        }
        bandBuffer[offset++] = byteVal;
      }
    }
    chunks.push(bandBuffer);
  }

  if (options.cutPaper !== false) {
    chunks.push(buildPaperCutBytes());
  }
  if (options.openCashDrawer) {
    chunks.push(buildCashDrawerKickBytes());
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    merged.set(c, pos);
    pos += c.length;
  }
  return merged;
}

/**
 * Renders an HTML receipt element (including RTL Arabic text & inline SVGs) onto an offscreen canvas
 * sized to exact 203-DPI thermal print head width (576 dots for 80mm, 384 dots for 58mm).
 */
async function renderElementToThermalCanvas(
  element: HTMLElement,
  paperWidthMm: 80 | 58
): Promise<HTMLCanvasElement> {
  const targetDotsWidth = paperWidthMm === 58 ? 384 : 576;
  const rect = element.getBoundingClientRect();
  const srcW = Math.max(220, Math.ceil(rect.width || element.scrollWidth || 300));
  const srcH = Math.max(120, Math.ceil(element.scrollHeight || rect.height || 400));
  const scale = targetDotsWidth / srcW;
  const targetDotsHeight = Math.max(120, Math.ceil(srcH * scale) + 16);

  const cloned = element.cloneNode(true) as HTMLElement;
  cloned.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  cloned.style.background = '#ffffff';
  cloned.style.color = '#000000';
  cloned.style.margin = '0';
  cloned.style.width = `${srcW}px`;

  const serializedHtml = new XMLSerializer().serializeToString(cloned);
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${srcW}" height="${srcH}">
    <foreignObject width="100%" height="100%">${serializedHtml}</foreignObject>
  </svg>`;

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

  const canvas = document.createElement('canvas');
  canvas.width = targetDotsWidth;
  canvas.height = targetDotsHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر تهيئة Canvas للطباعة');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, targetDotsWidth, Math.ceil(srcH * scale));
      resolve();
    };
    img.onerror = () => reject(new Error('تعذر تحويل قالب الإيصال إلى صورة حرارية'));
    img.src = dataUrl;
  });

  return canvas;
}

/**
 * Sends raw ESC/POS bytes to a paired or user-selected WebUSB / WebSerial thermal printer.
 */
export async function sendRawEscPosBytes(payload: Uint8Array): Promise<EscPosResult> {
  if (typeof navigator === 'undefined') {
    return { success: false, error: 'الطباعة المباشرة متاحة داخل المتصفح فقط' };
  }

  const navAny = navigator as unknown as {
    usb?: {
      getDevices: () => Promise<any[]>;
      requestDevice: (opts: { filters: Array<Record<string, number>> }) => Promise<any>;
    };
    serial?: {
      getPorts: () => Promise<any[]>;
      requestPort: () => Promise<any>;
    };
  };

  // 1. Try WebUSB first (standard USB Printer class 0x07 or already paired USB thermal printer)
  if (navAny.usb) {
    try {
      const paired = await navAny.usb.getDevices();
      let device = paired[0];
      if (!device) {
        device = await navAny.usb.requestDevice({
          filters: [{ classCode: 7 }], // USB Printer Class 0x07
        });
      }
      if (device) {
        await device.open();
        if (!device.configuration) {
          await device.selectConfiguration(1);
        }
        const iface =
          device.configuration.interfaces.find((i: any) =>
            i.alternates?.some((a: any) => a.interfaceClass === 7 || a.endpoints?.some((e: any) => e.direction === 'out'))
          ) || device.configuration.interfaces[0];

        await device.claimInterface(iface.interfaceNumber);
        const alt = iface.alternates[0];
        const outEndpoint = alt.endpoints.find((ep: any) => ep.direction === 'out');
        if (!outEndpoint) {
          throw new Error('لم يتم العثور على منفذ إخراج USB للطابعة الحرارية');
        }

        // Chunk USB transfers in 4KB blocks
        const chunkSize = 4096;
        for (let i = 0; i < payload.length; i += chunkSize) {
          await device.transferOut(
            outEndpoint.endpointNumber,
            payload.slice(i, i + chunkSize)
          );
        }

        try {
          await device.releaseInterface(iface.interfaceNumber);
          await device.close();
        } catch {}

        return { success: true, transport: 'webusb' };
      }
    } catch (usbErr: any) {
      // Fall through to WebSerial if available and user cancelled or USB printer is virtual COM
      if (!navAny.serial) {
        return {
          success: false,
          error: usbErr?.message || 'تعذر الاتصال بطابعة USB الحرارية',
        };
      }
    }
  }

  // 2. Fallback to WebSerial (USB-to-Serial / Bluetooth SPP COM thermal printers)
  if (navAny.serial) {
    try {
      const ports = await navAny.serial.getPorts();
      const port = ports[0] || (await navAny.serial.requestPort());
      await port.open({ baudRate: 9600 });
      const writer = port.writable.getWriter();
      await writer.write(payload);
      writer.releaseLock();
      await port.close();
      return { success: true, transport: 'webserial' };
    } catch (serErr: any) {
      return {
        success: false,
        error: serErr?.message || 'تعذر الاتصال بمنفذ الطابعة التسلسلي (WebSerial)',
      };
    }
  }

  return {
    success: false,
    error: 'هذا المتصفح لا يدعم WebUSB أو WebSerial (يرجى استخدام Chrome أو Edge للطباعة الصامتة)',
  };
}

/**
 * Triggers Cash Drawer Kick (`ESC p`) directly over WebUSB / WebSerial.
 */
export async function openCashDrawerDirect(): Promise<EscPosResult> {
  return sendRawEscPosBytes(buildCashDrawerKickBytes());
}

/**
 * Converts a receipt/sticker HTML element to 203-DPI monochrome raster ESC/POS bytes and prints directly.
 */
export async function printReceiptElementEscPos(
  element: HTMLElement,
  options: EscPosPrintOptions = {}
): Promise<EscPosResult> {
  try {
    const canvas = await renderElementToThermalCanvas(
      element,
      options.paperWidthMm || 80
    );
    const bytes = canvasToEscPosRasterBytes(canvas, {
      openCashDrawer: options.openCashDrawer,
      cutPaper: options.cutPaper !== false,
    });
    return await sendRawEscPosBytes(bytes);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'حدث خطأ أثناء تجهيز الطباعة الحرارية المباشرة',
    };
  }
}

export function isDirectEscPosSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const navAny = navigator as unknown as { usb?: unknown; serial?: unknown };
  return Boolean(navAny.usb || navAny.serial);
}
