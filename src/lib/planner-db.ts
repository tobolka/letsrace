import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attendanceFieldsForStatus,
  isGoingStatus,
  type PlanMemberStatus,
} from "@/lib/planner";

type AttendanceRecord = {
  member_id: string;
  status: string;
  registered: boolean;
  paid: boolean;
};

function flagsFrom(rows: AttendanceRecord[]) {
  return {
    registered: rows.some((r) => r.registered),
    paid: rows.some((r) => r.paid),
  };
}

export async function ensureFavorite(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  favorited: boolean,
) {
  if (favorited) return true;
  await supabase.from("event_favorites").insert({ user_id: userId, event_id: eventId });
  return true;
}

export async function toggleFavoriteRow(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  favorited: boolean,
) {
  if (favorited) {
    await supabase.from("event_favorites").delete().eq("user_id", userId).eq("event_id", eventId);
    return false;
  }
  await supabase.from("event_favorites").insert({ user_id: userId, event_id: eventId });
  return true;
}

export async function toggleMemberGoing(opts: {
  supabase: SupabaseClient;
  userId: string;
  eventId: string;
  memberId: string;
  selfId: string | null;
  rows: AttendanceRecord[];
  favorited: boolean;
}): Promise<{ rows: AttendanceRecord[]; favorited: boolean }> {
  const { supabase, userId, eventId, memberId, selfId } = opts;
  let rows = [...opts.rows];
  let favorited = opts.favorited;
  const existing = rows.find((r) => r.member_id === memberId);
  const goingNow = existing ? isGoingStatus(existing.status) : false;
  const flags = flagsFrom(rows);

  if (goingNow) {
    const othersGoing = rows.some((r) => r.member_id !== memberId && isGoingStatus(r.status));
    const keepWatching =
      memberId === selfId && (flags.registered || flags.paid) && !othersGoing;
    if (keepWatching && existing) {
      await supabase
        .from("event_attendance")
        .update({ status: "watching", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .eq("member_id", memberId);
      rows = rows.map((r) => (r.member_id === memberId ? { ...r, status: "watching" } : r));
    } else {
      await supabase
        .from("event_attendance")
        .delete()
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .eq("member_id", memberId);
      rows = rows.filter((r) => r.member_id !== memberId);
    }
    return { rows, favorited };
  }

  const next: AttendanceRecord = {
    member_id: memberId,
    status: "going",
    registered: flags.registered,
    paid: flags.paid,
  };

  if (existing) {
    await supabase
      .from("event_attendance")
      .update({
        status: "going",
        registered: flags.registered,
        paid: flags.paid,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .eq("member_id", memberId);
    rows = rows.map((r) => (r.member_id === memberId ? next : r));
  } else {
    await supabase.from("event_attendance").insert({
      user_id: userId,
      event_id: eventId,
      member_id: memberId,
      status: "going",
      registered: flags.registered,
      paid: flags.paid,
    });
    rows = [...rows, next];
  }

  favorited = await ensureFavorite(supabase, userId, eventId, favorited);
  return { rows, favorited };
}

export async function setHouseholdFlags(opts: {
  supabase: SupabaseClient;
  userId: string;
  eventId: string;
  selfId: string;
  rows: AttendanceRecord[];
  registered: boolean;
  paid: boolean;
  favorited: boolean;
}): Promise<{ rows: AttendanceRecord[]; favorited: boolean }> {
  const { supabase, userId, eventId, selfId } = opts;
  const registered = opts.paid ? true : opts.registered;
  const paid = opts.registered === false ? false : opts.paid;
  let rows = [...opts.rows];
  let favorited = opts.favorited;

  const selfRow = rows.find((r) => r.member_id === selfId);
  if (!selfRow) {
    const status = "watching";
    await supabase.from("event_attendance").insert({
      user_id: userId,
      event_id: eventId,
      member_id: selfId,
      status,
      registered,
      paid,
    });
    rows = [...rows, { member_id: selfId, status, registered, paid }];
  }

  if (rows.length > 0) {
    await supabase
      .from("event_attendance")
      .update({ registered, paid, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("event_id", eventId);
    rows = rows.map((r) => ({ ...r, registered, paid }));
  }

  if (registered || paid) {
    favorited = await ensureFavorite(supabase, userId, eventId, favorited);
  }
  return { rows, favorited };
}

export async function setMemberPlanStatus(opts: {
  supabase: SupabaseClient;
  userId: string;
  eventId: string;
  memberId: string;
  status: PlanMemberStatus;
  rows: AttendanceRecord[];
  favorited: boolean;
}): Promise<{ rows: AttendanceRecord[]; favorited: boolean }> {
  const { supabase, userId, eventId, memberId } = opts;
  let rows = [...opts.rows];
  let favorited = opts.favorited;
  const fields = attendanceFieldsForStatus(opts.status);

  if (!fields) {
    await supabase
      .from("event_attendance")
      .delete()
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .eq("member_id", memberId);
    return { rows: rows.filter((r) => r.member_id !== memberId), favorited };
  }

  const next: AttendanceRecord = {
    member_id: memberId,
    status: fields.status,
    registered: fields.registered,
    paid: fields.paid,
  };
  const existing = rows.find((r) => r.member_id === memberId);

  if (existing) {
    await supabase
      .from("event_attendance")
      .update({
        status: next.status,
        registered: next.registered,
        paid: next.paid,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .eq("member_id", memberId);
    rows = rows.map((r) => (r.member_id === memberId ? next : r));
  } else {
    await supabase.from("event_attendance").insert({
      user_id: userId,
      event_id: eventId,
      member_id: memberId,
      status: next.status,
      registered: next.registered,
      paid: next.paid,
    });
    rows = [...rows, next];
  }

  favorited = await ensureFavorite(supabase, userId, eventId, favorited);
  return { rows, favorited };
}

export async function setPlanFee(opts: {
  supabase: SupabaseClient;
  userId: string;
  eventId: string;
  feeAmount: number | null;
  favorited: boolean;
}): Promise<boolean> {
  if (!opts.favorited) {
    const { error } = await opts.supabase.from("event_favorites").insert({
      user_id: opts.userId,
      event_id: opts.eventId,
      fee_amount: opts.feeAmount,
    });
    if (!error) return true;
  }
  await opts.supabase
    .from("event_favorites")
    .update({ fee_amount: opts.feeAmount })
    .eq("user_id", opts.userId)
    .eq("event_id", opts.eventId);
  return true;
}

export async function removeFromPlan(opts: {
  supabase: SupabaseClient;
  userId: string;
  eventId: string;
}) {
  await opts.supabase
    .from("event_attendance")
    .delete()
    .eq("user_id", opts.userId)
    .eq("event_id", opts.eventId);
  await opts.supabase
    .from("event_favorites")
    .delete()
    .eq("user_id", opts.userId)
    .eq("event_id", opts.eventId);
}

export { flagsFrom };
export type { AttendanceRecord };
