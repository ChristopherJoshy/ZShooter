/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode enabled for better dev experience.
  reactStrictMode: true,

  // Proxy all /api/* requests to the backend so the browser never talks cross-origin.
  // This means the auth cookie is scoped to the frontend domain (Vercel), not the backend
  // domain (Render), which allows Next.js server components to read it via cookies().
  // API_URL is a private server-only env var — never exposed to the browser bundle.
  async rewrites() {
    const backendUrl = process.env.API_URL;
    if (!backendUrl) {
      console.warn('[next.config] API_URL is not set — /api/* rewrites will not be configured');
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
