import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/context/StoreContext';
import Navbar from '@/components/Navbar';
import CartDrawer from '@/components/CartDrawer';
import ProductModal from '@/components/ProductModal';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import StickyCartBar from '@/components/StickyCartBar';
import Footer from '@/components/Footer';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'محمصة الواحة الذهبية | أفخر أنواع المكسرات الطازجة أونلاين',
  description:
    'تسوق أفخر أنواع البندق التركي، الفستق الأمريكي الجامبو، عين الجمل التشيلي، الكاجو الملكي، وبوكسات المشكل الطازجة المحمصة يومياً مع توصيل سريع لجميع محافظات مصر.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="font-cairo min-h-screen flex flex-col bg-brand-50 text-brand-950"
      >
        <StoreProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <CartDrawer />
          <ProductModal />
          <StickyCartBar />
          <FloatingWhatsApp />
          <Footer />
        </StoreProvider>
      </body>
    </html>
  );
}
