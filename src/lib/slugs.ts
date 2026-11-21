import { Product } from '@/types/store';
import { getDb } from '@/lib/db';

/**
 * Normalizes Arabic text for tolerant matching:
 * - Removes Arabic diacritics (tashkeel)
 * - Normalizes Alef variations (إ, أ, آ, ٱ -> ا)
 * - Normalizes Teh Marbuta (ة -> ه)
 * - Normalizes Alef Maksura (ى -> ي)
 * - Converts spaces, underscores, and punctuation to hyphens
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[إأآٱ]/g, 'ا')              // normalize alefs
    .replace(/ة/g, 'ه')                   // normalize teh marbuta
    .replace(/ى/g, 'ي')                   // normalize alef maksura
    .replace(/[\s\-_]+/g, '-')            // unify spaces and hyphens
    .replace(/[^\w\u0600-\u06FF\-]/g, '') // remove other symbols
    .replace(/^-+|-+$/g, '');             // trim leading/trailing hyphens
}

/**
 * Resolves a product by slug, ID, or normalized Arabic name.
 * Safe against URL-encoding and returns undefined for unknown slugs.
 */
export function resolveProductBySlug(rawSlug: string): Product | undefined {
  if (!rawSlug) return undefined;

  let decodedSlug = rawSlug;
  try {
    decodedSlug = decodeURIComponent(rawSlug).trim();
  } catch {
    decodedSlug = rawSlug.trim();
  }

  const db = getDb();
  const products = db.products || [];
  const normalizedQuery = normalizeArabicText(decodedSlug);

  // 1. Match by exact product ID
  const byId = products.find(
    (p) => p.id && p.id.toLowerCase() === decodedSlug.toLowerCase()
  );
  if (byId) return byId;

  // 2. Match by exact product slug
  const bySlug = products.find(
    (p) => p.slug && p.slug.toLowerCase() === decodedSlug.toLowerCase()
  );
  if (bySlug) return bySlug;

  // 3. Match by normalized product name
  if (normalizedQuery) {
    const byNormalizedName = products.find(
      (p) => normalizeArabicText(p.name) === normalizedQuery
    );
    if (byNormalizedName) return byNormalizedName;

    // 4. Match by normalized product slug
    const byNormalizedSlug = products.find(
      (p) => normalizeArabicText(p.slug) === normalizedQuery
    );
    if (byNormalizedSlug) return byNormalizedSlug;

    // 5. Tolerant substring match if length >= 3
    if (normalizedQuery.length >= 3) {
      const bySubstring = products.find((p) => {
        const normName = normalizeArabicText(p.name);
        return normName.includes(normalizedQuery) || normalizedQuery.includes(normName);
      });
      if (bySubstring) return bySubstring;
    }
  }

  return undefined;
}

/**
 * Returns related products sharing the same categoryId,
 * supplemented by other top-rated products if fewer than limit.
 */
export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const db = getDb();
  const allProducts = db.products || [];

  // Filter in-stock products in the same category (excluding current)
  const sameCategory = allProducts.filter(
    (p) => p.id !== product.id && p.categoryId === product.categoryId && p.inStock
  );

  // Sort by rating & popularity
  sameCategory.sort((a, b) => {
    if (a.featured !== b.featured) return Number(b.featured) - Number(a.featured);
    return (b.rating * b.reviewsCount) - (a.rating * a.reviewsCount);
  });

  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }

  // Fallback: supplement with high-rated products from other categories
  const needed = limit - sameCategory.length;
  const otherCategories = allProducts.filter(
    (p) => p.id !== product.id && p.categoryId !== product.categoryId && p.inStock
  );
  otherCategories.sort((a, b) => b.rating - a.rating);

  return [...sameCategory, ...otherCategories.slice(0, needed)];
}
