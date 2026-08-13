import { redirect } from "next/navigation";

/** Auth lives in a modal — old /auth URL redirects home. */
export default async function AuthPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}`);
}
