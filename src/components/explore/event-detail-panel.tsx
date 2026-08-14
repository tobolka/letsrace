"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  X,
  MapPin,
  Globe,
  Trophy,
  Heart,
  Calendar,
  CalendarPlus,
  Users,
  Bike,
  Flag,
} from "lucide-react";
import type { EventListItem } from "@/lib/events";
import { messages, type Locale } from "@/lib/i18n/messages";
import {
  DISCIPLINE_LABELS,
  RACE_LEVEL_LABELS,
  UCI_CLASS_LABELS,
  formatEventCategoryLabel,
  type Discipline,
  type RaceLevel,
  type UciClass,
} from "@/lib/taxonomy";
import { disciplineColor, disciplineColorDark } from "@/lib/map-visuals";
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
  onSelectSeries,
}: {
  event: EventListItem;
  onClose: () => void;
  locale: string;
  onSelectSeries?: (slug: string) => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState("Sign in to save races and use your calendar.");
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
        : "Sign in to add this race to your calendar.",
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

  const levelKey = (event.level || "local") as RaceLevel;
  const levelLabel =
    (event.uciClass
      ? UCI_CLASS_LABELS[event.uciClass as UciClass] || event.uciClass.toUpperCase()
      : null) ||
    event.classLabel ||
    RACE_LEVEL_LABELS[levelKey] ||
    event.level;
  const websiteUrl = event.websiteUrl || event.listingUrl;
  const t = messages[(locale as Locale) in messages ? (locale as Locale) : "en"];
  const audienceLabel = formatEventCategoryLabel(event, {
    kids: t.kids,
    youth: t.youth,
    adults: t.adults,
  });
  const discLabel = event.disciplines
    .slice(0, 3)
    .map((d) => DISCIPLINE_LABELS[d as Discipline] || d)
    .join(" · ");

  const headerFrom = disciplineColor(event.disciplines);
  const headerTo = disciplineColorDark(event.disciplines);

  return (
    <aside className="pointer-events-auto flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-stone-200 md:w-[300px] md:self-start md:max-h-[calc(100dvh-1.5rem)]">
      <div
        className="relative px-3 py-2.5 text-white"
        style={{
          background: `linear-gradient(145deg, ${headerFrom} 0%, ${headerTo} 100%)`,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-full p-1 bg-black/20 hover:bg-black/30"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="pr-8 text-[15px] font-semibold leading-snug tracking-tight">{event.name}</h2>
      </div>

      <div className="space-y-1.5 px-3 py-2.5 text-[13px] text-stone-700">
        <Row icon={<Calendar className="h-3.5 w-3.5" />}>
          {format(parseISO(event.startDate), "EEE d MMM yyyy")}
          {event.endDate && event.endDate !== event.startDate
            ? ` – ${format(parseISO(event.endDate), "d MMM")}`
            : ""}
        </Row>
        <Row icon={<MapPin className="h-3.5 w-3.5" />}>
          {event.location?.municipality || event.location?.name || "—"}
          {event.location?.countryCode ? ` · ${event.location.countryCode}` : ""}
        </Row>
        <Row icon={<Trophy className="h-3.5 w-3.5" />}>{levelLabel}</Row>
        {discLabel ? <Row icon={<Bike className="h-3.5 w-3.5" />}>{discLabel}</Row> : null}
        {audienceLabel ? <Row icon={<Users className="h-3.5 w-3.5" />}>{audienceLabel}</Row> : null}
        {event.series ? (
          <Row icon={<Flag className="h-3.5 w-3.5" />}>
            {onSelectSeries ? (
              <button
                type="button"
                onClick={() => onSelectSeries(event.series!.slug)}
                className="font-medium text-stone-900 underline decoration-stone-300 underline-offset-2"
              >
                {event.series.name}
              </button>
            ) : (
              <Link
                href={`/${locale}?series=${event.series.slug}`}
                className="font-medium text-stone-900 underline decoration-stone-300 underline-offset-2"
              >
                {event.series.name}
              </Link>
            )}
          </Row>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5 border-t border-stone-100 px-2 py-1.5">
        <IconBtn
          label={favorited ? "Saved" : "Save"}
          onClick={() => void toggleFavorite()}
          disabled={busy}
        >
          <Heart className={`h-4 w-4 ${favorited ? "fill-rose-500 text-rose-500" : ""}`} />
        </IconBtn>
        <IconBtn
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
        >
          <CalendarPlus className="h-4 w-4" />
        </IconBtn>
        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t.openWebsite}
            title={t.openWebsite}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          >
            <Globe className="h-4 w-4" />
          </a>
        ) : null}
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

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-stone-400" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 leading-snug">{children}</span>
    </p>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
