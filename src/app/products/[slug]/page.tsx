import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDbAsync } from '@/lib/db';
import { getSafeImageUrl } from '@/lib/defaults';
import { resolveProductBySlug, getRelatedProducts } from '@/lib/slugs';
import ProductDetailClient from './ProductDetailClient';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamic = 'force-dynamic';

/**
 * Generate Static Params for build-time pre-rendering
 */
export async function generateStaticParams() {
  const db = await getDbAsync();
  const products = db.products || [];
  return products.flatMap((p) => [
    { slug: p.slug },
    { slug: p.id },
  ]);
}

/**
 * Dynamic SEO Metadata Generation
 */
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  await getDbAsync();
  const product = resolveProductBySlug(slug);

  if (!product) {
    return {
      title: 'المنتج غير موجود | محمصة الواحة الذهبية',
      description:
        'عذراً، المنتج الذي تبحث عنه غير متوفر حالياً في متجر محمصة الواحة الذهبية.',
      robots: { index: false, follow: true },
    };
  }

  const title = `${product.name} | محمصة الواحة الذهبية`;
  const minPrice = Math.min(...product.weights.map((w) => w.price));
  const description = `${product.name} - ${product.subtitle}. ${product.description.slice(
    0,
    140
  )}... بلد المنشأ: ${product.origin}. السعر يبدأ من ${minPrice} ج.م. تحميص طازج يومياً بالهواء الساخن مع شحن سريع لجميع محافظات مصر.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/products/${product.slug || product.id}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'ar_EG',
      siteName: 'محمصة الواحة الذهبية',
      url: `/products/${product.slug || product.id}`,
      images: [
        {
          url: getSafeImageUrl(product.image),
          width: 900,
          height: 600,
          alt: product.name,
        },
        ...(product.gallery || []).map((imgUrl) => ({
          url: getSafeImageUrl(imgUrl),
          width: 900,
          height: 600,
          alt: `${product.name} - صورة إضافية`,
        })),
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [getSafeImageUrl(product.image)],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const db = await getDbAsync();
  const product = resolveProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const category = db.categories.find((c) => c.id === product.categoryId);
  const relatedProducts = getRelatedProducts(product, 4);
  const minPrice = Math.min(...product.weights.map((w) => w.price));

  // JSON-LD Structured Data Schema for Google Rich Snippets
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: [
      getSafeImageUrl(product.image),
      ...(product.gallery || []).map((u) => getSafeImageUrl(u)),
    ],
    description: product.description,
    sku: product.id,
    brand: {
      '@type': 'Brand',
      name: 'محمصة الواحة الذهبية',
    },
    offers: {
      '@type': 'Offer',
      url: `https://elwaha-nuts.com/products/${product.slug || product.id}`,
      priceCurrency: 'EGP',
      price: minPrice,
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'محمصة الواحة الذهبية',
      },
    },
    ...(product.reviewsCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviewsCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(product.reviews && product.reviews.length > 0
      ? {
          review: product.reviews.slice(0, 5).map((r) => ({
            '@type': 'Review',
            author: {
              '@type': 'Person',
              name: r.customerName,
            },
            datePublished: new Date().toISOString().split('T')[0],
            reviewRating: {
              '@type': 'Rating',
              ratingValue: r.rating,
              bestRating: 5,
              worstRating: 1,
            },
            reviewBody: r.comment,
          })),
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient
        initialProduct={product}
        category={category}
        relatedProducts={relatedProducts}
      />
    </>
  );
}
