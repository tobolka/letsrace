import { openableUrl } from "@/lib/admin/urls";
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

  const { data: candidates, error: candidateError } = await supabase
    .from("pipeline_candidates")
    .select("id,payload,source_url,reason,status")
    .in("status", ["pending", "waiting", "conflict", "publishing"])
    .order("created_at", { ascending: false });
  if (candidateError) throw new Error(candidateError.message);

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
      <section className="rounded-lg border p-4" aria-labelledby="candidate-heading">
        <h2 id="candidate-heading" className="text-lg font-semibold">Race evidence awaiting review ({candidates?.length ?? 0})</h2>
        <p className="mt-1 text-sm text-muted-foreground">These are source claims awaiting a verified date or identity decision. They are separate from new website suggestions below; a proposed date is not a confirmed race day.</p>
        <ul className="mt-4 divide-y">
          {(candidates ?? []).map((candidate) => {
            const payload = candidate.payload && typeof candidate.payload === "object" && !Array.isArray(candidate.payload) ? candidate.payload : {};
            const url = openableUrl(candidate.source_url);
            return <li key={candidate.id} className="py-3 text-sm">
              <div className="font-medium">{typeof payload.name === "string" ? payload.name : "Unnamed race"}</div>
              <div className="text-muted-foreground">{candidate.status === "publishing" ? "Publication in progress" : candidate.status === "conflict" ? "Conflicting information" : "Awaiting verification"} · Proposed date: {typeof payload.startDate === "string" ? payload.startDate : "not confirmed"}</div>
              <p className="mt-1">{candidate.reason.includes("identity") || candidate.reason.includes("fingerprint") ? "Compare the race identity with the existing catalogue before publishing." : "Check the organiser’s announcement before treating this date as confirmed."}</p>
              <details className="mt-1 text-muted-foreground"><summary>Saved review note</summary><p className="mt-1 break-words">{candidate.reason}</p></details>
              {url ? <a className="mt-1 inline-block underline" href={url} target="_blank" rel="noreferrer">Check source</a> : null}
            </li>;
          })}
        </ul>
      </section>
      <DiscoveryQueue initial={data ?? []} />
    </div>
  );
}
