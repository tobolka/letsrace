"use client";

import { useEffect, useState } from "react";
import { AlertInbox } from "@/components/account/alert-inbox";
import { AlertSettings } from "@/components/account/alert-settings";
import { AuthForm } from "@/components/account/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { PAGE_WIDTH } from "@/components/account/panel";
import { messagesFor } from "@/lib/i18n/messages";
import { parseDisciplines } from "@/lib/plan-prefs";

export function AlertsPanel({ locale, embedded = false }: { locale: string; embedded?: boolean }) {
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
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!userId) {
    return (
      <Card className="m-auto w-full max-w-md">
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
    <div className={embedded ? "flex w-full flex-col gap-5" : `${PAGE_WIDTH}`}>
      {!embedded && <h1 className="text-2xl font-semibold tracking-tight">{t.alertTitle}</h1>}

      {/* Same split as the plan, so the left edge does not jump between tabs:
          what you are setting on the left, what it has produced beside it. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section aria-labelledby="alert-places" className="flex min-w-0 flex-col gap-3">
          <div>
            <h2 id="alert-places" className="text-sm font-semibold">
              {t.alertPlacesTitle}
            </h2>
            <p className="mt-0.5 max-w-2xl text-sm text-pretty text-muted-foreground">{t.alertHelp}</p>
          </div>
          <AlertSettings
            locale={locale}
            userId={userId}
            preferredDisciplines={preferredDisciplines}
          />
        </section>
        <aside className="min-w-0 lg:sticky lg:top-20">
          <AlertInbox locale={locale} userId={userId} />
        </aside>
      </div>
    </div>
  );
}
