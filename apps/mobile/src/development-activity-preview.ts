import { persistDevelopmentData, readDevelopmentData } from "./local-development-repository";

export type CreatedActivityPreview = {
  id: string;
  title: string;
  sportId: string;
  time: string;
  place: string;
  createdAt: string;
};

export type DevelopmentActivityState = {
  joinedDemoActivityIds: string[];
  savedDemoVenueIds: string[];
  createdActivities: CreatedActivityPreview[];
};

const activityKey = "activity-previews";
const emptyState = (): DevelopmentActivityState => ({
  joinedDemoActivityIds: [],
  savedDemoVenueIds: [],
  createdActivities: [],
});
let state = emptyState();

export async function hydrateDevelopmentActivities(): Promise<void> {
  const saved = await readDevelopmentData(activityKey, emptyState());
  state = {
    joinedDemoActivityIds: Array.isArray(saved.joinedDemoActivityIds) ? saved.joinedDemoActivityIds : [],
    savedDemoVenueIds: Array.isArray(saved.savedDemoVenueIds) ? saved.savedDemoVenueIds : [],
    createdActivities: Array.isArray(saved.createdActivities) ? saved.createdActivities : [],
  };
}

export function getDevelopmentActivityState(): DevelopmentActivityState {
  return {
    joinedDemoActivityIds: [...state.joinedDemoActivityIds],
    savedDemoVenueIds: [...state.savedDemoVenueIds],
    createdActivities: state.createdActivities.map((activity) => ({ ...activity })),
  };
}

export function toggleJoinedDemoActivity(id: string): DevelopmentActivityState {
  state = {
    ...state,
    joinedDemoActivityIds: toggleId(state.joinedDemoActivityIds, id),
  };
  persistState();
  return getDevelopmentActivityState();
}

export function toggleSavedDemoVenue(id: string): DevelopmentActivityState {
  state = {
    ...state,
    savedDemoVenueIds: toggleId(state.savedDemoVenueIds, id),
  };
  persistState();
  return getDevelopmentActivityState();
}

export function saveCreatedActivityPreview(input: Omit<CreatedActivityPreview, "id" | "createdAt">): CreatedActivityPreview {
  const activity: CreatedActivityPreview = {
    ...input,
    id: `local-activity-${Date.now()}-${state.createdActivities.length + 1}`,
    createdAt: new Date().toISOString(),
  };
  state = { ...state, createdActivities: [activity, ...state.createdActivities] };
  persistState();
  return { ...activity };
}

export function resetDevelopmentActivitiesForTests(): void {
  state = emptyState();
  persistState();
}

function persistState(): void {
  persistDevelopmentData(activityKey, state);
}

function toggleId(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}
