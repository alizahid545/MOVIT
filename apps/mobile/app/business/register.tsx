import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { createDirectoryRepository, type BusinessProfile } from "@moveit/supabase";
import { Button, Header, Page, Pill, SectionTitle } from "../../src/components/ui";
import { businessRegistrationSchema, registerPreviewBusiness } from "../../src/venue-preview";
import { getLocalPreviewAccountId, loadAccountOnboarding, saveAccountOnboarding } from "../../src/account-onboarding";
import { supabase } from "../../src/supabase";
import { useMoveitTheme } from "../../src/theme";

export default function BusinessRegistrationScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { colors } = useMoveitTheme();
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<"venue" | "gym" | "club" | "academy">("venue");
  const [city, setCity] = useState("Lahore");
  const [area, setArea] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    const parsed = businessRegistrationSchema.safeParse({ ownerName, email, businessName, businessType, city, area });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the business details.");
      return;
    }
    try {
      let accountId = getLocalPreviewAccountId();
      if (supabase) {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!data.user) throw new Error("Sign in with your MOVEIT account before setting up a business profile.");
        accountId = data.user.id;
      }
      const current = await loadAccountOnboarding(accountId);
      await saveAccountOnboarding(accountId, {
        selectedRoles: Array.from(new Set([...current.selectedRoles, "business"])),
        completedRoles: supabase
          ? current.completedRoles
          : Array.from(new Set([...current.completedRoles, "business"])),
        activeRole: "business",
      });
      registerPreviewBusiness(parsed.data);
      setError("");
      router.replace("/business/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Business preview could not be created.");
    }
  };

  if (params.mode === "live") {
    return <LiveBusinessRegistration />;
  }

  return (
    <Page>
      <Header eyebrow="BUSINESS REGISTRATION · PREVIEW" title="Start with your business." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        Use your existing MOVEIT account when business memberships are connected. This temporary form collects preview details only; it does not create an account, verify ownership, or submit documents.
      </Text>
      <Field label="Owner name" value={ownerName} onChangeText={setOwnerName} />
      <Field label="Account email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Business name" value={businessName} onChangeText={setBusinessName} />
      <View style={{ gap: 8 }}>
        <SectionTitle title="Business type" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["venue", "gym", "club", "academy"] as const).map((kind) => <Pill key={kind} label={kind} selected={kind === businessType} onPress={() => setBusinessType(kind)} />)}
        </View>
      </View>
      <Field label="City" value={city} onChangeText={setCity} />
      <Field label="Area" value={area} onChangeText={setArea} />
      <Text style={{ color: colors.muted, fontSize: 11 }}>Verification state after local submission: Pending · not verified.</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      <Button label="Create local business preview" icon="briefcase" onPress={submit} />
    </Page>
  );
}

function LiveBusinessRegistration() {
  const { colors } = useMoveitTheme();
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<"venue" | "gym" | "club" | "academy">("venue");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void createDirectoryRepository(supabase).loadMyBusinesses()
      .then((rows) => {
        setBusinesses(rows);
        setSelectedBusinessId(rows[0]?.id ?? "");
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Business profiles could not be loaded."));
  }, []);

  const addVenueToExistingBusiness = () => {
    const business = businesses.find((item) => item.id === selectedBusinessId);
    if (!business) return;
    router.push({
      pathname: "/business/venue/new",
      params: { mode: "live", businessId: business.id, city: business.city, area: business.area },
    });
  };

  const create = async () => {
    if (!supabase) {
      setError("Supabase is not configured. Live business listings require an authenticated account.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const business = await createDirectoryRepository(supabase).createBusiness({
        name,
        businessType,
        city,
        area,
      });
      router.replace({
        pathname: "/business/venue/new",
        params: { mode: "live", businessId: business.id, city, area },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Business profile could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Header eyebrow="VENUE ONBOARDING · STEP 1 OF 2" title="Set up your business." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>This creates an account-backed business profile, then takes you to the first venue location. Directory listings are owner-submitted and not independently verified; court schedules, pricing and bookings are not connected to this backend.</Text>
      {businesses.length ? (
        <View style={{ gap: 8 }}>
          <SectionTitle title="Add a location to an existing business" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {businesses.map((business) => <Pill key={business.id} label={`${business.name} · ${business.city}`} selected={selectedBusinessId === business.id} onPress={() => setSelectedBusinessId(business.id)} />)}
          </View>
          <Button label="Add venue location" variant="secondary" onPress={addVenueToExistingBusiness} />
        </View>
      ) : null}
      <SectionTitle title="Or create a business profile" />
      <Field label="Business name" value={name} onChangeText={setName} />
      <View style={{ gap: 8 }}>
        <SectionTitle title="Business type" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["venue", "gym", "club", "academy"] as const).map((type) => <Pill key={type} label={type} selected={businessType === type} onPress={() => setBusinessType(type)} />)}
        </View>
      </View>
      <Field label="City" value={city} onChangeText={setCity} />
      <Field label="Area" value={area} onChangeText={setArea} />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      <Button label={saving ? "Saving…" : "Continue to venue listing"} icon="briefcase" disabled={saving} onPress={() => void create()} />
    </Page>
  );
}

function Field({ label, value, onChangeText, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "email-address" }) {
  const { colors } = useMoveitTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={keyboardType ? "none" : "words"} placeholder={label} placeholderTextColor={colors.muted} style={{ minHeight: 48, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14 }} />
    </View>
  );
}
