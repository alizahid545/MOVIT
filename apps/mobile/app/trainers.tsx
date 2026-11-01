import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, Text, TextInput, View } from "react-native";
import { sportsCatalogue } from "@moveit/shared";
import { createDirectoryRepository, type CoachListing, type DirectoryInquiry } from "@moveit/supabase";
import { Button, Card, Header, Page, Pill, SectionTitle } from "../src/components/ui";
import { supabase } from "../src/supabase";
import { useMoveitTheme } from "../src/theme";

export default function TrainersScreen() {
  const { colors } = useMoveitTheme();
  const repository = useMemo(() => supabase ? createDirectoryRepository(supabase) : null, []);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [sportId, setSportId] = useState("");
  const [coaches, setCoaches] = useState<CoachListing[]>([]);
  const [inquiries, setInquiries] = useState<DirectoryInquiry[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [coachCity, setCoachCity] = useState("");
  const [area, setArea] = useState("");
  const [coachSports, setCoachSports] = useState<string[]>([]);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!repository) {
      setError("Sign in and configure Supabase to browse published coaches.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const rows = await repository.discoverCoaches({
        query,
        city,
        sportId: sportId || undefined,
        limit: 20,
        offset: 0,
      });
      setCoaches(rows);
      setHasMore(rows.length === 20);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Coach listings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [repository, query, city, sportId]);

  const loadMore = async () => {
    if (!repository || moreLoading || !hasMore) return;
    setMoreLoading(true);
    setError("");
    try {
      const rows = await repository.discoverCoaches({
        query,
        city,
        sportId: sportId || undefined,
        limit: 20,
        offset: coaches.length,
      });
      setCoaches((current) => [...current, ...rows]);
      setHasMore(rows.length === 20);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "More coaches could not be loaded.");
    } finally {
      setMoreLoading(false);
    }
  };

  const loadInquiries = useCallback(async () => {
    if (!repository) return;
    try {
      setInquiries(await repository.loadMyCoachInquiries());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Coach inquiries could not be loaded.");
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadInquiries(); }, [loadInquiries]);

  const sendInquiry = async (coachId: string) => {
    if (!repository) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await repository.createCoachInquiry(coachId, messages[coachId] ?? "");
      setMessages((current) => ({ ...current, [coachId]: "" }));
      setNotice("Your inquiry was sent privately to the coach.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your inquiry could not be sent.");
    } finally {
      setSaving(false);
    }
  };

  const publishProfile = async () => {
    if (!repository) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await repository.saveMyCoachProfile({
        headline,
        bio,
        city: coachCity,
        area,
        sportIds: coachSports,
        specialties: [],
        isPublished: true,
      });
      setNotice("Your coach profile is published. Credentials are not verified by MOVEIT.");
      setShowProfileForm(false);
      await load();
      await loadInquiries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your coach profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const updateInquiry = async (inquiry: DirectoryInquiry, status: DirectoryInquiry["status"]) => {
    if (!repository) return;
    setSaving(true);
    setError("");
    try {
      await repository.updateCoachInquiryStatus(inquiry.id, status);
      await loadInquiries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inquiry status could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSport = (id: string) => {
    setCoachSports((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : current.length < 20 ? [...current, id] : current);
  };

  return (
    <Page refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.accent} />}>
      <Header eyebrow="LIVE COACH DIRECTORY" title="Find a coach." />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        Coach profiles are self-published. MOVEIT has not verified qualifications, credentials, or availability.
      </Text>
      <TextInput accessibilityLabel="Search coaches" value={query} onChangeText={setQuery} placeholder="Search name, bio or headline" placeholderTextColor={colors.muted} style={inputStyle(colors)} />
      <TextInput accessibilityLabel="Filter coaches by city" value={city} onChangeText={setCity} placeholder="City or area" placeholderTextColor={colors.muted} style={inputStyle(colors)} />
      <View style={{ gap: 8 }}>
        <SectionTitle title="Sport" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill label="All sports" selected={!sportId} onPress={() => setSportId("")} />
          {sportsCatalogue.map((sport) => <Pill key={sport.id} label={sport.name} selected={sportId === sport.id} onPress={() => setSportId(sport.id)} />)}
        </View>
      </View>
      <Button label={showProfileForm ? "Hide coach profile form" : "List your coach profile"} icon="user" variant="secondary" onPress={() => setShowProfileForm((visible) => !visible)} />
      {showProfileForm ? (
        <Card>
          <SectionTitle title="Your public coach profile" />
          <Field label="Headline" value={headline} onChangeText={setHeadline} />
          <Field label="About" value={bio} onChangeText={setBio} multiline />
          <Field label="City" value={coachCity} onChangeText={setCoachCity} />
          <Field label="Area" value={area} onChangeText={setArea} />
          <Text style={{ color: colors.muted, fontSize: 11 }}>Choose the sports you coach.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {sportsCatalogue.map((sport) => <Pill key={sport.id} label={sport.name} selected={coachSports.includes(sport.id)} onPress={() => toggleSport(sport.id)} />)}
          </View>
          <Button label={saving ? "Publishing…" : "Publish coach profile"} disabled={saving} onPress={() => void publishProfile()} />
        </Card>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      {notice ? <Text accessibilityRole="status" style={{ color: colors.accent, fontSize: 12 }}>{notice}</Text> : null}
      {loading && coaches.length === 0 ? <ActivityIndicator accessibilityLabel="Loading coaches" color={colors.accent} /> : null}
      <View style={{ gap: 12 }}>
        <SectionTitle title={`${coaches.length} live ${coaches.length === 1 ? "coach" : "coaches"}`} />
        {coaches.map((coach) => (
          <Card key={coach.userId}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{coach.displayName || `@${coach.username}`}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{coach.headline || "MOVEIT coach"} · {[coach.area, coach.city].filter(Boolean).join(", ")}</Text>
            <Text style={{ color: colors.text, fontSize: 12 }}>
              {coach.sportIds.map((id) => sportsCatalogue.find((sport) => sport.id === id)?.name ?? id).join(" · ") || "Sports not specified"}
            </Text>
            {coach.bio ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{coach.bio}</Text> : null}
            {coach.specialties.length ? <Text style={{ color: colors.muted, fontSize: 11 }}>{coach.specialties.join(" · ")}</Text> : null}
            <Text style={{ color: colors.muted, fontSize: 10 }}>Self-published · qualifications and credentials are not verified</Text>
            <TextInput
              accessibilityLabel={`Inquiry for ${coach.displayName || coach.username}`}
              value={messages[coach.userId] ?? ""}
              onChangeText={(value) => setMessages((current) => ({ ...current, [coach.userId]: value }))}
              multiline
              maxLength={2000}
              placeholder="Write a private inquiry"
              placeholderTextColor={colors.muted}
              style={[inputStyle(colors), { minHeight: 76, textAlignVertical: "top", paddingTop: 12 }]}
            />
            <Button label="Send inquiry" disabled={saving || !(messages[coach.userId] ?? "").trim()} onPress={() => void sendInquiry(coach.userId)} />
          </Card>
        ))}
        {!loading && coaches.length === 0 && !error ? (
          <Card>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>No published coach profiles</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Try another city or sport. Sample trainer profiles are not shown as live results.</Text>
          </Card>
        ) : null}
      </View>
      {!loading && hasMore ? <Button label={moreLoading ? "Loading…" : "Load more coaches"} variant="secondary" disabled={moreLoading} onPress={() => void loadMore()} /> : null}
      <View style={{ gap: 12 }}>
        <SectionTitle title={`Coach inquiries · ${inquiries.length}`} />
        {inquiries.map((inquiry) => (
          <Card key={inquiry.id}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>Inquiry · {inquiry.status}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>From MOVEIT account {inquiry.requesterId.slice(0, 8)}</Text>
            <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>{inquiry.message}</Text>
            {inquiry.status !== "closed" ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Button label="Mark responded" variant="secondary" disabled={saving} onPress={() => void updateInquiry(inquiry, "responded")} /></View>
                <View style={{ flex: 1 }}><Button label="Close" variant="secondary" disabled={saving} onPress={() => void updateInquiry(inquiry, "closed")} /></View>
              </View>
            ) : null}
          </Card>
        ))}
        {!inquiries.length ? <Text style={{ color: colors.muted, fontSize: 11 }}>No incoming coaching inquiries yet.</Text> : null}
      </View>
    </Page>
  );
}

function Field({ label, value, onChangeText, multiline = false }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
}) {
  const { colors } = useMoveitTheme();
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      maxLength={multiline ? 2000 : 120}
      placeholder={label}
      placeholderTextColor={colors.muted}
      style={[inputStyle(colors), multiline ? { minHeight: 76, textAlignVertical: "top", paddingTop: 12 } : null]}
    />
  );
}

function inputStyle(colors: ReturnType<typeof useMoveitTheme>["colors"]) {
  return {
    minHeight: 46,
    color: colors.text,
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
  } as const;
}
