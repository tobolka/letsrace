import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { runOwnerMail } from "@/lib/admin/owner-mail";

export const maxDuration = 60;

/** Each morning: e-mail the owner what needs them, if anything does. */
export const GET = withCron(async () => NextResponse.json({ ok: true, ...(await runOwnerMail()) }));

export const POST = GET;
