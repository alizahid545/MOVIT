import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { Button, Card, Header, Page, Pill, SectionTitle } from "../../src/components/ui";
import { createPreviewTournament, getPreviewBusiness, getPreviewBusinessOwnerId, listOwnedPreviewVenues, listPreviewTournaments, type VenueRecord } from "../../src/venue-preview";
import { findSport } from "../../src/sports-catalogue";
import { useMoveitTheme } from "../../src/theme";

function dateOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export default function BusinessEventsScreen() {
  const { colors } = useMoveitTheme();
  const business = getPreviewBusiness();
  const venues = listOwnedPreviewVenues();
  const [selectedVenue, setSelectedVenue] = useState<VenueRecord | undefined>(venues[0]);
  const [facilityId, setFacilityId] = useState(venues[0]?.facilities[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsOn, setStartsOn] = useState(dateOffset(14));
  const [endsOn, setEndsOn] = useState(dateOffset(15));
  const [registrationClosesOn, setRegistrationClosesOn] = useState(dateOffset(13));
  const [participation, setParticipation] = useState<"individual" | "team">("individual");
  const [teamSize, setTeamSize] = useState("5");
  const [limit, setLimit] = useState("16");
  const [eligibility, setEligibility] = useState("Open to eligible local participants.");
  const [scoringFormat, setScoringFormat] = useState("");
  const [entryFee, setEntryFee] = useState("0");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const events = useMemo(() => listPreviewTournaments(), [refresh]);

  if (!business) return <Page><Header eyebrow="TOURNAMENTS" title="Business registration required." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} /><Button label="Register business preview" onPress={() => router.push("/business/register")} /></Page>;

  const create = () => {
    const facility = selectedVenue?.facilities.find((item) => item.id === facilityId);
    if (!selectedVenue || !facility) {
      setMessage("Add a venue and facility before creating an event.");
      return;
    }
    try {
      createPreviewTournament(business.id, getPreviewBusinessOwnerId(), {
        name, description, sportId: facility.sportId, venueId: selectedVenue.id, facilityId,
        startsOn, endsOn, registrationClosesOn, participation,
        teamSize: participation === "team" ? Number(teamSize) : undefined,
        participantLimit: limit ? Number(limit) : undefined,
        eligibility, scoringFormat, entryFee: Number(entryFee), prizeDescription,
      });
      setMessage("Tournament saved as a local draft. It is not published, and no fees or prizes are collected.");
      setRefresh((value) => value + 1);
      setName("");
      setDescription("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Tournament preview could not be saved.");
    }
  };

  return (
    <Page>
      <Header eyebrow="BUSINESS EVENTS · LOCAL PREVIEW" title="Tournament drafts." action={<Button label="Dashboard" variant="quiet" onPress={() => router.replace("/business/dashboard")} />} />
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>Events use a catalogue sport and a facility owned by this preview business. Scoring is a sport-specific description, not a universal score model. Drafts are not published or searchable.</Text>
      <SectionTitle title="Venue" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {venues.map((venue) => <Pill key={venue.id} label={venue.name} selected={selectedVenue?.id === venue.id} onPress={() => { setSelectedVenue(venue); setFacilityId(venue.facilities[0]?.id ?? ""); }} />)}
      </View>
      {selectedVenue?.facilities.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {selectedVenue.facilities.map((facility) => <Pill key={facility.id} label={`${facility.name} · ${findSport(facility.sportId)?.name ?? ""}`} selected={facilityId === facility.id} onPress={() => setFacilityId(facility.id)} />)}
        </View>
      ) : <Text style={{ color: colors.muted, fontSize: 11 }}>Add a venue and facility before creating an event.</Text>}
      <Field label="Tournament name" value={name} onChangeText={setName} />
      <Field label="Description and rules" value={description} onChangeText={setDescription} />
      <Field label="Start date · YYYY-MM-DD" value={startsOn} onChangeText={setStartsOn} />
      <Field label="End date · YYYY-MM-DD" value={endsOn} onChangeText={setEndsOn} />
      <Field label="Registration closes · YYYY-MM-DD" value={registrationClosesOn} onChangeText={setRegistrationClosesOn} />
      <SectionTitle title="Participation format" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pill label="Individual" selected={participation === "individual"} onPress={() => setParticipation("individual")} />
        <Pill label="Team" selected={participation === "team"} onPress={() => setParticipation("team")} />
      </View>
      {participation === "team" ? <Field label="Players per team" value={teamSize} onChangeText={setTeamSize} keyboardType="number-pad" /> : null}
      <Field label="Participant limit · optional" value={limit} onChangeText={setLimit} keyboardType="number-pad" />
      <Field label="Eligibility" value={eligibility} onChangeText={setEligibility} />
      <Field label="Scoring format for this sport" value={scoringFormat} onChangeText={setScoringFormat} />
      <Field label="Entry fee · PKR · 0 if none" value={entryFee} onChangeText={setEntryFee} keyboardType="number-pad" />
      <Field label="Prize description · optional" value={prizeDescription} onChangeText={setPrizeDescription} />
      <Button label="Save tournament draft" icon="save" onPress={create} />
      {message ? <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 11 }}>{message}</Text> : null}
      <SectionTitle title={`Draft events · ${events.length}`} />
      {events.length ? events.map((event) => <Card key={event.id}><Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{event.name}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{event.startsOn}–{event.endsOn} · {event.participation} · {event.status}</Text><Text style={{ color: colors.danger, fontSize: 10 }}>Preview only · not published · no registration or payment is active</Text></Card>) : <Card><Text style={{ color: colors.muted, fontSize: 12 }}>No tournament drafts yet.</Text></Card>}
    </Page>
  );
}

function Field({ label, value, onChangeText, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "number-pad" }) {
  const { colors } = useMoveitTheme();
  return <View style={{ gap: 7 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={label} placeholderTextColor={colors.muted} style={{ minHeight: 46, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13 }} /></View>;
}
