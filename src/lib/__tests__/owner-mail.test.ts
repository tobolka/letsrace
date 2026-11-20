import { expect, it } from "vitest";
import { ownerMail, tasksToMail } from "@/lib/admin/owner-mail";
import type { OwnerTask } from "@/lib/admin/owner-tasks";

const day = 86_400_000, now = Date.parse("2026-11-21T06:00:00Z");
const task = (key: string): OwnerTask => ({ key, title: `T ${key}`, what: "Stalo se <něco>.", todo: "Udělej jednu věc." });

it("mails a new task at once and remembers when", () => {
  const { due, remember } = tasksToMail([task("mac-silent")], {}, now);
  expect(due.map((t) => t.key)).toEqual(["mac-silent"]);
  expect(remember).toEqual({ "mac-silent": now });
});

it("does not repeat a task within three days, and does after", () => {
  expect(tasksToMail([task("a")], { a: now - 2 * day }, now).due).toEqual([]);
  expect(tasksToMail([task("a")], { a: now - 3 * day }, now).due.map((t) => t.key)).toEqual(["a"]);
});

it("forgets a task that went away, so its return is mailed again", () => {
  expect(tasksToMail([], { a: now - day }, now).remember).toEqual({});
});

it("says what to do in the mail and escapes page text", () => {
  const mail = ownerMail([task("a"), task("b")]);
  expect(mail.subject).toBe("LetsRace potřebuje tebe (2)");
  expect(mail.text).toContain("Co udělat: Udělej jednu věc.");
  expect(mail.html).toContain("&lt;něco&gt;");
});
