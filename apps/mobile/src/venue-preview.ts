import { z } from "zod";
import { demoVenues } from "./demo-data";
import { sportsCatalogue } from "./sports-catalogue";
import { persistDevelopmentData, readDevelopmentData } from "./local-development-repository";

export const businessVerificationStatuses = ["draft", "pending_verification", "approved", "rejected", "suspended"] as const;
export type BusinessVerificationStatus = (typeof businessVerificationStatuses)[number];
export type VenueListingStatus = "draft" | "pending_verification" | "published" | "suspended";
export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled";

const sportIdSchema = z.string().refine((id) => sportsCatalogue.some((sport) => sport.id === id), "Choose sports from the MOVEIT catalogue.");
const slugSchema = z.string()
  .trim()
  .min(3, "Use at least 3 characters for the public slug.")
  .max(60, "Slugs must be 60 characters or fewer.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.");
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use a valid 24-hour time such as 08:30.");

export const businessRegistrationSchema = z.object({
  ownerName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  businessName: z.string().trim().min(2).max(100),
  businessType: z.enum(["venue", "gym", "club", "academy"]),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(100),
});
export type BusinessRegistrationInput = z.infer<typeof businessRegistrationSchema>;

export const facilitySchema = z.object({
  name: z.string().trim().min(2).max(80),
  sportId: sportIdSchema,
  resourceType: z.enum(["court", "pitch", "ground", "lane", "room", "table", "training_area"]),
  capacity: z.number().int().min(1).max(1000),
  equipment: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  durationMinutes: z.number().int().min(15).max(480),
  incrementMinutes: z.number().int().min(5).max(120),
  opensAt: timeSchema,
  closesAt: timeSchema,
  pricePerHour: z.number().int().min(0).max(10000000),
  peakPricePerHour: z.number().int().min(0).max(10000000).optional(),
}).superRefine((value, context) => {
  if (value.incrementMinutes > value.durationMinutes || value.durationMinutes % value.incrementMinutes !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["incrementMinutes"], message: "Booking increments must divide the bookable duration." });
  }
  if (value.opensAt >= value.closesAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["closesAt"], message: "Closing time must be after opening time." });
  }
});
export type FacilityInput = z.infer<typeof facilitySchema>;

export const venueDraftSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: slugSchema,
  description: z.string().trim().max(1000).default(""),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(100),
  sportIds: z.array(sportIdSchema).min(1).max(20),
  contactEmail: z.string().trim().email().max(254),
}).superRefine((value, context) => {
  if (new Set(value.sportIds).size !== value.sportIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sportIds"], message: "Remove duplicate sports." });
  }
});
export type VenueDraftInput = z.infer<typeof venueDraftSchema>;

export const promotionSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(24).regex(/^[A-Z0-9_-]+$/),
  kind: z.enum(["fixed", "percentage"]),
  value: z.number().positive(),
  minimumSpend: z.number().min(0).default(0),
  usageLimit: z.number().int().positive().optional(),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
}).superRefine((value, context) => {
  if (value.startsOn > value.endsOn) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsOn"], message: "Promotion end date must not be before its start date." });
  if (value.kind === "percentage" && value.value > 100) context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Percentage discounts cannot exceed 100%." });
});
export type PromotionInput = z.infer<typeof promotionSchema>;

export const venueTournamentSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().min(1).max(1000),
  sportId: sportIdSchema,
  venueId: z.string().min(1),
  facilityId: z.string().min(1),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  registrationClosesOn: z.string().date(),
  participation: z.enum(["individual", "team"]),
  teamSize: z.number().int().min(2).max(100).optional(),
  participantLimit: z.number().int().min(2).max(10000).optional(),
  eligibility: z.string().trim().min(1).max(500),
  scoringFormat: z.string().trim().min(1).max(300),
  entryFee: z.number().int().min(0).max(10000000),
  prizeDescription: z.string().trim().max(300).default(""),
}).superRefine((value, context) => {
  if (value.startsOn > value.endsOn) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsOn"], message: "Event end date must not be before its start." });
  if (value.registrationClosesOn > value.startsOn) context.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationClosesOn"], message: "Registration must close on or before the event starts." });
  if (value.participation === "team" && value.teamSize === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["teamSize"], message: "Set a team size for team events." });
  if (value.participation === "individual" && value.teamSize !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["teamSize"], message: "Individual events do not use a team size." });
});
export type VenueTournamentInput = z.infer<typeof venueTournamentSchema>;

export type VenueFacility = FacilityInput & { id: string };
export type VenueRecord = VenueDraftInput & {
  id: string;
  businessId: string;
  status: VenueListingStatus;
  verificationStatus: BusinessVerificationStatus;
  facilities: VenueFacility[];
  createdAt: string;
};
export type PreviewBusiness = BusinessRegistrationInput & {
  id: string;
  ownerId: string;
  verificationStatus: BusinessVerificationStatus;
  createdAt: string;
  venueIds: string[];
};
export type PreviewBooking = {
  id: string;
  venueSlug: string;
  facilityId: string;
  customerName: string;
  date: string;
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  status: BookingStatus;
  createdAt: string;
  previewOnly: true;
};
export type PreviewTournament = VenueTournamentInput & {
  id: string;
  businessId: string;
  status: "draft";
  createdAt: string;
};

const ownerId = "local-business-preview-owner";
let sequence = 0;
let localBusiness: PreviewBusiness | null = null;
let localVenues: VenueRecord[] = [];
let previewBookings: PreviewBooking[] = [];
let previewTournaments: PreviewTournament[] = [];
const venueDataKey = "business-and-venue-preview";

export async function hydrateVenuePreview(): Promise<void> {
  const saved = await readDevelopmentData<{
    sequence: number;
    business: PreviewBusiness | null;
    venues: VenueRecord[];
    bookings: PreviewBooking[];
    tournaments: PreviewTournament[];
  }>(venueDataKey, { sequence: 0, business: null, venues: [], bookings: [], tournaments: [] });
  sequence = Number.isInteger(saved.sequence) && saved.sequence >= 0 ? saved.sequence : 0;
  localBusiness = saved.business ?? null;
  localVenues = Array.isArray(saved.venues) ? saved.venues : [];
  previewBookings = Array.isArray(saved.bookings) ? saved.bookings : [];
  previewTournaments = Array.isArray(saved.tournaments) ? saved.tournaments : [];
}

function persistVenuePreview(): void {
  persistDevelopmentData(venueDataKey, {
    sequence,
    business: localBusiness ? { ...localBusiness, ownerName: "", email: "" } : null,
    venues: localVenues.map((venue) => ({ ...venue, contactEmail: "" })),
    bookings: previewBookings.map((booking) => ({ ...booking, customerName: "Local preview customer" })),
    tournaments: previewTournaments,
  });
}

const demoPublicVenues = demoVenues.map((venue, index) => {
  const slug = ["model-town-sports-club", "smash-arena-gulberg", "city-cricket-nets"][index] ?? slugify(venue.name);
  const firstSportId = venue.sportIds[0] ?? "football";
  const sportName = sportsCatalogue.find((sport) => sport.id === firstSportId)?.name ?? "Sport";
  return {
    id: `demo-${venue.id}`,
    name: venue.name,
    slug,
    description: `Fictional ${sportName.toLowerCase()} facility listing for interface preview. Details, location and price are illustrative only.`,
    city: "Lahore",
    area: venue.area,
    sportIds: venue.sportIds,
    contactEmail: "",
    status: "published" as const,
    verificationStatus: "pending_verification" as const,
    businessId: `demo-business-${index + 1}`,
    facilities: [{
      id: `demo-facility-${venue.id}`,
      name: venue.facilityTypes[0] ?? "Sports facility",
      sportId: firstSportId,
      resourceType: venue.facilityTypes[0] === "ground" ? "ground" as const
        : venue.facilityTypes[0] === "nets" || venue.facilityTypes[0] === "gym" ? "training_area" as const
          : "court" as const,
      capacity: 10,
      equipment: [],
      durationMinutes: 60,
      incrementMinutes: 30,
      opensAt: "08:00",
      closesAt: "22:00",
      pricePerHour: Number(venue.price.match(/PKR\s([\d,]+)/)?.[1]?.replace(/,/g, "") ?? 0),
    }],
    createdAt: "2026-01-01T00:00:00.000Z",
    demo: true as const,
  };
});

export function slugify(value: string): string {
  return value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function listPublicPreviewVenues() {
  return [...demoPublicVenues, ...localVenues.filter((venue) => venue.status === "published" && venue.verificationStatus === "approved").map((venue) => ({ ...venue, demo: false as const }))];
}

export function getPublicPreviewVenue(slug: string) {
  return listPublicPreviewVenues().find((venue) => venue.slug === slug) ?? null;
}

export function getPublicPreviewVenueById(id: string) {
  return listPublicPreviewVenues().find((venue) => venue.id === id) ?? null;
}

export function registerPreviewBusiness(input: unknown): PreviewBusiness {
  const parsed = businessRegistrationSchema.parse(input);
  if (localBusiness) throw new Error("A local preview business is already registered for this session.");
  const business: PreviewBusiness = {
    ...parsed,
    id: `preview-business-${++sequence}`,
    ownerId,
    verificationStatus: "pending_verification",
    createdAt: new Date().toISOString(),
    venueIds: [],
  };
  localBusiness = business;
  persistVenuePreview();
  return business;
}

export function getPreviewBusiness(): PreviewBusiness | null {
  return localBusiness ? { ...localBusiness, venueIds: [...localBusiness.venueIds] } : null;
}

export function createPreviewVenue(businessId: string, actorId: string, input: unknown): VenueRecord {
  const business = requireBusinessOwner(businessId, actorId);
  const venue = venueDraftSchema.parse(input);
  if (listPublicPreviewVenues().some((existing) => existing.slug === venue.slug) || localVenues.some((existing) => existing.slug === venue.slug)) {
    throw new Error("That public venue slug is already in use.");
  }
  const record: VenueRecord = {
    ...venue,
    id: `preview-venue-${++sequence}`,
    businessId,
    status: "draft",
    verificationStatus: business.verificationStatus,
    facilities: [],
    createdAt: new Date().toISOString(),
  };
  localVenues = [record, ...localVenues];
  localBusiness = { ...business, venueIds: [...business.venueIds, record.id] };
  persistVenuePreview();
  return record;
}

export function listOwnedPreviewVenues(actorId = ownerId): VenueRecord[] {
  if (actorId !== ownerId) return [];
  return localVenues.filter((venue) => venue.businessId === localBusiness?.id).map((venue) => ({ ...venue, facilities: [...venue.facilities] }));
}

export function addPreviewFacility(venueId: string, actorId: string, input: unknown): VenueRecord {
  const venue = requireOwnedVenue(venueId, actorId);
  const facility = facilitySchema.parse(input);
  if (!venue.sportIds.includes(facility.sportId)) throw new Error("Facility sport must be included in the venue's supported sports.");
  const updated = { ...venue, facilities: [...venue.facilities, { ...facility, id: `preview-facility-${++sequence}` }] };
  localVenues = localVenues.map((item) => item.id === venueId ? updated : item);
  persistVenuePreview();
  return { ...updated, facilities: [...updated.facilities] };
}

export function submitPreviewVenueForVerification(venueId: string, actorId: string): VenueRecord {
  const venue = requireOwnedVenue(venueId, actorId);
  if (!venue.facilities.length) throw new Error("Add at least one facility before requesting listing review.");
  const updated = { ...venue, status: "pending_verification" as const };
  localVenues = localVenues.map((item) => item.id === venueId ? updated : item);
  persistVenuePreview();
  return { ...updated, facilities: [...updated.facilities] };
}

export function calculateBookingPrice(facility: Pick<FacilityInput, "pricePerHour" | "peakPricePerHour">, durationMinutes: number, promotion?: PromotionInput): { subtotal: number; discount: number; total: number } {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error("Booking duration must be greater than zero.");
  const subtotal = Math.round((facility.pricePerHour * durationMinutes) / 60);
  let discount = 0;
  if (promotion) {
    const offer = promotionSchema.parse(promotion);
    const today = new Date().toISOString().slice(0, 10);
    if (today < offer.startsOn || today > offer.endsOn) throw new Error("This promotion is not currently valid.");
    if (subtotal < offer.minimumSpend) throw new Error("The booking does not meet the promotion minimum spend.");
    discount = offer.kind === "fixed" ? offer.value : Math.round((subtotal * offer.value) / 100);
    discount = Math.min(subtotal, Math.round(discount));
  }
  return { subtotal, discount, total: Math.max(0, subtotal - discount) };
}

export function createPreviewBooking(input: Omit<PreviewBooking, "id" | "status" | "createdAt" | "previewOnly">): PreviewBooking {
  const venue = getPublicPreviewVenue(input.venueSlug);
  const facility = venue?.facilities.find((item) => item.id === input.facilityId);
  if (!venue || !facility) throw new Error("This venue facility is not available.");
  if (!z.string().date().safeParse(input.date).success || !timeSchema.safeParse(input.startsAt).success || !timeSchema.safeParse(input.endsAt).success || input.endsAt <= input.startsAt) {
    throw new Error("Choose a valid date and time range.");
  }
  const duration = timeMinutes(input.endsAt) - timeMinutes(input.startsAt);
  if (duration < facility.durationMinutes || duration % facility.incrementMinutes !== 0) throw new Error("Choose a duration that matches the facility booking increments.");
  if ((timeMinutes(input.startsAt) - timeMinutes(facility.opensAt)) % facility.incrementMinutes !== 0) throw new Error("Choose a start time on the facility's booking increments.");
  if (input.startsAt < facility.opensAt || input.endsAt > facility.closesAt) throw new Error("That time is outside this facility's listed hours.");
  if (previewBookings.some((booking) => booking.venueSlug === input.venueSlug && booking.facilityId === input.facilityId && booking.date === input.date && booking.status !== "cancelled" && booking.status !== "rejected" && overlaps(input.startsAt, input.endsAt, booking.startsAt, booking.endsAt))) {
    throw new Error("That time overlaps another booking request in this local preview.");
  }
  const price = calculateBookingPrice(facility, duration);
  if (input.totalPrice !== price.total) throw new Error("Price changed; review the current preview price.");
  const booking: PreviewBooking = { ...input, id: `preview-booking-${++sequence}`, status: "pending", createdAt: new Date().toISOString(), previewOnly: true };
  previewBookings = [booking, ...previewBookings];
  persistVenuePreview();
  return { ...booking };
}

export function listPreviewBookings(venueSlug?: string): PreviewBooking[] {
  return previewBookings.filter((booking) => !venueSlug || booking.venueSlug === venueSlug).map((booking) => ({ ...booking }));
}

export function listOwnedPreviewBookings(actorId = ownerId): PreviewBooking[] {
  if (actorId !== ownerId) return [];
  const ownedSlugs = new Set(localVenues.filter((venue) => venue.businessId === localBusiness?.id).map((venue) => venue.slug));
  return previewBookings.filter((booking) => ownedSlugs.has(booking.venueSlug)).map((booking) => ({ ...booking }));
}

export function canTransitionBooking(status: BookingStatus, nextStatus: BookingStatus): boolean {
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    pending: ["confirmed", "rejected", "cancelled"],
    confirmed: ["cancelled"],
    rejected: [],
    cancelled: [],
  };
  return allowed[status].includes(nextStatus);
}

export function createPreviewTournament(businessId: string, actorId: string, input: unknown): PreviewTournament {
  requireBusinessOwner(businessId, actorId);
  const tournament = venueTournamentSchema.parse(input);
  const venue = localVenues.find((item) => item.id === tournament.venueId && item.businessId === businessId);
  if (!venue || !venue.facilities.some((facility) => facility.id === tournament.facilityId)) {
    throw new Error("Choose a facility belonging to your business.");
  }
  if (!venue.sportIds.includes(tournament.sportId)) throw new Error("The tournament sport must be supported by the venue.");
  const record: PreviewTournament = { ...tournament, id: `preview-event-${++sequence}`, businessId, status: "draft", createdAt: new Date().toISOString() };
  previewTournaments = [record, ...previewTournaments];
  persistVenuePreview();
  return { ...record };
}

export function listPreviewTournaments(actorId = ownerId): PreviewTournament[] {
  if (actorId !== ownerId || !localBusiness) return [];
  return previewTournaments.filter((event) => event.businessId === localBusiness?.id).map((event) => ({ ...event }));
}

export function transitionPreviewBooking(bookingId: string, actorId: string, nextStatus: BookingStatus): PreviewBooking {
  if (actorId !== ownerId) throw new Error("Only the local venue owner can manage this preview booking.");
  const booking = previewBookings.find((item) => item.id === bookingId);
  if (!booking) throw new Error("Booking preview not found.");
  if (!localVenues.some((venue) => venue.businessId === localBusiness?.id && venue.slug === booking.venueSlug)) {
    throw new Error("This booking does not belong to your business.");
  }
  if (!canTransitionBooking(booking.status, nextStatus)) throw new Error(`Cannot change a ${booking.status} booking to ${nextStatus}.`);
  const updated = { ...booking, status: nextStatus };
  previewBookings = previewBookings.map((item) => item.id === bookingId ? updated : item);
  persistVenuePreview();
  return { ...updated };
}

export function getPreviewBusinessOwnerId(): string {
  return ownerId;
}

export function resetVenuePreviewForTests(): void {
  sequence = 0;
  localBusiness = null;
  localVenues = [];
  previewBookings = [];
  previewTournaments = [];
  persistVenuePreview();
}

function requireBusinessOwner(businessId: string, actorId: string): PreviewBusiness {
  if (actorId !== ownerId || !localBusiness || localBusiness.id !== businessId) throw new Error("Only an authorised business owner can manage these records.");
  return localBusiness;
}

function requireOwnedVenue(venueId: string, actorId: string): VenueRecord {
  if (actorId !== ownerId) throw new Error("Only an authorised business owner can manage this venue.");
  const venue = localVenues.find((item) => item.id === venueId && item.businessId === localBusiness?.id);
  if (!venue) throw new Error("Venue not found for this business.");
  return venue;
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

function timeMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
