import { getPopularSports } from "./sports-catalogue";

export type Sport = {
  id: string;
  name: string;
  glyph: string;
  background: "green" | "blue" | "orange";
};

export type DemoActivity = {
  id: string;
  sportId: string;
  title: string;
  sport: string;
  venue: string;
  time: string;
  spots: number;
  totalSpots: number;
  level: string;
  glyph: string;
  color: "green" | "blue" | "orange";
};

export type DemoVenue = {
  id: string;
  sportIds: string[];
  facilityTypes: string[];
  name: string;
  sport: string;
  area: string;
  price: string;
  glyph: string;
  color: "green" | "blue" | "orange";
};

const sportArt: Record<string, Pick<Sport, "glyph" | "background">> = {
  football: { glyph: "football", background: "green" },
  cricket: { glyph: "cricket", background: "orange" },
  badminton: { glyph: "badminton", background: "blue" },
  running: { glyph: "running", background: "green" },
  basketball: { glyph: "basketball", background: "orange" },
  "field-hockey": { glyph: "hockey", background: "green" },
  squash: { glyph: "squash", background: "blue" },
  volleyball: { glyph: "volleyball", background: "orange" },
};

const featuredSportIds = new Set(["football", "cricket", "badminton", "running", "basketball"]);

export const demoSports: Sport[] = getPopularSports().filter((sport) => featuredSportIds.has(sport.id)).map((sport) => ({
  id: sport.id,
  name: sport.name,
  ...(sportArt[sport.id] ?? { glyph: sport.icon, background: "green" as const }),
}));

export const demoActivities: DemoActivity[] = [
  {
    id: "activity-1",
    sportId: "football",
    title: "Evening five-a-side",
    sport: "Football",
    venue: "Model Town Sports Club",
    time: "Today · 6:30 PM",
    spots: 3,
    totalSpots: 10,
    level: "All levels",
    glyph: "football",
    color: "green",
  },
  {
    id: "activity-2",
    sportId: "running",
    title: "Easy Sunday run",
    sport: "Running",
    venue: "Jilani Park",
    time: "Sun · 7:00 AM",
    spots: 5,
    totalSpots: 8,
    level: "Easy pace",
    glyph: "running",
    color: "blue",
  },
  {
    id: "activity-3",
    sportId: "badminton",
    title: "Doubles after work",
    sport: "Badminton",
    venue: "Smash Arena, Gulberg",
    time: "Tomorrow · 7:00 PM",
    spots: 1,
    totalSpots: 4,
    level: "Intermediate",
    glyph: "badminton",
    color: "orange",
  },
];

export const demoVenues: DemoVenue[] = [
  { id: "venue-1", sportIds: ["football", "futsal"], facilityTypes: ["ground", "sports club"], name: "Model Town Sports Club", sport: "Football · Futsal", area: "Model Town", price: "Demo · PKR 4,000 / hour", glyph: "football", color: "green" },
  { id: "venue-2", sportIds: ["badminton"], facilityTypes: ["court", "arena"], name: "Smash Arena", sport: "Badminton", area: "Gulberg III", price: "Demo · PKR 1,800 / hour", glyph: "badminton", color: "blue" },
  { id: "venue-3", sportIds: ["cricket"], facilityTypes: ["nets"], name: "City Cricket Nets", sport: "Cricket", area: "Johar Town", price: "Demo · PKR 2,500 / hour", glyph: "cricket", color: "orange" },
  { id: "venue-gym-demo", sportIds: ["fitness-training", "weightlifting"], facilityTypes: ["gym", "strength training"], name: "Strength Studio · Fictional Demo", sport: "Fitness training · Weightlifting", area: "Gulberg · sample area", price: "Illustrative · PKR 3,200 / hour", glyph: "G", color: "green" },
];

export const demoCommunities = [
  { id: "community-1", sportId: "running", name: "Lahore Weekend Runners", sport: "Running", members: "1.2k", glyph: "running", color: "green" as const },
  { id: "community-2", sportId: "futsal", name: "Lahore Futsal Crew", sport: "Football", members: "840", glyph: "football", color: "blue" as const },
  { id: "community-3", sportId: "cricket", name: "Cricket After Hours", sport: "Cricket", members: "560", glyph: "cricket", color: "orange" as const },
];
