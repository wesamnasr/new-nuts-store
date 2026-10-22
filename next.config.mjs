/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
    ],
    unoptimized: true,
  },
  // Native Next.js redirection for legacy /products/:slug to canonical /product/:slug
  async redirects() {
    return [
      {
        source: '/products/:slug',
        destination: '/product/:slug',
        permanent: true,
      },
    ];
  },
  // Optimize output tracing on Windows and exclude non-app metadata
  outputFileTracingExcludes: {
    '*': ['.agents/**/*', 'data/**/*'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer && config.output) {
      config.output.chunkLoadTimeout = 180000;
    }
    return config;
  },
};

export default nextConfig;
