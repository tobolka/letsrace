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
          // The sheet sits 6px off the window on three sides and flush with the
          // rail on the fourth, with a hairline and no shadow.
          // A real border, not a ring: a ring is drawn outside the box, and on
          // the left the fixed rail painted over it.
          "min-h-0 overflow-hidden bg-background md:peer-data-[variant=inset]:m-1.5 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0 md:peer-data-[variant=inset]:rounded-[10px] md:border md:border-sidebar-border md:peer-data-[variant=inset]:shadow-none"
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
