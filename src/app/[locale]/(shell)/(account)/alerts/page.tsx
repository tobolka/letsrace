import { redirect } from "next/navigation";
import { localePath } from "@/lib/localized-paths";

/** Alerts live under the account now. */
export default async function AlertsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(localePath(locale, `account/alerts`));
}
