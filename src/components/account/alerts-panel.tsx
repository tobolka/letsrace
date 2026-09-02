"use client";

import { useEffect, useState } from "react";
import { AlertInbox } from "@/components/account/alert-inbox";
import { AlertSettings } from "@/components/account/alert-settings";
import { AuthForm } from "@/components/account/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { messagesFor } from "@/lib/i18n/messages";
import { parseDisciplines } from "@/lib/plan-prefs";
import { toast } from "sonner";

export function AlertsPanel({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [preferredDisciplines, setPreferredDisciplines] = useState<string[]>([]);

  async function load() {
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    setUserId(auth.user?.id ?? null);
    if (auth.user) {
      const { data } = await supabase
        .from("profiles")
        .select("preferred_disciplines")
        .eq("id", auth.user.id)
        .maybeSingle();
      setPreferredDisciplines(parseDisciplines(data?.preferred_disciplines));
    }
    setReady(true);
  }

  useEffect(() => {
    void load();
  }, []);

  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!userId) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{t.alertTitle}</CardTitle>
          <CardDescription>{t.alertAuth}</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm locale={locale} onSuccess={() => void load()} hideTitle />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.alertTitle}</h1>
        <p className="max-w-xl text-sm text-muted-foreground">{t.alertHelp}</p>
      </header>

      {/* Same split as the plan, so the left edge does not jump between tabs:
          what you are setting on the left, what it has produced beside it. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title={t.alertPlacesTitle}>
            <AlertSettings
              locale={locale}
              userId={userId}
              preferredDisciplines={preferredDisciplines}
            />
          </Section>
          <Section title={t.alertMailTitle}>
            <MailPrefs locale={locale} userId={userId} />
          </Section>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-16">
          <AlertInbox locale={locale} userId={userId} />
        </aside>
      </div>
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

function MailPrefs({ locale, userId }: { locale: string; userId: string }) {
  const t = messagesFor(locale);
  const [ready, setReady] = useState(false);
  const [planMail, setPlanMail] = useState(true);
  const [digestMail, setDigestMail] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    void supabase
      .from("profiles")
      .select("plan_mail, digest_mail")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setPlanMail(data?.plan_mail !== false);
        setDigestMail(data?.digest_mail !== false);
        setReady(true);
      });
  }, [userId]);

  async function patch(next: { plan_mail?: boolean; digest_mail?: boolean }) {
    if (next.plan_mail != null) setPlanMail(next.plan_mail);
    if (next.digest_mail != null) setDigestMail(next.digest_mail);
    const supabase = createBrowserSupabase();
    await supabase
      .from("profiles")
      .update({ ...next, locale, updated_at: new Date().toISOString() })
      .eq("id", userId);
    toast.success(t.alertSaved);
  }

  if (!ready) return <Skeleton className="h-36 w-full" />;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <Field orientation="horizontal" className="items-start justify-between gap-4">
          <div className="min-w-0">
            <FieldLabel htmlFor="plan-mail">{t.planMail}</FieldLabel>
            <FieldDescription>{t.planMailHelp}</FieldDescription>
          </div>
          <Switch
            id="plan-mail"
            checked={planMail}
            onCheckedChange={(on) => void patch({ plan_mail: on })}
          />
        </Field>
        <Field orientation="horizontal" className="items-start justify-between gap-4">
          <div className="min-w-0">
            <FieldLabel htmlFor="digest-mail">{t.digestMail}</FieldLabel>
            <FieldDescription>{t.digestMailHelp}</FieldDescription>
          </div>
          <Switch
            id="digest-mail"
            checked={digestMail}
            onCheckedChange={(on) => void patch({ digest_mail: on })}
          />
        </Field>
      </CardContent>
    </Card>
  );
}
