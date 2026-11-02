import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth/admin";
import { requireSessionUser } from "@/lib/supabase/user-server";
import { AdminSignIn } from "./admin-sign-in";

export const dynamic = "force-dynamic";

/** Sign in with the site's own account; an admin goes straight on. */
export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");
  const user = await requireSessionUser();
  return <AdminSignIn signedInAs={user?.email ?? null} />;
}
