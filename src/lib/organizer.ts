import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Organisers taking over their race or series.
 *
 * A claim is verified at once when the account's address is on the race
 * website's own domain (info@mujzavod.cz for mujzavod.cz); anything else waits
 * for the owner's approval. A verified claim on a series covers every round.
 */

export type ClaimStatus = "pending" | "verified" | "rejected" | "revoked";
export type OrganizerClaim = {
  id: string;
  user_id: string;
  event_id: string | null;
  series_id: string | null;
  status: ClaimStatus;
  method: "email_domain" | "manual" | null;
  contact_email: string;
  note: string | null;
  created_at: string;
  decided_at: string | null;
};

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
type OrganizerEdit = {
  id: string;
  claim_id: string;
  user_id: string;
  event_id: string;
  field: string;
  previous: unknown;
  value: unknown;
  created_at: string;
};

/** The two tables this feature adds, typed here until the generated types are refreshed. */
type OrganizerDb = {
  public: {
    Tables: { organizer_claims: Row<OrganizerClaim>; organizer_edits: Row<OrganizerEdit> };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export function organizerDb(): SupabaseClient<OrganizerDb> {
  return createServerSupabase() as unknown as SupabaseClient<OrganizerDb>;
}

/** Addresses anyone can get: they prove nothing about who runs a race. */
const PUBLIC_MAIL = new Set([
  "gmail.com", "googlemail.com", "seznam.cz", "email.cz", "post.cz", "centrum.cz", "volny.cz", "atlas.cz", "tiscali.cz",
  "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com",
  "gmx.de", "gmx.net", "gmx.at", "web.de", "t-online.de", "freenet.de", "wp.pl", "o2.pl", "onet.pl", "interia.pl",
  "azet.sk", "zoznam.sk", "centrum.sk", "aol.com", "mail.com",
]);

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Whether an address belongs to the site's own domain: the same host, or the
 * site sitting on a subdomain of the address's domain (info@klub.cz for
 * zavod.klub.cz). A public mailbox never counts.
 */
export function emailMatchesSite(email: string | null | undefined, siteUrl: string | null | undefined): boolean {
  const domain = email?.toLowerCase().split("@")[1]?.trim();
  const host = hostOf(siteUrl);
  if (!domain || !host || PUBLIC_MAIL.has(domain)) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

/** The claim that lets this user edit this race: on the race itself, or on a series it belongs to. */
export async function editingClaim(userId: string, eventId: string): Promise<OrganizerClaim | null> {
  const db = organizerDb();
  const supabase = createServerSupabase();
  const [{ data: event }, { data: memberships }] = await Promise.all([
    supabase.from("events").select("series_id").eq("id", eventId).maybeSingle(),
    supabase.from("event_series").select("series_id").eq("event_id", eventId),
  ]);
  const seriesIds = [event?.series_id, ...(memberships ?? []).map((m) => m.series_id)].filter((id): id is string => Boolean(id));
  let query = db.from("organizer_claims").select("*").eq("user_id", userId).eq("status", "verified");
  query = seriesIds.length
    ? query.or(`event_id.eq.${eventId},series_id.in.(${seriesIds.join(",")})`)
    : query.eq("event_id", eventId);
  const { data } = await query.limit(1);
  return (data?.[0] as OrganizerClaim | undefined) ?? null;
}

/** Sets or clears the public badge to match whether any verified claim stands on the target. */
export async function syncBadge(target: { eventId?: string | null; seriesId?: string | null }) {
  const db = organizerDb();
  const supabase = createServerSupabase();
  const column = target.eventId ? "event_id" : "series_id";
  const id = (target.eventId ?? target.seriesId)!;
  const { count, error: countError } = await db
    .from("organizer_claims")
    .select("id", { count: "exact", head: true })
    .eq(column, id)
    .eq("status", "verified");
  if (countError) throw new Error(countError.message);
  const verifiedAt = count ? new Date().toISOString() : null;
  const table = target.eventId ? "events" : "series";
  // Keep the first verification's time while one stands.
  let update = supabase.from(table).update({ organizer_verified_at: verifiedAt } as never).eq("id", id);
  if (verifiedAt) update = update.is("organizer_verified_at" as never, null);
  const { error } = await update;
  if (error) throw new Error(error.message);
}
