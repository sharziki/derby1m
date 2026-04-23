import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output keeps the Docker image small and self-contained.
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    // Production (Docker): proxy /api/simulate to the internal Python container.
    if (process.env.INTERNAL_API_URL) {
      return [
        {
          source: '/api/simulate',
          destination: `${process.env.INTERNAL_API_URL.replace(/\/$/, '')}/api/simulate`,
        },
      ];
    }
    // Local dev: proxy to uvicorn on 127.0.0.1:8001.
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/simulate',
          destination: 'http://127.0.0.1:8001/api/simulate',
        },
      ];
    }
    // Vercel: api/simulate.py is auto-routed by Vercel itself.
    return [];
  },
};

export default nextConfig;
