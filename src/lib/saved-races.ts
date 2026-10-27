import type { SupabaseClient } from "@supabase/supabase-js";
import { track } from "@/lib/analytics";
import { analyticsSection } from "@/lib/analytics-product";
import { toast } from "sonner";
import { ensureFavorite } from "@/lib/planner-db";
import { messagesFor } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";

/**
 * Which races the visitor has in their plan, shared by every "add to plan"
 * button on the page — one query for the whole list, not one per row.
 *
 * A visitor who is not signed in can still press the button: the race is
 * remembered here (in this browser) while they sign in or register, and added
 * as soon as a session appears — after the dialog, after Google's round trip,
 * or after the confirmation e-mail brings them back.
 */

export type SavedRacesState = { authed: boolean | null; ids: ReadonlySet<string> };

const PENDING_KEY = "letsrace:pending-plan-add";
/**
 * Long enough to find the confirmation e-mail, short enough not to surprise
 * someone who gave up and signs in next week. Closing the dialog does not
 * forget the race: registering by e-mail closes it before the session exists.
 */
const PENDING_TTL_MS = 86_400_000;

type Pending = { eventId: string; name: string; locale: string; at: number; source?: string };

const SERVER_STATE: SavedRacesState = { authed: null, ids: new Set() };
let state: SavedRacesState = SERVER_STATE;
let userId: string | null = null;
let client: SupabaseClient | null = null;
let ready: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: SavedRacesState) {
  state = next;
  listeners.forEach((l) => l());
}

function readPending(): Pending | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    if (!p?.eventId || Date.now() - p.at > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

function writePending(p: Pending | null) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Private mode: the race is not remembered across a redirect, but the
    // dialog's own sign-in still adds it (the session appears on this page).
  }
}

let memoryPending: Pending | null = null;

export function hasPendingSave(): boolean {
  return Boolean(memoryPending ?? readPending());
}

/** The app router's push, handed over by the components that use this store. */
let navigate: ((href: string) => void) | null = null;
export function setSavedRacesNavigate(push: (href: string) => void) {
  navigate = push;
}

function announce(name: string, locale: string) {
  const t = messagesFor(locale);
  toast.success(t.savedToPlan, {
    description: name,
    action: navigate ? { label: t.openPlan, onClick: () => navigate?.(localePath(locale, `account`)) } : undefined,
  });
}

const adding = new Map<string, Promise<boolean>>();
async function add(eventId: string, source = "unknown", authRequired = false): Promise<boolean> {
  if (!client || !userId) return false;
  if (state.ids.has(eventId)) return true;
  const existing = adding.get(eventId);
  if (existing) return existing;
  const operation = (async () => {
    const ok = await ensureFavorite(client!, userId!, eventId, false, () => {
      track("plan_save_completed", { race_id: eventId, source, auth_required: authRequired });
    });
    if (ok) set({ authed: true, ids: new Set(state.ids).add(eventId) });
    else track("action_failed", { action: "plan_save", error_class: "request" });
    return ok;
  })();
  adding.set(eventId, operation);
  try { return await operation; } finally { adding.delete(eventId); }
}

async function flushPending() {
  const p = memoryPending ?? readPending();
  if (!p || !userId) return;
  memoryPending = null;
  writePending(null);
  if (await add(p.eventId, p.source, true)) announce(p.name, p.locale);
  else toast.error(messagesFor(p.locale).saveFailed);
}

async function sync(id: string | null) {
  userId = id;
  if (!id || !client) {
    set({ authed: false, ids: new Set() });
    return;
  }
  const { data } = await client.from("event_favorites").select("event_id").eq("user_id", id);
  set({ authed: true, ids: new Set((data ?? []).map((r) => String(r.event_id))) });
  await flushPending();
}

/** Starts once per page; every button and the shell's boot share it. */
export function startSavedRaces(): Promise<void> {
  ready ??= (async () => {
    const { createBrowserSupabase } = await import("@/lib/supabase/browser");
    client = createBrowserSupabase();
    const { data } = await client.auth.getUser();
    await sync(data.user?.id ?? null);
    client.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id ?? null;
      if (id === userId) return;
      // Supabase holds its auth lock during this callback; querying from
      // inside it deadlocks, so the sync runs on the next tick.
      setTimeout(() => void sync(id), 0);
    });
  })().catch(() => set({ authed: false, ids: new Set() }));
  return ready;
}

export function subscribeSavedRaces(listener: () => void): () => void {
  void startSavedRaces();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSavedRaces = () => state;
export const getServerSavedRaces = () => SERVER_STATE;

/**
 * Add a race to the plan. "auth" means nobody is signed in: the race is now
 * waiting, and the caller should offer sign-in.
 */
export async function saveRace(race: { eventId: string; name: string; locale: string }): Promise<"saved" | "failed" | "auth"> {
  await startSavedRaces();
  if (state.ids.has(race.eventId)) return "saved";
  const source = typeof window !== "undefined" ? analyticsSection(window.location.pathname)?.section ?? "unknown" : "unknown";
  if (!adding.has(race.eventId)) track("plan_save_requested", { race_id: race.eventId, source, auth_required: !userId });
  if (!userId) {
    memoryPending = { ...race, source, at: Date.now() };
    writePending(memoryPending);
    return "auth";
  }
  if (await add(race.eventId, source)) {
    announce(race.name, race.locale);
    return "saved";
  }
  toast.error(messagesFor(race.locale).saveFailed);
  return "failed";
}
