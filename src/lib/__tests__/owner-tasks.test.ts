import { expect, it } from "vitest";
import { ownerTasks, type OwnerTaskInput } from "@/lib/admin/owner-tasks";

const now = Date.parse("2026-11-20T12:00:00Z");
const hours = (n: number) => new Date(now - n * 3_600_000).toISOString();
const calm: OwnerTaskInput = {
  now, macAt: hours(0.1), macPaused: false, agent: { open: 40, lastAnswerAt: now - 3_600_000 },
  serverAt: hours(8), messages: 0, questions: 0,
};

it("asks nothing of the owner when the machines are working", () => {
  expect(ownerTasks(calm)).toEqual([]);
});

it("does not count machine queues as the owner's work", () => {
  // A full agent queue that is being answered is not a task.
  expect(ownerTasks({ ...calm, agent: { open: 500, lastAnswerAt: now - 60_000 } })).toEqual([]);
});

it("tells the owner to switch the Mac on when it has been silent for hours", () => {
  const [task] = ownerTasks({ ...calm, macAt: hours(7) });
  expect(task?.key).toBe("mac-silent");
  expect(task?.todo).toMatch(/Zapni nebo probuď Mac/);
});

it("says nothing about the agent while the Mac is silent", () => {
  const keys = ownerTasks({ ...calm, macAt: hours(30), agent: { open: 10, lastAnswerAt: null } }).map((task) => task.key);
  expect(keys).toEqual(["mac-silent"]);
});

it("asks to start the agent when its queue has waited for days", () => {
  const keys = ownerTasks({ ...calm, agent: { open: 12, lastAnswerAt: now - 4 * 86_400_000 } }).map((task) => task.key);
  expect(keys).toEqual(["agent-idle"]);
});

it("reports a pause, stale server jobs, rider messages and open questions, each with a step", () => {
  const tasks = ownerTasks({ ...calm, macPaused: true, serverAt: hours(40), messages: 2, questions: 1 });
  expect(tasks.map((task) => task.key)).toEqual(["mac-paused", "server-stale", "messages", "questions"]);
  for (const task of tasks) expect(task.todo.length).toBeGreaterThan(20);
});
