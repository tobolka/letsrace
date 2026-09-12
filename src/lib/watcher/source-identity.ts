/** External ids can be reused next season; never overwrite a previous edition. */
export function sourceEditionId(
  startDate: string,
  source: { id: string; start_date: string; merged_into_id?: string | null } | null | undefined,
): string | undefined {
  if (!source || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return undefined;
  if (source.start_date.slice(0, 4) !== startDate.slice(0, 4)) return undefined;
  return source.merged_into_id ?? source.id;
}
