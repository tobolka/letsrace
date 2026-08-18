import { redirect } from "next/navigation";
import { AccountPanel } from "@/components/account/account-panel";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const { tab } = await searchParams;
  if (tab === "alerts") redirect(`/${locale}/alerts`);
  return <AccountPanel locale={locale} />;
}
