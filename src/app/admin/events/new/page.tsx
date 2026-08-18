import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { EventForm } from "@/components/admin/event-form";

export default async function NewEventPage() {
  await requireAdminPage();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Add event manually</h1>
        <p className="text-sm text-muted-foreground">
          Use this when you know about a race, or when scraping got something wrong — paste the URL
          and edit every field. Locked fields stay protected from the watcher.
        </p>
      </div>
      <EventForm />
    </div>
  );
}
