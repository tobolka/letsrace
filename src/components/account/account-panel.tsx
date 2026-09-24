"use client";

import { useEffect, useState } from "react";
import { LogOut, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { persist } from "@/lib/account/save";
import { AuthForm } from "@/components/account/auth-form";
import { CalendarFeed } from "@/components/account/calendar-feed";
import { PageHeader, PAGE_WIDTH } from "@/components/account/panel";
import { MailPrefs } from "@/components/account/mail-prefs";
import { PlanPrefsFields, notifyPrefsSaved, saveMemberPrefs } from "@/components/account/plan-prefs-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { messagesFor, type Messages } from "@/lib/i18n/messages";
import { parseDisciplines, parseWeekdays } from "@/lib/plan-prefs";

type Member = {
  id: string;
  name: string;
  relationship: string;
  birth_year: number | null;
  is_self: boolean;
  busy_weekdays: number[];
  preferred_disciplines: string[];
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * A colour per person, the same every visit: a family of grey "RT" discs reads
 * as a list of accounts, and the point of this page is telling people apart.
 */
function riderTint(name: string): React.CSSProperties {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return {
    background: `oklch(0.93 0.045 ${hue})`,
    color: `oklch(0.38 0.09 ${hue})`,
  };
}

function roleLabel(rel: string, t: Messages) {
  if (rel === "self") return t.relSelf;
  if (rel === "rider" || rel === "partner") return t.relRider;
  if (rel === "youth" || rel === "child") return t.relYouth;
  if (rel === "coach") return t.relCoach;
  return t.relOther;
}

function toMember(row: {
  id: string;
  name: string;
  relationship: string;
  birth_year: number | null;
  is_self: boolean;
  busy_weekdays?: unknown;
  preferred_disciplines?: unknown;
}): Member {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship,
    birth_year: row.birth_year,
    is_self: Boolean(row.is_self),
    busy_weekdays: parseWeekdays(row.busy_weekdays),
    preferred_disciplines: parseDisciplines(row.preferred_disciplines),
  };
}

/**
 * Two pages out of one panel.
 *
 * The riders you plan for and the settings of the account that holds them are
 * different jobs — one is a season, the other is an email address and a sign-out
 * button — but they read the same rows and share the same loading and auth
 * dance. Splitting the state would have meant fetching it twice; splitting the
 * render costs nothing.
 */
export function RidersPanel({ locale }: { locale: string }) {
  return <AccountPanel locale={locale} section="riders" />;
}

export function SettingsPanel({ locale }: { locale: string }) {
  return <AccountPanel locale={locale} section="settings" />;
}

export function AccountPanel({
  locale,
  section = "settings",
}: {
  locale: string;
  section?: "riders" | "settings";
}) {
  const t = messagesFor(locale);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("rider");
  const [birthYear, setBirthYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ridesByMember, setRidesByMember] = useState<Record<string, number>>({});

  async function load() {
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setAuthed(false);
      setUserId(null);
      setReady(true);
      return;
    }
    setAuthed(true);
    setEmail(auth.user.email ?? null);
    setUserId(auth.user.id);
    const { data } = await supabase
      .from("family_members")
      .select("id, name, relationship, birth_year, is_self, busy_weekdays, preferred_disciplines")
      .eq("user_id", auth.user.id)
      .order("created_at");
    setMembers((data ?? []).map(toMember));

    // How much racing each of them actually did this year — the one number
    // that makes a row of names feel like a season rather than a settings list.
    const year = new Date().getFullYear();
    const { data: rides } = await supabase
      .from("event_attendance")
      .select("member_id, event:events(start_date)")
      .eq("user_id", auth.user.id);
    const counts: Record<string, number> = {};
    for (const row of (rides ?? []) as unknown as {
      member_id: string;
      event: { start_date: string } | { start_date: string }[] | null;
    }[]) {
      const ev = Array.isArray(row.event) ? row.event[0] : row.event;
      if (!ev?.start_date?.startsWith(String(year))) continue;
      counts[row.member_id] = (counts[row.member_id] ?? 0) + 1;
    }
    setRidesByMember(counts);
    setReady(true);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setBusy(false);
      return;
    }
    const ok = await persist(
      supabase.from("family_members").insert({
        user_id: auth.user.id,
        name: trimmed,
        relationship,
        birth_year: birthYear ? Number(birthYear) : null,
        is_self: false,
      }),
      { locale },
    );
    if (!ok) {
      setBusy(false);
      return;
    }
    setName("");
    setBirthYear("");
    setRelationship("rider");
    toast.success(t.profilesAdded);
    setAdding(false);
    await load();
    setBusy(false);
  }

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    window.location.href = `/${locale}`;
  }

  async function removeMember(id: string) {
    const supabase = createBrowserSupabase();
    await persist(supabase.from("family_members").delete().eq("id", id), { locale });
    await load();
  }

  async function patchMember(member: Member, next: Partial<Pick<Member, "busy_weekdays" | "preferred_disciplines">>) {
    if (!userId) return;
    const updated = { ...member, ...next };
    setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    const ok = await saveMemberPrefs({
      userId,
      memberId: member.id,
      isSelf: member.is_self,
      busyWeekdays: updated.busy_weekdays,
      preferredDisciplines: updated.preferred_disciplines,
      locale,
    });
    if (!ok) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? member : m)));
      return;
    }
    notifyPrefsSaved(locale);
  }

  if (!ready) {
    return (
      <div className={PAGE_WIDTH}>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <Card className="m-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{t.account}</CardTitle>
          <CardDescription>{t.planAuthGoing}</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm locale={locale} onSuccess={() => void load()} hideTitle />
        </CardContent>
      </Card>
    );
  }

  if (section === "settings") {
    return (
      <div className={PAGE_WIDTH}>
        <PageHeader title={t.accountSettings} />
        {/*
          Label on the left, the thing itself on the right — the shape every
          settings page has, because it lets you scan the left column for the
          section you came for instead of reading every card top to bottom.
        */}
        <div className="flex flex-col">
          <SettingsSection title={t.account} description={t.settingsAccountBody}>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <Avatar size="lg">
                <AvatarFallback style={riderTint(email ?? "")}>
                  {(email ?? "?").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{t.accountSignedIn}</p>
                <p className="truncate text-sm font-medium">{email}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
                <LogOut data-icon="inline-start" />
                {t.signOut}
              </Button>
            </div>
          </SettingsSection>
          {userId ? (
            <>
              <SettingsSection title={t.alertMailTitle} description={t.settingsMailBody}>
                <MailPrefs locale={locale} userId={userId} />
              </SettingsSection>
              <SettingsSection title={t.feedTitleShort} description={t.feedBody}>
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <CalendarFeed locale={locale} userId={userId} bare />
                </div>
              </SettingsSection>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_WIDTH}>
      <PageHeader
        title={t.profilesTitle}
        description={t.profilesHelp}
        actions={
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            {t.profilesAdd}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {members.map((m) => (
          /*
           * What a rider is, and everything the plan knows about them, on one
           * card. The days they cannot ride and the racing they turn up for
           * used to be behind a "Kdy může" toggle, which left this page as one
           * name and a button on an empty screen — and left the two settings
           * that make the suggestions work unset.
           */
          <section
            key={m.id}
            aria-labelledby={`rider-${m.id}`}
            className="overflow-clip rounded-xl border bg-card shadow-sm"
          >
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Avatar size="lg">
                <AvatarFallback className="text-sm font-semibold" style={riderTint(m.name)}>
                  {initials(m.name) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 id={`rider-${m.id}`} className="flex min-w-0 items-center gap-2 font-semibold">
                  <span className="truncate">{m.name}</span>
                  {m.is_self ? <Badge variant="secondary">{t.planSelf}</Badge> : null}
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  {/* The "you" badge already says it; repeating the role reads as a stutter. */}
                  {[
                    m.is_self ? null : roleLabel(m.relationship, t),
                    m.birth_year ? t.profilesBorn.replace("{n}", String(m.birth_year)) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || " "}
                </p>
              </div>
              {/* The year so far, as a number you can read across the grid. */}
              <div className="shrink-0 text-right">
                <p className="text-lg font-semibold leading-none tabular-nums">
                  {ridesByMember[m.id] ?? 0}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t.planStatRidden}</p>
              </div>
              {!m.is_self ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="-mr-1.5 text-muted-foreground"
                      aria-label={`${t.remove} — ${m.name}`}
                      title={t.remove}
                    >
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.confirmRemove}</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => void removeMember(m.id)}
                      >
                        {t.remove}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
            <div className="px-4 py-4">
              <PlanPrefsFields
                locale={locale}
                busyWeekdays={m.busy_weekdays}
                preferredDisciplines={m.preferred_disciplines}
                onBusyChange={(days) => void patchMember(m, { busy_weekdays: days })}
                onDisciplinesChange={(discs) =>
                  void patchMember(m, { preferred_disciplines: discs })
                }
              />
            </div>
          </section>
        ))}

        {/* The next card in the grid is the one you have not made yet. */}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-card hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex size-10 items-center justify-center rounded-full border bg-background">
            <Plus className="size-5" aria-hidden />
          </span>
          <span className="text-sm font-medium text-foreground">{t.profilesAdd}</span>
          <span className="text-xs">{t.ridersAddBody}</span>
        </button>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.profilesAdd}</DialogTitle>
            <DialogDescription>{t.ridersAddBody}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void addMember(e)}>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="rider-name">{t.fieldName}</FieldLabel>
                <Input
                  id="rider-name"
                  required
                  autoFocus
                  name="name"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="rider-rel">{t.fieldRelationship}</FieldLabel>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger id="rider-rel" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="rider">{t.relRider}</SelectItem>
                        <SelectItem value="youth">{t.relYouth}</SelectItem>
                        <SelectItem value="coach">{t.relCoach}</SelectItem>
                        <SelectItem value="other">{t.relOther}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="rider-year">{t.fieldBirthYear}</FieldLabel>
                  <Input
                    id="rider-year"
                    name="birthYear"
                    inputMode="numeric"
                    pattern="(19|20)[0-9]{2}"
                    maxLength={4}
                    autoComplete="off"
                    spellCheck={false}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
                    placeholder="2016…"
                  />
                </Field>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    {t.cancel}
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={busy || !name.trim()} aria-busy={busy}>
                  {busy ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                  {t.profilesAdd}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 border-t py-6 first:border-t-0 first:pt-0 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 max-w-2xl">{children}</div>
    </section>
  );
}
