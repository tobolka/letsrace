import { NextResponse } from "next/server";

/** The one error body every route answers with: `{ error }`, plus any extras. */
export function apiError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * A failure the caller cannot act on. The cause goes to the log; the response
 * says nothing about the database behind it (table names, constraint names and
 * driver text used to reach the browser through `error.message`).
 */
export function serverError(context: string, cause: unknown) {
  console.error(context, cause);
  return apiError(500, "Something went wrong");
}
