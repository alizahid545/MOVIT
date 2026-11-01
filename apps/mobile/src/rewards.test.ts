import { afterEach, describe, expect, it } from "vitest";
import {
  athleteTiers,
  canRedeemOffer,
  demonstrationOffers,
  getPointsLedger,
  getPointsSummary,
  hydrateRewardsRepository,
  rankVenues,
  recordQualifyingPointsEvent,
  redeemOfferPreview,
  resetRewardsForTests,
  resolvePointsTier,
  reverseQualifyingEvent,
  type PointsRule,
  type RewardsOffer,
} from "./rewards";

const testRules: PointsRule[] = [
  { id: "test-booking", ownerType: "athlete", eventType: "booking_completed", points: 100, enabled: true, reason: "Completed test booking." },
  { id: "test-venue-booking", ownerType: "venue", eventType: "booking_completed", points: 100, enabled: true, reason: "Completed test venue booking." },
];

const trustedAthleteEvent = {
  ownerType: "athlete" as const,
  ownerId: "athlete-a",
  eventRef: "booking-123",
  eventType: "booking_completed" as const,
  lifecycle: "completed" as const,
  evidence: "trusted_service" as const,
};

afterEach(resetRewardsForTests);

describe("MOVEIT points rules and local ledger", () => {
  it("does not issue points for previews, user claims, incomplete, or disabled rules", async () => {
    expect(await recordQualifyingPointsEvent({ ...trustedAthleteEvent, evidence: "local_preview" }, testRules)).toBeNull();
    expect(await recordQualifyingPointsEvent({ ...trustedAthleteEvent, evidence: "user_claim" }, testRules)).toBeNull();
    expect(await recordQualifyingPointsEvent({ ...trustedAthleteEvent, lifecycle: "cancelled" }, testRules)).toBeNull();
    expect(await recordQualifyingPointsEvent(trustedAthleteEvent)).toBeNull();
    expect(getPointsLedger("athlete", "athlete-a")).toEqual([]);
  });

  it("awards an eligible completed event once and ignores duplicate event references", async () => {
    const first = await recordQualifyingPointsEvent(trustedAthleteEvent, testRules);
    const duplicate = await recordQualifyingPointsEvent(trustedAthleteEvent, testRules);

    expect(first?.points).toBe(100);
    expect(duplicate).toBeNull();
    expect(getPointsSummary("athlete", "athlete-a").availablePoints).toBe(100);
  });

  it("restores ledger entries from the local development repository", async () => {
    await recordQualifyingPointsEvent(trustedAthleteEvent, testRules);
    await hydrateRewardsRepository();
    expect(getPointsSummary("athlete", "athlete-a").availablePoints).toBe(100);
  });

  it("reverses a cancelled or refunded award exactly once", async () => {
    await recordQualifyingPointsEvent(trustedAthleteEvent, testRules);
    const reversal = await reverseQualifyingEvent("athlete", "athlete-a", trustedAthleteEvent.eventRef, "refunded");

    expect(reversal?.points).toBe(-100);
    expect(await reverseQualifyingEvent("athlete", "athlete-a", trustedAthleteEvent.eventRef, "refunded")).toBeNull();
    expect(getPointsSummary("athlete", "athlete-a").availablePoints).toBe(0);
    expect(getPointsLedger("athlete", "athlete-a").some((entry) => entry.status === "reversed")).toBe(true);
  });

  it("keeps points accounts isolated by owner type and venue ID", async () => {
    await recordQualifyingPointsEvent({ ...trustedAthleteEvent, ownerType: "venue", ownerId: "venue-a" }, testRules);
    await recordQualifyingPointsEvent({ ...trustedAthleteEvent, ownerType: "venue", ownerId: "venue-b", eventRef: "booking-456" }, testRules);

    expect(getPointsSummary("venue", "venue-a").availablePoints).toBe(100);
    expect(getPointsSummary("venue", "venue-b").availablePoints).toBe(100);
    expect(getPointsSummary("athlete", "athlete-a").availablePoints).toBe(0);
  });

  it("requires available points and enforces an offer's redemption limit", async () => {
    const offer: RewardsOffer = {
      id: "offer-test",
      venueId: "venue-a",
      venueName: "Test venue",
      title: "Test discount",
      description: "Testing only",
      pointsCost: 50,
      redemptionLimitPerAthlete: 1,
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      eligibleSportIds: ["football"],
      eligibility: "Test-only offer.",
      demonstration: false,
    };
    expect(canRedeemOffer(offer, "athlete-a", 0).eligible).toBe(false);
    await recordQualifyingPointsEvent(trustedAthleteEvent, testRules);
    const redemption = await redeemOfferPreview(offer, "athlete-a", new Date("2026-10-26T00:00:00.000Z"));

    expect(redemption.status).toBe("pending");
    expect(getPointsSummary("athlete", "athlete-a").availablePoints).toBe(50);
    expect(getPointsSummary("athlete", "athlete-a").pendingRedemptionPoints).toBe(50);
    expect(canRedeemOffer(offer, "athlete-a", 100, new Date("2026-10-26T00:00:00.000Z")).eligible).toBe(false);
    await expect(redeemOfferPreview(offer, "athlete-a", new Date("2026-10-26T00:00:00.000Z"))).rejects.toThrow("redemption limit");
    expect(demonstrationOffers).toEqual([]);
  });

  it("reserves points for pending redemptions to prevent overspending across offers", async () => {
    const offer = (id: string, cost: number): RewardsOffer => ({
      id,
      venueId: "venue-a",
      venueName: "Test venue",
      title: id,
      description: "Testing only",
      pointsCost: cost,
      redemptionLimitPerAthlete: 1,
      startsAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      eligibleSportIds: [],
      eligibility: "Test-only offer.",
      demonstration: false,
    });
    await recordQualifyingPointsEvent(trustedAthleteEvent, testRules);
    await redeemOfferPreview(offer("offer-80", 80), "athlete-a", new Date("2026-10-26T00:00:00.000Z"));
    expect(getPointsSummary("athlete", "athlete-a").availablePoints).toBe(20);
    await expect(redeemOfferPreview(offer("offer-50", 50), "athlete-a", new Date("2026-10-26T00:00:00.000Z"))).rejects.toThrow("enough available points");
  });

  it("does not invent tiers without qualifying history and advances from configured thresholds", () => {
    expect(resolvePointsTier("athlete", 0, false)).toBeNull();
    expect(resolvePointsTier("athlete", 99, true)).toBeNull();
    expect(resolvePointsTier("athlete", athleteTiers[0]!.minimumPoints, true)?.current.id).toBe("athlete-starter");
    expect(resolvePointsTier("athlete", 300, true)?.progress).toBeCloseTo(0.5);
    expect(resolvePointsTier("venue", 1000, true)).toBeNull();
    expect(resolvePointsTier("venue", 1000, true, { completedBookings: 4, fulfilledBookingRate: 1 })).toBeNull();
    expect(resolvePointsTier("venue", 1000, true, { completedBookings: 5, fulfilledBookingRate: 0.9 })?.current.id).toBe("venue-emerging");
    const developing = resolvePointsTier("venue", 3000, true, { completedBookings: 5, fulfilledBookingRate: 0.9 });
    expect(developing?.current.id).toBe("venue-emerging");
    expect(developing?.next?.id).toBe("venue-established");
    expect(developing?.progress).toBe(0);
  });

  it("does not rank unverified or insufficient venue datasets", () => {
    const candidate = (venueId: string, metricsVerified = true) => ({
      venueId,
      points: 500,
      completedBookings: 5,
      fulfilledBookingRate: 0.95,
      genuineRatingAverage: 4.5,
      listingCompleteness: 0.8,
      recentActivity: 0.7,
      metricsVerified,
    });
    expect(rankVenues([candidate("a"), candidate("b")])).toEqual([]);
    expect(rankVenues([candidate("a"), candidate("b"), candidate("c", false)])).toEqual([]);
    expect(rankVenues([candidate("a"), candidate("b"), candidate("c")])).toHaveLength(3);
  });
});
