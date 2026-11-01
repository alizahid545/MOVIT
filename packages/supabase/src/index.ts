import { createClient, type SupportedStorage } from "@supabase/supabase-js";

export {
  AVATAR_BUCKET,
  createAthleteProfileRepository,
  ProfileRepositoryError,
  type AvatarFile,
  type ProfileRepositoryErrorCode,
} from "./athlete-profile";
export {
  createCommunityPlatformRepository,
  PlatformRepositoryError,
  type ActivityParticipant,
  type MySocialSummary,
  type PlatformErrorCode,
  type PlatformNotification,
} from "./community-platform";
export {
  createDirectoryRepository,
  DirectoryRepositoryError,
  type BusinessProfile,
  type CoachListing,
  type DirectoryInquiry,
  type DirectoryErrorCode,
  type VenueListing,
} from "./directory";

const connectivityTimeoutMs = 10_000;

export function createMoveitClient(
  url: string | undefined,
  anonKey: string | undefined,
  storage?: SupportedStorage,
  persistSession = Boolean(storage),
) {
  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession,
      ...(storage ? { storage } : {}),
    },
  });
}

export async function checkSupabaseConnectivity(
  url: string | undefined,
  anonKey: string | undefined,
): Promise<void> {
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured. Set the project URL and public client key, then restart the app.");
  }

  let projectUrl: URL;
  try {
    projectUrl = new URL(url);
  } catch {
    throw new Error("The configured Supabase project URL is invalid.");
  }

  const isLocalHttp = projectUrl.protocol === "http:"
    && (projectUrl.hostname === "localhost" || projectUrl.hostname === "127.0.0.1");
  if (
    (projectUrl.protocol !== "https:" && !isLocalHttp)
    || projectUrl.username
    || projectUrl.password
    || projectUrl.search
    || projectUrl.hash
    || projectUrl.pathname !== "/"
  ) {
    throw new Error("The configured Supabase project URL must be an HTTPS project URL.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), connectivityTimeoutMs);
  let response: Response;
  try {
    response = await fetch(new URL("/auth/v1/health", projectUrl.origin), {
      method: "GET",
      headers: { apikey: anonKey },
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new Error("Supabase health check timed out. Check the network and project URL.");
    }
    throw new Error("Could not reach the configured Supabase project. Check the network and project URL.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Supabase health check failed with HTTP ${response.status}.`);
  }
}

export const SUPABASE_SETUP_ERROR =
  "Supabase is not configured. Add the project URL and anon key to the app environment file, then restart the app.";
