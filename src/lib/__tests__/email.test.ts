import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readUnsubscribeToken, unsubscribeToken } from "@/lib/email/unsubscribe";
import { renderEmail, renderEmailText } from "@/lib/email/layout";

const ID = "3f1c2b9a-7d4e-4a1b-9c2d-0e5f6a7b8c9d";

describe("unsubscribe tokens", () => {
  beforeEach(() => {
    process.env.EMAIL_LINK_SECRET = "test-secret";
  });
  afterEach(() => {
    delete process.env.EMAIL_LINK_SECRET;
  });

  it("round-trips what it names", () => {
    const token = unsubscribeToken({ kind: "digest", id: ID })!;
    expect(readUnsubscribeToken(token)).toEqual({ kind: "digest", id: ID });
  });

  it("rejects a token that was tampered with or signed with another key", () => {
    const token = unsubscribeToken({ kind: "alert", id: ID })!;
    const [, sig] = token.split(".");
    const forged = `${Buffer.from(`plan.${ID}`).toString("base64url")}.${sig}`;
    expect(readUnsubscribeToken(forged)).toBeNull();
    process.env.EMAIL_LINK_SECRET = "another";
    expect(readUnsubscribeToken(token)).toBeNull();
  });

  it("needs a secret to issue anything", () => {
    delete process.env.EMAIL_LINK_SECRET;
    delete process.env.CRON_SECRET;
    expect(unsubscribeToken({ kind: "plan", id: ID })).toBeNull();
  });
});

describe("email layout", () => {
  const content = {
    locale: "cs",
    preheader: "Nové závody u Prahy",
    heading: "Nové závody <do> 50 km",
    sections: [{ races: [{ name: "Race & Ride", href: "https://x/e", date: "2026-10-03", meta: "Praha" }] }],
    reason: "Protože hlídáte Prahu.",
    manage: { label: "Nastavení", href: "https://x/s" },
    unsubscribe: { label: "Odhlásit", href: "https://x/u" },
  };

  it("escapes text and lays the race out on its day", () => {
    const html = renderEmail(content);
    expect(html).toContain("Nové závody &lt;do&gt; 50 km");
    expect(html).toContain("Race &amp; Ride");
    expect(html).toMatch(/>3<\/div>/);
    expect(html).toContain("říj");
  });

  it("has a plain-text twin with every link", () => {
    const text = renderEmailText(content);
    expect(text).toContain("Race & Ride");
    expect(text).toContain("https://x/e");
    expect(text).toContain("Odhlásit: https://x/u");
  });
});
