import { demoActivities, demoCommunities } from "./demo-data";
import { previewTrainers } from "./sports-preview-data";
import { getChallengeStatus, listPreviewChallenges } from "./challenge-preview";
import { listPublicPreviewVenues } from "./venue-preview";
import { findSport, searchSports } from "./sports-catalogue";
import type { CatalogueSport, SportCategory } from "./sports-catalogue";

export const searchCategories = [
  { id: "all", label: "All" },
  { id: "players", label: "Players" },
  { id: "teams", label: "Teams & groups" },
  { id: "sports", label: "Sports" },
  { id: "venues", label: "Venues" },
  { id: "events", label: "Events & sessions" },
  { id: "challenges", label: "Challenges" },
  { id: "coaches", label: "Coaches" },
  { id: "classes", label: "Fitness classes" },
] as const;

export type SearchCategory = (typeof searchCategories)[number]["id"];

export type UniversalSearchQuery = {
  text: string;
  category: SearchCategory;
  sport?: string;
  area?: string;
  skillLevel?: string;
  date?: string;
  maxPrice?: number;
  availableOnly?: boolean;
  sportCategory?: SportCategory;
  popularSportsOnly?: boolean;
};

export type UniversalSearchResult = {
  id: string;
  category: Exclude<SearchCategory, "all" | "players" | "classes">;
  title: string;
  detail: string;
  searchText: string;
  sport: string;
  sportIds: string[];
  area: string;
  sportIcon?: CatalogueSport["icon"];
  sportCategory?: CatalogueSport["category"];
  popular?: boolean;
  skillLevel?: string;
  date?: string;
  available?: boolean;
  price?: number;
};

const catalogueResults: UniversalSearchResult[] = searchSports().map((sport) => ({
  id: sport.id,
  category: "sports",
  title: sport.name,
  detail: `${sport.category}${sport.parentId ? ` · Discipline of ${findSport(sport.parentId)?.name ?? sport.parentId}` : ""} · catalogue only`,
  searchText: `${sport.name} ${sport.id.replace(/-/g, " ")} ${sport.aliases.join(" ")}`,
  sport: sport.name,
  sportIds: [sport.id],
  area: "",
  sportIcon: sport.icon,
  sportCategory: sport.category,
  popular: sport.popular,
}));

const activityResults: UniversalSearchResult[] = demoActivities.map((activity) => {
  const sport = findSport(activity.sportId);
  return {
    id: activity.id,
    category: "events",
    title: activity.title,
    detail: `${sport?.name ?? activity.sport} · ${activity.level} · ${activity.venue} · ${activity.time} · ${activity.spots} spots · demo`,
    searchText: `${activity.title} ${sport?.name ?? activity.sport} ${sport?.aliases.join(" ") ?? ""} ${activity.venue} ${activity.time} ${activity.level} ${activity.spots > 0 ? "available open spots" : "full"}`,
    sport: sport?.name ?? activity.sport,
    sportIds: [activity.sportId],
    area: activity.venue,
    skillLevel: activity.level,
    date: activity.time,
    available: activity.spots > 0,
  };
});

const venueResults: UniversalSearchResult[] = listPublicPreviewVenues().map((venue) => {
  const sports = venue.sportIds.map(findSport).filter((sport): sport is CatalogueSport => Boolean(sport));
  const price = venue.facilities.length ? Math.min(...venue.facilities.map((facility) => facility.pricePerHour)) : undefined;
  return {
    id: venue.slug,
    category: "venues",
    title: venue.name,
    detail: `${sports.map((sport) => sport.name).join(" · ")} · ${venue.area} · illustrative sample · unverified`,
    searchText: `${venue.name} ${sports.flatMap((sport) => [sport.name, ...sport.aliases]).join(" ")} ${venue.facilities.map((facility) => facility.resourceType).join(" ")} ${venue.area}`,
    sport: sports.map((sport) => sport.name).join(" · "),
    sportIds: venue.sportIds,
    area: venue.area,
    price,
  };
});

const groupResults: UniversalSearchResult[] = demoCommunities.map((community) => {
  const sport = findSport(community.sportId);
  return {
    id: community.id,
    category: "teams",
    title: community.name,
    detail: `${sport?.name ?? community.sport} · sample group · no group page available`,
    searchText: `${community.name} ${sport?.name ?? community.sport} ${sport?.aliases.join(" ") ?? ""} team group community`,
    sport: sport?.name ?? community.sport,
    sportIds: [community.sportId],
    area: "Lahore",
  };
});

const coachResults: UniversalSearchResult[] = previewTrainers.map((trainer) => {
  const sports = trainer.sportIds.map(findSport).filter((sport): sport is CatalogueSport => Boolean(sport));
  return {
    id: trainer.id,
    category: "coaches",
    title: trainer.name,
    detail: `${trainer.specialties.join(" · ")} · ${trainer.area} · sample profile`,
    searchText: `${trainer.name} personal trainer coach ${trainer.specialties.join(" ")} ${sports.flatMap((sport) => [sport.name, ...sport.aliases]).join(" ")} ${trainer.area}`,
    sport: sports.map((sport) => sport.name).join(" · "),
    sportIds: trainer.sportIds,
    area: trainer.area,
  };
});

const results = [...catalogueResults, ...activityResults, ...venueResults, ...groupResults, ...coachResults];
const ignoredTerms = new Set(["in", "near", "me", "who", "play", "players", "find", "the", "for"]);

function normalizedTerms(text: string): string[] {
  return text.toLowerCase().trim().split(/\s+/).filter((term) => term && !ignoredTerms.has(term));
}

function termMatches(term: string, haystack: string): boolean {
  if (haystack.includes(term)) return true;
  if (term === "tonight") return haystack.includes("evening") || haystack.includes("today");
  if (term === "courts" || term === "court") return haystack.includes("court") || haystack.includes("racket");
  if (term === "trainers") return haystack.includes("trainer") || haystack.includes("coach");
  if (term === "gyms") return haystack.includes("gym");
  return false;
}

export function searchUniversalDirectory(query: UniversalSearchQuery): UniversalSearchResult[] {
  const terms = normalizedTerms(query.text);
  const sportFilter = query.sport?.trim();
  const canonicalSportId = sportFilter ? findSport(sportFilter)?.id : undefined;
  const sport = sportFilter?.toLowerCase();
  const area = query.area?.toLowerCase().trim();
  const skillLevel = query.skillLevel?.toLowerCase().trim();
  const date = query.date?.toLowerCase().trim();

  const challengeResults: UniversalSearchResult[] = listPreviewChallenges()
    .filter((challenge) => challenge.audience === "public" && getChallengeStatus(challenge) !== "cancelled" && getChallengeStatus(challenge) !== "expired")
    .map((challenge) => {
      const challengeSport = findSport(challenge.sportId);
      return {
        id: challenge.id,
        category: "challenges",
        title: challenge.title,
        detail: `${challengeSport?.name ?? "Sport unavailable"} · ${challenge.audience.toUpperCase()} · ${getChallengeStatus(challenge)} · local preview`,
        searchText: `${challenge.title} ${challenge.description} ${challengeSport?.name ?? ""} ${challengeSport?.aliases.join(" ") ?? ""} ${challenge.eligibilityRules} ${challenge.completionRules}`,
        sport: challengeSport?.name ?? "",
        sportIds: [challenge.sportId],
        area: "",
        date: `${challenge.startsOn} ${challenge.endsOn}`,
      };
    });

  return [...results, ...challengeResults].filter((result) => {
    if (query.category !== "all" && result.category !== query.category) return false;
    if (query.sportCategory && result.sportCategory !== query.sportCategory) return false;
    if (query.popularSportsOnly && result.popular !== true) return false;
    if (terms.length && !terms.every((term) => termMatches(term, result.searchText.toLowerCase()))) return false;
    if (sport && sport !== "all" && !(canonicalSportId
      ? result.sportIds.includes(canonicalSportId)
      : result.sport.toLowerCase().includes(sport))) return false;
    if (area && !result.area.toLowerCase().includes(area)) return false;
    if (skillLevel && (!result.skillLevel || !result.skillLevel.toLowerCase().includes(skillLevel))) return false;
    if (date && (!result.date || !result.date.toLowerCase().includes(date))) return false;
    if (query.availableOnly && result.available !== true) return false;
    if (query.maxPrice !== undefined && (result.price === undefined || result.price > query.maxPrice)) return false;
    return true;
  });
}

export function getSportIdForFilter(sport: string): string | undefined {
  return findSport(sport)?.id;
}

export { findSport };
