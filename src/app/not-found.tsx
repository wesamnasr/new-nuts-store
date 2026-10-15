import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <div className="max-w-sm w-full text-center bg-white rounded-2xl shadow-sm border border-brand-100 p-6 sm:p-7">
        <div className="w-14 h-14 mx-auto mb-4 bg-brand-50 border border-brand-200 rounded-full flex items-center justify-center text-2xl">
          🥜
        </div>
        <span className="inline-block px-2.5 py-0.5 bg-brand-100 text-brand-800 text-[11px] font-bold rounded-full mb-2">
          خطأ 404
        </span>
        <h1 className="text-xl sm:text-2xl font-extrabold text-brand-950 mb-2">
          الصفحة غير موجودة
        </h1>
        <p className="text-brand-700 text-xs sm:text-sm leading-relaxed mb-6">
          عذراً، الصفحة التي تبحث عنها غير متوفرة أو ربما تم نقلها أو حذفها. يمكنك العودة إلى المتجر وتصفح منتجاتنا الطازجة.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-sm hover:shadow"
        >
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
