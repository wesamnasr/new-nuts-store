/** @type {import('next').NextConfig} */
// Force reload webpack cache
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
      }
    ],
    unoptimized: true,
  },
};

export default nextConfig;
