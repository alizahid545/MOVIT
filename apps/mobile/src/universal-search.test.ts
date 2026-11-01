import { describe, expect, it } from "vitest";
import { searchUniversalDirectory } from "./universal-search";

describe("universal sports directory search", () => {
  it.each([
    ["basketball", "sports", "Basketball"],
    ["football tonight", "events", "Evening five-a-side"],
    ["personal trainer", "coaches", "Demo Coach A"],
    ["courts near me", "venues", "Smash Arena"],
    ["players who play badminton", "sports", "Badminton"],
  ])("finds available demo data for %s", (text, category, title) => {
    const matches = searchUniversalDirectory({
      text,
      category: category as "sports" | "events" | "coaches" | "venues",
    });
    expect(matches.some((match) => match.title === title)).toBe(true);
  });

  it("filters event previews by sport, area, skill, date, and open spots", () => {
    const matches = searchUniversalDirectory({
      text: "",
      category: "events",
      sport: "Running",
      area: "Jilani",
      skillLevel: "Easy",
      date: "Sun",
      availableOnly: true,
    });
    expect(matches.map((match) => match.title)).toEqual(["Easy Sunday run"]);
  });

  it("filters venue previews by maximum listed sample price", () => {
    const matches = searchUniversalDirectory({
      text: "",
      category: "venues",
      maxPrice: 2000,
    });
    expect(matches.map((match) => match.title)).toEqual(["Smash Arena"]);
  });

  it("does not fabricate searchable players or classes", () => {
    expect(searchUniversalDirectory({ text: "badminton", category: "players" })).toEqual([]);
    expect(searchUniversalDirectory({ text: "fitness", category: "classes" })).toEqual([]);
  });

  it("finds sports by aliases and distinguishes catalogue results from demo listings", () => {
    const footballResults = searchUniversalDirectory({ text: "soccer", category: "sports" });
    expect(footballResults.map((result) => result.id)).toContain("football");
    expect(footballResults.find((result) => result.id === "football")?.sportCategory).toBe("Team sports");
    expect(searchUniversalDirectory({ text: "ice hockey", category: "sports" }).map((result) => result.id)).toContain("ice-hockey");
  });

  it("filters by canonical sport identifiers and alias names", () => {
    const byId = searchUniversalDirectory({ text: "", category: "events", sport: "football" });
    const byAlias = searchUniversalDirectory({ text: "", category: "events", sport: "soccer" });
    expect(byId.map((result) => result.id)).toEqual(byAlias.map((result) => result.id));
  });
});
