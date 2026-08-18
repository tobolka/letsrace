"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { AuthForm } from "@/components/account/auth-form";
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
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
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

export function AccountPanel({ locale }: { locale: string }) {
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
  const [openPrefsId, setOpenPrefsId] = useState<string | null>(null);

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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!authed) {
    return (
      <Card className="mx-auto w-full max-w-md">
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.account}</h1>
        <p className="truncate text-sm text-muted-foreground">{email}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t.profilesTitle}</CardTitle>
          <CardDescription>{t.profilesHelp}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.profilesHelp}</p>
          ) : (
            <ItemGroup>
              {members.map((m) => {
                const open = openPrefsId === m.id;
                return (
                  <div key={m.id} className="flex flex-col gap-2">
                    <Item variant="outline" size="sm">
                      <ItemMedia>
                        <Avatar size="sm">
                          <AvatarFallback>{initials(m.name) || "?"}</AvatarFallback>
                        </Avatar>
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>
                          {m.name}
                          {m.is_self ? <Badge variant="secondary">{t.planSelf}</Badge> : null}
                        </ItemTitle>
                        <ItemDescription>
                          {roleLabel(m.relationship, t)}
                          {m.birth_year
                            ? ` · ${t.profilesBorn.replace("{n}", String(m.birth_year))}`
                            : ""}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-expanded={open}
                          className={open ? "[&_svg]:rotate-180" : undefined}
                          onClick={() => setOpenPrefsId(open ? null : m.id)}
                        >
                          <ChevronDown data-icon="inline-start" />
                          {t.prefsTitle}
                        </Button>
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
                      </ItemActions>
                    </Item>
                    {open ? (
                      <div className="rounded-lg border bg-muted/30 p-3">
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
                    ) : null}
                  </div>
                );
              })}
            </ItemGroup>
          )}

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
        </CardContent>
      </Card>
    </div>
  );
}
