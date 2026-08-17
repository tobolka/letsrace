import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import { DiscoveryQueue } from "@/components/admin/discovery-queue";
import { Button } from "@/components/ui/primitives";

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ queued?: string; watched?: string; error?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("discovered_links")
    .select("*, from:watched_urls(url)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-sans text-3xl font-semibold tracking-tight">Discovery queue</h1>
          <p className="text-sm text-stone-500">
            Independent race sites from web search and calendar outbound links. Accept to start
            watching.
          </p>
        </div>
        <form action="/api/admin/explore" method="post">
          <Button type="submit">Explore the web</Button>
        </form>
      </div>
      {sp.error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
          Explore run failed. Check ingest logs.
        </p>
      ) : null}
      {sp.queued != null ? (
        <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700 ring-1 ring-stone-200">
          Queued {sp.queued} new site{sp.queued === "1" ? "" : "s"}
          {sp.watched && sp.watched !== "0" ? ` · auto-watched ${sp.watched}` : ""}.
        </p>
      ) : null}
      <DiscoveryQueue initial={data ?? []} />
    </div>
  );
}
