import { redirect } from "next/navigation";

export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/account/recommendations?tab=watching`);
}
