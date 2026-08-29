import { describe, expect, it } from "vitest";
import { isWorkQueueEvent } from "@/lib/admin/data-quality";

describe("admin work queue", () => {
  it("keeps home-market races even without a website", () => {
    expect(
      isWorkQueueEvent({
        websiteUrl: null,
        registrationUrl: null,
        countryCode: "CZ",
      }),
    ).toBe(true);
    expect(
      isWorkQueueEvent({
        websiteUrl: null,
        registrationUrl: null,
        countryCode: "AT",
      }),
    ).toBe(true);
  });

  it("drops unlinked roadmap-market dumps and off-map countries", () => {
    expect(
      isWorkQueueEvent({
        websiteUrl: null,
        registrationUrl: null,
        countryCode: "FR",
      }),
    ).toBe(false);
    expect(
      isWorkQueueEvent({
        websiteUrl: "https://www.federciclismo.it/it/event/1",
        registrationUrl: null,
        countryCode: "FR",
      }),
    ).toBe(false);
    // Italy lists on its federation's race pages now.
    expect(
      isWorkQueueEvent({
        websiteUrl: null,
        registrationUrl: null,
        countryCode: "IT",
      }),
    ).toBe(true);
    expect(
      isWorkQueueEvent({
        websiteUrl: "https://letour.fr",
        registrationUrl: null,
        countryCode: "FR",
      }),
    ).toBe(false);
    expect(
      isWorkQueueEvent({
        websiteUrl: "https://maratona.it",
        registrationUrl: null,
        countryCode: "IT",
      }),
    ).toBe(true);
  });
});
