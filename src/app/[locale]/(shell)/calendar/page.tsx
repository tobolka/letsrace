import { redirect } from "next/navigation";
import { localePath } from "@/lib/localized-paths";

/** The plan moved to the account it belongs to; links in the wild still work. */
export default async function CalendarRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(localePath(locale, `account`));
}
