import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Startline — cycling race finder",
  description: "Map-first calendar of cycling races across Central Europe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full bg-stone-100 font-sans text-stone-900 antialiased">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
