"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  X,
  MapPin,
  Globe,
  ExternalLink,
  Trophy,
  Users,
  Heart,
  Calendar,
  CalendarPlus,
  Check,
  CreditCard,
  ClipboardCheck,
} from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import type { EventListItem } from "@/lib/events";
import { publicRaceUrl } from "@/lib/watcher/public-url";
import { formatAudienceList } from "@/lib/audience";
import { messages, type Locale } from "@/lib/i18n/messages";
import { LEVEL_LABELS, type RaceLevel } from "@/lib/race-level";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AuthDialog } from "@/components/account/auth-dialog";
import Link from "next/link";

type Member = {
  id: string;
  name: string;
  relationship: string;
  is_self: boolean;
};

type Attendance = {
  member_id: string;
  status: string;
  registered: boolean;
  paid: boolean;
};

export function EventDetailPanel({
  event,
  onClose,
  locale,
}: {
  event: EventListItem;
  onClose: () => void;
  locale: string;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState("Sign in to save races and add them to your calendar.");
  const [pendingAction, setPendingAction] = useState<"save" | "calendar" | null>(null);

  async function loadUserState(uid: string) {
    const supabase = createBrowserSupabase();
    const [{ data: mems }, { data: fav }, { data: att }] = await Promise.all([
      supabase.from("family_members").select("*").eq("user_id", uid).order("created_at"),
      supabase
        .from("event_favorites")
        .select("event_id")
        .eq("user_id", uid)
        .eq("event_id", event.id)
        .maybeSingle(),
      supabase
        .from("event_attendance")
        .select("member_id, status, registered, paid")
        .eq("user_id", uid)
        .eq("event_id", event.id),
    ]);
    setMembers(mems ?? []);
    setFavorited(Boolean(fav));
    setAttendance(att ?? []);
    return mems ?? [];
  }

  useEffect(() => {
    const supabase = createBrowserSupabase();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      await loadUserState(uid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  function requireAuth(action: "save" | "calendar") {
    setPendingAction(action);
    setAuthReason(
      action === "save"
        ? "Sign in to save this race to your favorites."
        : "Sign in to add this race to your family calendar.",
    );
    setAuthOpen(true);
  }

  async function toggleFavorite(uidOverride?: string) {
    const uid = uidOverride ?? userId;
    if (!uid) {
      requireAuth("save");
      return;
    }
    setBusy(true);
    const supabase = createBrowserSupabase();
    if (favorited) {
      await supabase.from("event_favorites").delete().eq("user_id", uid).eq("event_id", event.id);
      setFavorited(false);
    } else {
      await supabase.from("event_favorites").insert({ user_id: uid, event_id: event.id });
      setFavorited(true);
    }
    setBusy(false);
  }

  async function toggleGoing(memberId: string, uidOverride?: string) {
    const uid = uidOverride ?? userId;
    if (!uid) {
      requireAuth("calendar");
      return;
    }
    setBusy(true);
    const supabase = createBrowserSupabase();
    const existing = attendance.find((a) => a.member_id === memberId);
    if (existing) {
      await supabase
        .from("event_attendance")
        .delete()
        .eq("user_id", uid)
        .eq("event_id", event.id)
        .eq("member_id", memberId);
      setAttendance((prev) => prev.filter((a) => a.member_id !== memberId));
    } else {
      await supabase.from("event_attendance").insert({
        user_id: uid,
        event_id: event.id,
        member_id: memberId,
        status: "going",
      });
      setAttendance((prev) => [
        ...prev,
        { member_id: memberId, status: "going", registered: false, paid: false },
      ]);
    }
    setBusy(false);
  }

  async function onAuthSuccess() {
    const action = pendingAction;
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    setUserId(uid);
    setPendingAction(null);
    if (!uid) return;
    const mems = await loadUserState(uid);
    if (action === "save") {
      const { data: fav } = await supabase
        .from("event_favorites")
        .select("event_id")
        .eq("user_id", uid)
        .eq("event_id", event.id)
        .maybeSingle();
      if (!fav) {
        await supabase.from("event_favorites").insert({ user_id: uid, event_id: event.id });
        setFavorited(true);
      }
    } else if (action === "calendar") {
      const self = mems.find((m) => m.is_self) ?? mems[0];
      if (self) {
        const { data: existing } = await supabase
          .from("event_attendance")
          .select("member_id")
          .eq("user_id", uid)
          .eq("event_id", event.id)
          .eq("member_id", self.id)
          .maybeSingle();
        if (!existing) await toggleGoing(self.id, uid);
      }
    }
  }

  async function toggleFlag(memberId: string, field: "registered" | "paid") {
    if (!userId) return;
    const row = attendance.find((a) => a.member_id === memberId);
    if (!row) return;
    setBusy(true);
    const next = !row[field];
    const supabase = createBrowserSupabase();
    await supabase
      .from("event_attendance")
      .update({ [field]: next, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("event_id", event.id)
      .eq("member_id", memberId);
    setAttendance((prev) =>
      prev.map((a) => (a.member_id === memberId ? { ...a, [field]: next } : a)),
    );
    setBusy(false);
  }

  const levelKey = (event.level || "local") as RaceLevel;
  const levelLabel = event.classLabel || LEVEL_LABELS[levelKey] || event.level;
  const websiteUrl = publicRaceUrl(event.websiteUrl);
  const registrationUrl = publicRaceUrl(event.registrationUrl);
  const t = messages[(locale as Locale) in messages ? (locale as Locale) : "en"];
  const audienceLabel = formatAudienceList(
    event.audience,
    { kids: t.kids, youth: t.youth, adults: t.adults },
    event.categories,
  );

  return (
    <aside className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-stone-200 md:w-[380px]">
      <div className="relative border-b border-stone-100 bg-gradient-to-br from-stone-900 to-stone-700 p-5 text-white">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-black/20 p-1.5 hover:bg-black/30"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="pr-8 text-2xl font-semibold leading-tight tracking-tight">{event.name}</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge className="bg-white/20 text-white">{levelLabel}</Badge>
          <Badge className="bg-white/20 text-white">{audienceLabel}</Badge>
          {event.disciplines.map((d) => (
            <Badge key={d} className="bg-white/15 text-white">
              {d}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-b border-stone-100 px-4 py-3">
        <Action
          icon={<Heart className={`h-4 w-4 ${favorited ? "fill-rose-500 text-rose-500" : ""}`} />}
          label={favorited ? "Saved" : "Save"}
          onClick={() => void toggleFavorite()}
          disabled={busy}
        />
        <Action
          icon={<CalendarPlus className="h-4 w-4" />}
          label="Calendar"
          onClick={() => {
            if (!userId) {
              requireAuth("calendar");
              return;
            }
            if (!members[0]) return;
            void toggleGoing(members[0].id);
          }}
          disabled={busy}
        />
        {websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs text-stone-900 hover:bg-stone-100"
          >
            <Globe className="h-4 w-4" />
            Website
          </a>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        <InfoRow icon={<Calendar className="h-4 w-4" />}>
          {format(parseISO(event.startDate), "EEEE d MMMM yyyy")}
          {event.endDate && event.endDate !== event.startDate
            ? ` – ${format(parseISO(event.endDate), "d MMMM yyyy")}`
            : ""}
        </InfoRow>
        <InfoRow icon={<MapPin className="h-4 w-4" />}>
          {event.location?.municipality || event.location?.name || "—"}
          {event.location?.countryCode ? ` · ${event.location.countryCode}` : ""}
        </InfoRow>
        <InfoRow icon={<Trophy className="h-4 w-4" />}>
          Level: <strong>{levelLabel}</strong>
          <span className="text-stone-500"> ({levelKey})</span>
        </InfoRow>
        <InfoRow icon={<Users className="h-4 w-4" />}>
          {audienceLabel}
          {event.series ? (
            <>
              {" · "}
              <Link
                href={`/${locale}?series=${event.series.slug}`}
                className="font-medium text-stone-900 underline"
              >
                {event.series.name}
              </Link>
            </>
          ) : null}
        </InfoRow>
        {websiteUrl && (
          <InfoRow icon={<Globe className="h-4 w-4" />}>
            <a
              href={websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-stone-900 underline"
            >
              {websiteUrl.replace(/^https?:\/\//, "").slice(0, 42)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </InfoRow>
        )}
        {registrationUrl && (
          <InfoRow icon={<ClipboardCheck className="h-4 w-4" />}>
            <a href={registrationUrl} target="_blank" rel="noreferrer" className="text-stone-900 underline">
              Registration link
            </a>
          </InfoRow>
        )}

        {(event.categories?.length ?? 0) > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Categories
            </p>
            <ul className="space-y-1.5">
              {event.categories!.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-stone-500">
                    {c.ageMin != null || c.ageMax != null
                      ? `${c.ageMin ?? "?"}–${c.ageMax ?? "?"} yrs`
                      : ""}
                    {c.distanceKm != null ? ` · ${c.distanceKm} km` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-stone-200 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Family / who is going
          </p>
          {!userId ? (
            <p className="text-sm text-stone-600">
              <button
                type="button"
                className="font-medium text-stone-900 underline"
                onClick={() => requireAuth("calendar")}
              >
                Sign in
              </button>{" "}
              to save favorites and track registration for you and your kids.
            </p>
          ) : members.length === 0 ? (
            <p className="text-sm text-stone-600">
              Add family members in{" "}
              <Link href={`/${locale}/account`} className="text-stone-900 underline">
                Account
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => {
                const att = attendance.find((a) => a.member_id === m.id);
                const going = Boolean(att);
                return (
                  <li key={m.id} className="rounded-lg bg-stone-50 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-stone-900">{m.name}</p>
                        <p className="text-[11px] text-stone-500">{m.relationship}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={going ? "default" : "outline"}
                        disabled={busy}
                        onClick={() => void toggleGoing(m.id)}
                      >
                        {going ? "Going" : "Add"}
                      </Button>
                    </div>
                    {going && (
                      <div className="mt-2 flex gap-2">
                        <FlagBtn
                          active={att!.registered}
                          icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                          label="Registered"
                          onClick={() => void toggleFlag(m.id, "registered")}
                        />
                        <FlagBtn
                          active={att!.paid}
                          icon={<CreditCard className="h-3.5 w-3.5" />}
                          label="Paid"
                          onClick={() => void toggleFlag(m.id, "paid")}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <AuthDialog
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPendingAction(null);
        }}
        onSuccess={() => void onAuthSuccess()}
        locale={locale}
        reason={authReason}
      />
    </aside>
  );
}

function Action({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-stone-700">
      <span className="mt-0.5 text-stone-400">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function FlagBtn({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
        active
          ? "bg-stone-900 text-white ring-stone-900"
          : "bg-white text-stone-600 ring-stone-200"
      }`}
    >
      {active ? <Check className="h-3 w-3" /> : icon}
      {label}
    </button>
  );
}
