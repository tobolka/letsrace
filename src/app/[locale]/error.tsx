"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { messagesFor, locales, type Locale } from "@/lib/i18n/messages";

export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams();
  const locale = locales.includes(params.locale as Locale) ? String(params.locale) : "en";
  const t = messagesFor(locale);

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">{t.pageFailed}</h1>
      <p role="alert" className="text-muted-foreground">{t.loadFailed}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={retry}>{t.retry}</Button>
        <Button asChild variant="outline"><Link href={`/${locale}`}>{t.viewOnMap}</Link></Button>
      </div>
    </main>
  );
}
