import { permanentRedirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { localePath } from "@/lib/localized-paths";

/**
 * An address a race used to have answers with a real 308 here.
 *
 * The page sits under `loading.tsx`, so by the time it can redirect the
 * response has started and the redirect arrives as a meta refresh with a 200.
 * The layout renders before that boundary: one primary-key lookup, and only
 * old slugs pay for more.
 */
export default async function RaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const { data } = await createServerSupabase()
    .from("event_slug_aliases")
    .select("event:events(slug)")
    .eq("slug", slug)
    .maybeSingle();
  const current = (data?.event as { slug?: string } | null)?.slug;
  if (current && current !== slug) permanentRedirect(localePath(locale, `e/${current}`));
  return children;
}
