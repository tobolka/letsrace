"use client";

import { useEffect, useState } from "react";
import { AlertSettings } from "@/components/account/alert-settings";
import { AuthForm } from "@/components/account/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/account/panel";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {!embedded ? (
        <div className="flex flex-col gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
            <Link href={`/${locale}/account/recommendations`}>
              <ArrowLeft data-icon="inline-start" />
              {t.backToDiscover}
            </Link>
          </Button>
          <PageHeader title={t.areasTitle} description={t.areasBody} />
        </div>
      ) : null}
      {/*
        Settings only. What these areas turn up is on Discover, where the rest
        of the suggestions are; this page is where you say where to look.
      */}
      <AlertSettings locale={locale} userId={userId} preferredDisciplines={preferredDisciplines} />
    </div>
  );
}
