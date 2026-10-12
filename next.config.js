import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy — alleen in productie (dev/Turbopack heeft losse
// eval/HMR-websockets nodig). 'unsafe-eval' staat nog aan omdat dit de
// strengere Vercel-platform-default overrult; three.js/gsap (de oorspronkelijke
// reden) zijn verwijderd — kandidaat om te schrappen na een test met de
// Sentry-SDK.
// Google Ads (gtag.js, components/GoogleAdsTag.tsx): het script komt van
// googletagmanager.com; conversie-pings gaan als image/fetch naar google.com,
// googleadservices.com en doubleclick.net; de conversion-linker zet een
// onzichtbaar iframe op td.doubleclick.net.
const googleAdsHosts = {
  script: "https://www.googletagmanager.com",
  ping: "https://www.google.com https://www.google.nl https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com",
  frame: "https://td.doubleclick.net https://googleads.g.doubleclick.net",
};

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com ${googleAdsHosts.script}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://www.mollie.com ${googleAdsHosts.ping}`,
  "font-src 'self' data:",
  `connect-src 'self' https://res.cloudinary.com https://api.cloudinary.com https://*.sentry.io https://*.ingest.sentry.io https://va.vercel-scripts.com https://vitals.vercel-insights.com ${googleAdsHosts.script} ${googleAdsHosts.ping}`,
  `frame-src ${googleAdsHosts.frame}`,
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
    // Bewust compact: elke breedte is een extra Cloudinary-transformatie per
    // foto. 5 + 4 maten dekken 375px-mobiel t/m 2x-retina-desktop.
    deviceSizes: [640, 828, 1080, 1440, 1920],
    imageSizes: [96, 128, 256, 384],
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
