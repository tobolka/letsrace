import { AccountPanel } from "@/components/account/account-panel";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-[100dvh] bg-stone-100 px-4 py-8">
      <AccountPanel locale={locale} />
    </div>
  );
}
