"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { persist } from "@/lib/account/save";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { messagesFor } from "@/lib/i18n/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Which letters this account gets.
 *
 * It used to sit under the alerts, beneath the places being watched, which
 * made one page about two different things and left the account page holding a
 * sign-out button and nothing else. Alerts are what to watch for; this is
 * about the account, and lives with the rest of it.
 */
export function MailPrefs({ locale, userId }: { locale: string; userId: string }) {
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
    const wasPlan = planMail;
    const wasDigest = digestMail;
    if (next.plan_mail != null) setPlanMail(next.plan_mail);
    if (next.digest_mail != null) setDigestMail(next.digest_mail);
    const supabase = createBrowserSupabase();
    // Silence here means the user believes they turned the mail off and keeps
    // receiving it.
    const ok = await persist(
      supabase
        .from("profiles")
        .update({ ...next, locale, updated_at: new Date().toISOString() })
        .eq("id", userId),
      {
        locale,
        onFailure: () => {
          setPlanMail(wasPlan);
          setDigestMail(wasDigest);
        },
      },
    );
    if (ok) toast.success(t.alertSaved);
  }

  if (!ready) return <Skeleton className="h-36 w-full" />;

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-4">
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
    </div>
  );
}
