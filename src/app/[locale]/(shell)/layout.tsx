import { AppSidebar, MobileTabBar } from "@/components/shell/app-rail";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * One frame for everything inside the app: the map, the list, the calendar and
 * the profile.
 *
 * shadcn's inset sidebar, collapsed to its icons: a grey rail, and the page as
 * a white sheet laid on the grey beside it. On a phone the rail becomes tabs
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
      // The rail is the page's grey; the sheet laid on it is the card's white.
      // Our own grey: a cool fog with a trace of green in it — the colour of a
      // trail map's paper rather than every app's neutral stone. The icon rail
      // is 56px, so a 32px button sits with 12px of air on either side.
      style={
        {
          "--sidebar": "var(--shell-rail)",
          "--sidebar-accent": "var(--shell-rail-accent)",
          "--sidebar-border": "var(--shell-rail-border)",
          "--sidebar-width-icon": "2.5rem",
        } as React.CSSProperties
      }
      className="h-dvh min-h-0 overflow-hidden max-md:flex-col"
    >
      <AppSidebar locale={locale} />
      <SidebarInset
        className={
          // The sheet sits 6px off the window on three sides and flush with the
          // rail on the fourth; a hairline and the faintest lift, not a card.
          // A real border, not a ring: a ring is drawn outside the box, and on
          // the left the fixed rail painted over it.
          "min-h-0 overflow-hidden bg-card md:peer-data-[variant=inset]:m-1.5 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0 md:peer-data-[variant=inset]:rounded-[10px] md:border md:border-(--shell-sheet-edge) md:peer-data-[variant=inset]:shadow-[0_1px_2px_var(--shell-sheet-lift)]"
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
