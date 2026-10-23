import type { NextRequest } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth/admin";
import { requireCronSecret } from "@/lib/cron-auth";
import { apiError } from "@/lib/api/respond";

type Handler<Ctx> = (req: NextRequest, ctx: Ctx) => Response | Promise<Response>;

/**
 * Run `handler` for a signed-in admin only. Forms that post from the admin
 * pages and expect a redirect back pass `onUnauthorized` to send the person to
 * the login page instead of showing them JSON.
 */
export function withAdmin<Ctx = unknown>(
  handler: Handler<Ctx>,
  opts: { onUnauthorized?: (req: NextRequest) => Response } = {},
): Handler<Ctx> {
  return async (req, ctx) => {
    if (!(await isAdminAuthenticated())) {
      return opts.onUnauthorized?.(req) ?? apiError(401, "Unauthorized");
    }
    return handler(req, ctx);
  };
}

/**
 * Run `handler` for Vercel Cron (or anyone holding `CRON_SECRET`). Export it as
 * both `GET` and `POST`: cron calls GET, and a manual run is easier with POST.
 */
export function withCron<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return (req, ctx) => {
    if (!requireCronSecret(req)) return apiError(401, "Unauthorized");
    return handler(req, ctx);
  };
}
