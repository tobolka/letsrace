import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/guards";
import { httpUrl } from "@/lib/api/schemas";
import { parseJson } from "@/lib/api/validate";
import { previewUrl } from "@/lib/watcher/run";

const bodySchema = z.object({ url: httpUrl.min(1, { error: "url required" }) });

export const POST = withAdmin(async (req: NextRequest) => {
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json(await previewUrl(parsed.data.url));
});
