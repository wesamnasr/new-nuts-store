'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, ClipboardList } from 'lucide-react';

/**
 * UX Constitution Section 4.5 Security Policy:
 * External suppliers NEVER log into the ERP. All supply invoices, scale weight verification,
 * supplier ledgers, and WhatsApp shortage POs are managed exclusively by the internal
 * Procurement & Inventory Officer inside /admin?tab=supply_invoices.
 */
export default function SupplierPortalRedirectPage() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.replace('/admin?tab=supply_invoices');
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white max-w-md w-full rounded-2xl border border-[#E8E0D5] shadow-lg p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#FAF6F0] border border-[#E8E0D5] mx-auto flex items-center justify-center text-[#9A6836]">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-cairo font-bold text-lg text-[#231710]">
            بوابة التوريدات داخلية فقط (قرار أمني معتمد)
          </h1>
          <p className="text-xs text-[#6B5B4E] leading-relaxed">
            حفاظاً على سرية المخزون والأسعار، تم إلغاء دخول الموردين الخارجيين. يتم تسجيل فواتير
            التوريد ومطابقة أوزان الميزان وإرسال أوامر الشراء عبر واتساب من خلال{' '}
            <strong className="text-[#231710]">مسؤول التوريدات والمخزون</strong> داخل لوحة الإدارة.
          </p>
        </div>
        <Link
          href="/admin?tab=supply_invoices"
          className="w-full min-h-[48px] bg-[#231710] hover:bg-[#3A271C] text-white font-cairo font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition"
        >
          <ClipboardList className="w-4 h-4 text-[#D4AF37]" />
          <span>الانتقال إلى لوحة التوريدات والمخزون</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </Link>
      </div>
    </div>
  );
}
