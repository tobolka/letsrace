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
  /**
   * Crawlers that get the title, description and canonical in <head>.
   *
   * Next streams metadata after the page shell for everyone not on its own
   * list — which leaves out Googlebot, SeznamBot and AI search crawlers.
   * Keep their metadata in the initial head, alongside the default bots;
   * setting the option replaces the default rather than extending it.
   */
  htmlLimitedBots:
    /Googlebot|SeznamBot|OAI-SearchBot|ChatGPT-User|PerplexityBot|Perplexity-User|Claude-SearchBot|Claude-User|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  // Nothing calls `next/image` (plain <img> throughout). Leaving the optimiser
  // on makes Next trace `sharp` + libvips (~28 MB) into every page function.
  images: { unoptimized: true },
  serverExternalPackages: ["@sparticuz/chromium"],
  outputFileTracingExcludes: {
    "*": [
      "src/lib/watcher/extractors/csc-render.ts",
      "node_modules/@sparticuz/chromium/**",
      // Home OG used to `import("sharp")` at request time; that pulled the
      // stack into all twenty-five page functions. The cards are static JPEGs
      // under public/og/ now, so nothing in the serverless graph needs these.
      "node_modules/@img/**",
      "node_modules/sharp/**",
      "node_modules/sharp-*/**",
    ],
  },
  experimental: {
    /**
     * The site's root layout is `app/[locale]/layout.tsx` (admin and the API
     * docs have their own), so there is no single layout left to compose a 404
     * for unmatched addresses from — `app/global-not-found.tsx` is that page.
     */
    globalNotFound: true,
    optimizePackageImports: ["lucide-react", "date-fns"],
    /**
     * Ship the stylesheet inside the HTML instead of behind a <link>.
     *
     * The shell now leaves the server in 40ms, but the browser cannot paint it
     * until a render-blocking stylesheet has been discovered, requested and
     * parsed — which is the two blank frames at the start of the filmstrip.
     * Tailwind keeps this small (121 kB raw, 21 kB on the wire), so trading a
     * round trip for those bytes is worth it on a first visit.
     */
    inlineCss: true,
  },
  async redirects() {
    return [
      // The canonical host is the apex — it is what `NEXT_PUBLIC_SITE_URL`,
      // the canonical tags and robots.txt all name. Serving the same pages on
      // www as well split every page into two URLs for search engines.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.letsrace.cz" }],
        destination: "https://letsrace.cz/:path*",
        permanent: true,
      },
    ];
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
          // Versioned under /maplibre/<semver>/, so the bytes at a URL never
          // change. `no-store` here meant every visit re-fetched a megabyte of
          // map library that the browser already had.
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
