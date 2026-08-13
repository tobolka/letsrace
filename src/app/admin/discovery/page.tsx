import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import { DiscoveryQueue } from "@/components/admin/discovery-queue";

export default async function DiscoveryPage() {
  await requireAdminPage();
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("discovered_links")
    .select("*, from:watched_urls(url)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-sans tracking-tight text-3xl font-semibold">Discovery queue</h1>
        <p className="text-sm text-stone-500">
          Links found on calendars and series pages. Accept to start watching them.
        </p>
      </div>
      <DiscoveryQueue initial={data ?? []} />
    </div>
  );
}
