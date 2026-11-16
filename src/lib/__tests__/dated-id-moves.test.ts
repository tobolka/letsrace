import { describe, expect, it } from "vitest";
import { planDateMoves, readOervCalendar, splitDatedKey, OERV_ID, type HeldRace } from "@/lib/catalog/dated-id-moves";

const ARLBERG = "12B0C9A21F7641899018A28997A3897D";
const KAMPTAL = "084A53BF1AF64FFE8BA58D855E127EAD";
const today = "2026-11-16";

const race = (eventId: string, name: string, startDate: string, keys: [string, string][], extra: Partial<HeldRace> = {}): HeldRace => ({
  eventId,
  name,
  startDate,
  visibility: "public",
  keys: keys.map(([id, date]) => ({ id, date })),
  ...extra,
});

describe("splitDatedKey", () => {
  it("reads the federation id and the day from a Cycling Austria key", () => {
    expect(splitDatedKey(`oerv-${ARLBERG}-2027-07-31`, "oerv", OERV_ID)).toEqual({ id: ARLBERG, date: "2027-07-31" });
  });
  it("ignores keys made from a name, which carry no federation number", () => {
    expect(splitDatedKey("oerv-arlberg giro-2027-07-31", "oerv", OERV_ID)).toBeNull();
    expect(splitDatedKey(`radsport-1-2027-07-31`, "oerv", OERV_ID)).toBeNull();
  });
});

describe("planDateMoves", () => {
  it("folds the old-day race into the new-day one when the calendar moved it", () => {
    const { moves, heldBack } = planDateMoves(
      [{ id: ARLBERG, date: "2027-07-31", name: "Arlberg Giro Kriterium" }],
      [
        race("old", "Arlberg Giro Kriterium", "2027-06-19", [[ARLBERG, "2027-06-19"]]),
        race("new", "Arlberg Giro Kriterium", "2027-07-31", [[ARLBERG, "2027-07-31"]]),
      ],
      today,
    );
    expect(moves).toEqual([
      expect.objectContaining({ dropId: "old", keepId: "new", oldDate: "2027-06-19", newDate: "2027-07-31" }),
    ]);
    expect(heldBack).toEqual([]);
  });

  it("keeps two races of one federation id on consecutive days apart when both are listed", () => {
    const { moves, heldBack } = planDateMoves(
      [
        { id: KAMPTAL, date: "2027-04-03", name: "35. KTM Kamptal Trophy - Youngsters & UCI Junior Series" },
        { id: KAMPTAL, date: "2027-04-04", name: "35. KTM Kamptal Trophy - UCI XCO C1" },
      ],
      [
        race("sat", "35. KTM Kamptal Trophy - Youngsters & UCI Junior Series", "2027-04-03", [[KAMPTAL, "2027-04-03"]]),
        race("sun", "35. KTM Kamptal Trophy - UCI XCO C1", "2027-04-04", [[KAMPTAL, "2027-04-04"]]),
      ],
      today,
    );
    expect(moves).toEqual([]);
    expect(heldBack).toEqual([]);
  });

  it("never merges an old-day race whose name the calendar no longer shows", () => {
    const { moves, heldBack } = planDateMoves(
      [{ id: KAMPTAL, date: "2027-04-04", name: "35. KTM Kamptal Trophy - UCI XCO C1" }],
      [
        race("sat", "35. KTM Kamptal Trophy - Youngsters & UCI Junior Series", "2027-04-03", [[KAMPTAL, "2027-04-03"]]),
        race("sun", "35. KTM Kamptal Trophy - UCI XCO C1", "2027-04-04", [[KAMPTAL, "2027-04-04"]]),
      ],
      today,
    );
    expect(moves).toEqual([]);
    expect(heldBack).toEqual([expect.objectContaining({ eventId: "sat", reason: "name_differs" })]);
  });

  it("holds back when the same name is listed on two new days", () => {
    const { moves, heldBack } = planDateMoves(
      [
        { id: ARLBERG, date: "2027-07-31", name: "Arlberg Giro Kriterium" },
        { id: ARLBERG, date: "2027-08-01", name: "Arlberg Giro Kriterium" },
      ],
      [race("old", "Arlberg Giro Kriterium", "2027-06-19", [[ARLBERG, "2027-06-19"]])],
      today,
    );
    expect(moves).toEqual([]);
    expect(heldBack).toEqual([expect.objectContaining({ reason: "several_new_days" })]);
  });

  it("waits while the new day has no race yet, and leaves a hidden one to a person", () => {
    const listed = [{ id: ARLBERG, date: "2027-07-31", name: "Arlberg Giro Kriterium" }];
    const old = race("old", "Arlberg Giro Kriterium", "2027-06-19", [[ARLBERG, "2027-06-19"]]);
    expect(planDateMoves(listed, [old], today).heldBack).toEqual([expect.objectContaining({ reason: "new_day_not_in_catalogue" })]);
    const hidden = race("new", "Arlberg Giro Kriterium", "2027-07-31", [[ARLBERG, "2027-07-31"]], { visibility: "hidden" });
    const plan = planDateMoves(listed, [old, hidden], today);
    expect(plan.moves).toEqual([]);
    expect(plan.heldBack).toEqual([expect.objectContaining({ reason: "new_day_race_hidden" })]);
  });

  it("does not choose between two public races on the new day", () => {
    const plan = planDateMoves(
      [{ id: ARLBERG, date: "2027-07-31", name: "Arlberg Giro Kriterium" }],
      [
        race("old", "Arlberg Giro Kriterium", "2027-06-19", [[ARLBERG, "2027-06-19"]]),
        race("a", "Arlberg Giro Kriterium", "2027-07-31", [[ARLBERG, "2027-07-31"]]),
        race("b", "Arlberg Giro", "2027-07-31", [[ARLBERG, "2027-07-31"]]),
      ],
      today,
    );
    expect(plan.moves).toEqual([]);
    expect(plan.heldBack).toEqual([expect.objectContaining({ reason: "several_races_on_new_day" })]);
  });

  it("respects fields a person locked on the old-day race", () => {
    const plan = planDateMoves(
      [{ id: ARLBERG, date: "2027-07-31", name: "Arlberg Giro Kriterium" }],
      [
        race("old", "Arlberg Giro Kriterium", "2027-06-19", [[ARLBERG, "2027-06-19"]], { lockedFields: ["start_date"] }),
        race("new", "Arlberg Giro Kriterium", "2027-07-31", [[ARLBERG, "2027-07-31"]]),
      ],
      today,
    );
    expect(plan.moves).toEqual([]);
    expect(plan.heldBack).toEqual([expect.objectContaining({ reason: "locked" })]);
  });

  it("leaves past editions alone, even under the same federation id", () => {
    const plan = planDateMoves(
      [{ id: ARLBERG, date: "2027-07-31", name: "Arlberg Giro Kriterium" }],
      [
        race("2026", "Arlberg Giro Kriterium", "2026-07-25", [[ARLBERG, "2026-07-25"]]),
        race("new", "Arlberg Giro Kriterium", "2027-07-31", [[ARLBERG, "2027-07-31"]]),
      ],
      today,
    );
    expect(plan).toEqual({ moves: [], heldBack: [] });
  });

  it("leaves a race over several days alone when the calendar lists one of its days", () => {
    const plan = planDateMoves(
      [{ id: ARLBERG, date: "2027-07-31", name: "Arlberg Giro Kriterium" }],
      [race("weekend", "Arlberg Giro Kriterium", "2027-07-30", [[ARLBERG, "2027-07-30"]], { endDate: "2027-08-01" })],
      today,
    );
    expect(plan).toEqual({ moves: [], heldBack: [] });
  });

  it("does not carry a race across the turn of the year", () => {
    const plan = planDateMoves(
      [{ id: ARLBERG, date: "2028-01-08", name: "Arlberg Giro Kriterium" }],
      [
        race("old", "Arlberg Giro Kriterium", "2027-12-18", [[ARLBERG, "2027-12-18"]]),
        race("new", "Arlberg Giro Kriterium", "2028-01-08", [[ARLBERG, "2028-01-08"]]),
      ],
      today,
    );
    expect(plan.moves).toEqual([]);
    expect(plan.heldBack).toEqual([expect.objectContaining({ reason: "other_season" })]);
  });

  it("leaves a race alone once it holds the new day, as after a merge by hand", () => {
    const plan = planDateMoves(
      [{ id: ARLBERG, date: "2027-07-31", name: "Arlberg Giro Kriterium" }],
      [race("kept", "Arlberg Giro Kriterium", "2027-07-31", [[ARLBERG, "2027-06-19"], [ARLBERG, "2027-07-31"]])],
      today,
    );
    expect(plan).toEqual({ moves: [], heldBack: [] });
  });

  it("ignores hidden old-day races and ids the calendar no longer lists at all", () => {
    const plan = planDateMoves(
      [{ id: ARLBERG, date: "2027-07-31", name: "Arlberg Giro Kriterium" }],
      [
        race("hiddenOld", "Arlberg Giro Kriterium", "2027-06-19", [[ARLBERG, "2027-06-19"]], { visibility: "hidden" }),
        race("new", "Arlberg Giro Kriterium", "2027-07-31", [[ARLBERG, "2027-07-31"]]),
        race("gone", "Kirschblütenrennen", "2027-04-25", [["61328196B9204EA8AB7C2E570BF6AF80", "2027-04-25"]]),
      ],
      today,
    );
    expect(plan).toEqual({ moves: [], heldBack: [] });
  });
});

const card = (id: string, date: string, name: string) => `
<div data-date="${date}" class="Tirol" data-disziplin="Straße">
  <a class="om_card" href="/kalender/event?id=${id}"><h3>${name}</h3></a>
  <div class="uk-heading-small">${date}</div>
</div>`;
const page = (n: number, last: number, cards: string) =>
  `<html><body>${cards}${Array.from({ length: last }, (_, i) => `<a href="/kalender?view=events&amp;page=${i + 1}">${i + 1}</a>`).join("")}</body></html>`;

describe("readOervCalendar", () => {
  const site = (pages: Record<number, { status?: number; html: string }>) => async (url: string) => {
    const n = Number(new URL(url).searchParams.get("page"));
    const got = pages[n] ?? { html: "<html></html>" };
    return { status: got.status ?? 200, html: got.html };
  };

  it("reads every page and proves the end with an empty one", async () => {
    const read = await readOervCalendar(site({
      1: { html: page(1, 2, card(ARLBERG, "2027-07-31", "Arlberg Giro Kriterium")) },
      2: { html: page(2, 2, card(KAMPTAL, "2027-04-04", "35. KTM Kamptal Trophy - UCI XCO C1")) },
    }));
    expect(read).toEqual({
      complete: true,
      pages: 2,
      entries: [
        { id: ARLBERG, date: "2027-07-31", name: "Arlberg Giro Kriterium" },
        { id: KAMPTAL, date: "2027-04-04", name: "35. KTM Kamptal Trophy - UCI XCO C1" },
      ],
    });
  });

  it("is not a full read when a page fails or comes back empty", async () => {
    const failed = await readOervCalendar(site({
      1: { html: page(1, 2, card(ARLBERG, "2027-07-31", "Arlberg Giro Kriterium")) },
      2: { status: 503, html: "" },
    }));
    expect(failed).toMatchObject({ complete: false });
    const empty = await readOervCalendar(site({ 1: { html: page(1, 2, card(ARLBERG, "2027-07-31", "Arlberg Giro Kriterium")) } }));
    expect(empty).toMatchObject({ complete: false });
  });

  it("is not a full read when the calendar goes on past the last page it names", async () => {
    const read = await readOervCalendar(site({
      1: { html: page(1, 1, card(ARLBERG, "2027-07-31", "Arlberg Giro Kriterium")) },
      2: { html: page(2, 1, card(KAMPTAL, "2027-04-04", "35. KTM Kamptal Trophy - UCI XCO C1")) },
    }));
    expect(read).toMatchObject({ complete: false });
  });
});
