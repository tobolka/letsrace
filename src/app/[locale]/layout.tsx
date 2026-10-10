import type { Metadata } from "next";
import { RootDocument, rootMetadata, rootViewport } from "@/components/shell/root-document";
import { notFound } from "next/navigation";
import { AuthErrorToast } from "@/components/account/auth-error-toast";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { absoluteUrl, localeAlternates, localeOgImagePath, seoCopy, socialCard, TITLE_SUFFIX } from "@/lib/seo";

export const viewport = rootViewport;

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
    // This is the site's root layout: the verification tokens, metadataBase and
    // robots defaults come from the shared document, then this language's own.
    ...rootMetadata,
    // A plain string here ends the root layout's template for every page below
    // it: race and hub titles went out without the brand. The template is
    // restated so it carries on; this page's own title is written out whole.
    title: { absolute: `${copy.title}${TITLE_SUFFIX}`, template: `%s${TITLE_SUFFIX}` },
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

/** The root layout of the public site — one per language. */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();

  // `lang` from the route, not a request header: reading headers here made
  // every page below dynamic.
  return (
    <RootDocument lang={raw}>
      <AuthErrorToast locale={raw} />
      {children}
    </RootDocument>
  );
}
