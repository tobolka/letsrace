import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, localeAlternates, seoCopy, SITE_NAME } from "@/lib/seo";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const copy = seoCopy[locale];
  const url = absoluteUrl(`/${locale}`);

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: url,
      languages: localeAlternates(),
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: copy.title,
      description: copy.description,
      url,
      locale: copy.ogLocale,
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();

  return (
    <div lang={raw} className="contents">
      {children}
    </div>
  );
}
