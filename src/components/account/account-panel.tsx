"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button, Input, Label } from "@/components/ui/primitives";
import { AuthForm } from "@/components/account/auth-form";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  name: string;
  relationship: string;
  birth_year: number | null;
  is_self: boolean;
};

export function AccountPanel({ locale }: { locale: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("other");
  const [birthYear, setBirthYear] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setAuthed(false);
      setReady(true);
      return;
    }
    setAuthed(true);
    setEmail(auth.user.email ?? null);
    const { data } = await supabase
      .from("family_members")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("created_at");
    setMembers(data ?? []);
    setReady(true);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("family_members").insert({
      user_id: auth.user.id,
      name,
      relationship,
      birth_year: birthYear ? Number(birthYear) : null,
      is_self: false,
    });
    setName("");
    setBirthYear("");
    setMessage("Profile added");
    await load();
  }

  async function removeMember(id: string) {
    const supabase = createBrowserSupabase();
    await supabase.from("family_members").delete().eq("id", id);
    await load();
  }

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push(`/${locale}`);
  }

  if (!ready) {
    return <p className="mx-auto max-w-md p-6 text-sm text-stone-500">…</p>;
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <AuthForm locale={locale} onSuccess={() => void load()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-sans text-3xl font-semibold tracking-tight">Account</h1>
          <p className="text-sm text-stone-500">{email}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${locale}`} className="text-sm text-stone-500 hover:text-stone-800">
            ← Map
          </Link>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
        <h2 className="font-medium">Profiles</h2>
        <p className="mt-1 text-sm text-stone-500">
          People you track races for — favorites, calendar, registration status.
        </p>
        <ul className="mt-4 space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {m.name} {m.is_self ? "(you)" : ""}
                </p>
                <p className="text-xs text-stone-500">
                  {m.relationship}
                  {m.birth_year ? ` · born ${m.birth_year}` : ""}
                </p>
              </div>
              {!m.is_self && (
                <Button size="sm" variant="ghost" onClick={() => void removeMember(m.id)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={addMember} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-1">
            <Label>Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name…" />
          </div>
          <div className="space-y-1">
            <Label>Relationship</Label>
            <select
              className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            >
              <option value="self">Self</option>
              <option value="partner">Partner</option>
              <option value="child">Child</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Birth year</Label>
            <Input
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="2016"
              inputMode="numeric"
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit">Add profile</Button>
            {message && <span className="ml-3 text-sm text-stone-900">{message}</span>}
          </div>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
        <h2 className="font-medium">Shortcuts</h2>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href={`/${locale}/calendar`} className="text-stone-900 underline">
            My race calendar
          </Link>
          <Link href={`/${locale}`} className="text-stone-900 underline">
            Map
          </Link>
        </div>
      </section>
    </div>
  );
}
