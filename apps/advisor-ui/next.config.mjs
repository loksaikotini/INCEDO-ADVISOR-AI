/** @type {import('next').NextConfig} */
// FILE: apps/advisor-ui/next.config.mjs
// Ref: Blueprint §3.1 — Next.js frontend configuration

const nextConfig = {
  reactStrictMode: true,

  env: {
    // Only truly-public (non-secret) vars here.
    // DEEPGRAM_API_KEY is server-only — accessed via /api/deepgram/token and /api/voice/tts
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001',
  },

  // Security headers — Ref: Blueprint §5 OWASP compliance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },

  transpilePackages: ['@advisor-ai/types'],

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node": false,
    };
    return config;
  },
};

export default nextConfig;
