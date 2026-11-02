import Link from 'next/link';
import { Compass } from 'lucide-react';

export const dynamic = 'force-static';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] bg-[#FAF6F0] flex items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full text-center bg-white rounded-2xl border border-[#E8E0D5] p-6 sm:p-8 space-y-4">
        <div className="w-12 h-12 mx-auto bg-[#FAF6F0] border border-[#E8E0D5] rounded-2xl flex items-center justify-center text-[#9A6836]">
          <Compass className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <span className="inline-block px-2.5 py-0.5 bg-[#FAF6F0] text-[#9A6836] border border-[#E8E0D5] text-xs font-bold rounded-lg">
            خطأ 404
          </span>
          <h1 className="font-cairo text-xl font-bold text-[#231710]">
            الصفحة غير موجودة
          </h1>
          <p className="text-[#5C4A3D] text-xs sm:text-sm leading-relaxed">
            عذراً، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها. يمكنك العودة إلى المتجر وتصفح منتجاتنا الطازجة.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center w-full px-4 py-3 bg-[#231710] hover:bg-[#362419] text-[#FAF6F0] font-cairo text-xs sm:text-sm font-bold rounded-xl transition-colors"
        >
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
