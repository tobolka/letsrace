import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { withCron } from "@/lib/api/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { PUBLIC_CATALOGUE_TAG, PUBLIC_CATALOGUE_VIEWS_TAG, publicEventTag, publicSeriesTag } from "@/lib/catalogue-cache";
import { publicationPayload } from "@/lib/pipeline/publication";
import { locales } from "@/lib/i18n/messages";

/** A private, claimed outbox item is required; callers cannot invalidate arbitrary paths. */
export const POST = withCron(async req => {
  const input = await req.json() as { key?: string; token?: string; revision?: string; catalogue?: boolean };
  if (typeof input.key !== "string" || input.key.length > 100 || !/^[a-f0-9-]{36}$/i.test(input.token ?? "")) return NextResponse.json({ error: "Invalid publication claim" }, { status: 400 });
  const db = createServerSupabase();
  const { data, error } = await db.from("pipeline_tasks").select("*").eq("key", input.key).single();
  if (error) throw error;
  if (!["public_refresh", "catalogue_refresh", "public_expire"].includes(data.kind) || data.status !== "running" || data.token !== input.token || !data.lease_until || !Number.isFinite(Date.parse(data.lease_until)) || Date.parse(data.lease_until) <= Date.now()) return NextResponse.json({ error: "Publication claim expired" }, { status: 409 });
  if (data.kind === "public_expire") {
    if (data.key !== "publication:expire" || !data.payload || typeof data.payload !== "object" || Array.isArray(data.payload) || data.payload.revision !== input.revision) return NextResponse.json({ error: "Publication superseded" }, { status: 409 });
    const { data: items, error: candidateError } = await db.rpc("pipeline_expiration_candidates", { p_token: input.token! });
    if (candidateError) throw candidateError;
    const tags = new Set<string>();
    for (const item of items) {
      const payload = publicationPayload(item.payload);
      for (const slug of [payload.slug, ...(payload.previousSlugs ?? [])]) {
        if (!slug || slug.length > 200 || slug.includes("/")) throw Error("Invalid race slug in publication");
        tags.add(item.key.startsWith("series:") ? publicSeriesTag(slug) : publicEventTag(slug));
      }
    }
    for (const tag of tags) revalidateTag(tag, { expire: 0 });
    // Receipts are recorded by the worker only after this response completes,
    // so a failed framework flush cannot strand a falsely acknowledged revision.
    return NextResponse.json({ items: items.map(item => ({ key: item.key, revision: publicationPayload(item.payload).revision })), verified: false }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (data.kind === "catalogue_refresh") {
    const payload = data.payload as { revision?: string };
    if (data.key !== "catalogue:upcoming" || typeof payload.revision !== "string" || payload.revision !== input.revision) return NextResponse.json({ error: "Publication superseded" }, { status: 409 });
    revalidateTag(PUBLIC_CATALOGUE_VIEWS_TAG, { expire: 0 });
    return NextResponse.json({ refreshed: true, revision: payload.revision }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const payload = publicationPayload(data.payload);
  if (payload.revision !== input.revision) return NextResponse.json({ error: "Publication superseded" }, { status: 409 });
  // Explicit operator batch only. Routine watcher publication stays race-scoped.
  if (input.catalogue === true) {
    revalidateTag(PUBLIC_CATALOGUE_TAG, { expire: 0 });
    revalidateTag(PUBLIC_CATALOGUE_VIEWS_TAG, { expire: 0 });
  }
  for (const slug of new Set([payload.slug, ...(payload.previousSlugs ?? [])])) {
    if (!slug || slug.length > 200 || slug.includes("/")) throw Error("Invalid race slug in publication");
    revalidateTag(publicEventTag(slug), { expire: 0 });
    // revalidatePath takes the destination route, before the language rewrite.
    for (const locale of locales) revalidatePath(`/${locale}/e/${slug}`);
  }
  return NextResponse.json({ refreshed: true, revision: payload.revision }, { headers: { "Cache-Control": "private, no-store" } });
});
