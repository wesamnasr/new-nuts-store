'use client';

/**
 * Compresses an admin-selected image to <=720px and <=180KB (WebP/JPEG fallback)
 * and uploads it via /api/admin/upload-image when an admin session token is present.
 */
export async function compressAndUploadAdminImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('يرجى اختيار ملفات صور صالحة فقط'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.onload = (e) => {
      const src = String(e.target?.result || '');
      if (!src) {
        reject(new Error('ملف الصورة فارغ'));
        return;
      }

      const img = new window.Image();
      img.onerror = () => reject(new Error('تعذر معالجة أبعاد الصورة'));
      img.onload = () => {
        const maxDim = 720;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        const mime = dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
        if (mime === 'image/jpeg') {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        while (Math.round((dataUrl.length * 3) / 4) > 180 * 1024 && quality > 0.45) {
          quality = Math.round((quality - 0.12) * 100) / 100;
          dataUrl = canvas.toDataURL(mime, quality);
        }

        const token =
          (typeof window !== 'undefined' &&
            (sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token'))) ||
          '';

        if (!token) {
          resolve(dataUrl);
          return;
        }

        fetch('/api/admin/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ dataUrl }),
        })
          .then((r) => r.json().catch(() => null))
          .then((json) => {
            resolve(json?.success && json?.url ? String(json.url) : dataUrl);
          })
          .catch(() => resolve(dataUrl));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
