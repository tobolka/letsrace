import { NextRequest, NextResponse } from "next/server";
import { bootstrapAccount, displayNameFromAuthUser } from "@/lib/account-bootstrap";
import { getSiteUrl } from "@/lib/seo";

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/";
  }
  return next;
}

/**
 * Origins sign-in may return to.
 *
 * Only the real site and local development. The `startline-*` and `racegrid-*`
 * aliases are leftovers from earlier names for this project; a visitor who
 * reaches one of those now falls through to `getSiteUrl()` and lands on
 * letsrace.cz, which is where they should end up anyway.
 */
function allowedOrigins(): Set<string> {
  const out = new Set<string>([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://letsrace.cz",
    "https://www.letsrace.cz",
  ]);
  try {
    out.add(getSiteUrl());
  } catch {
    /* ignore */
  }
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) out.add(explicit);
  return out;
}

function redirectBase(request: NextRequest, origin: string): string {
  const allowed = allowedOrigins();
  if (allowed.has(origin)) return origin;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const candidate = `https://${forwardedHost}`;
    if (allowed.has(candidate)) return candidate;
  }

  try {
    return getSiteUrl();
  } catch {
    return origin;
  }
}

const ERROR_CODE = /^[a-z0-9_-]{1,64}$/;

/**
 * Reduce a failed sign-in to a short code the page can translate.
 *
 * Only the code travels back in the URL, never the provider's own prose: the
 * destination renders whatever it finds, and a crafted link must not be able
 * to put arbitrary text in front of a visitor.
 */
function failureCode(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("error_code") ?? searchParams.get("error");
  if (!raw) return null;
  return ERROR_CODE.test(raw) ? raw : "unknown";
}

function destination(base: string, next: string, failure: string | null): string {
  const url = new URL(`${base}${next}`);
  if (failure) url.searchParams.set("auth_error", failure);
  return url.toString();
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const base = redirectBase(request, origin);

  // Google and Supabase report a refusal by sending the visitor back here with
  // an error instead of a code. Carry it through so the page can say so.
  const refused = failureCode(searchParams);
  if (refused) return NextResponse.redirect(destination(base, next, refused));

  const response = NextResponse.redirect(destination(base, next, null));

  if (!code) return response;

  const { createServerClient } = await import("@supabase/ssr");
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(destination(base, next, "exchange_failed"));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await bootstrapAccount({
      userId: user.id,
      email: user.email,
      displayName: displayNameFromAuthUser(user),
    });
  }

  return response;
}
