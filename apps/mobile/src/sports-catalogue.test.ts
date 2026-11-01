import { describe, expect, it } from "vitest";
import {
  findSport,
  normalizeSportTerm,
  searchSports,
  sportCategories,
  sportsCatalogue,
  toggleSportRole,
  type SportInterest,
} from "./sports-catalogue";

describe("sports catalogue", () => {
  it("provides a broad catalogue across every supported category", () => {
    expect(sportsCatalogue.length).toBeGreaterThan(120);
    expect(new Set(sportsCatalogue.map((sport) => sport.id)).size).toBe(sportsCatalogue.length);
    expect(new Set(sportsCatalogue.map((sport) => sport.category))).toEqual(new Set(sportCategories));
  });

  it.each([
    ["football", "soccer", "football"],
    ["pool", "billiards", "pool"],
    ["football", "association football", "football"],
    ["snooker", "snooker", "snooker"],
  ])("resolves canonical and alias terms: %s / %s", (canonical, alias, id) => {
    expect(findSport(canonical)?.id).toBe(id);
    expect(findSport(alias)?.id).toBe(id);
  });

  it("includes Pakistani favourites in the canonical catalogue", () => {
    const ids = new Set(sportsCatalogue.map((sport) => sport.id));
    for (const id of ["cricket", "field-hockey", "football", "squash", "badminton", "volleyball", "kabaddi", "wrestling", "snooker", "pool"]) {
      expect(ids.has(id), `expected catalogue entry ${id}`).toBe(true);
    }
  });

  it("filters by category and searches aliases without adding duplicate sports", () => {
    expect(searchSports("soccer").map((sport) => sport.id)).toEqual(["football"]);
    expect(searchSports("", "Combat sports").every((sport) => sport.category === "Combat sports")).toBe(true);
    expect(searchSports("not-a-real-sport")).toEqual([]);
  });

  it("keeps canonical names and aliases unambiguous across sports", () => {
    const termOwners = new Map<string, string>();
    for (const sport of sportsCatalogue) {
      for (const term of [sport.id.replace(/-/g, " "), sport.name, ...sport.aliases]) {
        const normalized = normalizeSportTerm(term);
        const existingOwner = termOwners.get(normalized);
        expect(existingOwner === undefined || existingOwner === sport.id, `ambiguous catalogue term "${term}"`).toBe(true);
        termOwners.set(normalized, sport.id);
      }
    }
  });

  it("only references valid parent disciplines", () => {
    const ids = new Set(sportsCatalogue.map((sport) => sport.id));
    for (const sport of sportsCatalogue) {
      if (sport.parentId) expect(ids.has(sport.parentId), `${sport.id} parent should exist`).toBe(true);
    }
  });

  it("toggles each sport-role pair once and supports multiple sports and roles", () => {
    const initial: SportInterest[] = [];
    const playing = toggleSportRole(initial, "football", "playing");
    expect(toggleSportRole(playing, "football", "playing")).toEqual([]);
    const multiple = toggleSportRole(
      toggleSportRole(playing, "football", "following"),
      "cricket",
      "playing",
    );
    expect(multiple).toEqual([
      { sportId: "football", role: "playing" },
      { sportId: "football", role: "following" },
      { sportId: "cricket", role: "playing" },
    ]);
  });

  it("keeps scoring and metrics sport-specific rather than assuming one shared format", () => {
    expect(findSport("cricket")?.metrics?.map((metric) => metric.id)).toContain("wickets");
    expect(findSport("running")?.metrics?.map((metric) => metric.id)).toContain("pace");
    expect(findSport("tennis")?.scoreFormat).toContain("Sets");
    expect(findSport("kabaddi")?.metrics).toBeUndefined();
  });
});
