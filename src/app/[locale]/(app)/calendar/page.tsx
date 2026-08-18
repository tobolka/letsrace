import { CalendarPanel } from "@/components/account/calendar-panel";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <CalendarPanel locale={locale} />;
}
