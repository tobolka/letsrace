/**
 * The two numbers the admin shell shows: things that need the owner, and
 * messages from riders. Machine queues (website suggestions, sources waiting to
 * be read, possible duplicates) are not counted here: they are the agent's and
 * the Mac's work, and a badge on them only read as an alarm.
 */
import { getOwnerTasks } from "@/lib/admin/owner-tasks";

export type AdminWorkCounts = {
  /** Things on the owner's list (see owner-tasks.ts). */
  tasks: number;
  /** Messages from riders still open. */
  inbox: number;
  checkedAt: string;
};

export async function getAdminWorkCounts(): Promise<AdminWorkCounts> {
  const { input, tasks } = await getOwnerTasks();
  return { tasks: tasks.length, inbox: input.messages, checkedAt: new Date().toISOString() };
}
