import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { WebMcpTools } from "@/components/agent/webmcp-tools";
import { getSiteUrl, seoCopy, SITE_AUTHOR, SITE_NAME } from "@/lib/seo";
import "./globals.css";

const site = getSiteUrl();
const en = seoCopy.en;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f4",
};

/** Google Search Console ownership for letsrace.cz. */
const GOOGLE_VERIFICATION = "aVohYf51HhFqN0skaqmxz-Lqs9RbFrujEihdbuZ9YEI";

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
    // The token is public by design — it ships in the page's meta tag — so it
    // lives here rather than in an env var somebody has to remember to set.
    google: process.env.GOOGLE_SITE_VERIFICATION || GOOGLE_VERIFICATION,
    other: {
      ...(process.env.SEZNAM_WMT_VERIFICATION
        ? { "seznam-wmt": process.env.SEZNAM_WMT_VERIFICATION }
        : {}),
      ...(process.env.BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
        : {}),
    },
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const raw = h.get("x-locale") ?? defaultLocale;
  const lang = locales.includes(raw as Locale) ? raw : defaultLocale;

  return (
    <html
      lang={lang}
      className={`${GeistSans.className} ${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <head>
        <link rel="ai-catalog" href="/.well-known/ai-catalog.json" />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <TooltipProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </TooltipProvider>
        <WebMcpTools />
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
