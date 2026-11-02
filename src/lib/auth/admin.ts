import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";

/**
 * The admin is a person, not a password: the site's own sign-in (Google), and
 * an address on this list or in `admin_users`. The shared password, its cookie
 * and its login endpoint are gone.
 */
const OWNER_EMAILS = new Set(["tobolka@gmail.com"]);

/** An address only counts once its owner has proved it — Google always has. */
function confirmedEmail(user: User | null): string | null {
  if (!user?.email) return null;
  const proved = Boolean(user.email_confirmed_at) || user.app_metadata?.provider === "google";
  return proved ? user.email.toLowerCase() : null;
}

export async function isAdminEmail(email: string | null): Promise<boolean> {
  if (!email) return false;
  if (OWNER_EMAILS.has(email)) return true;
  const { data } = await createServerSupabase().from("admin_users").select("id").ilike("email", email).limit(1);
  return Boolean(data?.length);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  return isAdminEmail(confirmedEmail(await requireSessionUser()));
}

export async function requireAdmin() {
  const ok = await isAdminAuthenticated();
  if (!ok) throw new Error("Unauthorized");
}
