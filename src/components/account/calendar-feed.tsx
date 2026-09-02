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
export function CalendarFeed({ locale, userId }: { locale: string; userId: string }) {
  const t = messagesFor(locale);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = createBrowserSupabase();
      const { data } = await supabase
        .from("profiles")
        .select("ics_token")
        .eq("id", userId)
        .maybeSingle();
      if (!alive) return;
      setToken((data?.ics_token as string | null) ?? null);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

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
    const next = crypto.randomUUID();
    const supabase = createBrowserSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({ ics_token: next, updated_at: new Date().toISOString() })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setToken(next);
    toast.success(t.feedRegenerated);
  }

  if (!ready) return <Skeleton className="h-40 w-full" />;
  if (!token) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarPlus className="size-4" aria-hidden />
          {t.feedTitle}
        </CardTitle>
        <CardDescription>{t.feedBody}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
      </CardContent>
    </Card>
  );
}
