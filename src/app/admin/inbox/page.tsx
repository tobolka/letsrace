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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
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
