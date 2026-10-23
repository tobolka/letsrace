import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/guards";
import { getAdminWorkCounts } from "@/lib/admin/work-counts";

export const dynamic = "force-dynamic";

/** Counts for the admin shell's badges. */
export const GET = withAdmin(async () => NextResponse.json(await getAdminWorkCounts()));
