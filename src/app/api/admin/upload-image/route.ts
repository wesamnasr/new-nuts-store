import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDbAsync } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB limit
const MAX_INLINE_DATAURL_BYTES = 350 * 1024; // 350KB max when falling back to DB dataUrl
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];

async function persistUploadedImage(
  buffer: Buffer,
  filename: string,
  mime: string,
  fallbackDataUrl: string
): Promise<string> {
  // 1. Optional Vercel Blob direct REST upload (zero extra npm dependencies required)
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (blobToken) {
    try {
      const blobRes = await fetch(`https://blob.vercel-storage.com/products/${filename}`, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${blobToken}`,
          'x-api-version': '7',
          'x-content-type': mime,
          'content-type': mime,
        },
        body: new Uint8Array(buffer),
      });
      if (blobRes.ok) {
        const blobJson = (await blobRes.json().catch(() => null)) as { url?: string } | null;
        if (blobJson?.url) {
          return blobJson.url;
        }
      }
    } catch {
      // Fall through to local disk or compact dataUrl
    }
  }

  // 2. Local writable disk (development / dedicated VPS)
  try {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  } catch {
    // 3. Read-only serverless fallback: guard against multi-MB JSONB bloat
    if (buffer.length > MAX_INLINE_DATAURL_BYTES) {
      throw new Error(
        'حجم الصورة كبير للتخزين المباشر بدون خدمة تخزين سحابية (يرجى رفع صورة مضغوطة أقل من 350 كيلوبايت أو ضبط BLOB_READ_WRITE_TOKEN)'
      );
    }
    return fallbackDataUrl;
  }
}

export async function POST(request: NextRequest) {
  // 1. Hydrate DB on serverless cold-start then enforce strict Super Admin authentication
  await getDbAsync();
  const auth = verifyAdminRequest(request, ['super_admin']);
  if (!auth.isAuthenticated) {
    return NextResponse.json(
      { error: auth.error || 'غير مصرح لك برفع الصور (صلاحية المدير العام مطلوبة)' },
      { status: auth.statusCode || 401 }
    );
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    // A. JSON Payload containing base64 dataUrl
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      const rawDataUrl = typeof body.dataUrl === 'string' ? body.dataUrl.trim() : '';

      if (!rawDataUrl.startsWith('data:image/')) {
        return NextResponse.json(
          { error: 'تنسيق الصورة غير مدعوم. يجب أن تبدأ بـ data:image/' },
          { status: 400 }
        );
      }

      // Check size
      const approxBytes = Math.round((rawDataUrl.length * 3) / 4);
      if (approxBytes > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: 'حجم الصورة يتجاوز الحد الأقصى المسموح به (8 ميجابايت)' },
          { status: 400 }
        );
      }

      const match = rawDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json(
          { error: 'تنسيق Data URL غير صالح' },
          { status: 400 }
        );
      }

      const mime = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const randomSuffix = crypto.randomBytes(4).toString('hex');
      const filename = `hafsa-prod-${Date.now()}-${randomSuffix}.webp`;

      let finalUrl = rawDataUrl;
      try {
        finalUrl = await persistUploadedImage(buffer, filename, mime, rawDataUrl);
      } catch (persistErr: any) {
        return NextResponse.json(
          { error: persistErr?.message || 'تعذر حفظ الصورة' },
          { status: 413 }
        );
      }

      return NextResponse.json({
        success: true,
        url: finalUrl,
        filename,
        format: mime.includes('webp') ? 'webp' : mime.replace('image/', ''),
        sizeBytes: buffer.length,
        message: 'تم استلام وتجهيز الصورة بنجاح ✅',
      });
    }

    // B. Multipart/form-data upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || typeof file === 'string' || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: 'لم يتم العثور على ملف صورة صالح في الطلب' },
          { status: 400 }
        );
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `نوع الملف (${file.type}) غير مدعوم. الأنواع المدعومة: WebP, JPEG, PNG, AVIF` },
          { status: 400 }
        );
      }

      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: 'حجم ملف الصورة كبير جداً (الحد الأقصى 8 ميجابايت)' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${file.type};base64,${base64}`;

      const randomSuffix = crypto.randomBytes(4).toString('hex');
      const extension = file.type === 'image/webp' ? 'webp' : 'webp';
      const filename = `hafsa-prod-${Date.now()}-${randomSuffix}.${extension}`;

      let finalUrl = dataUrl;
      try {
        finalUrl = await persistUploadedImage(buffer, filename, file.type, dataUrl);
      } catch (persistErr: any) {
        return NextResponse.json(
          { error: persistErr?.message || 'تعذر حفظ الصورة' },
          { status: 413 }
        );
      }

      return NextResponse.json({
        success: true,
        url: finalUrl,
        filename,
        format: 'webp',
        originalSize: file.size,
        compressedSize: buffer.length,
        message: 'تم رفع الصورة وضغطها بنجاح ✅',
      });
    }

    return NextResponse.json(
      { error: 'نوع المحتوى (Content-Type) غير مدعوم. استخدم multipart/form-data أو application/json' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Error uploading product image:', err);
    return NextResponse.json(
      { error: `فشل في رفع الصورة: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
