/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/simulate',
          destination: 'http://127.0.0.1:8001/api/simulate',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
