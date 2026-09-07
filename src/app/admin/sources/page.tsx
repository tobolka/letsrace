import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import { SourcesManager } from "@/components/admin/sources-manager";

export default async function SourcesPage() {
  await requireAdminPage();
  const supabase = createServerSupabase();
  const { data: sources } = await supabase
    .from("watched_urls")
    .select("*")
    .order("created_at", { ascending: false });

  /*
   * What each source is actually worth.
   *
   * A list of four hundred URLs with a green badge each says nothing about
   * which of them to keep. The number of races a source has put in the
   * catalogue is the one fact that answers it — a healthy source that has never
   * produced a race is a parser that does not work, and it looked identical to
   * the calendar carrying half the season.
   */
  const yields = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("event_sources")
      .select("watched_url_id")
      .not("watched_url_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + 999);
    const page = data ?? [];
    for (const row of page) {
      const id = row.watched_url_id as string;
      yields.set(id, (yields.get(id) ?? 0) + 1);
    }
    if (page.length < 1000) break;
  }

  const withYield = (sources ?? []).map((s) => ({
    ...s,
    races: yields.get(s.id as string) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
        <p className="text-sm text-muted-foreground">
          Paste federation, series, aggregator, or single-race URLs. The watcher keeps them fresh.
        </p>
      </div>
      <SourcesManager initialSources={withYield} />
    </div>
  );
}
