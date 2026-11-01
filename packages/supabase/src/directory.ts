import {
  businessProfileInputSchema,
  coachProfileInputSchema,
  directoryInquirySchema,
  directorySearchSchema,
  venueListingInputSchema,
  type BusinessProfileInput,
  type CoachProfileInput,
  type DirectorySearchInput,
  type VenueListingInput,
} from "@moveit/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DirectoryErrorCode =
  | "AUTH_REQUIRED"
  | "VALIDATION"
  | "DIRECTORY_LOAD_FAILED"
  | "DIRECTORY_SAVE_FAILED"
  | "INQUIRY_FAILED";

export type BusinessProfile = BusinessProfileInput & {
  id: string;
  ownerId: string;
  status: "draft" | "published";
  createdAt: string;
};

export type VenueListing = {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  description: string;
  city: string;
  area: string;
  sportIds: string[];
  createdAt: string;
};

export type CoachListing = {
  userId: string;
  username: string;
  displayName: string;
  headline: string;
  bio: string;
  city: string;
  area: string;
  sportIds: string[];
  specialties: string[];
  avatarObjectPath: string | null;
  avatarPublicUrl: string | null;
};

export type DirectoryInquiry = {
  id: string;
  listingType: "venue" | "coach";
  listingId: string;
  listingName: string;
  requesterId: string;
  message: string;
  status: "new" | "responded" | "closed";
  createdAt: string;
};

export class DirectoryRepositoryError extends Error {
  constructor(readonly code: DirectoryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DirectoryRepositoryError";
  }
}

type VenueRow = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  city: string;
  area: string;
  sport_ids: string[];
  business_name: string;
  created_at: string;
};

type CoachRow = {
  user_id: string;
  username: string;
  display_name: string;
  headline: string;
  bio: string;
  city: string;
  area: string;
  sport_ids: string[];
  specialties: string[];
  avatar_object_path: string | null;
};

function firstIssue(error: { issues?: Array<{ message: string }> }, fallback: string) {
  return error.issues?.[0]?.message ?? fallback;
}

function parseDirectorySearch(input: Partial<DirectorySearchInput>) {
  const parsed = directorySearchSchema.safeParse(input);
  if (!parsed.success) {
    throw new DirectoryRepositoryError("VALIDATION", firstIssue(parsed.error, "Check directory filters."), {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function createDirectoryRepository(client: SupabaseClient) {
  async function currentUserId(): Promise<string> {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      throw new DirectoryRepositoryError(
        "AUTH_REQUIRED",
        "Sign in to browse MOVEIT directories.",
        error ? { cause: error } : undefined,
      );
    }
    return data.user.id;
  }

  function mapVenue(row: VenueRow): VenueListing {
    return {
      id: row.id,
      businessId: row.business_id,
      businessName: row.business_name,
      name: row.name,
      description: row.description,
      city: row.city,
      area: row.area,
      sportIds: row.sport_ids,
      createdAt: row.created_at,
    };
  }

  function mapCoach(row: CoachRow): CoachListing {
    const avatarPublicUrl = row.avatar_object_path
      ? client.storage.from("moveit-avatars").getPublicUrl(row.avatar_object_path).data.publicUrl
      : null;
    return {
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name,
      headline: row.headline,
      bio: row.bio,
      city: row.city,
      area: row.area,
      sportIds: row.sport_ids,
      specialties: row.specialties,
      avatarObjectPath: row.avatar_object_path,
      avatarPublicUrl,
    };
  }

  return {
    async discoverVenues(input: Partial<DirectorySearchInput> = {}): Promise<VenueListing[]> {
      const filters = parseDirectorySearch(input);
      await currentUserId();
      const { data, error } = await client.rpc("discover_public_venues", {
        p_query: filters.query || null,
        p_city: filters.city || null,
        p_sport_id: filters.sportId || null,
        p_limit: filters.limit,
        p_offset: filters.offset,
      });
      if (error) {
        throw new DirectoryRepositoryError("DIRECTORY_LOAD_FAILED", error.message, { cause: error });
      }
      return ((data ?? []) as VenueRow[]).map(mapVenue);
    },

    async discoverCoaches(input: Partial<DirectorySearchInput> = {}): Promise<CoachListing[]> {
      const filters = parseDirectorySearch(input);
      await currentUserId();
      const { data, error } = await client.rpc("discover_public_coaches", {
        p_query: filters.query || null,
        p_city: filters.city || null,
        p_sport_id: filters.sportId || null,
        p_limit: filters.limit,
        p_offset: filters.offset,
      });
      if (error) {
        throw new DirectoryRepositoryError("DIRECTORY_LOAD_FAILED", error.message, { cause: error });
      }
      return ((data ?? []) as CoachRow[]).map(mapCoach);
    },

    async loadMyBusinesses(): Promise<BusinessProfile[]> {
      const ownerId = await currentUserId();
      const { data, error } = await client.from("business_profiles")
        .select("id,owner_id,name,business_type,city,area,status,created_at")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });
      if (error) {
        throw new DirectoryRepositoryError("DIRECTORY_LOAD_FAILED", error.message, { cause: error });
      }
      return (data ?? []).map((row) => ({
        id: row.id as string,
        ownerId: row.owner_id as string,
        name: row.name as string,
        businessType: row.business_type as BusinessProfileInput["businessType"],
        city: row.city as string,
        area: row.area as string,
        status: row.status as BusinessProfile["status"],
        createdAt: row.created_at as string,
      }));
    },

    async createBusiness(input: BusinessProfileInput): Promise<BusinessProfile> {
      const parsed = businessProfileInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new DirectoryRepositoryError("VALIDATION", firstIssue(parsed.error, "Check the business details."), {
          cause: parsed.error,
        });
      }
      const ownerId = await currentUserId();
      const { data, error } = await client.from("business_profiles")
        .insert({
          owner_id: ownerId,
          name: parsed.data.name,
          business_type: parsed.data.businessType,
          city: parsed.data.city,
          area: parsed.data.area,
          status: "published",
        })
        .select("id,owner_id,name,business_type,city,area,status,created_at")
        .single();
      if (error) {
        throw new DirectoryRepositoryError("DIRECTORY_SAVE_FAILED", error.message, { cause: error });
      }
      return {
        id: data.id as string,
        ownerId: data.owner_id as string,
        name: data.name as string,
        businessType: data.business_type as BusinessProfileInput["businessType"],
        city: data.city as string,
        area: data.area as string,
        status: data.status as BusinessProfile["status"],
        createdAt: data.created_at as string,
      };
    },

    async createVenue(input: VenueListingInput): Promise<void> {
      const parsed = venueListingInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new DirectoryRepositoryError("VALIDATION", firstIssue(parsed.error, "Check the venue details."), {
          cause: parsed.error,
        });
      }
      await currentUserId();
      const { error } = await client.from("venues").insert({
        business_id: parsed.data.businessId,
        name: parsed.data.name,
        description: parsed.data.description,
        city: parsed.data.city,
        area: parsed.data.area,
        sport_ids: parsed.data.sportIds,
        status: parsed.data.status,
      });
      if (error) {
        throw new DirectoryRepositoryError("DIRECTORY_SAVE_FAILED", error.message, { cause: error });
      }
    },

    async saveMyCoachProfile(input: CoachProfileInput): Promise<void> {
      const parsed = coachProfileInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new DirectoryRepositoryError("VALIDATION", firstIssue(parsed.error, "Check your coach profile."), {
          cause: parsed.error,
        });
      }
      const userId = await currentUserId();
      const { error } = await client.from("coach_profiles").upsert({
        user_id: userId,
        headline: parsed.data.headline,
        bio: parsed.data.bio,
        city: parsed.data.city,
        area: parsed.data.area,
        sport_ids: parsed.data.sportIds,
        specialties: parsed.data.specialties,
        is_published: parsed.data.isPublished,
      }, { onConflict: "user_id" });
      if (error) {
        throw new DirectoryRepositoryError("DIRECTORY_SAVE_FAILED", error.message, { cause: error });
      }
    },

    async createVenueInquiry(venueId: string, message: string): Promise<void> {
      const parsed = directoryInquirySchema.safeParse({ message });
      if (!parsed.success) {
        throw new DirectoryRepositoryError("VALIDATION", firstIssue(parsed.error, "Check your message."), {
          cause: parsed.error,
        });
      }
      const requesterId = await currentUserId();
      const { error } = await client.from("venue_inquiries")
        .insert({ venue_id: venueId, requester_id: requesterId, message: parsed.data.message });
      if (error) {
        const message = error.code === "23505"
          ? "You already have an open inquiry for this venue."
          : error.message;
        throw new DirectoryRepositoryError("INQUIRY_FAILED", message, { cause: error });
      }
    },

    async createCoachInquiry(coachId: string, message: string): Promise<void> {
      const parsed = directoryInquirySchema.safeParse({ message });
      if (!parsed.success) {
        throw new DirectoryRepositoryError("VALIDATION", firstIssue(parsed.error, "Check your message."), {
          cause: parsed.error,
        });
      }
      const requesterId = await currentUserId();
      const { error } = await client.from("coach_inquiries")
        .insert({ coach_id: coachId, requester_id: requesterId, message: parsed.data.message });
      if (error) {
        const friendly = error.code === "23505"
          ? "You already have an open inquiry for this coach."
          : error.message;
        throw new DirectoryRepositoryError("INQUIRY_FAILED", friendly, { cause: error });
      }
    },

    async loadMyVenueInquiries(): Promise<DirectoryInquiry[]> {
      const userId = await currentUserId();
      const { data, error } = await client.from("venue_inquiries")
        .select("id,venue_id,requester_id,message,status,created_at,venue:venues!inner(name)")
        .neq("requester_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        throw new DirectoryRepositoryError("INQUIRY_FAILED", error.message, { cause: error });
      }
      return (data ?? []).map((value) => {
        const row = value as unknown as {
          id: string;
          venue_id: string;
          requester_id: string;
          message: string;
          status: DirectoryInquiry["status"];
          created_at: string;
          venue: { name: string };
        };
        return {
          id: row.id,
          listingType: "venue",
          listingId: row.venue_id,
          listingName: row.venue.name,
          requesterId: row.requester_id,
          message: row.message,
          status: row.status,
          createdAt: row.created_at,
        };
      });
    },

    async loadMyCoachInquiries(): Promise<DirectoryInquiry[]> {
      const userId = await currentUserId();
      const { data, error } = await client.from("coach_inquiries")
        .select("id,coach_id,requester_id,message,status,created_at")
        .eq("coach_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        throw new DirectoryRepositoryError("INQUIRY_FAILED", error.message, { cause: error });
      }
      return (data ?? []).map((row) => ({
        id: row.id as string,
        listingType: "coach",
        listingId: row.coach_id as string,
        listingName: "Coach profile",
        requesterId: row.requester_id as string,
        message: row.message as string,
        status: row.status as DirectoryInquiry["status"],
        createdAt: row.created_at as string,
      }));
    },

    async updateVenueInquiryStatus(inquiryId: string, status: DirectoryInquiry["status"]): Promise<void> {
      await currentUserId();
      const { data, error } = await client.from("venue_inquiries")
        .update({ status })
        .eq("id", inquiryId)
        .select("id")
        .maybeSingle();
      if (error) {
        throw new DirectoryRepositoryError("INQUIRY_FAILED", error.message, { cause: error });
      }
      if (!data) {
        throw new DirectoryRepositoryError("INQUIRY_FAILED", "This venue inquiry is unavailable or you cannot manage it.");
      }
    },

    async updateCoachInquiryStatus(inquiryId: string, status: DirectoryInquiry["status"]): Promise<void> {
      await currentUserId();
      const { data, error } = await client.from("coach_inquiries")
        .update({ status })
        .eq("id", inquiryId)
        .select("id")
        .maybeSingle();
      if (error) {
        throw new DirectoryRepositoryError("INQUIRY_FAILED", error.message, { cause: error });
      }
      if (!data) {
        throw new DirectoryRepositoryError("INQUIRY_FAILED", "This coach inquiry is unavailable or you cannot manage it.");
      }
    },
  };
}
