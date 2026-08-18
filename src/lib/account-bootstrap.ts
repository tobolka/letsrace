import { createServerSupabase } from "@/lib/supabase/server";

export function displayNameFromAuthUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const meta = user.user_metadata ?? {};
  const fromMeta = [meta.full_name, meta.name, meta.display_name].find(
    (value) => typeof value === "string" && value.trim(),
  );
  if (typeof fromMeta === "string") return fromMeta.trim();
  return user.email?.split("@")[0] || "Rider";
}

export async function bootstrapAccount(input: {
  userId: string;
  email?: string | null;
  displayName?: string | null;
}) {
  const email = input.email?.trim() || "";
  const displayName = input.displayName?.trim() || email.split("@")[0] || "Rider";
  const supabase = createServerSupabase();

  await supabase.from("profiles").upsert({
    id: input.userId,
    email,
    display_name: displayName,
    updated_at: new Date().toISOString(),
  });

  const { data: existing } = await supabase
    .from("family_members")
    .select("id")
    .eq("user_id", input.userId)
    .eq("is_self", true)
    .maybeSingle();

  if (!existing) {
    await supabase.from("family_members").insert({
      user_id: input.userId,
      name: displayName,
      relationship: "self",
      is_self: true,
    });
  }
}
