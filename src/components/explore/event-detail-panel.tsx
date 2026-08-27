"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { format, parseISO } from "date-fns";
import {
  X,
  MapPin,
  Trophy,
  Calendar,
  Bike,
  ExternalLink,
  Share,
  UserRound,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";
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
import { RacePlanControls } from "@/components/account/race-plan-controls";
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
import { eventTrustLevel, lastCheckedLabel, trustLabel } from "@/lib/trust";
import { eventMapPath } from "@/lib/event-url";
import { type PlanMemberStatus } from "@/lib/planner";
import {
  setMemberPlanStatus,
  type AttendanceRecord,
} from "@/lib/planner-db";

type Member = {
  id: string;
  name: string;
  relationship: string;
  is_self: boolean;
};

type Attendance = AttendanceRecord;

/** Must match the desktop list card in explore-shell (width + overlay padding + gap). */
const DEFAULT_X = 12 + 400 + 12;
const DEFAULT_Y = 12;
const DRAG_MARGIN = 12;

function clampPanelPos(x: number, y: number, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? 320;
  const h = el?.offsetHeight ?? 200;
  const maxX = Math.max(DRAG_MARGIN, window.innerWidth - w - DRAG_MARGIN);
  const maxY = Math.max(DRAG_MARGIN, window.innerHeight - h - DRAG_MARGIN);
  return {
    x: Math.min(maxX, Math.max(DRAG_MARGIN, x)),
    y: Math.min(maxY, Math.max(DRAG_MARGIN, y)),
  };
}

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
  const t = messagesFor(locale);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState("");
  const [pendingAction, setPendingAction] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const offsetRef = useRef({ x: DEFAULT_X, y: DEFAULT_Y });
  const [offset, setOffset] = useState({ x: DEFAULT_X, y: DEFAULT_Y });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (embedded) return;
    const onResize = () => {
      const next = clampPanelPos(offsetRef.current.x, offsetRef.current.y, cardRef.current);
      offsetRef.current = next;
      setOffset(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [embedded]);

  function onHeaderPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (embedded || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    const pos = offsetRef.current;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    setDragging(true);
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onHeaderPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const next = clampPanelPos(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY),
      cardRef.current,
    );
    const el = cardRef.current;
    if (el) el.style.transform = `translate(${next.x - drag.origX}px, ${next.y - drag.origY}px)`;
  }

  function endHeaderDrag(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const next = clampPanelPos(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY),
      cardRef.current,
    );
    dragRef.current = null;
    offsetRef.current = next;
    setOffset(next);
    setDragging(false);
    const el = cardRef.current;
    if (el) el.style.transform = "";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

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

  function requireAuth() {
    setPendingAction(true);
    setAuthReason(t.planAuthGoing);
    setAuthOpen(true);
  }

  async function setStatus(
    memberId: string,
    status: PlanMemberStatus,
    uidOverride?: string,
  ) {
    const uid = uidOverride ?? userId;
    if (!uid) {
      requireAuth();
      return;
    }
    setBusy(true);
    const supabase = createBrowserSupabase();
    const next = await setMemberPlanStatus({
      supabase,
      userId: uid,
      eventId: event.id,
      memberId,
      status,
      rows: attendance,
      favorited,
    });
    setAttendance(next.rows);
    setFavorited(next.favorited);
    setBusy(false);
  }

  async function onAuthSuccess() {
    const shouldSetGoing = pendingAction;
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    setUserId(uid);
    setPendingAction(false);
    if (!uid) return;
    const mems = await loadUserState(uid);
    if (!shouldSetGoing) return;
    const self = mems.find((m) => m.is_self) ?? mems[0];
    if (self) await setStatus(self.id, "going", uid);
  }

  const levelKey = (event.level || "local") as RaceLevel;
  const levelLabel =
    (event.uciClass
      ? UCI_CLASS_LABELS[event.uciClass as UciClass] || event.uciClass.toUpperCase()
      : null) ||
    event.classLabel ||
    RACE_LEVEL_LABELS[levelKey] ||
    event.level;
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
  if (
    event.resultsUrl &&
    event.resultsUrl !== registerUrl &&
    event.resultsUrl !== websiteUrl &&
    event.resultsUrl !== listingUrl &&
    event.resultsUrl !== event.regulationsUrl
  ) {
    extraLinks.push({
      href: event.resultsUrl,
      label: t.results,
      kind: "results",
    });
  }

  const trust = eventTrustLevel(event);
  const trustText = trustLabel(trust, t);
  const checkedText = lastCheckedLabel(event.lastSeenAt, locale, t.trustChecked);
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
      ref={cardRef}
      aria-labelledby="race-detail-title"
      className={cn(
        "pointer-events-auto w-full gap-0 overflow-hidden py-0",
        dragging && "select-none",
        embedded
          ? "flex h-full min-h-0 flex-col border-0 shadow-none"
          : "absolute z-10 w-[320px] max-h-[calc(100dvh-1.5rem)] shadow-lg",
      )}
      style={embedded ? undefined : { left: offset.x, top: offset.y }}
    >
      <CardHeader
        className={cn(
          "shrink-0 items-center border-b px-4 py-3 [.border-b]:pb-3",
          !embedded && "cursor-grab touch-none select-none",
          dragging && "cursor-grabbing",
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
        onLostPointerCapture={endHeaderDrag}
      >
        <CardTitle
          id="race-detail-title"
          className="flex min-w-0 items-center gap-2 text-base leading-snug"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: disciplineColor(event.disciplines) }}
            aria-hidden
          />
          <span className="min-w-0">{event.name}</span>
        </CardTitle>
        <CardAction className="self-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={embedded ? "size-11" : undefined}
            onClick={onClose}
            aria-label={t.close}
          >
            <X />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
        inert={dragging || undefined}
      >
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

        {members.length > 0 ? (
          <div className="mt-4 border-t border-border pt-3">
            <RacePlanControls
              locale={locale}
              members={members.map((m) => ({
                id: m.id,
                name: m.name,
                relationship: m.relationship,
                isSelf: m.is_self,
              }))}
              attendance={attendance}
              busy={busy}
              addPeopleHref={`/${locale}/account`}
              onStatusChange={(memberId, status) => void setStatus(memberId, status)}
            />
          </div>
        ) : !userId ? (
          <button
            type="button"
            className="mt-4 w-full rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            onClick={() => requireAuth()}
          >
            <span className="font-medium text-foreground">{t.planWhoGoes}</span>
            <span className="mt-0.5 block text-xs">{t.planAuthGoing}</span>
          </button>
        ) : null}

        {actionLinks.length > 0 && !embedded ? (
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
        ) : actionLinks.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t.noOnlineEntry}</p>
        ) : (
          <ButtonGroup orientation="vertical" className="mt-4 w-full">
            {secondaryLinks.map((link) => (
              <Button key={link.href} asChild variant="outline" className="w-full">
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
        )}
      </CardContent>

      <CardFooter
        className={cn(
          "shrink-0 gap-2 border-t px-2 py-2 [.border-t]:pt-2",
          embedded
            ? "flex-col items-stretch pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            : "justify-between pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-2",
        )}
        inert={dragging || undefined}
      >
        {embedded && primaryHref && primaryLabel ? (
          <Button asChild size="lg" className="h-12 w-full text-base">
            <a
              href={primaryHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEnter(primaryKind)}
            >
              <ExternalLink data-icon="inline-start" />
              {primaryLabel}
            </a>
          </Button>
        ) : null}
        <div className={cn("flex w-full items-center gap-2", embedded && "px-1")}>
          <p className="sr-only" aria-live="polite">
            {linkCopied ? t.linkCopied : ""}
          </p>
          <p
            className={cn(
              "min-w-0 flex-1 text-xs leading-snug",
              trust === "low" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {trustText}
            {checkedText && event.lastSeenAt ? (
              <>
                <span aria-hidden> · </span>
                <time className="tabular-nums" dateTime={event.lastSeenAt}>
                  {checkedText}
                </time>
              </>
            ) : null}
          </p>
          <div className="ml-auto flex items-center gap-0.5">
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
              <Share />
            </Toggle>
          </div>
        </div>
      </CardFooter>

      <AuthDialog
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPendingAction(false);
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
