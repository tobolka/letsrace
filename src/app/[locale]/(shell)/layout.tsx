import { AppSidebar, MobileTabBar } from "@/components/shell/app-rail";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * One frame for everything inside the app: the map, the list, the calendar and
 * the profile.
 *
 * shadcn's inset sidebar, collapsed to its icons: the theme's sidebar grey for
 * the rail, and the page as a white sheet beside it. On a phone the rail becomes tabs
 * along the bottom.
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
    <SidebarProvider
      open={false}
      // Only the rail's width is ours; its colours are the theme's sidebar
      // tokens. The icon rail is 56px, so a 32px button has 12px either side.
      style={{ "--sidebar-width-icon": "2.5rem" } as React.CSSProperties}
      className="h-dvh min-h-0 overflow-hidden max-md:flex-col"
    >
      <AppSidebar locale={locale} />
      <SidebarInset
        className={
          // The page is a white sheet laid on the rail's grey: 8px off the window
          // on three sides, flush with the rail on the fourth, lifted by a
          // hairline outline and a soft shadow rather than a drawn border.
          // It sits above the rail (z-20) so that outline is not painted over
          // on its left edge by the fixed rail.
          "relative z-20 min-h-0 overflow-hidden bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-(--shell-sheet-shadow)"
        }
      >
        <div id="shell-stage" className="relative min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
      <MobileTabBar locale={locale} />
    </SidebarProvider>
  );
}
