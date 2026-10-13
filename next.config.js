import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy — alleen in productie (dev/Turbopack heeft losse
// eval/HMR-websockets nodig). 'unsafe-eval' staat nog aan omdat dit de
// strengere Vercel-platform-default overrult; three.js/gsap (de oorspronkelijke
// reden) zijn verwijderd — kandidaat om te schrappen na een test met de
// Sentry-SDK.
// Google Ads + GA4 (gtag.js, components/Analytics.tsx): het script komt van
// googletagmanager.com; conversie-pings gaan als image/fetch naar google.com,
// googleadservices.com en doubleclick.net; GA4 stuurt naar
// *.google-analytics.com / *.analytics.google.com (regionale endpoints);
// de conversion-linker zet een onzichtbaar iframe op td.doubleclick.net.
const googleAdsHosts = {
  script: "https://www.googletagmanager.com https://*.googletagmanager.com",
  ping: "https://www.google.com https://www.google.nl https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  frame: "https://td.doubleclick.net https://googleads.g.doubleclick.net",
};

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com ${googleAdsHosts.script}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://res.cloudinary.com https://www.mollie.com ${googleAdsHosts.ping}`,
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

// Statische bestanden uit public/ (en de app-iconen) krijgen een jaar cache,
// immutable: de browser vraagt ze bij herhaalbezoek niet opnieuw op. Dat is
// alleen veilig voor bestanden waarvan de naam meeverandert als de inhoud
// verandert — wijzigt het logo, geef het bestand dan een nieuwe naam
// (logo-2027.png) i.p.v. het te overschrijven. Voor /_next/static regelt
// Next dit zelf (gehashte namen).
const immutableCache = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
const immutableStaticPaths = ["/images/:path*", "/icon.png", "/apple-icon.png", "/mokka-poster.jpg"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Trimt barrel-imports van zware libs (alleen gebruikte exports bundelen).
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...immutableStaticPaths.map((source) => ({ source, headers: immutableCache })),
    ];
  },
  images: {
    // Productfoto's gaan NIET door de Next-optimizer: components/ui/
    // CloudinaryImage (+ lib/cloudinary-url cloudinaryLoader) laat Cloudinary
    // resizen en f_auto/q_auto kiezen. De optimizer hieronder bedient alleen
    // lokale statics (public/images/logo.png); Mollie-iconen zijn `unoptimized`.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Officiële Mollie betaalmethode-iconen op de checkout.
      { protocol: "https", hostname: "www.mollie.com" },
    ],
    // Alleen voor de lokale statics: AVIF eerst (kleinste, alpha ondersteund),
    // WebP als fallback. Cloudinary kiest zijn eigen formaat via f_auto.
    formats: ["image/avif", "image/webp"],
    // Enige quality die <Image> nog meekrijgt (default 75; de Cloudinary-loader
    // negeert 'm en gebruikt q_auto). Next waarschuwt bij waarden buiten deze lijst.
    qualities: [75],
    // Bewust compact: elke breedte is een extra Cloudinary-transformatie per
    // foto (de loader gebruikt deze lijst voor de srcSet). 5 + 4 maten dekken
    // 375px-mobiel t/m 2x-retina-desktop.
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
