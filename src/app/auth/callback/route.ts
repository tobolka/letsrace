import { NextRequest, NextResponse } from "next/server";
import { bootstrapAccount, displayNameFromAuthUser } from "@/lib/account-bootstrap";
import { getSiteUrl } from "@/lib/seo";

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/";
  }
  return next;
}

function allowedOrigins(): Set<string> {
  const out = new Set<string>([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://racegrid-one.vercel.app",
    "https://startline-lovat.vercel.app",
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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const base = redirectBase(request, origin);
  const dest = `${base}${next}`;
  const response = NextResponse.redirect(dest);

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
  if (error) return response;

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
