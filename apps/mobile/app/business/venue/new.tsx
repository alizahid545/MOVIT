import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { createDirectoryRepository } from "@moveit/supabase";
import { Button, Header, Page, Pill, SectionTitle } from "../../../src/components/ui";
import { getPreviewBusiness, createPreviewVenue, addPreviewFacility, facilitySchema, getPreviewBusinessOwnerId, slugify } from "../../../src/venue-preview";
import { searchSports, type CatalogueSport } from "../../../src/sports-catalogue";
import { loadAccountOnboarding, saveAccountOnboarding } from "../../../src/account-onboarding";
import { supabase } from "../../../src/supabase";
import { useMoveitTheme } from "../../../src/theme";

export default function NewBusinessVenueScreen() {
  const params = useLocalSearchParams<{ mode?: string; businessId?: string; city?: string; area?: string }>();
  const { colors } = useMoveitTheme();
  const business = getPreviewBusiness();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState(business?.area ?? "");
  const [email, setEmail] = useState(business?.email ?? "");
  const [sportQuery, setSportQuery] = useState("");
  const [sport, setSport] = useState<CatalogueSport | undefined>();
  const [facilityName, setFacilityName] = useState("");
  const [resourceType, setResourceType] = useState<"court" | "pitch" | "ground" | "lane" | "room" | "table" | "training_area">("court");
  const [capacity, setCapacity] = useState("4");
  const [duration, setDuration] = useState("60");
  const [increment, setIncrement] = useState("30");
  const [opens, setOpens] = useState("08:00");
  const [closes, setCloses] = useState("22:00");
  const [price, setPrice] = useState("1800");
  const [error, setError] = useState("");
  const matchingSports = useMemo(() => searchSports(sportQuery).slice(0, 8), [sportQuery]);

  if (params.mode === "live") {
    const businessId = typeof params.businessId === "string" ? params.businessId : "";
    const city = typeof params.city === "string" ? params.city : "";
    const area = typeof params.area === "string" ? params.area : "";
    return <LiveVenueRegistration businessId={businessId} initialCity={city} initialArea={area} />;
  }

  if (!business) {
    return <Page><Header eyebrow="BUSINESS PORTAL" title="Register your business first." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} /><Button label="Business registration" onPress={() => router.replace("/business/register")} /></Page>;
  }

  const create = () => {
    try {
      const facilityInput = facilitySchema.parse({
        name: facilityName,
        sportId: sport?.id ?? "",
        resourceType,
        capacity: Number(capacity),
        equipment: [],
        durationMinutes: Number(duration),
        incrementMinutes: Number(increment),
        opensAt: opens,
        closesAt: closes,
        pricePerHour: Number(price),
      });
      const venue = createPreviewVenue(business.id, getPreviewBusinessOwnerId(), {
        name, slug: slug || slugify(name), description, city: business.city, area, sportIds: sport ? [sport.id] : [], contactEmail: email,
      });
      addPreviewFacility(venue.id, getPreviewBusinessOwnerId(), facilityInput);
      router.replace("/business/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Venue preview could not be created.");
    }
  };

  return (
    <Page>
      <Header eyebrow="VENUE SETUP · LOCAL DRAFT" title="Add a venue." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>This draft is private to the local preview business. It is not publicly listed until a future verification workflow approves it.</Text>
      <Field label="Venue name" value={name} onChangeText={(value) => { setName(value); if (!slug) setSlug(slugify(value)); }} />
      <Field label="Public slug" value={slug} onChangeText={(value) => setSlug(slugify(value))} />
      <Text style={{ color: colors.muted, fontSize: 10 }}>Public URL preview: /venues/{slug || "your-venue-slug"}</Text>
      <Field label="Description" value={description} onChangeText={setDescription} />
      <Field label="City / area" value={area} onChangeText={setArea} />
      <Field label="Venue contact email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <SectionTitle title={sport ? `Sport · ${sport.name}` : "Choose a catalogue sport"} />
      <TextInput accessibilityLabel="Search venue sports" value={sportQuery} onChangeText={setSportQuery} placeholder="Find sport by name or alias" placeholderTextColor={colors.muted} style={inputStyle(colors)} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {matchingSports.map((item) => <Pill key={item.id} label={item.name} selected={sport?.id === item.id} onPress={() => setSport(item)} />)}
      </View>
      <SectionTitle title="First facility" />
      <Field label="Facility name" value={facilityName} onChangeText={setFacilityName} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {(["court", "pitch", "ground", "lane", "room", "table", "training_area"] as const).map((type) => <Pill key={type} label={type.replace("_", " ")} selected={resourceType === type} onPress={() => setResourceType(type)} />)}
      </View>
      <Field label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      <Field label="Bookable duration · minutes" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
      <Field label="Time increment · minutes" value={increment} onChangeText={setIncrement} keyboardType="number-pad" />
      <Field label="Opens · HH:MM" value={opens} onChangeText={setOpens} />
      <Field label="Closes · HH:MM" value={closes} onChangeText={setCloses} />
      <Field label="Standard price · PKR/hour" value={price} onChangeText={setPrice} keyboardType="number-pad" />
      <Text style={{ color: colors.muted, fontSize: 10 }}>Peak pricing, equipment, recurring schedules and date exceptions are reserved for the connected business service.</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      <Button label="Save local draft venue" onPress={create} icon="save" />
    </Page>
  );
}

function LiveVenueRegistration({ businessId, initialCity, initialArea }: { businessId: string; initialCity: string; initialArea: string }) {
  const { colors } = useMoveitTheme();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState(initialCity);
  const [area, setArea] = useState(initialArea);
  const [sportId, setSportId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [listingCreated, setListingCreated] = useState(false);

  const publish = async () => {
    if (!supabase) {
      setError("Supabase is not configured. Live venue listings require an authenticated account.");
      return;
    }
    if (!businessId) {
      setError("The business profile is missing. Start again from venue registration.");
      return;
    }
    setSaving(true);
    setError("");
    let venueCreated = false;
    try {
      await createDirectoryRepository(supabase).createVenue({
        businessId,
        name,
        description,
        city,
        area,
        sportIds: sportId ? [sportId] : [],
        status: "published",
      });
      venueCreated = true;
      setListingCreated(true);
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Sign in again to complete venue onboarding.");
      const account = await loadAccountOnboarding(auth.user.id);
      await saveAccountOnboarding(auth.user.id, {
        selectedRoles: Array.from(new Set([...account.selectedRoles, "business"])),
        completedRoles: Array.from(new Set([...account.completedRoles, "business"])),
        activeRole: "business",
      });
      router.replace("/business/dashboard");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Venue listing could not be published.";
      setError(venueCreated
        ? `The venue listing was created, but onboarding could not be completed. ${message} Do not submit the listing again.`
        : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Header eyebrow="VENUE ONBOARDING · STEP 2 OF 2" title="Add your first location." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Add additional locations under the same business profile whenever needed. Published listings are owner-submitted and not independently verified.</Text>
      <Field label="Venue name" value={name} onChangeText={setName} />
      <Field label="Description" value={description} onChangeText={setDescription} />
      <Field label="City" value={city} onChangeText={setCity} />
      <Field label="Area" value={area} onChangeText={setArea} />
      <View style={{ gap: 8 }}>
        <SectionTitle title="Sport" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill label="Not specified" selected={!sportId} onPress={() => setSportId("")} />
          {searchSports("").map((sport) => <Pill key={sport.id} label={sport.name} selected={sportId === sport.id} onPress={() => setSportId(sport.id)} />)}
        </View>
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      {listingCreated ? (
        <Button label="Open business dashboard" icon="briefcase" onPress={() => router.replace("/business/dashboard")} />
      ) : (
        <Button label={saving ? "Publishing…" : "Publish venue listing"} icon="map-pin" disabled={saving} onPress={() => void publish()} />
      )}
    </Page>
  );
}

function Field({ label, value, onChangeText, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "number-pad" | "email-address" }) {
  const { colors } = useMoveitTheme();
  return <View style={{ gap: 7 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"} placeholder={label} placeholderTextColor={colors.muted} style={inputStyle(colors)} /></View>;
}

function inputStyle(colors: ReturnType<typeof useMoveitTheme>["colors"]) {
  return { minHeight: 48, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14 } as const;
}
