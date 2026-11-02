import type { Metadata } from "next";
import { OrganizerPanel } from "@/components/account/organizer-panel";
import { asLocale } from "@/lib/i18n/messages";
import { organizerCopy } from "@/lib/i18n/organizer-copy";
import { SITE_NAME } from "@/lib/seo";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ race?: string; series?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: { absolute: `${organizerCopy[asLocale(locale)].title} · ${SITE_NAME}` }, robots: { index: false } };
}

/**
 * An organiser's own page: claim the race or series the link came from, see
 * every claim and its state, and edit what is verified.
 */
export default async function OrganizerPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { race, series } = await searchParams;
  const kind = race ? "race" : series ? "series" : null;
  const slug = race ?? series ?? null;
  let target: { kind: "race" | "series"; slug: string; name: string } | null = null;
  if (kind && slug && slug.length <= 200) {
    const supabase = createServerSupabase();
    const { data } = await (kind === "race"
      ? supabase.from("events").select("name, slug").eq("slug", slug).eq("visibility", "public").maybeSingle()
      : supabase.from("series").select("name, slug").eq("slug", slug).eq("visibility", "public").maybeSingle());
    if (data) target = { kind, slug: data.slug, name: data.name };
  }
  return <OrganizerPanel locale={locale} target={target} />;
}
