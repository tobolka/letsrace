import { redirect } from "next/navigation";

/** The plan moved to the account it belongs to; links in the wild still work. */
export default async function CalendarRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/account`);
}
