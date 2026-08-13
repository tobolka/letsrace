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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-sans tracking-tight text-3xl font-semibold">Sources</h1>
        <p className="text-sm text-stone-500">
          Paste federation, series, aggregator, or single-race URLs. The watcher keeps them fresh.
        </p>
      </div>
      <SourcesManager initialSources={sources ?? []} />
    </div>
  );
}
