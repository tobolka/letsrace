"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { messagesFor } from "@/lib/i18n/messages";

/**
 * A plan that lives only on this site is a plan nobody sees on a Friday
 * evening. Subscribing puts the weekend's race next to the dentist and the
 * school run, which is where the decision actually gets made.
 */
export function CalendarFeed({
  locale,
  userId,
  bare,
}: {
  locale: string;
  userId: string;
  /** Inside a panel that already carries the title, the blurb and the surface. */
  bare?: boolean;
}) {
  const t = messagesFor(locale);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setReady(false);
      setFailed(false);
      setToken(null);
      try {
        const supabase = createBrowserSupabase();
        const { data, error } = await supabase
          .from("profiles")
          .select("ics_token")
          .eq("id", userId)
          .maybeSingle();
        if (error) throw error;
        if (!alive) return;
        if (!data?.ics_token) throw new Error("Calendar token unavailable");
        setToken((data?.ics_token as string | null) ?? null);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, attempt]);

  const url = token
    ? `${typeof window === "undefined" ? "" : window.location.origin}/api/plan/${token}.ics`
    : "";
  const webcal = url.replace(/^https?:/, "webcal:");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.feedCopy);
    }
  }

  async function regenerate() {
    setBusy(true);
    try {
      const next = crypto.randomUUID();
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase
        .from("profiles")
        .update({ ics_token: next, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("ics_token")
        .single();
      if (error || !data?.ics_token) throw error ?? new Error("Calendar update failed");
      setToken(data.ics_token);
      toast.success(t.feedRegenerated);
    } catch {
      toast.error(t.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Skeleton className="h-40 w-full" />;
  if (failed || !token) return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <p role="alert" className="text-sm text-muted-foreground">{t.loadFailed}</p>
      <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
    </div>
  );

  const inner = (
    <>
        <InputGroup>
          <InputGroupInput readOnly value={url} aria-label={t.feedTitle} onFocus={(e) => e.currentTarget.select()} />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="button" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />}
              {copied ? t.feedCopied : t.feedCopy}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={webcal}>{t.feedApple}</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.feedGoogle}
            </a>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={busy}
            onClick={() => void regenerate()}
          >
            <RefreshCw data-icon="inline-start" />
            {t.feedRegenerate}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{t.feedWarn}</p>
    </>
  );

  if (bare) return <div className="flex flex-col gap-3">{inner}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarPlus className="size-4" aria-hidden />
          {t.feedTitle}
        </CardTitle>
        <CardDescription>{t.feedBody}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{inner}</CardContent>
    </Card>
  );
}
