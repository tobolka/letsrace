import { NextResponse } from "next/server";
import { z } from "zod";
import { withCron } from "@/lib/api/guards";
import { preparePublicRaceDetails } from "@/lib/events";

const slug = z.string().min(1).max(200).regex(/^[a-z0-9_-]+$/i);
const input = z.union([
  z.object({ slugs: z.array(slug).min(1).max(200) }),
  z.object({ after: z.union([z.literal(""), slug]), limit: z.number().int().min(1).max(100) }),
]);

export const POST = withCron(async req => {
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid public race cache batch" }, { status: 400 });
  const batch = parsed.data;
  if ("after" in batch) return NextResponse.json(await preparePublicRaceDetails(batch));

  const slugs = [...new Set(batch.slugs)];
  let prepared = 0;
  for (let from = 0; from < slugs.length; from += 25) {
    prepared += (await preparePublicRaceDetails({ slugs: slugs.slice(from, from + 25) })).prepared;
  }
  return NextResponse.json({ prepared });
}, "publication");
