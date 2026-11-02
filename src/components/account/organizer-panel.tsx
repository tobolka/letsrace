"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLoadEffect } from "@/hooks/use-load-effect";
import { AuthForm } from "@/components/account/auth-form";
import { DocPageSkeleton } from "@/components/account/page-skeletons";
import { DOC_WIDTH, PageHeader } from "@/components/account/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { asLocale } from "@/lib/i18n/messages";
import { organizerCopy } from "@/lib/i18n/organizer-copy";
import { localePath } from "@/lib/localized-paths";

type Target = { kind: "race" | "series"; slug: string; name: string };
type Round = { id: string; name: string; slug: string; start_date: string };
type Claim = {
  id: string;
  kind: "race" | "series";
  status: "pending" | "verified" | "rejected" | "revoked";
  target: { id: string; name: string; slug: string; start_date?: string } | null;
  rounds: Round[];
};
type Category = { name: string; distanceKm: number | null; ageMin: number | null; ageMax: number | null };
type RaceForm = {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string | null;
  status: string;
  websiteUrl: string | null;
  registrationUrl: string | null;
  regulationsUrl: string | null;
  registrationClosesAt: string | null;
  description: string | null;
  categories: Category[];
};

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");

export function OrganizerPanel({ locale, target }: { locale: string; target: Target | null }) {
  const c = organizerCopy[asLocale(locale)];
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  async function load() {
    const { data: auth } = await createBrowserSupabase().auth.getUser();
    setSignedIn(Boolean(auth.user));
    if (auth.user) {
      const res = await fetch("/api/organizer/claims");
      if (res.ok) {
        const body = (await res.json()) as { email: string | null; claims: Claim[] };
        setEmail(body.email);
        setClaims(body.claims);
      }
    }
    setReady(true);
  }

  useLoadEffect(load, []);

  if (!ready) return <DocPageSkeleton boxes={2} />;

  if (!signedIn) {
    return (
      <Card className="m-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{c.title}</CardTitle>
          <CardDescription>{target ? fill(c.claimTitle, { name: target.name }) : c.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm locale={locale} onSuccess={() => void load()} hideTitle />
        </CardContent>
      </Card>
    );
  }

  if (editing) {
    return (
      <div className={DOC_WIDTH}>
        <RaceEditor locale={locale} eventId={editing} onDone={() => setEditing(null)} />
      </div>
    );
  }

  const already = target && claims.find((cl) => cl.kind === target.kind && cl.target?.slug === target.slug && cl.status !== "rejected" && cl.status !== "revoked");

  return (
    <div className={DOC_WIDTH}>
      <PageHeader title={c.title} description={c.description} />

      {target && !already ? <ClaimCard locale={locale} target={target} email={email} onClaimed={() => void load()} /> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{c.mine}</h2>
        {claims.length === 0 ? (
          <p className="text-sm text-muted-foreground">{c.none}</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border">
            {claims.map((cl) => (
              <li key={cl.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 font-medium">
                    {cl.kind === "series" ? <span className="text-muted-foreground">{c.series} · </span> : null}
                    {cl.target?.name ?? "—"}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={cl.status === "verified" ? "default" : "outline"}>{c.status[cl.status]}</Badge>
                    {cl.status === "verified" && cl.kind === "race" && cl.target ? (
                      <Button size="sm" variant="outline" onClick={() => setEditing(cl.target!.id)}>
                        {c.edit}
                      </Button>
                    ) : null}
                  </span>
                </div>
                {cl.status === "verified" && cl.rounds.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {cl.rounds.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          <span className="tabular-nums text-muted-foreground">{r.start_date.slice(8, 10)}. {r.start_date.slice(5, 7)}. </span>
                          {r.name}
                        </span>
                        <Button size="xs" variant="ghost" onClick={() => setEditing(r.id)}>
                          {c.edit}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ClaimCard({ locale, target, email, onClaimed }: { locale: string; target: Target; email: string | null; onClaimed: () => void }) {
  const c = organizerCopy[asLocale(locale)];
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function claim() {
    setBusy(true);
    const res = await fetch("/api/organizer/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: target.kind, slug: target.slug, note }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(c.failed);
      return;
    }
    const { status } = (await res.json()) as { status: string };
    toast.success(status === "verified" ? c.claimVerified : c.claimPending);
    onClaimed();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{fill(c.claimTitle, { name: target.name })}</CardTitle>
        <CardDescription>{c.claimBody}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {email ? <p className="text-sm text-muted-foreground">{fill(c.account, { email })}</p> : null}
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.notePlaceholder} rows={3} maxLength={2000} />
        <div>
          <Button onClick={() => void claim()} disabled={busy}>
            <BadgeCheck data-icon="inline-start" />
            {target.kind === "race" ? c.claimRace : c.claimSeries}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Everything an organiser may change on one race, saved in one go. */
function RaceEditor({ locale, eventId, onDone }: { locale: string; eventId: string; onDone: () => void }) {
  const c = organizerCopy[asLocale(locale)];
  const [form, setForm] = useState<RaceForm | null>(null);
  const [busy, setBusy] = useState(false);

  useLoadEffect(async () => {
    const res = await fetch(`/api/organizer/events/${eventId}`);
    if (res.ok) setForm((await res.json()) as RaceForm);
  }, [eventId]);

  if (!form) return <DocPageSkeleton boxes={2} />;

  const set = <K extends keyof RaceForm>(key: K, value: RaceForm[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const setCat = (i: number, patch: Partial<Category>) =>
    set("categories", form.categories.map((cat, j) => (j === i ? { ...cat, ...patch } : cat)));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const text = (v: string) => (v.trim() === "" ? null : v.trim());

  async function save() {
    if (!form) return;
    setBusy(true);
    const res = await fetch(`/api/organizer/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: form.startDate,
        endDate: form.endDate || null,
        status: form.status === "postponed" || form.status === "cancelled" ? form.status : "scheduled",
        websiteUrl: form.websiteUrl,
        registrationUrl: form.registrationUrl,
        regulationsUrl: form.regulationsUrl,
        registrationClosesAt: form.registrationClosesAt || null,
        description: form.description,
        categories: form.categories.filter((cat) => cat.name.trim()),
      }),
    });
    setBusy(false);
    if (res.ok) toast.success(c.saved);
    else toast.error(c.failed);
  }

  return (
    <>
      <PageHeader
        title={form.name}
        actions={
          <>
            <Button variant="outline" onClick={onDone}>
              {c.back}
            </Button>
            <Button variant="outline" asChild>
              <Link href={localePath(locale, `e/${form.slug}`)} target="_blank">
                {c.view}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.startDate}>
          <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field label={c.endDate}>
          <Input type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value || null)} />
        </Field>
        <Field label={c.raceStatus}>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.status === "postponed" || form.status === "cancelled" ? form.status : "scheduled"}
            onChange={(e) => set("status", e.target.value)}
          >
            {(Object.keys(c.raceStatuses) as (keyof typeof c.raceStatuses)[]).map((s) => (
              <option key={s} value={s}>
                {c.raceStatuses[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={c.closes}>
          <Input type="date" value={form.registrationClosesAt ?? ""} onChange={(e) => set("registrationClosesAt", e.target.value || null)} />
        </Field>
        <Field label={c.website} wide>
          <Input type="url" value={form.websiteUrl ?? ""} onChange={(e) => set("websiteUrl", text(e.target.value))} placeholder="https://" />
        </Field>
        <Field label={c.registration} wide>
          <Input type="url" value={form.registrationUrl ?? ""} onChange={(e) => set("registrationUrl", text(e.target.value))} placeholder="https://" />
        </Field>
        <Field label={c.regulations} wide>
          <Input type="url" value={form.regulationsUrl ?? ""} onChange={(e) => set("regulationsUrl", text(e.target.value))} placeholder="https://" />
        </Field>
        <Field label={c.about} wide>
          <Textarea rows={5} maxLength={3000} value={form.description ?? ""} onChange={(e) => set("description", text(e.target.value))} />
        </Field>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{c.categories}</h2>
        {form.categories.map((cat, i) => (
          <div key={i} className="grid grid-cols-[1fr_5rem_4.5rem_4.5rem_auto] items-end gap-2">
            <Field label={i === 0 ? c.catName : ""}>
              <Input value={cat.name} onChange={(e) => setCat(i, { name: e.target.value })} maxLength={120} />
            </Field>
            <Field label={i === 0 ? c.catKm : ""}>
              <Input inputMode="decimal" value={cat.distanceKm ?? ""} onChange={(e) => setCat(i, { distanceKm: num(e.target.value) })} />
            </Field>
            <Field label={i === 0 ? c.catAgeMin : ""}>
              <Input inputMode="numeric" value={cat.ageMin ?? ""} onChange={(e) => setCat(i, { ageMin: num(e.target.value) })} />
            </Field>
            <Field label={i === 0 ? c.catAgeMax : ""}>
              <Input inputMode="numeric" value={cat.ageMax ?? ""} onChange={(e) => setCat(i, { ageMax: num(e.target.value) })} />
            </Field>
            <Button
              variant="ghost"
              size="icon"
              aria-label={c.remove}
              onClick={() => set("categories", form.categories.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => set("categories", [...form.categories, { name: "", distanceKm: null, ageMin: null, ageMax: null }])}
          >
            <Plus data-icon="inline-start" />
            {c.addCategory}
          </Button>
        </div>
      </section>

      <div>
        <Button onClick={() => void save()} disabled={busy}>
          {c.save}
        </Button>
      </div>
    </>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}>
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
      {children}
    </div>
  );
}
