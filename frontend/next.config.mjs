/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode enabled for better dev experience.
  reactStrictMode: true,

  // All API calls proxied to backend — avoids CORS in browser.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
