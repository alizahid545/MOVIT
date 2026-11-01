import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { Button, Card, Header, Icon, Page, Pill, SectionTitle } from "../../src/components/ui";
import { calculateBookingPrice, createPreviewBooking, getPublicPreviewVenue, listPreviewBookings } from "../../src/venue-preview";
import { findSport } from "../../src/sports-catalogue";
import { useMoveitTheme } from "../../src/theme";

const demoStartTimes = ["09:00", "10:00", "14:00", "18:00"];

export default function PublicVenueScreen() {
  const { colors } = useMoveitTheme();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const venue = getPublicPreviewVenue(slug);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedFacilityId, setSelectedFacilityId] = useState(venue?.facilities[0]?.id ?? "");
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [customerName, setCustomerName] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  if (!venue) {
    return <Page><Header eyebrow="VENUE" title="Listing unavailable." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} /><Card><Text style={{ color: colors.muted, fontSize: 12 }}>This venue does not exist in the public preview or is not an approved listing.</Text></Card></Page>;
  }

  const facility = venue.facilities.find((item) => item.id === selectedFacilityId) ?? venue.facilities[0];
  const sportNames = venue.sportIds.map((id) => findSport(id)?.name).filter(Boolean);
  const totalPrice = facility ? calculateBookingPrice(facility, facility.durationMinutes).total : 0;
  const existing = listPreviewBookings(venue.slug);
  const requestPreview = () => {
    if (!facility) return;
    try {
      const booking = createPreviewBooking({
        venueSlug: venue.slug,
        facilityId: facility.id,
        customerName: customerName.trim() || "Local preview customer",
        date,
        startsAt: selectedTime,
        endsAt: addMinutes(selectedTime, facility.durationMinutes),
        totalPrice,
      });
      setMessage(`Preview request ${booking.id} created locally only. It is not a reservation and no payment was taken.`);
      setRevision((value) => value + 1);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Booking preview could not be created.");
    }
  };

  return (
    <Page>
      <Header eyebrow="VENUE LISTING · FICTIONAL DEMO" title={venue.name} action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <Card>
        <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}><Icon name="map-pin" size={16} color={colors.muted} /><Text style={{ color: colors.text, fontSize: 12 }}>{venue.area}, {venue.city}</Text></View>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{venue.description}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Sports · {sportNames.join(" · ") || "Not listed"}</Text>
        <Text style={{ color: colors.danger, fontSize: 11, fontWeight: "600" }}>Illustrative sample listing · Not verified · Not bookable in the real world</Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>No owner, contact, photo, map pin, reviews, tournament, or current venue supply is represented.</Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>No points tier or discovery ranking is shown without verified venue performance data.</Text>
      </Card>
      <View style={{ gap: 9 }}>
        <SectionTitle title="Facilities · illustrative" />
        {venue.facilities.map((item) => (
          <Card key={item.id}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{item.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{findSport(item.sportId)?.name ?? "Sport"} · {item.capacity} capacity · {item.durationMinutes} min</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{item.opensAt}–{item.closesAt} · PKR {item.pricePerHour}/hour</Text>
            <Pill label="Hours and prices are demo data, not availability" />
          </Card>
        ))}
      </View>
      <View style={{ gap: 9 }}>
        <SectionTitle title="Booking price preview" />
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>Try the local flow to inspect price and overlap handling. This does not check live availability, create a real reservation, or process payment.</Text>
        <TextInput accessibilityLabel="Booking date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={inputStyle(colors)} />
        <TextInput accessibilityLabel="Preview customer name" value={customerName} onChangeText={setCustomerName} placeholder="Name · optional local preview" placeholderTextColor={colors.muted} style={inputStyle(colors)} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {venue.facilities.map((item) => <Pill key={item.id} label={item.name} selected={selectedFacilityId === item.id} onPress={() => setSelectedFacilityId(item.id)} />)}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {demoStartTimes.map((time) => <Pill key={time} label={time} selected={selectedTime === time} onPress={() => setSelectedTime(time)} />)}
        </View>
        {facility ? (
          <Card>
            <Text style={{ color: colors.text, fontSize: 12 }}>Duration · {facility.durationMinutes} min · {selectedTime}–{addMinutes(selectedTime, facility.durationMinutes)}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>Subtotal · PKR {totalPrice} · Discount · PKR 0 · Total · PKR {totalPrice}</Text>
          </Card>
        ) : null}
        <Button label="Preview booking request · no reservation" icon="calendar" onPress={requestPreview} />
        {message ? <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>{message}</Text> : null}
        {existing.length ? (
          <Card>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Local requests · {existing.length}</Text>
            {existing.map((booking) => <Text key={booking.id} style={{ color: colors.muted, fontSize: 11 }}>{booking.date} · {booking.startsAt} · {booking.status} · preview only</Text>)}
          </Card>
        ) : null}
        <Text style={{ color: colors.danger, fontSize: 10 }}>Prices, discounts, taxes, availability, cancellation terms, QR check-in, and payment are not live.</Text>
      </View>
      <Button label="Venue owners · List Your Venue" variant="secondary" onPress={() => router.push("/business")} />
      <Text style={{ color: colors.muted, fontSize: 9 }}>Preview state {revision + 1} · This page uses a human-readable public slug: {venue.slug}</Text>
    </Page>
  );
}

function addMinutes(time: string, minutesToAdd: number): string {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutesToAdd;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function inputStyle(colors: ReturnType<typeof useMoveitTheme>["colors"]) {
  return { minHeight: 46, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13 } as const;
}
