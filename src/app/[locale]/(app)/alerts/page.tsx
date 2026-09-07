import { redirect } from "next/navigation";

/** Alerts live under the account now. */
export default async function AlertsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/account/alerts`);
}
