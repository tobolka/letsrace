import { AlertsPanel } from "@/components/account/alerts-panel";

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AlertsPanel locale={locale} />;
}
