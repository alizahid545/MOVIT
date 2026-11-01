import {
  athleteProfileSchema,
  type AthleteProfileInput,
} from "@moveit/shared";
import { createAthleteProfileRepository, SUPABASE_SETUP_ERROR } from "@moveit/supabase";
import { supabase } from "./supabase";

export type AthleteProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  city: string;
  visibility: "public" | "private";
  avatar_url: string | null;
  sports_interests: string[];
  fitness_goals: string[];
  created_at: string;
  updated_at: string;
};

function client() {
  if (!supabase) throw new Error(SUPABASE_SETUP_ERROR);
  return supabase;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await client().auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Sign in to view and edit your account profile.");
  return data.user.id;
}

export async function loadMyAthleteProfile(): Promise<AthleteProfile> {
  const db = client();
  const profile = await createAthleteProfileRepository(db).loadMyProfile();
  const [preferencesResult, goalsResult] = await Promise.all([
    db
      .from("profiles")
      .select("avatar_url,sports_interests")
      .eq("id", profile.id)
      .maybeSingle(),
    db
      .from("profile_fitness_goals")
      .select("fitness_goals")
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  if (preferencesResult.error) throw new Error(preferencesResult.error.message);
  if (goalsResult.error) throw new Error(goalsResult.error.message);
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.displayName,
    bio: profile.bio,
    city: profile.city,
    visibility: profile.visibility,
    avatar_url: preferencesResult.data?.avatar_url ?? null,
    sports_interests: preferencesResult.data?.sports_interests ?? [],
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    fitness_goals: goalsResult.data?.fitness_goals ?? [],
  };
}

export async function saveMyAthleteProfile(
  input: Omit<AthleteProfileInput, "avatarUrl"> & { avatarUrl: string },
): Promise<AthleteProfile> {
  const db = client();
  const userId = await currentUserId();
  const profile = athleteProfileSchema.parse(input);
  const { data, error } = await db.rpc("save_my_athlete_profile", {
    p_username: profile.username,
    p_display_name: profile.displayName,
    p_bio: profile.bio,
    p_city: profile.city,
    p_avatar_url: profile.avatarUrl,
    p_sports_interests: profile.sportsInterests,
    p_fitness_goals: profile.fitnessGoals,
  })
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("That username is already in use.");
    throw new Error(error.message);
  }
  return data as AthleteProfile;
}
