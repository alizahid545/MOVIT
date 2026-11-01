import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { Button, Card, Header, Page, SectionTitle } from "../../src/components/ui";
import { createDirectoryRepository, type BusinessProfile, type ManagedVenueListing } from "@moveit/supabase";
import { loadAccountOnboarding, saveAccountOnboarding } from "../../src/account-onboarding";
import { supabase } from "../../src/supabase";
import {
  getPreviewBusiness,
  getPreviewBusinessOwnerId,
  listOwnedPreviewBookings,
  listOwnedPreviewVenues,
  submitPreviewVenueForVerification,
  transitionPreviewBooking,
  type PreviewBusiness,
  type PreviewBooking,
  type VenueRecord,
} from "../../src/venue-preview";
import { useMoveitTheme } from "../../src/theme";

export default function BusinessDashboardScreen() {
  const { colors } = useMoveitTheme();
  const [accountMode, setAccountMode] = useState<"checking" | "live" | "preview" | "error">(supabase ? "checking" : "preview");
  const [accountError, setAccountError] = useState("");
  const [business, setBusiness] = useState<PreviewBusiness | null>(getPreviewBusiness());
  const [venues, setVenues] = useState<VenueRecord[]>(listOwnedPreviewVenues());
  const [bookings, setBookings] = useState<PreviewBooking[]>(listOwnedPreviewBookings());
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setBusiness(getPreviewBusiness());
    setVenues(listOwnedPreviewVenues());
    setBookings(listOwnedPreviewBookings());
    if (!supabase) {
      setAccountMode("preview");
      return () => { active = false; };
    }
    setAccountMode("checking");
    void supabase.auth.getUser()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setAccountMode(data.user ? "live" : "preview");
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setAccountError(caught instanceof Error ? caught.message : "The business account could not be loaded.");
        setAccountMode("error");
      });
    return () => { active = false; };
  }, [revision]));

  if (accountMode === "checking") {
    return <Page><Header eyebrow="MOVEIT BUSINESS" title="Loading workspace." /><View style={{ alignItems: "center", padding: 28 }}><ActivityIndicator color={colors.accent} /></View></Page>;
  }
  if (accountMode === "error") {
    return <Page><Header eyebrow="MOVEIT BUSINESS" title="Workspace unavailable." /><Card style={{ gap: 10 }}><Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{accountError}</Text><Button label="Try again" onPress={() => setRevision((value) => value + 1)} /></Card></Page>;
  }
  if (accountMode === "live") return <LiveBusinessDashboard />;

  if (!business) {
    return <Page><Header eyebrow="MOVEIT BUSINESS" title="Business dashboard." action={<Button label="Switch / add profile" icon="repeat" variant="quiet" onPress={() => router.push("/role-selection")} />} /><Card><Text style={{ color: colors.muted, fontSize: 12 }}>Register a local preview business to manage venue drafts. Existing account authentication is separate and not connected to business membership yet.</Text><Button label="Set up business profile" onPress={() => router.push("/business/register")} /></Card></Page>;
  }

  const refresh = (text: string) => {
    setMessage(text);
    setRevision((value) => value + 1);
    setBusiness(getPreviewBusiness());
    setVenues(listOwnedPreviewVenues());
    setBookings(listOwnedPreviewBookings());
  };

  const manageBooking = (booking: PreviewBooking, status: "confirmed" | "rejected") => {
    try {
      transitionPreviewBooking(booking.id, getPreviewBusinessOwnerId(), status);
      refresh(`Local booking preview ${status}. No customer reservation was made.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Booking preview could not be updated.");
    }
  };

  return (
    <Page>
      <Header eyebrow="BUSINESS PORTAL · LOCAL ONLY" title="Venue dashboard." action={<Button label="Switch / add profile" icon="repeat" variant="quiet" onPress={() => router.push("/role-selection")} />} />
      <Card>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>{business.businessName}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{business.businessType} · {business.city} · {business.area}</Text>
        <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600" }}>Verification · Pending · not verified</Text>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>This dashboard uses temporary app memory. No business role, staff account, live booking, occupancy, revenue, or payment data is connected.</Text>
      </Card>

      <View style={{ gap: 8 }}>
        <SectionTitle title="Business operations" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button label="Add a venue" icon="plus" onPress={() => router.push("/business/venue/new")} />
          <Button label="Tournament preview" icon="award" variant="secondary" onPress={() => router.push("/business/events")} />
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Your venues" />
        {venues.length ? venues.map((venue) => (
          <Card key={venue.id}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{venue.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>/venues/{venue.slug} · {venue.area}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Listing · {venue.status.replace("_", " ")} · Verification · {venue.verificationStatus.replace("_", " ")}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{venue.facilities.length} facility · {venue.facilities.map((facility) => `${facility.name} · PKR ${facility.pricePerHour}/hour`).join(", ")}</Text>
            <Button
              label="Venue points & visibility"
              icon="award"
              variant="secondary"
              onPress={() => router.push({ pathname: "/business/rewards", params: { venueId: venue.id } })}
            />
            <Button label="Manage facilities and schedule" icon="grid" variant="secondary" onPress={() => router.push({ pathname: "/business/venue/[id]", params: { id: venue.id } })} />
            <Button label="Request listing review" variant="secondary" disabled={venue.status !== "draft"} onPress={() => {
              try {
                submitPreviewVenueForVerification(venue.id, getPreviewBusinessOwnerId());
                refresh("Venue marked pending review in local preview; it is not public or verified.");
              } catch (caught) {
                setMessage(caught instanceof Error ? caught.message : "Venue could not be submitted.");
              }
            }} />
            <Text style={{ color: colors.muted, fontSize: 10 }}>Public page is unavailable until a future trusted verification decision.</Text>
          </Card>
        )) : <Card><Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>No venues added</Text><Text style={{ color: colors.muted, fontSize: 11 }}>Start with a venue draft and one facility. It will remain private to this local preview.</Text></Card>}
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Booking requests · local preview" />
        {bookings.length ? bookings.map((booking) => (
          <Card key={booking.id}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{booking.customerName} · {booking.status}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{booking.venueSlug} · {booking.date} · {booking.startsAt}–{booking.endsAt} · PKR {booking.totalPrice}</Text>
            <Text style={{ color: colors.danger, fontSize: 10 }}>Not a real booking; no payment or reservation is made.</Text>
            {booking.status === "pending" ? <View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1 }}><Button label="Preview confirm" onPress={() => manageBooking(booking, "confirmed")} /></View><View style={{ flex: 1 }}><Button label="Reject preview" variant="secondary" onPress={() => manageBooking(booking, "rejected")} /></View></View> : null}
          </Card>
        )) : <Card><Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>No booking requests</Text><Text style={{ color: colors.muted, fontSize: 11 }}>There are no sample transactions or live customer bookings.</Text></Card>}
      </View>
      {message ? <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 11 }}>{message}</Text> : null}
    </Page>
  );
}

function LiveBusinessDashboard() {
  const { colors } = useMoveitTheme();
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [venues, setVenues] = useState<ManagedVenueListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    try {
      const directory = createDirectoryRepository(supabase);
      const [nextBusinesses, nextVenues] = await Promise.all([
        directory.loadMyBusinesses(),
        directory.loadMyVenues(),
      ]);
      setBusinesses(nextBusinesses);
      setVenues(nextVenues);
      if (nextBusinesses.length) {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (auth.user) {
          const account = await loadAccountOnboarding(auth.user.id);
          await saveAccountOnboarding(auth.user.id, {
            selectedRoles: Array.from(new Set([...account.selectedRoles, "business"])),
            completedRoles: Array.from(new Set([...account.completedRoles, "business"])),
            activeRole: "business",
          });
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your business profiles could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Page>
      <Header eyebrow="MOVEIT BUSINESS · ACCOUNT" title="Venue dashboard." action={<Button label="Switch profile" variant="quiet" onPress={() => router.push("/role-selection")} />} />
      {loading ? <ActivityIndicator accessibilityLabel="Loading business profiles" color={colors.accent} /> : null}
      {error ? <Card style={{ gap: 10 }}><Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text><Button label="Try again" variant="secondary" onPress={() => void load()} /></Card> : null}
      {!loading && !error ? (
        <>
          <Card style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{businesses.length} business profiles</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>This workspace shows account-backed business and venue listings. Availability, court schedules, booking records, payment status and verification are not available in the current backend.</Text>
            <Button label="Add a business or venue" icon="plus" onPress={() => router.push({ pathname: "/business/register", params: { mode: "live" } })} />
          </Card>
          {businesses.map((item) => (
            <Card key={item.id} style={{ gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{item.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{item.businessType} · {[item.area, item.city].filter(Boolean).join(", ")} · {item.status}</Text>
            </Card>
          ))}
          <View style={{ gap: 10 }}>
            <SectionTitle title="Venue listings" />
            {venues.map((venue) => (
              <Card key={venue.id} style={{ gap: 5 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{venue.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{[venue.area, venue.city].filter(Boolean).join(", ")} · {venue.status}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{venue.sportIds.join(" · ") || "No sports specified"}</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>Owner-submitted · verification, facilities and live booking are not represented.</Text>
              </Card>
            ))}
            {!venues.length ? <Card><Text style={{ color: colors.muted, fontSize: 12 }}>No venue listings have been added to these businesses.</Text></Card> : null}
          </View>
        </>
      ) : null}
    </Page>
  );
}
