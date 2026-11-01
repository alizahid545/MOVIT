import { useMemo } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, Header, Icon, Page, SectionTitle } from "../../src/components/ui";
import { previewTrainers } from "../../src/sports-preview-data";
import { useMoveitTheme } from "../../src/theme";

export default function TrainerPreviewProfileScreen() {
  const { colors } = useMoveitTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trainerId = Array.isArray(id) ? id[0] : id;
  const trainer = useMemo(() => previewTrainers.find((item) => item.id === trainerId), [trainerId]);

  return (
    <Page>
      <Header
        eyebrow="SAMPLE PROFILE · NOT VERIFIED"
        title={trainer?.name ?? "Trainer profile."}
        action={<Button label="Back" variant="quiet" onPress={() => router.back()} />}
      />
      {trainer ? (
        <>
          <Card>
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <Icon name="user" size={27} color={colors.muted} />
              </View>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>{trainer.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{trainer.area}</Text>
              <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600" }}>{trainer.qualificationClaim}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{trainer.profile}</Text>
          </Card>
          <View style={{ gap: 10 }}>
            <SectionTitle title="Specialties · example only" />
            {trainer.specialties.map((specialty) => (
              <View key={specialty} style={{ flexDirection: "row", alignItems: "center", gap: 9, minHeight: 36 }}>
                <Icon name="check" size={15} color={colors.primary} />
                <Text style={{ color: colors.text, fontSize: 13 }}>{specialty}</Text>
              </View>
            ))}
          </View>
          <Card>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>No ratings or reviews</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
              MOVEIT has no trainer credential verification, reviews, availability, contact, or booking flow yet.
            </Text>
          </Card>
          <Button label="Trainer contact unavailable" variant="secondary" disabled onPress={() => undefined} />
        </>
      ) : (
        <Card>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Sample profile unavailable</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>This profile is not part of the current local preview.</Text>
          <Button label="Return to trainer directory" onPress={() => router.replace("/trainers")} />
        </Card>
      )}
    </Page>
  );
}
