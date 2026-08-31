import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { DeferredChrome } from "@/components/deferred-chrome";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultLocale } from "@/lib/i18n/messages";
import { getSiteUrl, seoCopy, SITE_AUTHOR, SITE_NAME } from "@/lib/seo";
import "./globals.css";

/** optional = no late swap CLS if the file misses the first paint window. */
const GeistSans = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "optional",
  adjustFontFallback: "Arial",
});

const site = getSiteUrl();
const en = seoCopy.en;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f4",
};

/**
 * Search-console ownership. Public by design — it ships in the page's meta tag
 * on every request.
 *
 * Google is verified by DNS TXT instead: the site is registered as a Domain
 * property, which accepts nothing else, and the root path 307s to /en so a tag
 * there would never be read anyway. The env override below still works if that
 * ever changes.
 */
const SEZNAM_VERIFICATION = "5ixYWYYeiOTVCgKPzlpbV8K9oBN2TEJD";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: en.title,
    template: `%s · ${SITE_NAME}`,
  },
  description: en.description,
  applicationName: SITE_NAME,
  keywords: [
    "cycling races",
    "race calendar",
    "MTB",
    "gravel",
    "cyclocross",
    "Central Europe",
    "Czech Republic",
    "kids races",
  ],
  authors: [{ name: SITE_AUTHOR.name, url: SITE_AUTHOR.url }],
  creator: SITE_AUTHOR.name,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: en.title,
    description: en.description,
    url: site,
    locale: en.ogLocale,
  },
  twitter: {
    card: "summary_large_image",
    title: en.title,
    description: en.description,
  },
  robots: {
    index: true,
    follow: true,
  },
  /**
   * Search-console ownership, supplied by env so a code can be pasted into
   * Vercel without a deploy of its own. Seznam is not optional here: it carries
   * a tenth of Czech search, and Czechia is the home market.
   */
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    other: {
      // Seznam carries roughly a tenth of Czech search, and Czechia is the
      // home market — worth as much here as Google's own token.
      "seznam-wmt": process.env.SEZNAM_WMT_VERIFICATION || SEZNAM_VERIFICATION,
      ...(process.env.BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
        : {}),
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang={defaultLocale}
      className={`${GeistSans.className} ${GeistSans.variable} h-full`}
    >
      <head>
        <link rel="ai-catalog" href="/.well-known/ai-catalog.json" />
        <link rel="preconnect" href="https://basemaps.cartocdn.com" crossOrigin="" />
        <link rel="preconnect" href="https://tiles.basemaps.cartocdn.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://basemaps.cartocdn.com" />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <TooltipProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </TooltipProvider>
        <Toaster />
        <DeferredChrome />
      </body>
    </html>
  );
}
