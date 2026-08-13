import { AuthForm } from "@/components/account/auth-form";

export default async function AuthPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="min-h-[100dvh] bg-stone-100 px-4 py-10">
      <AuthForm locale={locale} />
    </div>
  );
}
