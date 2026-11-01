import { persistDevelopmentData, readDevelopmentData, writeDevelopmentData } from "./local-development-repository";
import type { PreviewProfileVisibility } from "./challenge-preview";
import type { SportInterest } from "./sports-catalogue";

export type DevelopmentProfile = {
  displayName: string;
  username: string;
  city: string;
  bio: string;
  visibility: PreviewProfileVisibility;
  skillLevels: Record<string, string>;
  shownSections: string[];
  selectedInterests: SportInterest[];
};

const profileKey = "athlete-profile";
const defaultProfile: DevelopmentProfile = {
  displayName: "",
  username: "",
  city: "",
  bio: "",
  visibility: "public",
  skillLevels: {},
  shownSections: ["About", "Sports", "Achievements"],
  selectedInterests: [
    { sportId: "football", role: "playing" },
    { sportId: "running", role: "playing" },
  ],
};
let profile = copyProfile(defaultProfile);

export async function hydrateDevelopmentProfile(): Promise<void> {
  profile = copyProfile(await readDevelopmentData(profileKey, defaultProfile));
}

export function getDevelopmentProfile(): DevelopmentProfile {
  return copyProfile(profile);
}

export function updateDevelopmentProfile(update: Partial<DevelopmentProfile>): void {
  profile = copyProfile({ ...profile, ...update });
  persistDevelopmentData(profileKey, profile);
}

export async function saveDevelopmentProfile(update: Partial<DevelopmentProfile>): Promise<DevelopmentProfile> {
  profile = copyProfile({ ...profile, ...update });
  await writeDevelopmentData(profileKey, profile);
  return getDevelopmentProfile();
}

export async function saveDevelopmentAthleteDetails(input: {
  displayName: string;
  username: string;
  city: string;
  bio: string;
}): Promise<void> {
  await saveDevelopmentProfile(input);
}

function copyProfile(value: DevelopmentProfile): DevelopmentProfile {
  return {
    ...value,
    skillLevels: { ...value.skillLevels },
    shownSections: [...value.shownSections],
    selectedInterests: value.selectedInterests.map((interest) => ({ ...interest })),
  };
}
