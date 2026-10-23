/** An embedded `event_overrides` as a query returns it. */
export type OverridesEmbed =
  | { locked_fields: string[] | null }
  | { locked_fields: string[] | null }[]
  | null
  | undefined;

/**
 * The fields an editor locked on a race.
 *
 * `event_overrides.event_id` is unique, so PostgREST embeds the row as one
 * object, not a list. Code that read it as a list saw no locks at all and
 * went on to overwrite what an editor had set by hand; this reads either shape.
 */
export function lockedFieldsOf(overrides: OverridesEmbed): string[] {
  const rows = Array.isArray(overrides) ? overrides : overrides ? [overrides] : [];
  return rows.flatMap((o) => o.locked_fields ?? []);
}
