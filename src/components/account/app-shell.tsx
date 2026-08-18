"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarDays, LogOut, Map, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { messagesFor } from "@/lib/i18n/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function AppShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const t = messagesFor(locale);
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const planHref = `/${locale}/calendar`;
  const alertsHref = `/${locale}/alerts`;
  const accountHref = `/${locale}/account`;
  const mapHref = `/${locale}`;

  useEffect(() => {
    const supabase = createBrowserSupabase();
    void supabase.auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push(mapHref);
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="border-b">
          <BrandMark href={mapHref} size="sm" className="px-1 group-data-[collapsible=icon]:hidden" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname?.includes("/calendar")}>
                    <Link href={planHref}>
                      <CalendarDays />
                      <span>{t.myCalendar}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname?.includes("/alerts")}>
                    <Link href={alertsHref}>
                      <Bell />
                      <span>{t.alertTitle}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname?.includes("/account")}>
                    <Link href={accountHref}>
                      <UserRound />
                      <span>{t.account}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href={mapHref}>
                      <Map />
                      <span>{t.viewOnMap}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        {authed ? (
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={t.signOut} onClick={() => void signOut()}>
                  <LogOut />
                  <span>{t.signOut}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        ) : null}
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <BrandMark href={mapHref} size="sm" />
        </header>
        <div className="flex flex-1 flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
