import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { communityPostSchema } from "@moveit/shared";
import { Button, Card, Header, Page } from "../../src/components/ui";
import {
  CommunitySessionError,
  createCommunityPost,
  getCommunityPost,
  hasCommunitySession,
  isLocalCommunityPreview,
  updateCommunityPost,
} from "../../src/community-api";
import { useMoveitTheme } from "../../src/theme";

type SessionState = "checking" | "signed-in" | "signed-out" | "error";

export default function CreatePostScreen() {
  const { colors } = useMoveitTheme();
  const params = useLocalSearchParams<{ postId?: string }>();
  const editingPostId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const localPreview = isLocalCommunityPreview();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [sessionError, setSessionError] = useState("");
  const [body, setBody] = useState("");
  const [validationError, setValidationError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const checkSession = useCallback(async () => {
    setSessionState("checking");
    setSessionError("");
    try {
      const signedIn = await hasCommunitySession();
      setSessionState(signedIn ? "signed-in" : "signed-out");
      if (editingPostId) {
        const post = await getCommunityPost(editingPostId);
        if (!post) throw new Error("This local post could not be found.");
        setBody(post.body);
      }
    } catch (caught) {
      setSessionState("error");
      setSessionError(caught instanceof Error ? caught.message : "Your session could not be checked.");
    }
  }, [editingPostId]);

  useFocusEffect(
    useCallback(() => {
      void checkSession();
    }, [checkSession]),
  );

  const submit = async () => {
    if (saving) return;
    const result = communityPostSchema.safeParse({ body });
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? "Check your post and try again.");
      return;
    }

    setValidationError("");
    setSaveError("");
    setSaving(true);
    try {
      if (editingPostId) await updateCommunityPost(editingPostId, result.data.body);
      else await createCommunityPost(result.data.body);
      router.replace("/(tabs)/community");
    } catch (caught) {
      if (caught instanceof CommunitySessionError) setSessionState("signed-out");
      setSaveError(caught instanceof Error ? caught.message : "Your post could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page>
        <Header
          eyebrow={localPreview ? "LOCAL PREVIEW · COMMUNITY" : "COMMUNITY · NEW POST"}
          title={editingPostId ? "Edit your post." : "Share a thought."}
          action={
            <Pressable
              accessibilityRole="button"
              onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/community")}
              hitSlop={12}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
            >
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Cancel</Text>
            </Pressable>
          }
        />

        {sessionState === "checking" ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Checking sign-in" style={{ alignItems: "center", padding: 24, gap: 10 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>Checking your sign-in…</Text>
          </View>
        ) : sessionState === "signed-out" ? (
          <Card>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>Sign in to post</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
              You can keep writing below. Your draft stays on this screen while you sign in.
            </Text>
            <Button label="Continue to sign in" onPress={() => router.push("/auth")} />
            {saveError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{saveError}</Text> : null}
          </Card>
        ) : sessionState === "error" ? (
          <Card>
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{sessionError}</Text>
            <Button label="Try again" variant="secondary" onPress={() => void checkSession()} />
          </Card>
        ) : null}

        <Card>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
            Start a conversation, share a small win, or invite local players. Keep it welcoming.
          </Text>
          <TextInput
            accessibilityLabel="Community post text"
            accessibilityHint="Write up to 2,000 characters."
            value={body}
            onChangeText={(value) => {
              setBody(value.slice(0, 2000));
              setValidationError("");
              setSaveError("");
            }}
            placeholder="What’s on your mind?"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            editable={!saving}
            style={{
              minHeight: 180,
              color: colors.text,
              backgroundColor: colors.field,
              borderWidth: 1,
              borderColor: validationError ? colors.danger : colors.border,
              borderRadius: 14,
              padding: 14,
              fontSize: 14,
              lineHeight: 21,
            }}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
            {validationError ? (
              <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11, flex: 1 }}>{validationError}</Text>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 10, flex: 1 }}>Text posts only · Images aren’t configured yet</Text>
            )}
            <Text accessibilityLabel={`${body.length} of 2,000 characters`} style={{ color: colors.muted, fontSize: 10 }}>
              {body.length}/2,000
            </Text>
          </View>
        </Card>

        {saveError ? (
          <Card style={{ backgroundColor: colors.surfaceAlt }}>
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{saveError}</Text>
          </Card>
        ) : null}

        <Button
          label={saving ? "Saving…" : sessionState === "signed-out" ? "Sign in to publish" : editingPostId ? "Save changes" : "Publish post"}
          onPress={() => {
            if (sessionState === "signed-out") router.push("/auth");
            else if (sessionState === "signed-in") void submit();
          }}
          disabled={saving || sessionState === "checking" || sessionState === "error"}
        />
        <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}>
          {localPreview
            ? "LOCAL DEVELOPMENT PREVIEW · This post is saved only on this device and is not shared with other MOVEIT users. Avoid including sensitive or health information."
            : "Your post is sent to the MOVEIT community only after the database confirms it was saved."}
        </Text>
      </Page>
    </KeyboardAvoidingView>
  );
}
