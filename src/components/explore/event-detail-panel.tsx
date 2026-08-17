"use client";

import { useEffect, useRef, useState } from "react";
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
  ExternalLink,
  Share2,
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
import { track } from "@vercel/analytics";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/primitives";
import { eventTrustLevel, trustLabel } from "@/lib/trust";
import { eventMapPath, eventPagePath } from "@/lib/event-url";

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
  embedded = false,
}: {
  event: EventListItem;
  onClose: () => void;
  locale: string;
  onSelectSeries?: (slug: string) => void;
  /** Flat layout inside the mobile bottom sheet (no outer card chrome). */
  embedded?: boolean;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState("Sign in to save races and use your calendar.");
  const [pendingAction, setPendingAction] = useState<"save" | "calendar" | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

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
  const t = messages[(locale as Locale) in messages ? (locale as Locale) : "en"];
  const whoLabel = formatEventCategoryLabel(event, {
    kids: t.kids,
    youth: t.youth,
    adults: t.adults,
  });
  const discLabel = event.disciplines
    .slice(0, 4)
    .map((d) => DISCIPLINE_LABELS[d as Discipline] || d)
    .filter(Boolean)
    .join(" · ");

  const registerUrl = event.registrationUrl;
  const websiteUrl = event.websiteUrl;
  const listingUrl =
    event.listingUrl &&
    event.listingUrl !== websiteUrl &&
    event.listingUrl !== registerUrl
      ? event.listingUrl
      : null;
  const primaryEnter = registerUrl || websiteUrl || listingUrl;
  const primaryEnterLabel = registerUrl
    ? t.register
    : websiteUrl
      ? t.openWebsite
      : listingUrl
        ? t.calendarListing
        : null;

  const sharePath = eventMapPath(locale, event);
  const racePageHref = eventPagePath(locale, event.slug);

  async function copyShareLink() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${sharePath}` : sharePath;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: event.name, url });
        track("share_native", { slug: event.slug });
        return;
      }
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      track("share_link", { slug: event.slug });
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      /* user cancelled share or clipboard blocked */
    }
  }

  function trackEnter(kind: string) {
    track("outbound_enter", { slug: event.slug, kind });
  }

  const trust = eventTrustLevel(event);
  const trustText = trustLabel(trust, t);

  const headerFrom = disciplineColor(event.disciplines);
  const headerTo = disciplineColorDark(event.disciplines);

  return (
    <aside
      className={cn(
        "pointer-events-auto flex w-full flex-col overflow-hidden bg-white",
        embedded
          ? "rounded-none shadow-none ring-0"
          : "rounded-xl shadow-lg ring-1 ring-stone-200 md:w-[300px] md:max-h-[calc(100dvh-1.5rem)] md:self-start",
      )}
    >
      <div
        className="relative px-3 py-3 text-white sm:py-2.5"
        style={{
          background: `linear-gradient(145deg, ${headerFrom} 0%, ${headerTo} 100%)`,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="touch-target absolute right-1.5 top-1.5 inline-flex size-11 items-center justify-center rounded-full bg-black/20 text-white transition-[background-color,transform] duration-150 ease-out hover:bg-black/35 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 md:size-9"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <h2 className="pr-12 text-[15px] font-semibold leading-snug tracking-tight sm:pr-10">
          {event.name}
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3 text-[13px] text-stone-700">
        <Row icon={<Calendar className="h-3.5 w-3.5" />}>
          <time className="tabular" dateTime={event.startDate}>
            {format(parseISO(event.startDate), "EEE d MMM yyyy")}
            {event.endDate && event.endDate !== event.startDate
              ? ` – ${format(parseISO(event.endDate), "d MMM")}`
              : ""}
          </time>
        </Row>
        <Row icon={<MapPin className="h-3.5 w-3.5" />}>
          <span className="break-words">
            {event.location?.municipality || event.location?.name || "—"}
            {event.location?.countryCode ? ` · ${event.location.countryCode}` : ""}
          </span>
        </Row>

        <Fact
          icon={<Users className="h-3.5 w-3.5" />}
          label={t.audience}
          known={Boolean(whoLabel)}
        >
          {whoLabel || t.whoUnknown}
        </Fact>
        <Fact
          icon={<Bike className="h-3.5 w-3.5" />}
          label={t.formatLabel}
          known={Boolean(discLabel)}
        >
          {discLabel || t.formatUnknown}
        </Fact>
        <Fact icon={<Trophy className="h-3.5 w-3.5" />} label={t.levelFilter} known>
          {levelLabel}
        </Fact>

        {event.series ? (
          <Row icon={<Flag className="h-3.5 w-3.5" />}>
            {onSelectSeries ? (
              <button
                type="button"
                onClick={() => onSelectSeries(event.series!.slug)}
                className="min-h-11 text-left font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 md:min-h-0"
              >
                {event.series.name}
              </button>
            ) : (
              <Link
                href={`/${locale}?series=${event.series.slug}`}
                className="inline-flex min-h-11 items-center font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 md:min-h-0"
              >
                {event.series.name}
              </Link>
            )}
          </Row>
        ) : null}

        <div className="rounded-lg bg-stone-50 px-2.5 py-2.5 ring-1 ring-stone-100">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            {t.enterLabel}
          </p>
          {primaryEnter && primaryEnterLabel ? (
            <div className="mt-1.5 flex flex-col gap-1">
              <a
                href={primaryEnter}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEnter(registerUrl ? "register" : websiteUrl ? "website" : "listing")
                }
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 transition-colors duration-150 ease-out hover:decoration-stone-900 md:min-h-9"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
                <span className="break-all">{primaryEnterLabel}</span>
              </a>
              {registerUrl && websiteUrl && websiteUrl !== registerUrl ? (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEnter("website")}
                  className="inline-flex min-h-10 items-center gap-1.5 text-xs text-stone-600 underline decoration-stone-300 underline-offset-2 hover:text-stone-900 md:min-h-8"
                >
                  {t.openWebsite}
                </a>
              ) : null}
              {!registerUrl && !websiteUrl && listingUrl ? (
                <p className="text-[11px] text-stone-500">{t.calendarListing}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-sm text-stone-400">{t.noOnlineEntry}</p>
          )}
        </div>
        <p
          className={cn(
            "font-mono text-[10px] font-semibold uppercase tracking-wide",
            trust === "official"
              ? "text-emerald-700"
              : trust === "low"
                ? "text-amber-700"
                : "text-stone-400",
          )}
        >
          {trustText}
        </p>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-0.5 border-t border-stone-100 px-1.5 py-1.5 md:flex-nowrap md:px-2",
          embedded ? "pb-1.5" : "pb-[max(0.375rem,env(safe-area-inset-bottom))] md:pb-1.5",
        )}
      >
        <p className="sr-only" aria-live="polite">
          {linkCopied ? t.linkCopied : ""}
        </p>
        <IconBtn
          label={favorited ? "Saved" : "Save"}
          onClick={() => void toggleFavorite()}
          disabled={busy}
        >
          <Heart
            className={`h-4 w-4 ${favorited ? "fill-rose-500 text-rose-500" : ""}`}
            aria-hidden
          />
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
          <CalendarPlus className="h-4 w-4" aria-hidden />
        </IconBtn>
        <IconBtn
          label={linkCopied ? t.linkCopied : t.shareRace}
          onClick={() => void copyShareLink()}
          pressed={linkCopied}
        >
          <Share2 className={`h-4 w-4 ${linkCopied ? "text-emerald-600" : ""}`} aria-hidden />
        </IconBtn>
        {primaryEnter ? (
          <a
            href={primaryEnter}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEnter(registerUrl ? "register" : "website")}
            aria-label={primaryEnterLabel ?? t.openWebsite}
            title={primaryEnterLabel ?? t.openWebsite}
            className="touch-target inline-flex size-11 items-center justify-center rounded-md text-stone-600 transition-[background-color,color,transform] duration-150 ease-out hover:bg-stone-100 hover:text-stone-900 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 md:size-9"
          >
            <Globe className="h-4 w-4" aria-hidden />
          </a>
        ) : null}
        <Link
          href={racePageHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "ml-auto max-w-full shrink text-[11px] text-stone-500",
          )}
        >
          {t.racePage}
        </Link>
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

function Fact({
  icon,
  label,
  known,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  known: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-stone-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 leading-snug">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
          {label}
        </p>
        <p className={known ? "text-stone-800" : "text-stone-400"}>{children}</p>
      </div>
    </div>
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
  pressed,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="touch-target inline-flex size-11 items-center justify-center rounded-md text-stone-600 transition-[background-color,color,transform] duration-150 ease-out hover:bg-stone-100 hover:text-stone-900 active:scale-[0.97] disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100 md:size-9"
    >
      {children}
    </button>
  );
}
