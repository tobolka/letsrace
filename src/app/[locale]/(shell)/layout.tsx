import { Suspense } from "react";
import { AppRail, MobileTabBar } from "@/components/shell/app-rail";

/**
 * One frame for everything you do inside the app: the map, the list, the
 * schedule and the profile.
 *
 * A rail down the left on a desktop and tabs along the bottom on a phone; the
 * page beside it scrolls on its own. The rail reads the query string to carry
 * the filters between views, which makes it a dynamic part of a static layout,
 * so it sits under a Suspense boundary of its own and never holds the page.
 */
export default async function ShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background md:flex-row">
      <Suspense fallback={<div aria-hidden className="hidden w-14 shrink-0 border-r bg-card md:block" />}>
        <AppRail locale={locale} />
      </Suspense>
      <div id="shell-stage" className="relative min-h-0 min-w-0 flex-1 overflow-auto">
        {children}
      </div>
      <Suspense fallback={null}>
        <MobileTabBar locale={locale} />
      </Suspense>
    </div>
  );
}
