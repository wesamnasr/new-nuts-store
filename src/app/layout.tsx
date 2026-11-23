import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StoreProvider } from '@/context/StoreContext';
import ThemeController from '@/components/ThemeController';
import Navbar from '@/components/Navbar';
import CartDrawer from '@/components/CartDrawer';
import ProductModal from '@/components/ProductModal';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import StickyCartBar from '@/components/StickyCartBar';
import Footer from '@/components/Footer';

export const viewport: Viewport = {
  themeColor: '#231710',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://hafsahnuts.com'),
  title: 'محمصة حفصة للبن والمكسرات | بني مزار — أمام مسجد الزراعيين | HAFSA ROASTERY',
  description:
    'أصل التحميصة ومزاج القهوة الفاخر في قلب بني مزار (أمام مسجد الزراعيين مباشرة) — مكسرات VIP محمصة يومياً، بن تركي وإسبريسو طازج، كوبايات تسلية وبوكسات السهرة، وتوصيل فوري للبندر وقرى المركز مع 5% كاش باك VIP.',
  keywords: [
    'محمصة حفصة',
    'محمصة حفصة بني مزار',
    'Hafsa Roastery',
    'مكسرات بني مزار',
    'بن محوج بني مزار',
    'ركن القهوة والإسبريسو بني مزار',
    'بوكس السهرة المقسم',
    'تمور وعسل طبيعي المنيا',
  ],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/images/brand/hafsa-sticker-gold.png', type: 'image/png' },
    ],
    apple: [
      { url: '/images/brand/hafsa-logo-icon.png', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'محمصة حفصة للبن والمكسرات | بني مزار — HAFSA ROASTERY',
    description:
      'تحميص يومي طازج أمام مسجد الزراعيين ببني مزار — اطلب مكسراتك، توليفة قهوتك، مشروبات البار، أو صمّم بوكس السهرة بتوصيل فوري 30 دقيقة وكاش باك 5%.',
    url: 'https://hafsahnuts.com',
    locale: 'ar_EG',
    type: 'website',
    images: [
      {
        url: '/images/brand/hafsa-logo-main.png',
        width: 800,
        height: 800,
        alt: 'شعار محمصة حفصة للبن والمكسرات — بني مزار',
      },
    ],
  },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'Store',
  name: 'محمصة حفصة للبن والمكسرات — بني مزار',
  alternateName: 'HAFSA ROASTERY — Bani Mazar',
  url: 'https://hafsahnuts.com',
  image: '/images/brand/hafsa-logo-main.png',
  description:
    'محمصة حفصة للبن والمكسرات بمركز بني مزار (أمام مسجد الزراعيين مباشرة): 24 عين مكسرات وتسالي طازجة، ركن القهوة والإسبريسو، بوكسات السهرة والهدايا، وتوصيل فوري لبندر وقرى بني مزار.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'أمام مسجد الزراعيين مباشرة — مركز بني مزار',
    addressLocality: 'بني مزار',
    addressRegion: 'المنيا',
    addressCountry: 'EG',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 28.5036,
    longitude: 30.8004,
  },
  telephone: '+201107677672',
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
      closes: '02:00',
    },
  ],
  priceRange: '$$',
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
                  // Non-render-blocking async font enhancement after initial paint
                  window.addEventListener('load', function() {
                    if (navigator.onLine === false) return;
                    var schedule = window.requestIdleCallback || function(cb) { setTimeout(cb, 150); };
                    schedule(function() {
                      try {
                        if (document.getElementById('mizan-gf-async')) return;
                        var link = document.createElement('link');
                        link.id = 'mizan-gf-async';
                        link.rel = 'stylesheet';
                        link.media = 'print';
                        link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap';
                        link.onload = function() { link.media = 'all'; };
                        document.head.appendChild(link);
                      } catch (_) {}
                    });
                  });

                  // Intercept raw DOM Event rejections and ChunkLoadError timeouts to recover cleanly
                  window.addEventListener('error', function(event) {
                    var msg = (event && event.message) ? String(event.message) : '';
                    if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1) {
                      var lastReload = sessionStorage.getItem('mizan_chunk_reload_ts');
                      var now = Date.now();
                      if (!lastReload || now - Number(lastReload) > 10000) {
                        sessionStorage.setItem('mizan_chunk_reload_ts', String(now));
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
        className="font-tajawal min-h-screen flex flex-col antialiased"
      >
        <StoreProvider>
          <ThemeController />
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
