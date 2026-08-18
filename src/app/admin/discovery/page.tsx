import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import { DiscoveryQueue } from "@/components/admin/discovery-queue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CircleCheck, TriangleAlert } from "lucide-react";

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Discovery queue</h1>
          <p className="text-sm text-muted-foreground">
            Independent race sites from web search and calendar outbound links. Accept to start
            watching.
          </p>
        </div>
        <form action="/api/admin/explore" method="post">
          <Button type="submit">Explore the web</Button>
        </form>
      </div>
      {sp.error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>Explore run failed. Check ingest logs.</AlertDescription>
        </Alert>
      ) : null}
      {sp.queued != null ? (
        <Alert>
          <CircleCheck />
          <AlertDescription>
            Queued {sp.queued} new site{sp.queued === "1" ? "" : "s"}
            {sp.watched && sp.watched !== "0" ? ` · auto-watched ${sp.watched}` : ""}.
          </AlertDescription>
        </Alert>
      ) : null}
      <DiscoveryQueue initial={data ?? []} />
    </div>
  );
}
