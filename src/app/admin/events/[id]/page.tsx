import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { getEventById } from "@/lib/events";
import { EventForm } from "@/components/admin/event-form";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  const location = event.location as {
    name?: string;
    municipality?: string;
    country_code?: string;
    lat?: number;
    lng?: number;
  } | null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-sans tracking-tight text-3xl font-semibold">Edit event</h1>
        <p className="text-sm text-stone-500">
          Fix scraped mistakes here. Enable lock so the watcher will not overwrite your edits.
        </p>
      </div>
      <EventForm
        initial={{
          id: event.id,
          name: event.name,
          startDate: event.start_date,
          endDate: event.end_date ?? "",
          placeName: location?.name ?? "",
          municipality: location?.municipality ?? "",
          countryCode: location?.country_code ?? "CZ",
          lat: location?.lat != null ? String(location.lat) : "",
          lng: location?.lng != null ? String(location.lng) : "",
          audience: event.audience,
          disciplines: event.disciplines ?? [],
          websiteUrl: event.website_url ?? "",
          registrationUrl: event.registration_url ?? "",
          regulationsUrl: event.regulations_url ?? "",
          status: event.status,
          visibility: event.visibility ?? "public",
          lockFields: true,
        }}
      />
    </div>
  );
}
