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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
        <p className="text-sm text-muted-foreground">
          Paste federation, series, aggregator, or single-race URLs. The watcher keeps them fresh.
        </p>
      </div>
      <SourcesManager initialSources={sources ?? []} />
    </div>
  );
}
