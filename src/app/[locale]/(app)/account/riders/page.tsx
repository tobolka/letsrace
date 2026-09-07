import { RidersPanel } from "@/components/account/riders-panel";

export default async function RidersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <RidersPanel locale={locale} />;
}
