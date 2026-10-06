"use client";

import { useEffect, useState } from "react";
import { AlertSettings } from "@/components/account/alert-settings";
import { AuthForm } from "@/components/account/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocPageSkeleton } from "@/components/account/page-skeletons";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DOC_WIDTH, PageHeader } from "@/components/account/panel";
import { Button } from "@/components/ui/button";
import { messagesFor } from "@/lib/i18n/messages";
import { parseDisciplines } from "@/lib/plan-prefs";
import { localePath } from "@/lib/localized-paths";

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
    return <DocPageSkeleton boxes={1} />;
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
    <div className={DOC_WIDTH}>
      {!embedded ? (
        <div className="flex flex-col gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
            <Link href={localePath(locale, `account/recommendations`)}>
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
