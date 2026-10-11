import type { Locale } from "@/lib/i18n/messages";
import { absoluteUrl, getSiteUrl, seoCopy, SITE_AUTHOR, SITE_NAME } from "@/lib/seo";

const CONTACT = "info@letsrace.cz";

/**
 * Who publishes the site, for the home page.
 *
 * Every race and hub page described its own content, but nothing said what
 * Let's Race itself is — no Organization, no WebSite — so a search engine had
 * no entity to attach the brand, the logo or the pages to. The `@id`s let the
 * other blocks refer to these two later without repeating them.
 */
export function SiteJsonLd({ locale }: { locale: Locale }) {
  const site = getSiteUrl();
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site}/#organization`,
        name: SITE_NAME,
        url: site,
        logo: absoluteUrl("/apple-icon.png"),
        email: CONTACT,
        founder: { "@type": "Person", name: SITE_AUTHOR.name, url: SITE_AUTHOR.url },
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        name: SITE_NAME,
        url: absoluteUrl(`/${locale}`),
        description: seoCopy[locale].description,
        inLanguage: locale,
        publisher: { "@id": `${site}/#organization` },
      },
    ],
  };
  const json = JSON.stringify(graph)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
