import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { EventForm } from "@/components/admin/event-form";

export default async function NewEventPage() {
  await requireAdminPage();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-sans tracking-tight text-3xl font-semibold">Add event manually</h1>
        <p className="text-sm text-stone-500">
          Use this when you know about a race, or when scraping got something wrong — paste the URL
          and edit every field. Locked fields stay protected from the watcher.
        </p>
      </div>
      <EventForm />
    </div>
  );
}
