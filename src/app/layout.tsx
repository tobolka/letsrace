import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.className} ${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <TooltipProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </TooltipProvider>
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
