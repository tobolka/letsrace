/** Reads Prima CUP round pages (iprimacup.cz) for upcoming public events and saves verified practical details. Dry unless --apply. */
import { readFileSync } from "node:fs";
import { parse } from "dotenv";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type PrimaCupEventRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string | null;
  public_revision: string;
  website_url: string | null;
  regulations_url: string | null;
  registration_url: string | null;
  location: { venue: string | null; municipality: string | null } | null;
};

async function main() {
  try { for (const [key, value] of Object.entries(parse(readFileSync(".env.local", "utf8")))) process.env[key] ??= value; } catch { /* the runner provides them */ }

  const apply = process.argv.includes("--apply");
  const maxArg = Number(process.argv.find(arg => arg.startsWith("--max="))?.slice(6) ?? 50);
  const max = Number.isFinite(maxArg) && maxArg > 0 ? Math.floor(maxArg) : 50;

  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { isPrimaCupRoundUrl, primaCupFacts } = await import("../src/lib/catalog/primacup");
  const { verifyPracticalExtraction } = await import("../src/lib/catalog/practical-extraction");
  const { savePracticalDetails, saveFoundLinks } = await import("../src/lib/catalog/practical-enrichment");
  const { registrationLinkIn } = await import("../src/lib/catalog/race-completeness");
  const { createServerSupabase } = await import("../src/lib/supabase/server");

  const db = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await db
    .from("events")
    .select("id,name,start_date,end_date,status,public_revision,website_url,regulations_url,registration_url,location:locations(venue,municipality)")
    .eq("visibility", "public")
    .is("merged_into_id", null)
    .gte("start_date", today)
    .or("status.is.null,status.not.in.(cancelled,completed)")
    .ilike("website_url", "%iprimacup.cz/%")
    .order("start_date")
    .returns<PrimaCupEventRow[]>();

  if (error) throw Error(error.message);

  const events = (rows ?? [])
    .filter(event => event.status !== "cancelled" && event.status !== "completed" && isPrimaCupRoundUrl(event.website_url ?? ""))
    .slice(0, max);

  const stats = {
    total: events.length,
    read: 0,
    saved: 0,
    upgradedRegulations: 0,
    fields: {} as Record<string, number>,
  };

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    const url = event.website_url!;
    const doc = await readDocument(url, { maxBytes: 4 * 1024 * 1024 }).catch(() => null);
    if (i < events.length - 1) await wait(350);
    if (!doc?.html) {
      console.log(`${event.start_date} ${event.name.slice(0, 40)}: unreadable (${url})`);
      continue;
    }

    stats.read++;
    const parsedPage = pageAsText(doc.html, url);
    const page = { url, text: parsedPage.text, links: [...parsedPage.links] };
    const raw = primaCupFacts(page, {
      startDate: event.start_date,
      endDate: event.end_date,
      municipality: event.location?.municipality ?? null,
    });

    const context = {
      name: event.name,
      startDate: event.start_date,
      endDate: event.end_date,
      knownVenue: event.location?.venue ?? undefined,
      municipality: event.location?.municipality ?? null,
      ownUrls: [page.url, event.website_url, event.regulations_url],
      documents: [page],
    };
    const checked = verifyPracticalExtraction(raw, context);
    const verifiedFields = Object.keys(checked.details);

    console.log(`${event.start_date} ${event.name.slice(0, 40)}: ${verifiedFields.join(",") || "-"} ${JSON.stringify(checked.reasons)}`);
    for (const key of verifiedFields) stats.fields[key] = (stats.fields[key] ?? 0) + 1;

    if (apply) {
      if (verifiedFields.length > 0) {
        const saved = await savePracticalDetails(event.id, event.public_revision, checked.details) as { changed?: string[] };
        if (saved.changed?.length) stats.saved++;
      }

      if (!event.registration_url) {
        const registration = registrationLinkIn(page.text);
        if (registration) await saveFoundLinks(event, { registration });
      }

      const isGenericRules = Boolean(event.regulations_url && /\/o-serialu\/pravidla\b/i.test(event.regulations_url));
      if (verifiedFields.length >= 2 && (!event.regulations_url || isGenericRules) && event.regulations_url !== page.url) {
        const { error: updateError } = await db.from("events").update({ regulations_url: page.url }).eq("id", event.id);
        if (updateError) throw Error(`Updating regulations_url: ${updateError.message}`);
        stats.upgradedRegulations++;
      }
    }
  }

  console.log(JSON.stringify(stats));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
