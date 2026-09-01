import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthErrorToast } from "@/components/account/auth-error-toast";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, localeAlternates, localeOgImagePath, seoCopy, socialCard } from "@/lib/seo";

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
    ...socialCard({
      title: copy.title,
      description: copy.description,
      url,
      localeKey: locale,
      imagePath: localeOgImagePath(locale),
      imageAlt: copy.title,
    }),
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
    <>
      <AuthErrorToast locale={raw} />
      {children}
    </>
  );
}
