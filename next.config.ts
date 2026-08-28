import type { NextConfig } from "next";

/** Next's dev overlay/HMR evaluates code; production bundles never need eval. */
const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com"
    : "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-insights.com https://nominatim.openstreetmap.org https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://tiles.openfreemap.org https://*.openfreemap.org https://*.openstreetmap.org",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com https://*.supabase.co",
      "frame-src 'self' https://accounts.google.com https://*.supabase.co",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium"],
  outputFileTracingExcludes: {
    "*": [
      "src/lib/watcher/extractors/csc-render.ts",
      "node_modules/@sparticuz/chromium/**",
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/maplibre/:path*",
        headers: [
          { key: "Content-Type", value: "text/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
