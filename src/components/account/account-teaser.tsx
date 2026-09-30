"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Bookmark, BellRing, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { messagesFor } from "@/lib/i18n/messages";

const AuthDialog = dynamic(() =>
  import("@/components/account/auth-dialog").then((m) => ({ default: m.AuthDialog })),
);

/**
 * What the profile is for, shown to someone who has not signed in.
 *
 * The profile is one click from anywhere in the rail, so a visitor will press
 * it. A bare sign-in form answers "what is this?" with "give us your email";
 * this says what they get first, and leaves the form one button away.
 */
export function AccountTeaser({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const [open, setOpen] = useState(false);
  const points = [
    { icon: Bookmark, text: t.teaserPlan },
    { icon: BellRing, text: t.teaserAlerts },
    { icon: Users, text: t.teaserRiders },
  ];

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.teaserTitle}</h1>
        <p className="text-sm text-pretty text-muted-foreground">{t.teaserBody}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="pt-1.5">{text}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen(true)}>{t.signIn}</Button>
        <Button asChild variant="outline">
          <Link href={`/${locale}`}>{t.teaserBrowse}</Link>
        </Button>
      </div>
      {open ? (
        <AuthDialog open onClose={() => setOpen(false)} onSuccess={() => setOpen(false)} locale={locale} />
      ) : null}
    </div>
  );
}
