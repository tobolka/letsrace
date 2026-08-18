import { AppShell } from "@/components/account/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AppShell locale={locale}>{children}</AppShell>;
}
