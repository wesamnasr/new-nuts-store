import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDbAsync } from '@/lib/db';
import { getSafeImageUrl } from '@/lib/defaults';
import { resolveProductBySlug, getRelatedProducts } from '@/lib/slugs';
import ProductDetailClient from '@/components/product/ProductDetailClient';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamicParams = true;
export const revalidate = 60;

/**
 * Generate Static Params for build-time pre-rendering on the single canonical /product/[slug] route
 */
export async function generateStaticParams() {
  const db = await getDbAsync();
  const products = db.products || [];
  return products.map((p) => ({
    slug: p.slug || p.id,
  }));
}

/**
 * Dynamic SEO Metadata Generation
 */
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = await getDbAsync();
  const storeName = db.settings?.storeName || 'محمصة حفصة للبن والمكسرات';
  const currency = db.settings?.currencySymbol || 'ج.م';
  const product = resolveProductBySlug(slug, db);

  if (!product) {
    return {
      title: `المنتج غير موجود | ${storeName}`,
      description: `عذراً، المنتج الذي تبحث عنه غير متوفر حالياً في ${storeName}.`,
      robots: { index: false, follow: true },
    };
  }

  const title = `${product.name} | ${storeName}`;
  const minPrice = Math.min(...product.weights.map((w) => w.price));
  const description = `${product.name} - ${product.subtitle}. ${product.description.slice(
    0,
    130
  )}... السعر يبدأ من ${minPrice} ${currency} • شحن لجميع محافظات مصر والدفع عند الاستلام.`;
  const heroImageUrl = getSafeImageUrl(product.image);

  return {
    title,
    description,
    alternates: {
      canonical: `/product/${product.slug || product.id}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'ar_EG',
      siteName: storeName,
      url: `/product/${product.slug || product.id}`,
      images: [
        {
          url: heroImageUrl,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [heroImageUrl],
    },
    other: {
      'product:price:amount': String(minPrice),
      'product:price:currency': 'EGP',
      'product:availability': product.inStock ? 'in stock' : 'out of stock',
      'product:condition': 'new',
      'product:brand': storeName,
      'product:retailer_item_id': product.id,
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const db = await getDbAsync();
  const product = resolveProductBySlug(slug, db);

  if (!product) {
    notFound();
  }

  const category = db.categories.find((c) => c.id === product.categoryId);
  const relatedProducts = getRelatedProducts(product, 4, db);
  const minPrice = Math.min(...product.weights.map((w) => w.price));
  const writtenReviews = Array.isArray(product.reviews) ? product.reviews : [];

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
      name: db.settings?.storeName || 'محمصة حفصة للبن والمكسرات',
    },
    offers: {
      '@type': 'Offer',
      url: `/product/${product.slug || product.id}`,
      priceCurrency: 'EGP',
      price: minPrice,
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: db.settings?.storeName || 'محمصة حفصة للبن والمكسرات',
      },
    },
    ...(writtenReviews.length > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: writtenReviews.length,
            bestRating: 5,
            worstRating: 1,
          },
          review: writtenReviews.slice(0, 5).map((r) => ({
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
