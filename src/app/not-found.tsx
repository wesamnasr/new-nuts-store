import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[55vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-xs w-full text-center bg-white rounded-2xl shadow-xs border border-brand-100 p-5">
        <div className="w-11 h-11 mx-auto mb-3 bg-brand-50 border border-brand-200 rounded-full flex items-center justify-center text-xl">
          🥜
        </div>
        <span className="inline-block px-2 py-0.5 bg-brand-100 text-brand-800 text-[10px] font-bold rounded-full mb-1.5">
          خطأ 404
        </span>
        <h1 className="text-lg sm:text-xl font-extrabold text-brand-950 mb-1.5">
          الصفحة غير موجودة
        </h1>
        <p className="text-brand-700 text-[11px] leading-relaxed mb-4">
          عذراً، الصفحة التي تبحث عنها غير متوفرة أو ربما تم نقلها أو حذفها. يمكنك العودة إلى المتجر وتصفح منتجاتنا الطازجة.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center w-full px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs hover:shadow-sm"
        >
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
