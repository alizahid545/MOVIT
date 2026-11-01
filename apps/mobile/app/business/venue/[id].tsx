import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { Button, Card, Header, Page, Pill, SectionTitle } from "../../../src/components/ui";
import { addPreviewFacility, getPreviewBusinessOwnerId, listOwnedPreviewVenues, type VenueRecord } from "../../../src/venue-preview";
import { findSport } from "../../../src/sports-catalogue";
import { useMoveitTheme } from "../../../src/theme";

export default function ManageVenueScreen() {
  const { colors } = useMoveitTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const venue = useMemo(() => listOwnedPreviewVenues().find((item) => item.id === id), [id]);
  const [name, setName] = useState("");
  const [sportId, setSportId] = useState(venue?.sportIds[0] ?? "");
  const [type, setType] = useState<"court" | "pitch" | "ground" | "lane" | "room" | "table" | "training_area">("court");
  const [capacity, setCapacity] = useState("4");
  const [duration, setDuration] = useState("60");
  const [increment, setIncrement] = useState("30");
  const [opensAt, setOpensAt] = useState("08:00");
  const [closesAt, setClosesAt] = useState("22:00");
  const [price, setPrice] = useState("1800");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);

  if (!venue) return <Page><Header eyebrow="BUSINESS PORTAL" title="Venue unavailable." action={<Button label="Dashboard" variant="quiet" onPress={() => router.replace("/business/dashboard")} />} /><Text style={{ color: colors.muted }}>This venue does not belong to the local preview business.</Text></Page>;

  const currentVenue = listOwnedPreviewVenues().find((item) => item.id === id) ?? venue;
  const addFacility = () => {
    try {
      addPreviewFacility(id, getPreviewBusinessOwnerId(), {
        name, sportId, resourceType: type, capacity: Number(capacity), equipment: [],
        durationMinutes: Number(duration), incrementMinutes: Number(increment), opensAt, closesAt, pricePerHour: Number(price),
      });
      setName("");
      setMessage("Facility added to the local draft. Hours and price are not published or bookable.");
      setRefresh((value) => value + 1);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Facility could not be added.");
    }
  };

  return (
    <Page>
      <Header eyebrow="VENUE OPERATIONS · LOCAL DRAFT" title={currentVenue.name} action={<Button label="Dashboard" variant="quiet" onPress={() => router.replace("/business/dashboard")} />} />
      <Text style={{ color: colors.muted, fontSize: 11 }}>Facility schedules and pricing are editable preview data only. A listing must pass verification before any public booking service could be enabled.</Text>
      <SectionTitle title={`Facilities · ${currentVenue.facilities.length}`} />
      {currentVenue.facilities.length ? currentVenue.facilities.map((facility) => (
        <Card key={facility.id}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{facility.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{findSport(facility.sportId)?.name} · {facility.resourceType} · capacity {facility.capacity}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{facility.opensAt}–{facility.closesAt} · {facility.durationMinutes} min booking · {facility.incrementMinutes} min increments</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Standard PKR {facility.pricePerHour}/hour{facility.peakPricePerHour ? ` · peak PKR ${facility.peakPricePerHour}/hour` : ""}</Text>
        </Card>
      )) : <Card><Text style={{ color: colors.muted, fontSize: 12 }}>No bookable resources configured yet.</Text></Card>}
      <SectionTitle title="Add another facility" />
      <Field label="Facility name" value={name} onChangeText={setName} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {currentVenue.sportIds.map((id) => <Pill key={id} label={findSport(id)?.name ?? id} selected={sportId === id} onPress={() => setSportId(id)} />)}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {(["court", "pitch", "ground", "lane", "room", "table", "training_area"] as const).map((item) => <Pill key={item} label={item.replace("_", " ")} selected={type === item} onPress={() => setType(item)} />)}
      </View>
      <Field label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      <Field label="Bookable duration · minutes" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
      <Field label="Time increment · minutes" value={increment} onChangeText={setIncrement} keyboardType="number-pad" />
      <View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1 }}><Field label="Opens · HH:MM" value={opensAt} onChangeText={setOpensAt} /></View><View style={{ flex: 1 }}><Field label="Closes · HH:MM" value={closesAt} onChangeText={setClosesAt} /></View></View>
      <Field label="Standard price · PKR/hour" value={price} onChangeText={setPrice} keyboardType="number-pad" />
      <Button label="Add facility to local draft" icon="plus" onPress={addFacility} />
      {message ? <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 11 }}>{message}</Text> : null}
      <Text style={{ color: colors.muted, fontSize: 10 }}>Peak/off-peak pricing rules, recurring calendars, date overrides, closures and maintenance blocks await backend scheduling.</Text>
      <Text style={{ color: colors.muted, fontSize: 9 }}>Preview update {refresh + 1}</Text>
    </Page>
  );
}

function Field({ label, value, onChangeText, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "number-pad" }) {
  const { colors } = useMoveitTheme();
  return <View style={{ gap: 7 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={label} placeholderTextColor={colors.muted} style={{ minHeight: 46, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13 }} /></View>;
}
