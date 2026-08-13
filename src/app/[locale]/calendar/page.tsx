import { CalendarPanel } from "@/components/account/calendar-panel";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-[100dvh] bg-stone-100 px-4 py-8">
      <CalendarPanel locale={locale} />
    </div>
  );
}
