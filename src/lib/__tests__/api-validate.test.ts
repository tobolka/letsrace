import { describe, expect, it } from "vitest";
import { z } from "zod";
import { all, first, httpUrl, isoDay, optional } from "@/lib/api/schemas";
import { parseJson, parseQuery, validate } from "@/lib/api/validate";

async function bodyOf(res: Response) {
  return (await res.json()) as { error: string; issues?: { path: string; message: string }[] };
}

describe("validate", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number() });

  it("returns the parsed data", () => {
    expect(validate(schema, { name: "a", age: 3 })).toEqual({ ok: true, data: { name: "a", age: 3 } });
  });

  it("answers 400 and names every field that was wrong", async () => {
    const result = validate(schema, { name: "", age: "x" });
    if (result.ok) throw new Error("expected a failure");
    expect(result.response.status).toBe(400);
    const body = await bodyOf(result.response);
    expect(body.issues?.map((i) => i.path).sort()).toEqual(["age", "name"]);
    expect(body.error).toContain("name:");
    expect(body.error).toContain("age:");
  });

  it("shows a rule with no field of its own on its own", async () => {
    const whole = z.object({ a: z.string() }).refine(() => false, { error: "a and b together" });
    const result = validate(whole, { a: "x" });
    if (result.ok) throw new Error("expected a failure");
    expect((await bodyOf(result.response)).error).toBe("a and b together");
  });
});

describe("parseJson", () => {
  const schema = z.object({ n: z.number() });
  const post = (body: string) => new Request("https://x.test", { method: "POST", body });

  it("parses a valid body", async () => {
    expect(await parseJson(post('{"n":1}'), schema)).toEqual({ ok: true, data: { n: 1 } });
  });

  it("rejects an unreadable body with 400", async () => {
    const result = await parseJson(post("{nope"), schema);
    if (result.ok) throw new Error("expected a failure");
    expect(result.response.status).toBe(400);
    expect((await bodyOf(result.response)).error).toBe("Invalid JSON body");
  });

  it("treats an unreadable body as empty when it is optional", async () => {
    const lenient = z.object({ n: z.number().default(7) });
    expect(await parseJson(post(""), lenient, { optional: true })).toEqual({ ok: true, data: { n: 7 } });
  });
});

describe("parseQuery", () => {
  const schema = z.object({ q: first, tags: all, day: optional(isoDay) });

  it("reads single and repeated keys the same way", () => {
    const result = parseQuery(new URLSearchParams("q=a&q=b&tags=x&tags=&tags=y"), schema);
    expect(result).toEqual({ ok: true, data: { q: "a", tags: ["x", "y"], day: undefined } });
  });

  it("is happy with nothing at all", () => {
    expect(parseQuery(new URLSearchParams(), schema)).toEqual({
      ok: true,
      data: { q: undefined, tags: [], day: undefined },
    });
  });

  it("rejects a day that is not on the calendar", () => {
    const result = parseQuery(new URLSearchParams("day=2026-02-30"), schema);
    expect(result.ok).toBe(false);
  });
});

describe("httpUrl", () => {
  it.each(["https://letsrace.cz/x", "http://example.com"])("accepts %s", (url) => {
    expect(httpUrl.safeParse(url).success).toBe(true);
  });

  it.each(["javascript:alert(1)", "ftp://example.com", "not a url", "//example.com"])("rejects %s", (url) => {
    expect(httpUrl.safeParse(url).success).toBe(false);
  });
});
