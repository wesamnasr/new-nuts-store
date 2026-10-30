import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB limit
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];

export async function POST(request: NextRequest) {
  // 1. Strict Admin Authentication
  const auth = verifyAdminRequest(request, ['super_admin']);
  if (!auth) {
    return NextResponse.json(
      { error: 'غير مصرح لك برفع الصور (صلاحية المدير العام مطلوبة)' },
      { status: 401 }
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

      // Try saving to public/uploads if filesystem is writable
      let finalUrl = rawDataUrl;
      try {
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);
        finalUrl = `/uploads/${filename}`;
      } catch {
        // Fallback to optimized dataUrl for read-only serverless runtimes
        finalUrl = rawDataUrl;
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
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);
        finalUrl = `/uploads/${filename}`;
      } catch {
        finalUrl = dataUrl;
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
