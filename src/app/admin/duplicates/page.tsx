import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import {
  listSuspiciousDuplicates,
  dismissSuspiciousPair,
} from "@/lib/catalog/suspicious-duplicates";
import { mergeEventPair } from "@/lib/catalog/merge-duplicates";
import { DuplicateReview } from "@/components/admin/duplicate-review";
import { DuplicateFilters } from "@/components/admin/duplicate-filters";

export default async function DuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; discipline?: string; from?: string; to?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const filters = {
    country: (sp.country ?? "").trim().toUpperCase(),
    discipline: (sp.discipline ?? "").trim(),
    fromDate: (sp.from ?? "").trim(),
    toDate: (sp.to ?? "").trim(),
  };
  const pairs = await listSuspiciousDuplicates(filters);

  async function merge(keepId: string, dropId: string) {
    "use server";
    await requireAdminPage();
    await mergeEventPair(keepId, dropId);
    revalidatePath("/admin/duplicates");
  }

  async function dismiss(leftId: string, rightId: string) {
    "use server";
    await requireAdminPage();
    await dismissSuspiciousPair(leftId, rightId);
    revalidatePath("/admin/duplicates");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Duplicates</h1>
        <p className="text-sm text-muted-foreground">
          Races sharing a venue, a day and a discipline that the merger would not take on its
          own. Roughly half of these are two real races — a town holds more than one bike race on
          a Sunday — so each one is a question, not a verdict.
        </p>
      </div>
      <DuplicateFilters
        country={filters.country}
        discipline={filters.discipline}
        from={filters.fromDate}
        to={filters.toDate}
      />
      <DuplicateReview pairs={pairs} onMerge={merge} onDismiss={dismiss} />
    </div>
  );
}
