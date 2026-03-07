/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode enabled for better dev experience.
  reactStrictMode: true,

  // Proxy all /api/* requests to the backend so the browser never talks cross-origin.
  // This means the auth cookie is scoped to the frontend domain (Vercel), not the backend
  // domain (Render), which allows Next.js server components to read it via cookies().
  // API_URL env var overrides the hardcoded production URL for local dev.
  async rewrites() {
    const backendUrl = process.env.API_URL ?? 'https://zshooter.onrender.com';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
