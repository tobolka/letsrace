import { createServerSupabase } from "@/lib/supabase/server";
import { SubmissionsInbox } from "@/components/admin/submissions-inbox";
import { requireAdminPage } from "@/lib/auth/require-admin-page";

export default async function AdminInboxPage() {
  await requireAdminPage();
  const supabase = createServerSupabase();
  const [{ data: notes }, { data: subs }, { data: feedback }] = await Promise.all([
    supabase
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("race_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("feedback_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-stone-500">
          Feature requests, race URLs, and notifications.
        </p>
      </div>
      <SubmissionsInbox
        notifications={notes ?? []}
        submissions={subs ?? []}
        feedback={feedback ?? []}
      />
    </div>
  );
}
