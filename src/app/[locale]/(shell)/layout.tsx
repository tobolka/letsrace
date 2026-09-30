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
      style={{ "--sidebar": "var(--background)", "--sidebar-accent": "var(--border)" } as React.CSSProperties}
      className="h-dvh min-h-0 overflow-hidden max-md:flex-col"
    >
      <AppSidebar locale={locale} />
      <SidebarInset className="min-h-0 overflow-hidden bg-card md:border md:border-sidebar-border">
        <div id="shell-stage" className="relative min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
      <MobileTabBar locale={locale} />
    </SidebarProvider>
  );
}
