import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/supabase/user-server";
import { messagesFor } from "@/lib/i18n/messages";
import { ResetPasswordForm } from "@/components/account/reset-password-form";
import { AuthForm } from "@/components/account/auth-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = messagesFor(locale);
  const user = await requireSessionUser();
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">{t.newPassword}</h1>
      {user ? <ResetPasswordForm locale={locale} /> : (
        <>
          <p role="alert" className="text-sm text-muted-foreground">{t.recoveryInvalid}</p>
          <AuthForm locale={locale} hideTitle />
        </>
      )}
    </main>
  );
}
