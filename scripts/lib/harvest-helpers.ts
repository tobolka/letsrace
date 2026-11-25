import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import type { ParsedEvent } from "../../src/lib/domain";
import type { PracticalDetails } from "../../src/lib/practical-details";

export type CatalogueRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  visibility: string;
  merged_into_id: string | null;
  public_revision: string;
  website_url: string | null;
  regulations_url: string | null;
  registration_url: string | null;
  registration_closes_at: string | null;
  location: { municipality: string | null; country_code: string | null } | null;
};

const STOP = new Set([
  "cross", "cyclo", "cyclocross", "rennen", "race", "lauf", "2026", "2027", "2028",
  "radsport", "gravel", "pokal", "preis", "grosser", "grosser", "marathon", "bike",
  "cycling", "tour", "trophy", "challenge", "gran", "fondo", "classic", "open",
  "ultra", "brevet", "round", "stage", "etape", "vuelta", "giro", "prix", "grand",
  "international", "national", "meisterschaft", "radmarathon", "jedermann", "winter",
  "sommer", "herbst", "fruhjahr", "fruehjahr", "rennen", "radrennen", "event", "ride",
  "velodrom", "bahn", "track", "street", "road", "mountain", "mountainbike", "trail",
  "enduro", "downhill", "sprint", "krit", "kriterium", "zeitfahren", "club", "team",
  "sport", "veloclub", "radsportclub", "vereins", "stadt", "gemeinde", "kreis",
]);

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export const foldText = (text: string) =>
  text.toLowerCase().replaceAll("ß", "ss").normalize("NFD").replace(/\p{M}/gu, "");

export function distinctiveWords(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of foldText(text).match(/[a-z0-9]{4,}/g) ?? []) {
    if (!STOP.has(w) && !/^\d{4,5}$/.test(w)) out.add(w);
  }
  return out;
}

export function loadLocalEnv() {
  try {
    for (const [k, v] of Object.entries(parse(readFileSync(".env.local", "utf8")))) {
      process.env[k] ??= v;
    }
  } catch { /* runner provides env */ }
}

export async function loadCatalogue(sinceDate: string): Promise<CatalogueRow[]> {
  const { createServerSupabase } = await import("../../src/lib/supabase/server");
  const { readAllRows } = await import("../../src/lib/supabase/read-all");
  const db = createServerSupabase();
  return readAllRows((from, to) =>
    db
      .from("events")
      .select("id,name,start_date,end_date,visibility,merged_into_id,public_revision,website_url,regulations_url,registration_url,registration_closes_at,location:locations(municipality,country_code)")
      .gte("start_date", sinceDate)
      .order("start_date")
      .range(from, to),
  ) as unknown as Promise<CatalogueRow[]>;
}

/** Finds an existing catalogue record matching this race (public, hidden, or merged). */
export function findCatalogueMatch(
  catalogue: CatalogueRow[],
  incoming: { name: string; startDate: string; endDate?: string | null; place: string; countryCode?: string | null; radNetId?: string | null },
): CatalogueRow | null {
  const inEnd = incoming.endDate ?? incoming.startDate;
  const inWords = distinctiveWords(`${incoming.name} ${incoming.place}`);
  const inCountry = incoming.countryCode?.toUpperCase() || null;

  let best: { row: CatalogueRow; score: number } | null = null;
  for (const row of catalogue) {
    const rowEnd = row.end_date ?? row.start_date;
    if (row.start_date > inEnd || rowEnd < incoming.startDate) continue;
    if (incoming.radNetId) {
      const urls = `${row.website_url ?? ""} ${row.regulations_url ?? ""}`;
      if (urls.includes(`ID_Veranstaltung%3D${incoming.radNetId}`) || urls.includes(`ID_Veranstaltung=${incoming.radNetId}`)) {
        return row;
      }
    }
    const rowCountry = row.location?.country_code?.toUpperCase() || null;
    if (inCountry && rowCountry && inCountry !== rowCountry) continue;
    const rowWords = distinctiveWords(`${row.name} ${row.location?.municipality ?? ""}`);
    let shared = 0;
    for (const w of inWords) if (rowWords.has(w)) shared++;
    if (shared > 0 && (!best || shared > best.score)) {
      best = { row, score: shared };
    }
  }
  return best?.row ?? null;
}

export async function publishAndEnrich(
  event: ParsedEvent,
  evidence: { sourceUrl: string; documentHash: string; textHash: string; reason: string; country?: string | null },
  practical: PracticalDetails,
  authority: "official" | "series" | "national_federation" = "official",
): Promise<{ published: boolean; eventId: string | null; error?: string }> {
  const { createServerSupabase } = await import("../../src/lib/supabase/server");
  const { saveCandidate } = await import("../../src/lib/discovery/review");
  const { validateReviewSource } = await import("../../src/lib/discovery/review-source");
  const { ingestReviewedCandidate } = await import("../../src/lib/watcher/run");
  const { catalogueWindow } = await import("../../src/lib/catalog/overview-quality");
  const { savePracticalDetails } = await import("../../src/lib/catalog/practical-enrichment");
  const db = createServerSupabase();

  try {
    const saved = await saveCandidate(db, event, {
      sourceUrl: evidence.sourceUrl,
      documentHash: evidence.documentHash,
      textHash: evidence.textHash,
      reason: evidence.reason,
      country: evidence.country ?? undefined,
    });
    if (saved.rejected) return { published: false, eventId: null, error: "already rejected" };
    const { data: candidate, error: cErr } = await db
      .from("pipeline_candidates")
      .select("*")
      .eq("candidate_key", saved.candidate_key)
      .eq("evidence_hash", saved.evidence_hash)
      .single();
    if (cErr || !candidate) return { published: false, eventId: null, error: cErr?.message ?? "candidate missing" };

    const review = {
      id: candidate.id,
      evidenceHash: candidate.evidence_hash,
      action: "publish" as const,
      reason: evidence.reason,
      expectedEventId: null,
      authority,
      checked: { identity: true, date: true, place: true, discipline: true, authority: true },
    };
    await validateReviewSource(candidate, review, catalogueWindow().from);
    const { data: claim, error: claimErr } = await db.rpc("pipeline_claim_candidate", {
      p_id: candidate.id,
      p_hash: candidate.evidence_hash,
      p_updated: candidate.updated_at,
      p_decision: review as never,
      p_retry_resolved: false,
    });
    if (claimErr) return { published: false, eventId: null, error: claimErr.message };
    const receipt = claim as { status?: string; token?: string } | null;
    if (!receipt?.token || receipt.status !== "publishing") return { published: false, eventId: null, error: "not claimed" };

    await ingestReviewedCandidate(candidate, review, { id: candidate.id, evidenceHash: candidate.evidence_hash, token: receipt.token });

    // Look up the created event to attach practical_details immediately.
    const { data: created } = await db
      .from("events")
      .select("id,public_revision")
      .eq("name", event.name)
      .eq("start_date", event.startDate)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (created && Object.keys(practical).length) {
      await savePracticalDetails(created.id, created.public_revision, practical).catch(() => null);
    }
    return { published: true, eventId: created?.id ?? null };
  } catch (err) {
    return { published: false, eventId: null, error: (err instanceof Error ? err.message : String(err)).slice(0, 180) };
  }
}
