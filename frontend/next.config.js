/** @type {import('next').NextConfig} */
const nextConfig = {
  // Modern Next.js configuration
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3001/api/v1/:path*',
      },
    ]
  },
  experimental: {
    allowedDevOrigins: ["http://192.168.1.230:3000"],
  },
  output: 'export',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
