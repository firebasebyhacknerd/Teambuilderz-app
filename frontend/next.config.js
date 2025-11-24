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
<<<<<<< HEAD
}

module.exports = nextConfig

=======
  experimental: {
    allowedDevOrigins: ["http://192.168.1.230:3000"],
  },
  output: 'export',
  images: {
    unoptimized: true,
  },

  // Adding rewrites to proxy API requests
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3001/api/v1/:path*', // Proxy to Backend
      },
    ];
  },
};

module.exports = nextConfig;
>>>>>>> 45aef2e4e76cf2dc9053192f0b3a49cac1475811
