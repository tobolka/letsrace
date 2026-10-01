import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { confirmSeriesAges, listSeriesForAgeReview } from "@/lib/catalog/series-ages";
import { SeriesAgeReview } from "@/components/admin/series-age-review";

export const dynamic = "force-dynamic";

export default async function SeriesAgesPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; all?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const country = (sp.country ?? "").trim().toUpperCase();
  const rows = await listSeriesForAgeReview({ country: country || undefined, onlyOpen: sp.all !== "1" });

  async function save(seriesId: string, ages: string[]) {
    "use server";
    await requireAdminPage();
    const rounds = await confirmSeriesAges(seriesId, ages);
    revalidatePath("/admin/series");
    return rounds;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Series categories</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Who may start in each series, decided once by a person. A confirmed list is stored as stated on
          every upcoming round, and again each night on rounds added later, so the category filter can
          trust it. Unconfirmed series come first, the ones with most races ahead at the top.
        </p>
        <div className="flex flex-wrap gap-2 pt-1 text-sm">
          {["", "CZ", "SK", "PL", "DE", "AT"].map((cc) => (
            <a
              key={cc || "all"}
              href={`/admin/series${cc ? `?country=${cc}` : ""}`}
              className={`rounded-full border px-3 py-1 ${country === cc ? "bg-foreground text-background" : ""}`}
            >
              {cc || "All countries"}
            </a>
          ))}
          <a href={`/admin/series?${country ? `country=${country}&` : ""}all=1`} className="rounded-full border px-3 py-1">
            Include confirmed
          </a>
        </div>
      </div>
      <SeriesAgeReview rows={rows} onSave={save} />
    </div>
  );
}
