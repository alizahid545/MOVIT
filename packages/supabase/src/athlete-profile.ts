import {
  avatarUploadSchema,
  athleteOnboardingStateSchema,
  athleteOnboardingStepSchema,
  athletePreferencesSchema,
  profileSchema,
  sportPreferencesInputSchema,
  type AthleteProfile,
  type AthleteOnboardingState,
  type AthleteOnboardingStep,
  type AthletePreferencesInput,
  type ProfileInput,
  type SportPreference,
  type SportPreferenceInput,
} from "@moveit/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_BUCKET = "moveit-avatars";

export type AvatarFile = {
  bytes: Uint8Array;
  mimeType: string;
};

export type ProfileRepositoryErrorCode =
  | "AUTH_REQUIRED"
  | "PROFILE_NOT_FOUND"
  | "VALIDATION"
  | "USERNAME_TAKEN"
  | "AVATAR_INVALID"
  | "AVATAR_UPLOAD_FAILED"
  | "AVATAR_SAVE_FAILED"
  | "AVATAR_DELETE_FAILED"
  | "AVATAR_CLEANUP_FAILED"
  | "PROFILE_SAVE_FAILED"
  | "PROFILE_LOAD_FAILED"
  | "SPORT_PREFERENCES_LOAD_FAILED"
  | "SPORT_PREFERENCES_SAVE_FAILED"
  | "ATHLETE_PREFERENCES_LOAD_FAILED"
  | "ATHLETE_PREFERENCES_SAVE_FAILED"
  | "ONBOARDING_LOAD_FAILED"
  | "ONBOARDING_SAVE_FAILED";

export class ProfileRepositoryError extends Error {
  constructor(
    readonly code: ProfileRepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProfileRepositoryError";
  }
}

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  city: string;
  visibility: "public" | "private";
  avatar_object_path: string | null;
  avatar_url: string | null;
  discovery_radius_km: number | null;
  created_at: string;
  updated_at: string;
};

type SportPreferenceRow = {
  sport_id: string;
  skill_level: SportPreference["skillLevel"];
  is_preferred: boolean;
};

type FitnessGoalsRow = {
  fitness_goals: string[];
};

type OnboardingRow = {
  athlete_onboarding_version: number;
  athlete_onboarding_step: AthleteOnboardingState["step"];
  athlete_onboarding_completed_at: string | null;
};

const profileColumns =
  "id,username,display_name,bio,city,visibility,avatar_object_path,avatar_url,discovery_radius_km,created_at,updated_at";

function isUsernameConflict(error: { code?: string; constraint?: string; message?: string; details?: string }) {
  const description = `${error.constraint ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "23505" && description.includes("username");
}

export function createAthleteProfileRepository(
  supabase: SupabaseClient,
  createObjectId: () => string = () => globalThis.crypto.randomUUID(),
) {
  async function currentUserId(): Promise<string> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new ProfileRepositoryError(
        "AUTH_REQUIRED",
        "Sign in to view and edit your MOVEIT profile.",
        error ? { cause: error } : undefined,
      );
    }
    return data.user.id;
  }

  async function loadProfile(userId: string): Promise<AthleteProfile> {
    const { data, error } = await supabase
      .from("profiles")
      .select(profileColumns)
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      throw new ProfileRepositoryError("PROFILE_LOAD_FAILED", error.message, { cause: error });
    }
    if (!data) {
      throw new ProfileRepositoryError("PROFILE_NOT_FOUND", "Your MOVEIT profile is not available.");
    }
    return toProfile(data as ProfileRow);
  }

  function toProfile(row: ProfileRow): AthleteProfile {
    const avatarPublicUrl = row.avatar_object_path
      ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(row.avatar_object_path).data.publicUrl
      : row.avatar_url;

    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      bio: row.bio,
      city: row.city,
      avatarObjectPath: row.avatar_object_path,
      avatarPublicUrl,
      visibility: row.visibility,
      discoveryRadiusKm: row.discovery_radius_km,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async function updateAvatarReference(userId: string, objectPath: string | null) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_object_path: objectPath, avatar_url: null })
      .eq("id", userId)
      .select(profileColumns)
      .maybeSingle();
    if (error) {
      throw new ProfileRepositoryError("AVATAR_SAVE_FAILED", error.message, { cause: error });
    }
    if (!data) {
      throw new ProfileRepositoryError("PROFILE_NOT_FOUND", "Your MOVEIT profile is not available.");
    }
    return toProfile(data as ProfileRow);
  }

  async function loadMySportPreferences(): Promise<SportPreference[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("profile_sports_preferences")
      .select("sport_id,skill_level,is_preferred")
      .eq("user_id", userId);
    if (error) {
      throw new ProfileRepositoryError(
        "SPORT_PREFERENCES_LOAD_FAILED",
        error.message,
        { cause: error },
      );
    }
    return (data as SportPreferenceRow[]).map((preference) => ({
      sportId: preference.sport_id,
      skillLevel: preference.skill_level,
      isPreferred: preference.is_preferred,
    }));
  }

  async function deleteOwnedAvatar(userId: string, objectPath: string) {
    if (!objectPath.startsWith(`${userId}/`)) {
      throw new ProfileRepositoryError(
        "AVATAR_DELETE_FAILED",
        "The saved avatar path does not belong to your account.",
      );
    }
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([objectPath]);
    if (error) {
      throw new ProfileRepositoryError("AVATAR_DELETE_FAILED", error.message, { cause: error });
    }
  }

  return {
    async loadMyProfile(): Promise<AthleteProfile> {
      return loadProfile(await currentUserId());
    },

    async saveMyProfile(input: ProfileInput): Promise<AthleteProfile> {
      const userId = await currentUserId();
      const parsed = profileSchema.safeParse(input);
      if (!parsed.success) {
        throw new ProfileRepositoryError(
          "VALIDATION",
          parsed.error.issues[0]?.message ?? "Check your profile details.",
          { cause: parsed.error },
        );
      }
      const profile = parsed.data;
      const fields = {
        username: profile.username,
        display_name: profile.displayName,
        bio: profile.bio,
        city: profile.city,
      };

      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update(fields)
        .eq("id", userId)
        .select(profileColumns)
        .maybeSingle();
      if (updateError) {
        if (isUsernameConflict(updateError)) {
          throw new ProfileRepositoryError("USERNAME_TAKEN", "That username is already in use.", { cause: updateError });
        }
        throw new ProfileRepositoryError("PROFILE_SAVE_FAILED", updateError.message, { cause: updateError });
      }
      if (updated) return toProfile(updated as ProfileRow);

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId, ...fields })
        .select(profileColumns)
        .single();
      if (insertError) {
        if (isUsernameConflict(insertError)) {
          throw new ProfileRepositoryError("USERNAME_TAKEN", "That username is already in use.", { cause: insertError });
        }
        if (insertError.code === "23505") {
          const { data: racedProfile, error: retryError } = await supabase
            .from("profiles")
            .update(fields)
            .eq("id", userId)
            .select(profileColumns)
            .maybeSingle();
          if (!retryError && racedProfile) return toProfile(racedProfile as ProfileRow);
          if (retryError && isUsernameConflict(retryError)) {
            throw new ProfileRepositoryError("USERNAME_TAKEN", "That username is already in use.", { cause: retryError });
          }
        }
        throw new ProfileRepositoryError("PROFILE_SAVE_FAILED", insertError.message, { cause: insertError });
      }
      return toProfile(inserted as ProfileRow);
    },

    async loadMySportPreferences(): Promise<SportPreference[]> {
      return loadMySportPreferences();
    },

    async loadMyAthletePreferences(): Promise<AthletePreferencesInput> {
      const userId = await currentUserId();
      const [{ data: profile, error: profileError }, { data: goals, error: goalsError }] = await Promise.all([
        supabase.from("profiles").select("visibility,discovery_radius_km").eq("id", userId).maybeSingle(),
        supabase.from("profile_fitness_goals").select("fitness_goals").eq("user_id", userId).maybeSingle(),
      ]);
      const cause = profileError ?? goalsError;
      if (cause) {
        throw new ProfileRepositoryError(
          "ATHLETE_PREFERENCES_LOAD_FAILED",
          cause.message,
          { cause },
        );
      }
      if (!profile) {
        throw new ProfileRepositoryError("PROFILE_NOT_FOUND", "Your MOVEIT profile is not available.");
      }
      const parsed = athletePreferencesSchema.safeParse({
        fitnessGoals: (goals as FitnessGoalsRow | null)?.fitness_goals ?? [],
        discoveryRadiusKm: profile.discovery_radius_km,
        visibility: profile.visibility,
      });
      if (!parsed.success) {
        throw new ProfileRepositoryError(
          "ATHLETE_PREFERENCES_LOAD_FAILED",
          "Saved athlete preferences contain invalid values.",
          { cause: parsed.error },
        );
      }
      return parsed.data;
    },

    async saveMyAthletePreferences(input: AthletePreferencesInput): Promise<AthletePreferencesInput> {
      const parsed = athletePreferencesSchema.safeParse(input);
      if (!parsed.success) {
        throw new ProfileRepositoryError(
          "VALIDATION",
          parsed.error.issues[0]?.message ?? "Check your athlete preferences.",
          { cause: parsed.error },
        );
      }
      await currentUserId();
      const { error } = await supabase.rpc("save_my_athlete_preferences", {
        p_fitness_goals: parsed.data.fitnessGoals,
        p_discovery_radius_km: parsed.data.discoveryRadiusKm,
        p_visibility: parsed.data.visibility,
      });
      if (error) {
        throw new ProfileRepositoryError("ATHLETE_PREFERENCES_SAVE_FAILED", error.message, { cause: error });
      }
      return this.loadMyAthletePreferences();
    },

    async loadMyAthleteOnboardingState(): Promise<AthleteOnboardingState> {
      const userId = await currentUserId();
      const { data, error } = await supabase
        .from("user_onboarding")
        .select("athlete_onboarding_version,athlete_onboarding_step,athlete_onboarding_completed_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        throw new ProfileRepositoryError("ONBOARDING_LOAD_FAILED", error.message, { cause: error });
      }
      const row = data as OnboardingRow | null;
      const parsed = athleteOnboardingStateSchema.safeParse({
        version: row?.athlete_onboarding_version ?? 0,
        step: row?.athlete_onboarding_step ?? null,
        completedAt: row?.athlete_onboarding_completed_at ?? null,
      });
      if (!parsed.success) {
        throw new ProfileRepositoryError("ONBOARDING_LOAD_FAILED", "Saved onboarding state is invalid.", { cause: parsed.error });
      }
      return parsed.data;
    },

    async saveMyAthleteOnboardingState(
      step: Exclude<AthleteOnboardingStep, "complete">,
      completed = false,
    ): Promise<void> {
      const parsedStep = athleteOnboardingStepSchema.safeParse(step);
      if (!parsedStep.success || parsedStep.data === "complete") {
        throw new ProfileRepositoryError("VALIDATION", "Choose a valid onboarding step.");
      }
      await currentUserId();
      const { error } = await supabase.rpc("save_my_athlete_onboarding_state", {
        p_step: parsedStep.data,
        p_completed: completed,
      });
      if (error) {
        throw new ProfileRepositoryError("ONBOARDING_SAVE_FAILED", error.message, { cause: error });
      }
    },

    async saveMySportPreferences(
      preferences: SportPreferenceInput[],
    ): Promise<SportPreference[]> {
      const parsed = sportPreferencesInputSchema.safeParse(preferences);
      if (!parsed.success) {
        throw new ProfileRepositoryError(
          "VALIDATION",
          parsed.error.issues[0]?.message ?? "Check your sport preferences.",
          { cause: parsed.error },
        );
      }
      await currentUserId();
      const { error } = await supabase.rpc("save_my_sports_preferences", {
        p_preferences: parsed.data,
      });
      if (error) {
        throw new ProfileRepositoryError(
          "SPORT_PREFERENCES_SAVE_FAILED",
          error.message,
          { cause: error },
        );
      }
      return loadMySportPreferences();
    },

    async uploadAvatar(file: AvatarFile): Promise<AthleteProfile> {
      const validation = avatarUploadSchema.safeParse({
        mimeType: file.mimeType,
        size: file.bytes.byteLength,
      });
      if (!validation.success) {
        throw new ProfileRepositoryError(
          "AVATAR_INVALID",
          validation.error.issues[0]?.message ?? "Choose a JPEG, PNG, or WebP image up to 5 MiB.",
          { cause: validation.error },
        );
      }
      const userId = await currentUserId();
      const current = await loadProfile(userId);
      const extension = validation.data.mimeType === "image/jpeg"
        ? "jpg"
        : validation.data.mimeType === "image/png" ? "png" : "webp";
      const objectPath = `${userId}/${createObjectId()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(objectPath, file.bytes, {
          contentType: validation.data.mimeType,
          upsert: false,
        });
      if (uploadError) {
        throw new ProfileRepositoryError("AVATAR_UPLOAD_FAILED", uploadError.message, { cause: uploadError });
      }

      let saved: AthleteProfile;
      try {
        saved = await updateAvatarReference(userId, objectPath);
      } catch (error) {
        const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([objectPath]);
        const cleanupDetail = cleanupError ? ` Cleanup also failed: ${cleanupError.message}` : "";
        throw new ProfileRepositoryError(
          "AVATAR_SAVE_FAILED",
          `${error instanceof Error ? error.message : "The avatar could not be saved."}${cleanupDetail}`,
          { cause: error },
        );
      }

      if (current.avatarObjectPath && current.avatarObjectPath !== objectPath) {
        try {
          await deleteOwnedAvatar(userId, current.avatarObjectPath);
        } catch (error) {
          throw new ProfileRepositoryError(
            "AVATAR_CLEANUP_FAILED",
            `Your new avatar was saved, but the previous image could not be removed: ${error instanceof Error ? error.message : "unknown error"}`,
            { cause: error },
          );
        }
      }
      return saved;
    },

    async removeAvatar(): Promise<AthleteProfile> {
      const userId = await currentUserId();
      const current = await loadProfile(userId);
      const saved = await updateAvatarReference(userId, null);
      if (current.avatarObjectPath) {
        await deleteOwnedAvatar(userId, current.avatarObjectPath);
      }
      return saved;
    },
  };
}
