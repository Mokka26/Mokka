import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy — alleen in productie (dev/Turbopack heeft losse
// eval/HMR-websockets nodig). 'unsafe-eval' is bewust toegestaan: three.js,
// gsap en de Sentry-SDK gebruiken het, en dit overrult tegelijk de strengere
// Vercel-platform-default die anders 'eval' blokkeert.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://www.mollie.com",
  "font-src 'self' data:",
  "connect-src 'self' https://res.cloudinary.com https://api.cloudinary.com https://*.sentry.io https://*.ingest.sentry.io https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "media-src 'self' https://res.cloudinary.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Trimt barrel-imports van zware libs (alleen gebruikte exports bundelen).
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Officiële Mollie betaalmethode-iconen op de checkout.
      { protocol: "https", hostname: "www.mollie.com" },
    ],
    formats: ["image/avif", "image/webp"],
    qualities: [75, 95],
    deviceSizes: [640, 750, 828, 1080, 1200, 1600, 1920, 2400, 3200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512, 768],
    minimumCacheTTL: 31536000,
  },
};

export default withSentryConfig(nextConfig, {
  org: "mokka-home",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Deprecated keys vervangen door webpack-options (Next 16 / Sentry 10):
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
