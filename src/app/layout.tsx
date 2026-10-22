import type { Metadata, Viewport } from 'next';
import { Cairo, Tajawal } from 'next/font/google';
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
  display: 'swap',
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-tajawal',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#231710',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'محمصة حفصة للبن والمكسرات | أصل التحميصة ومزاج القهوة الفاخر في بني مزار',
  description:
    'محمصة حفصة للبن والمكسرات بمركز بني مزار (أمام مسجد الزراعيين - المنيا). تسوق أونلاين أفخر المكسرات الطازجة، توليفات البن المحمص بالطلب، بوكس الـ 125 جنيه، الياميش، والعسل الطبيعي مع توصيل سريع لبندر وقرى بني مزار.',
  keywords: [
    'محمصة حفصة بني مزار',
    'أفضل بن ومكسرات في بني مزار',
    'بوكس تسالي بني مزار',
    'محمصة حفصة أمام مسجد الزراعيين',
    'بن عميد بني مزار',
    'مكسرات طازجة المنيا',
  ],
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'محمصة حفصة للبن والمكسرات | مركز بني مزار',
    description:
      'أصل التحميصة ومزاج القهوة الفاخر.. الآن في قلب بني مزار (أمام مسجد الزراعيين). صمّم بوكس السهرة أو توليفة قهوتك الخاصة الآن.',
    locale: 'ar_EG',
    type: 'website',
  },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'FoodEstablishment',
  name: 'محمصة حفصة للبن والمكسرات - HAFSA ROASTERY',
  alternateName: 'محمصة حفصة بني مزار',
  description:
    'محمصة حديثة للبن الفاخر والمكسرات المحمصة يومياً بالهواء الساخن، الياميش، التمور، العسل الطبيعي، والشوكولاتة المستوردة في مركز بني مزار.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'أمام مسجد الزراعيين - وسط البلد',
    addressLocality: 'بني مزار',
    addressRegion: 'المنيا',
    addressCountry: 'EG',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 28.5036,
    longitude: 30.8004,
  },
  telephone: '+201000000000',
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      opens: '09:00',
      closes: '01:00',
    },
  ],
  priceRange: '$$',
  servesCuisine: ['Coffee', 'Nuts', 'Dates', 'Honey', 'Sweets'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${tajawal.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (typeof window !== 'undefined') {
                  // Intercept raw DOM Event rejections and ChunkLoadError timeouts to recover cleanly
                  window.addEventListener('error', function(event) {
                    var msg = (event && event.message) ? String(event.message) : '';
                    if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1) {
                      var lastReload = sessionStorage.getItem('hafsa_chunk_reload_ts');
                      var now = Date.now();
                      if (!lastReload || now - Number(lastReload) > 10000) {
                        sessionStorage.setItem('hafsa_chunk_reload_ts', String(now));
                        window.location.reload();
                      }
                    }
                  });
                  window.addEventListener('unhandledrejection', function(event) {
                    if (event && event.reason && typeof event.reason === 'object' && ('isTrusted' in event.reason || event.reason instanceof Event)) {
                      event.preventDefault();
                      console.warn('Prevented raw Event unhandled rejection:', event.reason.type || event.reason);
                    }
                  });

                  if ('serviceWorker' in navigator) {
                    var isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                    if (isDev) {
                      navigator.serviceWorker.getRegistrations().then(function(registrations) {
                        if (!registrations) return;
                        for (var i = 0; i < registrations.length; i++) {
                          try { registrations[i].unregister(); } catch (_) {}
                        }
                      }).catch(function() {});
                      if ('caches' in window) {
                        caches.keys().then(function(names) {
                          if (!names) return;
                          for (var i = 0; i < names.length; i++) {
                            try { caches.delete(names[i]); } catch (_) {}
                          }
                        }).catch(function() {});
                      }
                    } else {
                      window.addEventListener('load', function() {
                        navigator.serviceWorker.register('/sw.js').catch(function() {});
                      });
                    }
                  }
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="font-tajawal min-h-screen flex flex-col bg-[#FAF6F0] text-[#231710] pb-16 lg:pb-0"
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
