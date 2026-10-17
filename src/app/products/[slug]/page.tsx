import { redirect } from 'next/navigation';

interface LegacyProductsRouteProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyProductsRedirectPage({
  params,
}: LegacyProductsRouteProps) {
  const { slug } = await params;
  redirect(`/product/${slug}`);
}
