/**
 * The owner's to-do list, by e-mail, once in the morning.
 *
 * Nothing is sent while the list is empty. A task is mailed when it appears and
 * again only if it is still there three days later, so a Mac left off for a week
 * is two e-mails, not seven. When a task goes away and later comes back, it is
 * mailed again at once.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { OWNER_EMAIL } from "@/lib/auth/admin";
import { escapeHtml, sendResendEmail } from "@/lib/mail";
import { getOwnerTasks, type OwnerTask } from "@/lib/admin/owner-tasks";
import { createServerSupabase } from "@/lib/supabase/server";

const JOB = "owner-mail";
const REMIND_AFTER = 3 * 86_400_000;
const ADMIN_URL = "https://letsrace.cz/admin";
const sentSchema = z.record(z.string(), z.number());

/** Which tasks go out now, and what to remember afterwards. Pure, for the tests. */
export function tasksToMail(tasks: OwnerTask[], sent: Record<string, number>, now: number) {
  const due = tasks.filter((task) => now - (sent[task.key] ?? 0) >= REMIND_AFTER);
  // Only tasks still on the list are remembered: one that went away is new again when it returns.
  const remember = Object.fromEntries(tasks.map((task) => [task.key, due.includes(task) ? now : sent[task.key]!]));
  return { due, remember };
}

export function ownerMail(tasks: OwnerTask[]) {
  const subject = tasks.length === 1 ? `LetsRace: ${tasks[0]!.title}` : `LetsRace potřebuje tebe (${tasks.length})`;
  const text = [
    ...tasks.flatMap((task) => [task.title, task.what, `Co udělat: ${task.todo}`, ""]),
    `Admin: ${ADMIN_URL}`,
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5">
${tasks
  .map(
    (task) => `<h2 style="font-size:18px;margin:24px 0 4px">${escapeHtml(task.title)}</h2>
<p style="margin:0 0 8px;color:#555">${escapeHtml(task.what)}</p>
<p style="margin:0;padding:12px;background:#f4f4f5;border-radius:6px"><strong>Co udělat:</strong> ${escapeHtml(task.todo)}</p>`,
  )
  .join("\n")}
<p style="margin-top:24px"><a href="${ADMIN_URL}">Otevřít admin</a></p>
</div>`;
  return { subject, text, html };
}

export async function runOwnerMail(now = Date.now()) {
  const db = createServerSupabase();
  const [{ tasks }, previous] = await Promise.all([
    getOwnerTasks(now),
    db.from("pipeline_jobs").select("summary").eq("key", JOB).maybeSingle(),
  ]);
  if (previous.error) throw Error(previous.error.message);
  const stored = sentSchema.safeParse((previous.data?.summary as { sent?: unknown } | null)?.sent);
  const { due, remember } = tasksToMail(tasks, stored.success ? stored.data : {}, now);

  let mailed = false;
  if (due.length) {
    const mail = ownerMail(due);
    mailed = await sendResendEmail({
      to: process.env.OWNER_ALERT_EMAIL || OWNER_EMAIL,
      ...mail,
      idempotencyKey: `owner-mail:${new Date(now).toISOString().slice(0, 10)}:${due.map((task) => task.key).join(",")}`,
    });
  }
  // A mail that did not go out is tried again tomorrow rather than marked as sent.
  const sent = mailed ? remember : Object.fromEntries(Object.entries(remember).filter(([key]) => !due.some((task) => task.key === key)));
  const saved = await db.from("pipeline_jobs").upsert(
    { key: JOB, run_id: randomUUID(), started_at: new Date(now).toISOString(), finished_at: new Date().toISOString(), status: "ok", summary: { sent, tasks: tasks.map((task) => task.key), mailed: mailed ? due.map((task) => task.key) : [] } },
    { onConflict: "key" },
  );
  if (saved.error) throw Error(saved.error.message);
  return { tasks: tasks.length, mailed: mailed ? due.length : 0 };
}
