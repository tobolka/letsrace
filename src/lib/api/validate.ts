import type { NextResponse } from "next/server";
import type { z } from "zod";
import { apiError } from "@/lib/api/respond";

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Check `input` against `schema`, answering a failure as a 400 whose `error`
 * names every field that was wrong. A rule with no field of its own (a
 * bounding box that is only half there) has an empty path, and its message
 * stands alone.
 */
export function validate<S extends z.ZodType>(schema: S, input: unknown): Parsed<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  // A message that already opens with its field ("dateFrom must be …") reads as it is.
  const error = issues
    .map((i) => (i.path && !i.message.startsWith(i.path) ? `${i.path}: ${i.message}` : i.message))
    .join("; ");
  return { ok: false, response: apiError(400, error, { issues }) };
}

/**
 * The JSON body of a request, checked. `optional` is for the few callers that
 * have always accepted an empty or unreadable body as "nothing sent".
 */
export async function parseJson<S extends z.ZodType>(
  req: Request,
  schema: S,
  opts: { optional?: boolean } = {},
): Promise<Parsed<z.output<S>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (!opts.optional) return { ok: false, response: apiError(400, "Invalid JSON body") };
    body = {};
  }
  return validate(schema, body);
}

/**
 * The query string, checked. Every key reaches the schema as a list of its
 * values, so a repeated key (`?levels=a&levels=b`) and a single one read the
 * same way; use `first` / `all` from `@/lib/api/schemas` to unwrap them.
 */
export function parseQuery<S extends z.ZodType>(
  params: URLSearchParams,
  schema: S,
): Parsed<z.output<S>> {
  const input: Record<string, string[]> = {};
  for (const key of new Set(params.keys())) input[key] = params.getAll(key);
  return validate(schema, input);
}
