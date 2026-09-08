"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AuthForm } from "@/components/account/auth-form";
import { CalendarFeed } from "@/components/account/calendar-feed";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
    await supabase.from("family_members").insert({
      user_id: auth.user.id,
      name: trimmed,
      relationship,
      birth_year: birthYear ? Number(birthYear) : null,
      is_self: false,
    });
    setName("");
    setBirthYear("");
    setRelationship("rider");
    toast.success(t.profilesAdded);
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
    await supabase.from("family_members").delete().eq("id", id);
    await load();
  }

  async function patchMember(member: Member, next: Partial<Pick<Member, "busy_weekdays" | "preferred_disciplines">>) {
    if (!userId) return;
    const updated = { ...member, ...next };
    setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    await saveMemberPrefs({
      userId,
      memberId: member.id,
      isSelf: member.is_self,
      busyWeekdays: updated.busy_weekdays,
      preferredDisciplines: updated.preferred_disciplines,
    });
    notifyPrefsSaved(locale);
  }

  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-64 w-full" />
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 [&>*]:max-w-3xl">
      {/*
        The nav says which page this is, and said it three times over: once as
        the tab, once as a heading, once as the title of the only card on the
        page. The heading stays for a screen reader and the card is gone — a
        card around the entire contents of a page is a border drawn inside a
        border.
      */}
      <h1 className="sr-only">{section === "riders" ? t.profilesTitle : t.account}</h1>

      {section === "settings" ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <p className="min-w-0 truncate">
            <span className="text-muted-foreground">{t.accountSignedIn} </span>
            <span className="font-medium">{email}</span>
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t.signOut}
          </button>
        </div>
      ) : null}

      {section === "settings" && userId ? (
        <>
          <Section title={t.alertMailTitle}>
            <MailPrefs locale={locale} userId={userId} />
          </Section>
          <Section title={t.feedTitle}>
            <CalendarFeed locale={locale} userId={userId} hideTitle />
          </Section>
        </>
      ) : null}

      {section === "riders" ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold">{t.profilesTitle}</h2>
            <p className="text-xs text-muted-foreground">{t.profilesHelp}</p>
          </div>
          {members.length === 0 ? null : (
            <div className="flex flex-col gap-3">
              {members.map((m) => (
                /*
                 * What a rider is, and everything the plan knows about them, on
                 * one card. The days they cannot ride and the racing they turn
                 * up for used to be behind a "Kdy může" toggle, which left this
                 * page as one name and a button on an empty screen — and left
                 * the two settings that make the suggestions work unset.
                 */
                <div key={m.id} className="rounded-xl border bg-card">
                  <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                    <Avatar size="sm">
                      <AvatarFallback>{initials(m.name) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {m.name}
                        {m.is_self ? <Badge variant="secondary">{t.planSelf}</Badge> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {/* The "you" badge already says it; repeating the role reads as a stutter. */}
                        {[
                          m.is_self ? null : roleLabel(m.relationship, t),
                          m.birth_year
                            ? t.profilesBorn.replace("{n}", String(m.birth_year))
                            : null,
                          ridesByMember[m.id]
                            ? t.accountRidesThisYear.replace("{n}", String(ridesByMember[m.id]))
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {!m.is_self ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {t.remove}
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
                  <div className="px-4 py-3">
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
                </div>
              ))}
            </div>
          )}

          <Collapsible open={adding || members.length === 0} onOpenChange={setAdding}>
            {members.length > 0 ? (
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-fit">
                  <Plus data-icon="inline-start" />
                  {t.profilesAdd}
                </Button>
              </CollapsibleTrigger>
            ) : null}
            <CollapsibleContent className={members.length > 0 ? "pt-4" : undefined}>
          <form onSubmit={(e) => void addMember(e)}>
            <FieldGroup className="gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="rider-name">{t.fieldName}</FieldLabel>
                  <Input
                    id="rider-name"
                    required
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex…"
                  />
                </Field>
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
                    autoComplete="bday-year"
                    spellCheck={false}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="2016…"
                  />
                </Field>
              </div>
              <Button type="submit" disabled={busy} aria-busy={busy}>
                {busy ? <Spinner data-icon="inline-start" /> : null}
                {t.profilesAdd}
              </Button>
            </FieldGroup>
          </form>
            </CollapsibleContent>
          </Collapsible>
        </section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
