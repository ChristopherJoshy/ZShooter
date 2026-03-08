/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Enable SWC for faster builds
  swcMinify: true,
  
  // Production optimizations
  output: 'standalone',
  
  // Reduce logging in production
  logLevel: 'error',
  
  // Module IDs
  moduleIds: 'deterministic',

  // Proxy all /api/* requests to the backend
  async rewrites() {
    // Detect environment
    const isDev = process.env.NODE_ENV === 'development';
    const backendUrl = isDev 
      ? process.env.API_URL ?? 'http://localhost:4000'
      : process.env.API_URL ?? 'https://zshooter.onrender.com';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
