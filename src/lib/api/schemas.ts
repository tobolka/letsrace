import { z } from "zod";
import { isIsoDay } from "@/lib/events";

/** `?key=a&key=b` arrives as `["a", "b"]`; the first value, or nothing. */
export const first = z
  .array(z.string())
  .optional()
  .transform((v) => v?.[0]);

/** Every non-empty value of a repeated key. */
export const all = z
  .array(z.string())
  .optional()
  .transform((v) => (v ?? []).filter(Boolean));

/** `YYYY-MM-DD`, and a real day. */
export const isoDay = z.string().refine(isIsoDay, { error: "must be YYYY-MM-DD" });

/** An address a browser can open: `javascript:` and friends never get stored. */
export const httpUrl = z
  .string()
  .trim()
  .max(2000, "too long")
  .refine((value) => {
    try {
      return /^https?:$/i.test(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "must be an http(s) URL");

/** A form field left empty is a field not sent. */
export const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

/** An optional `?dateFrom=`-style day; an unreadable one is a client error. */
export const dayParam = (key: string) =>
  first
    .refine((raw) => !raw || isIsoDay(raw), { error: `${key} must be YYYY-MM-DD` })
    .transform((raw) => raw || undefined);
