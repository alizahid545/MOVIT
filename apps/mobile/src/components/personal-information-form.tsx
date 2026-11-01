import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { avatarUploadSchema, profileSchema, type AthleteProfile, type ProfileInput } from "@moveit/shared";
import { createAthleteProfileRepository, ProfileRepositoryError } from "@moveit/supabase";
import { saveDevelopmentAthleteDetails } from "../development-profile";
import { supabase } from "../supabase";
import { useMoveitTheme } from "../theme";
import { Button, Card, SectionTitle } from "./ui";

type Props = {
  onSaved?: (profile: AthleteProfile | null) => void | Promise<void>;
};

const emptyDraft: ProfileInput = {
  username: "",
  displayName: "",
  bio: "",
  city: "Lahore",
};

const repository = supabase ? createAthleteProfileRepository(supabase) : null;

export function PersonalInformationForm({ onSaved }: Props) {
  const { colors } = useMoveitTheme();
  const [draft, setDraft] = useState<ProfileInput>(emptyDraft);
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarMimeType, setAvatarMimeType] = useState<string | null>(null);
  const [avatarBytes, setAvatarBytes] = useState<Uint8Array | null>(null);
  const [removeSavedAvatar, setRemoveSavedAvatar] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileInput, string>>>({});
  const [loading, setLoading] = useState(Boolean(repository));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    if (!repository) return () => { active = false; };

    void repository.loadMyProfile().then((saved) => {
      if (!active) return;
      setProfile(saved);
      setDraft({
        username: saved.username,
        displayName: saved.displayName,
        bio: saved.bio,
        city: saved.city,
      });
    }).catch((caught: unknown) => {
      if (!active) return;
      if (!(caught instanceof ProfileRepositoryError) || caught.code !== "PROFILE_NOT_FOUND") {
        setFeedback(caught instanceof Error ? caught.message : "Your profile could not be loaded.");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, []);

  const updateField = (field: keyof ProfileInput, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback("");
  };

  const chooseAvatar = async () => {
    setFeedback("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFeedback("Allow photo-library access to choose a profile picture, or continue without one.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || !asset.mimeType) {
        setFeedback("The selected file type could not be verified. Choose a JPEG, PNG, or WebP image.");
        return;
      }
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error("The selected image could not be read.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const validation = avatarUploadSchema.safeParse({
        mimeType: asset.mimeType,
        size: bytes.byteLength,
      });
      if (!validation.success) {
        setFeedback(validation.error.issues[0]?.message ?? "Choose a JPEG, PNG, or WebP image up to 5 MiB.");
        return;
      }
      setAvatarUri(asset.uri);
      setAvatarMimeType(validation.data.mimeType);
      setAvatarBytes(bytes);
      setRemoveSavedAvatar(false);
    } catch (caught) {
      setFeedback(caught instanceof Error ? caught.message : "The selected photo could not be opened.");
    }
  };

  const save = async () => {
    setFeedback("");
    const parsed = profileSchema.safeParse(draft);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof ProfileInput, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in draft && !nextErrors[field as keyof ProfileInput]) {
          nextErrors[field as keyof ProfileInput] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      if (repository) {
        let saved = await repository.saveMyProfile(parsed.data);
        if (avatarUri && avatarMimeType && avatarBytes) {
          setUploading(true);
          saved = await repository.uploadAvatar({
            bytes: avatarBytes,
            mimeType: avatarMimeType,
          });
        } else if (removeSavedAvatar) {
          saved = await repository.removeAvatar();
        }
        setProfile(saved);
        setAvatarUri(null);
        setAvatarMimeType(null);
        setAvatarBytes(null);
        setRemoveSavedAvatar(false);
        setFeedback("Your profile was saved to your MOVEIT account.");
        await onSaved?.(saved);
      } else {
        await saveDevelopmentAthleteDetails({
          displayName: parsed.data.displayName,
          username: parsed.data.username,
          city: parsed.data.city,
          bio: parsed.data.bio,
        });
        setFeedback("Your demo profile was saved on this device.");
        await onSaved?.(null);
      }
    } catch (caught) {
      setFeedback(caught instanceof Error ? caught.message : "Your profile could not be saved.");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const currentAvatar = avatarUri ?? (removeSavedAvatar ? null : profile?.avatarPublicUrl);

  return (
    <Card style={{ gap: 16 }}>
      <SectionTitle title="Personal information" />
      {loading ? (
        <View accessibilityRole="progressbar" style={{ alignItems: "center", gap: 10, padding: 18 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted }}>Loading your saved profile…</Text>
        </View>
      ) : (
        <>
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 6 }}>
            {currentAvatar ? (
              <Image accessibilityLabel="Profile picture preview" source={{ uri: currentAvatar }} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceAlt }} />
            ) : (
              <View accessibilityLabel="No profile picture selected" style={{ width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Photo</Text>
              </View>
            )}
            {repository ? (
              <>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Choose profile picture" onPress={() => void chooseAvatar()} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}>
                    <Text style={{ color: colors.accent, fontWeight: "600" }}>{uploading ? "Uploading…" : "Choose photo"}</Text>
                  </Pressable>
                  {currentAvatar ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Remove profile picture" onPress={() => { setAvatarUri(null); setAvatarMimeType(null); setAvatarBytes(null); setRemoveSavedAvatar(true); }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}>
                      <Text style={{ color: colors.muted, fontWeight: "600" }}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center" }}>Optional · public profile picture · JPEG, PNG or WebP up to 5 MiB</Text>
              </>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center" }}>Profile pictures are available for signed-in accounts.</Text>
            )}
          </View>

          <Field label="Display name" value={draft.displayName} onChangeText={(value) => updateField("displayName", value)} error={errors.displayName} />
          <Field label="Username" value={draft.username} onChangeText={(value) => updateField("username", value)} error={errors.username} autoCapitalize="none" />
          <Field label="Bio (optional)" value={draft.bio} onChangeText={(value) => updateField("bio", value)} error={errors.bio} multiline />
          <Field label="City or area" value={draft.city} onChangeText={(value) => updateField("city", value)} error={errors.city} />

          {!!feedback && <Text accessibilityRole="alert" style={{ color: feedback.includes("saved") ? colors.success : colors.danger }}>{feedback}</Text>}
          <Button
            label={saving ? (uploading ? "Uploading photo…" : "Saving…") : "Save and continue"}
            onPress={() => void save()}
            disabled={saving}
          />
        </>
      )}
    </Card>
  );
}

function Field({
  label,
  value,
  onChangeText,
  error,
  autoCapitalize = "sentences",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  autoCapitalize?: "none" | "sentences";
  multiline?: boolean;
}) {
  const { colors } = useMoveitTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.muted}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          minHeight: multiline ? 90 : 48,
          color: colors.text,
          backgroundColor: colors.field,
          borderColor: error ? colors.danger : colors.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 13,
          paddingVertical: 12,
        }}
      />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11 }}>{error}</Text> : null}
    </View>
  );
}
