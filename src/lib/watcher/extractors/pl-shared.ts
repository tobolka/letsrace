/** Shared signals for the Polish sources (pzkol.pl, dostartu.pl). */

const YOUTH =
  /\bdzieci|\bdziecięc|\bdzieciec|\bmłodzik|\bmlodzik|\bmłodzież|\bmlodziez|szkół podstawowych|szkol podstawowych|\bżak\b|\bzak\b|\bkids\b|\bpucharek\b/i;

export function isPolishYouthRace(name: string): boolean {
  return YOUTH.test(name);
}
