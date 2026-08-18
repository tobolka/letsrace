import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { bootstrapAccount, displayNameFromAuthUser } from "@/lib/account-bootstrap";

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/";
  }
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const forwardedHost = request.headers.get("x-forwarded-host");
  const dest =
    process.env.NODE_ENV !== "development" && forwardedHost
      ? `https://${forwardedHost}${next}`
      : `${origin}${next}`;
  const response = NextResponse.redirect(dest);

  if (!code) return response;

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
