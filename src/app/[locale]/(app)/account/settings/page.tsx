import { SettingsPanel } from "@/components/account/settings-panel";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SettingsPanel locale={locale} />;
}
