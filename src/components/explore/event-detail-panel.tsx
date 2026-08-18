"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  X,
  MapPin,
  Trophy,
  Heart,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Bike,
  ExternalLink,
  Share2,
  UserRound,
  ChartNoAxesColumnIncreasing,
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
import { disciplineColor } from "@/lib/map-visuals";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AuthDialog } from "@/components/account/auth-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Toggle } from "@/components/ui/toggle";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { cn } from "@/lib/utils";
import { eventTrustLevel, trustLabel } from "@/lib/trust";
import { eventMapPath } from "@/lib/event-url";

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
  const whoChips = whoLabel ? whoLabel.split(" · ").filter(Boolean) : [];
  const discChips = event.disciplines
    .slice(0, 4)
    .map((d) => DISCIPLINE_LABELS[d as Discipline] || d)
    .filter(Boolean);

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

  const extraLinks: { href: string; label: string; kind: string }[] = [];
  if (registerUrl && websiteUrl && websiteUrl !== registerUrl) {
    extraLinks.push({ href: websiteUrl, label: t.openWebsite, kind: "website" });
  }
  if (
    event.regulationsUrl &&
    event.regulationsUrl !== registerUrl &&
    event.regulationsUrl !== websiteUrl &&
    event.regulationsUrl !== listingUrl
  ) {
    extraLinks.push({
      href: event.regulationsUrl,
      label: t.regulations,
      kind: "regulations",
    });
  }

  const trust = eventTrustLevel(event);
  const trustText = trustLabel(trust, t);
  const accent = disciplineColor(event.disciplines);
  const selfMember = members.find((m) => m.is_self) ?? members[0];
  const going = Boolean(
    selfMember && attendance.some((a) => a.member_id === selfMember.id),
  );
  const placeLabel = [
    event.location?.municipality || event.location?.name,
    event.location?.countryCode,
  ]
    .filter(Boolean)
    .join(" · ");

  const primaryHref = primaryEnter || event.regulationsUrl;
  const primaryLabel = primaryEnterLabel ?? (event.regulationsUrl ? t.regulations : null);
  const primaryKind = registerUrl
    ? "register"
    : websiteUrl
      ? "website"
      : listingUrl
        ? "listing"
        : "regulations";
  const secondaryLinks = extraLinks.filter((link) => link.href !== primaryHref);
  const actionLinks = [
    ...(primaryHref && primaryLabel
      ? [{ href: primaryHref, label: primaryLabel, kind: primaryKind }]
      : []),
    ...secondaryLinks,
  ];

  return (
    <Card
      aria-labelledby="race-detail-title"
      className={cn(
        "pointer-events-auto w-full gap-0 overflow-hidden py-0",
        embedded
          ? "flex h-full min-h-0 flex-col border-0 shadow-none"
          : "shadow-lg md:w-[320px] md:max-h-[calc(100dvh-1.5rem)] md:self-start",
      )}
    >
      <CardHeader className="shrink-0 border-b px-4 py-3 [.border-b]:pb-3">
        <CardTitle
          id="race-detail-title"
          className="flex min-w-0 items-start gap-2 text-base leading-snug"
        >
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden
          />
          <span className="min-w-0">{event.name}</span>
        </CardTitle>
        <CardAction>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t.close}>
            <X />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-base font-medium">
            <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <time className="tabular" dateTime={event.startDate}>
              {format(parseISO(event.startDate), "EEE d MMM yyyy")}
              {event.endDate && event.endDate !== event.startDate
                ? ` – ${format(parseISO(event.endDate), "d MMM")}`
                : ""}
            </time>
          </p>
          <p className="flex items-start gap-2 text-sm font-medium">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 break-words">{placeLabel || "—"}</span>
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          <MetaRow icon={<UserRound />} label={t.audience}>
            {whoChips.length > 0 ? (
              whoChips.map((chip) => (
                <Badge key={chip} variant="outline">
                  {chip}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">{t.whoUnknown}</span>
            )}
          </MetaRow>
          <MetaRow icon={<Bike />} label={t.formatLabel}>
            {discChips.length > 0 ? (
              discChips.map((chip) => (
                <Badge key={chip} variant="outline">
                  {chip}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">{t.formatUnknown}</span>
            )}
          </MetaRow>
          <MetaRow icon={<ChartNoAxesColumnIncreasing />} label={t.levelFilter}>
            <Badge variant="outline">{levelLabel}</Badge>
          </MetaRow>
          {event.series ? (
            <MetaRow icon={<Trophy />} label={t.seriesFilter}>
              {onSelectSeries ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => onSelectSeries(event.series!.slug)}
                >
                  {event.series.name}
                </Button>
              ) : (
                <Button asChild variant="outline" size="xs">
                  <Link href={`/${locale}?series=${event.series.slug}`}>{event.series.name}</Link>
                </Button>
              )}
            </MetaRow>
          ) : null}
        </div>

        {actionLinks.length > 0 ? (
          <ButtonGroup orientation="vertical" className="mt-4 w-full">
            {actionLinks.map((link, index) => (
              <Button
                key={link.href}
                asChild
                variant={index === 0 ? "default" : "outline"}
                className="w-full"
              >
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEnter(link.kind)}
                >
                  <ExternalLink data-icon="inline-start" />
                  {link.label}
                </a>
              </Button>
            ))}
          </ButtonGroup>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t.noOnlineEntry}</p>
        )}
      </CardContent>

      <CardFooter
        className={cn(
          "shrink-0 justify-between gap-2 border-t px-2 py-2 [.border-t]:pt-2",
          embedded ? "" : "pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-2",
        )}
      >
        <p className="sr-only" aria-live="polite">
          {linkCopied ? t.linkCopied : ""}
        </p>
        <p
          className={cn(
            "min-w-0 truncate text-xs",
            trust === "low" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {trustText}
        </p>
        <div className="ml-auto flex items-center gap-0.5">
          <Toggle
            pressed={favorited}
            disabled={busy}
            size="lg"
            aria-label={favorited ? t.savedRace : t.saveRace}
            title={favorited ? t.savedRace : t.saveRace}
            className="size-9 min-w-9 [@media(pointer:coarse)]:size-11 [@media(pointer:coarse)]:min-w-11 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            onPressedChange={() => void toggleFavorite()}
          >
            <Heart className={cn(favorited && "fill-current")} />
          </Toggle>
          <Toggle
            pressed={going}
            disabled={busy}
            size="lg"
            aria-label={t.calendarAdd}
            title={t.calendarAdd}
            className="size-9 min-w-9 [@media(pointer:coarse)]:size-11 [@media(pointer:coarse)]:min-w-11 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            onPressedChange={() => {
              if (!userId) {
                requireAuth("calendar");
                return;
              }
              if (!selfMember) return;
              void toggleGoing(selfMember.id);
            }}
          >
            {going ? <CalendarCheck /> : <CalendarPlus />}
          </Toggle>
          <Toggle
            pressed={linkCopied}
            size="lg"
            aria-label={linkCopied ? t.linkCopied : t.shareRace}
            title={linkCopied ? t.linkCopied : t.shareRace}
            className="size-9 min-w-9 [@media(pointer:coarse)]:size-11 [@media(pointer:coarse)]:min-w-11 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            onPressedChange={() => {
              if (!linkCopied) void copyShareLink();
            }}
          >
            <Share2 />
          </Toggle>
        </div>
      </CardFooter>

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
    </Card>
  );
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-muted-foreground [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <span className="sr-only">{label}</span>
        {children}
      </div>
    </div>
  );
}
