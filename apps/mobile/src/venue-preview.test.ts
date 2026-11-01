import { afterEach, describe, expect, it } from "vitest";
import { flushDevelopmentWrites, persistDevelopmentData } from "./local-development-repository";
import {
  addPreviewFacility,
  businessRegistrationSchema,
  canTransitionBooking,
  calculateBookingPrice,
  createPreviewBooking,
  createPreviewTournament,
  createPreviewVenue,
  getPreviewBusiness,
  getPreviewBusinessOwnerId,
  hydrateVenuePreview,
  listOwnedPreviewVenues,
  getPublicPreviewVenueById,
  getPublicPreviewVenue,
  listPreviewBookings,
  listPreviewTournaments,
  registerPreviewBusiness,
  resetVenuePreviewForTests,
  submitPreviewVenueForVerification,
  transitionPreviewBooking,
  venueDraftSchema,
  venueTournamentSchema,
} from "./venue-preview";

const registration = {
  ownerName: "Preview Owner",
  email: "owner@example.test",
  businessName: "Northside Sports",
  businessType: "venue" as const,
  city: "Lahore",
  area: "Gulberg",
};

afterEach(resetVenuePreviewForTests);

describe("business and venue preview rules", () => {
  it("exposes the fictional gym through the public local preview catalogue without marking it verified", () => {
    const gym = getPublicPreviewVenueById("demo-venue-gym-demo");
    expect(gym?.name).toBe("Strength Studio · Fictional Demo");
    expect(gym?.demo).toBe(true);
    expect(gym?.verificationStatus).toBe("pending_verification");
    expect(gym?.sportIds).toContain("fitness-training");
  });

  it("validates business registration and normalized human-readable venue slugs", () => {
    expect(businessRegistrationSchema.safeParse(registration).success).toBe(true);
    expect(businessRegistrationSchema.safeParse({ ...registration, email: "not-email" }).success).toBe(false);
    expect(venueDraftSchema.safeParse({
      name: "Northside Arena",
      slug: "Northside Arena",
      description: "",
      city: "Lahore",
      area: "Gulberg",
      sportIds: ["squash"],
      contactEmail: "venue@example.test",
    }).success).toBe(false);
  });

  it("restores business and venue drafts from local storage", async () => {
    const business = registerPreviewBusiness(registration);
    const venue = createPreviewVenue(business.id, getPreviewBusinessOwnerId(), {
      name: "Persistent Local Arena",
      slug: "persistent-local-arena",
      description: "Local development draft.",
      city: "Lahore",
      area: "Gulberg",
      sportIds: ["squash"],
      contactEmail: "venue@example.test",
    });
    await flushDevelopmentWrites();
    persistDevelopmentData("business-and-venue-preview", {
      sequence: 2,
      business: { ...business, ownerName: "", email: "" },
      venues: [{ ...venue, contactEmail: "" }],
      bookings: [],
      tournaments: [],
    });
    await flushDevelopmentWrites();
    await hydrateVenuePreview();

    expect(getPreviewBusiness()?.businessName).toBe(registration.businessName);
    expect(listOwnedPreviewVenues().map((venue) => venue.slug)).toEqual(["persistent-local-arena"]);
    expect(listOwnedPreviewVenues()[0]?.contactEmail).toBe("");
    resetVenuePreviewForTests();
    await flushDevelopmentWrites();
  });

  it("keeps new listings private until review and prevents duplicate public slugs", () => {
    const business = registerPreviewBusiness(registration);
    const venue = createPreviewVenue(business.id, getPreviewBusinessOwnerId(), {
      name: "Northside Arena",
      slug: "northside-arena",
      description: "Local draft",
      city: "Lahore",
      area: "Gulberg",
      sportIds: ["squash"],
      contactEmail: "venue@example.test",
    });
    expect(venue.status).toBe("draft");
    expect(getPublicPreviewVenue("northside-arena")).toBeNull();
    expect(() => createPreviewVenue(business.id, "other-user", {
      name: "Wrong owner venue",
      slug: "wrong-owner",
      description: "",
      city: "Lahore",
      area: "Gulberg",
      sportIds: ["squash"],
      contactEmail: "venue@example.test",
    })).toThrow("authorised business owner");
    expect(() => createPreviewVenue(business.id, getPreviewBusinessOwnerId(), {
      name: "Duplicate slug",
      slug: "northside-arena",
      description: "",
      city: "Lahore",
      area: "Gulberg",
      sportIds: ["squash"],
      contactEmail: "venue@example.test",
    })).toThrow("slug is already in use");
    expect(() => submitPreviewVenueForVerification(venue.id, getPreviewBusinessOwnerId())).toThrow("at least one facility");
  });

  it("validates facility schedule and requires steps before review submission", () => {
    const business = registerPreviewBusiness(registration);
    const venue = createPreviewVenue(business.id, getPreviewBusinessOwnerId(), {
      name: "Northside Arena",
      slug: "northside-arena",
      description: "",
      city: "Lahore",
      area: "Gulberg",
      sportIds: ["squash"],
      contactEmail: "venue@example.test",
    });
    expect(() => addPreviewFacility(venue.id, getPreviewBusinessOwnerId(), {
      name: "Court 1",
      sportId: "squash",
      resourceType: "court",
      capacity: 2,
      equipment: [],
      durationMinutes: 60,
      incrementMinutes: 40,
      opensAt: "22:00",
      closesAt: "08:00",
      pricePerHour: 1800,
    })).toThrow();
    addPreviewFacility(venue.id, getPreviewBusinessOwnerId(), {
      name: "Court 1",
      sportId: "squash",
      resourceType: "court",
      capacity: 2,
      equipment: ["racket"],
      durationMinutes: 60,
      incrementMinutes: 30,
      opensAt: "08:00",
      closesAt: "22:00",
      pricePerHour: 1800,
    });
    expect(submitPreviewVenueForVerification(venue.id, getPreviewBusinessOwnerId()).status).toBe("pending_verification");
    expect(getPreviewBusiness()?.verificationStatus).toBe("pending_verification");
    expect(getPublicPreviewVenue("northside-arena")).toBeNull();
  });

  it("calculates bounded fixed and percentage discounts", () => {
    expect(calculateBookingPrice({ pricePerHour: 1800 }, 90)).toEqual({ subtotal: 2700, discount: 0, total: 2700 });
    const today = new Date().toISOString().slice(0, 10);
    const offer = { code: "MOVE10", kind: "percentage" as const, value: 10, minimumSpend: 100, startsOn: today, endsOn: today };
    expect(calculateBookingPrice({ pricePerHour: 1800 }, 60, offer)).toEqual({ subtotal: 1800, discount: 180, total: 1620 });
    expect(calculateBookingPrice({ pricePerHour: 100 }, 60, { ...offer, kind: "fixed", value: 500 })).toEqual({ subtotal: 100, discount: 100, total: 0 });
  });

  it("rejects overlapping preview requests and enforces booking transitions and owner checks", () => {
    const venue = getPublicPreviewVenue("smash-arena-gulberg");
    expect(venue).not.toBeNull();
    const facility = venue!.facilities[0]!;
    const date = new Date().toISOString().slice(0, 10);
    const request = createPreviewBooking({
      venueSlug: venue!.slug,
      facilityId: facility.id,
      customerName: "Preview customer",
      date,
      startsAt: "10:00",
      endsAt: "11:00",
      totalPrice: facility.pricePerHour,
    });
    expect(request.previewOnly).toBe(true);
    expect(() => createPreviewBooking({
      venueSlug: venue!.slug,
      facilityId: facility.id,
      customerName: "Another preview customer",
      date,
      startsAt: "10:30",
      endsAt: "11:30",
      totalPrice: facility.pricePerHour,
    })).toThrow("overlaps");
    expect(() => transitionPreviewBooking(request.id, "someone-else", "confirmed")).toThrow("venue owner");
    expect(() => transitionPreviewBooking(request.id, getPreviewBusinessOwnerId(), "confirmed")).toThrow("does not belong to your business");
    expect(canTransitionBooking("pending", "confirmed")).toBe(true);
    expect(canTransitionBooking("pending", "rejected")).toBe(true);
    expect(canTransitionBooking("confirmed", "cancelled")).toBe(true);
    expect(canTransitionBooking("confirmed", "confirmed")).toBe(false);
    expect(canTransitionBooking("rejected", "confirmed")).toBe(false);
    expect(listPreviewBookings(venue!.slug)).toHaveLength(1);
  });

  it("validates sport-specific event drafts and venue ownership", () => {
    expect(venueTournamentSchema.safeParse({
      name: "Squash Open",
      description: "Friendly bracket rules",
      sportId: "squash",
      venueId: "venue",
      facilityId: "court",
      startsOn: "2026-11-10",
      endsOn: "2026-11-11",
      registrationClosesOn: "2026-11-09",
      participation: "team",
      teamSize: 2,
      participantLimit: 16,
      eligibility: "Open",
      scoringFormat: "Best of three games using squash scoring.",
      entryFee: 0,
      prizeDescription: "",
    }).success).toBe(true);
    const business = registerPreviewBusiness(registration);
    const venue = createPreviewVenue(business.id, getPreviewBusinessOwnerId(), {
      name: "Northside Arena",
      slug: "northside-arena",
      description: "",
      city: "Lahore",
      area: "Gulberg",
      sportIds: ["squash"],
      contactEmail: "venue@example.test",
    });
    const facility = addPreviewFacility(venue.id, getPreviewBusinessOwnerId(), {
      name: "Court 1",
      sportId: "squash",
      resourceType: "court",
      capacity: 2,
      equipment: [],
      durationMinutes: 60,
      incrementMinutes: 30,
      opensAt: "08:00",
      closesAt: "22:00",
      pricePerHour: 1800,
    }).facilities[0]!;
    const event = createPreviewTournament(business.id, getPreviewBusinessOwnerId(), {
      name: "Squash Open",
      description: "Friendly bracket rules",
      sportId: "squash",
      venueId: venue.id,
      facilityId: facility.id,
      startsOn: "2026-11-10",
      endsOn: "2026-11-11",
      registrationClosesOn: "2026-11-09",
      participation: "individual",
      participantLimit: 16,
      eligibility: "Open",
      scoringFormat: "Best of three games using squash scoring.",
      entryFee: 0,
      prizeDescription: "",
    });
    expect(event.status).toBe("draft");
    expect(listPreviewTournaments()).toHaveLength(1);
    expect(() => createPreviewTournament(business.id, "other", {})).toThrow("authorised business owner");
  });
});
