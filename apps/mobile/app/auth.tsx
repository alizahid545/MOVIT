import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { router } from "expo-router";
import { authFormSchema, type AuthFormInput } from "@moveit/shared";
import { checkSupabaseConnectivity, SUPABASE_SETUP_ERROR } from "@moveit/supabase";
import { supabase } from "../src/supabase";
import { getLocalPreviewAccountId, getPostAuthenticationRoute, loadAccountOnboarding } from "../src/account-onboarding";
import { createStyles } from "../src/styles";
import { useMoveitTheme } from "../src/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Icon } from "../src/components/ui";

type Mode = "signin" | "signup" | "reset";

export default function Auth() {
  const { colors } = useMoveitTheme();
  const styles = createStyles(colors);
  const [mode, setMode] = useState<Mode>("signin");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionFeedback, setConnectionFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const { control, handleSubmit, formState: { errors } } = useForm<AuthFormInput>({
    resolver: zodResolver(authFormSchema(mode)),
    defaultValues: { email: "", password: "" },
  });

  const submit = async (values: AuthFormInput) => {
    setFeedback("");
    if (!supabase) {
      setFeedback(SUPABASE_SETUP_ERROR);
      return;
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email);
        setFeedback(error?.message ?? "If an account exists for that email, a reset link will be sent.");
      } else if (mode === "signup") {
        if (!values.password) {
          setFeedback("Enter your password.");
          return;
        }
        const { email, password } = values;
        const { error } = await supabase.auth.signUp({ email, password });
        setFeedback(error?.message ?? "Check your email to verify your account before signing in.");
      } else {
        if (!values.password) {
          setFeedback("Enter your password.");
          return;
        }
        const { email, password } = values;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setFeedback(error.message);
          return;
        }
        if (data.session) {
          const onboarding = await loadAccountOnboarding(data.session.user.id);
          router.replace(getPostAuthenticationRoute(onboarding));
        }
      }
    } catch (caught) {
      setFeedback(caught instanceof Error ? caught.message : "Your account setup could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  const continueLocalPreview = async () => {
    setBusy(true);
    setFeedback("");
    try {
      const onboarding = await loadAccountOnboarding(getLocalPreviewAccountId());
      router.replace(getPostAuthenticationRoute(onboarding));
    } catch (caught) {
      setFeedback(caught instanceof Error ? caught.message : "Local preview data could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setCheckingConnection(true);
    setConnectionFeedback(null);
    try {
      await checkSupabaseConnectivity(
        process.env.EXPO_PUBLIC_SUPABASE_URL,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      );
      setConnectionFeedback({ message: "Supabase is reachable. This check did not sign in or read/write app data.", error: false });
    } catch (caught) {
      setConnectionFeedback({
        message: caught instanceof Error ? caught.message : "Supabase connectivity could not be verified.",
        error: true,
      });
    } finally {
      setCheckingConnection(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={styles.brand}>MOVEIT<Text style={styles.accentMark}>.</Text></Text>
            <Text style={styles.eyebrow}>YOUR CITY. YOUR PEOPLE. YOUR GAME.</Text>
            <Text style={styles.title}>{mode === "signin" ? "Welcome back." : mode === "reset" ? "Reset password." : "Get moving."}</Text>
            <Text style={styles.body}>{mode === "reset" ? "Enter your email and we’ll send a reset link." : "Find your people. Find your game. Starting in Lahore."}</Text>
            <View style={styles.form}>
              <Text style={styles.label}>Email address</Text>
              <Controller control={control} name="email" render={({ field: { onChange, value } }) => (
                <TextInput value={value} onChangeText={onChange} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" placeholderTextColor={colors.muted} style={styles.input} />
              )} />
              {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
              {mode !== "reset" && <>
                <Text style={styles.label}>Password</Text>
                <Controller control={control} name="password" render={({ field: { onChange, value } }) => (
                  <TextInput value={value} onChangeText={onChange} secureTextEntry autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="At least 8 characters" placeholderTextColor={colors.muted} style={styles.input} />
                )} />
                {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
              </>}
              <Pressable accessibilityRole="button" style={styles.button} disabled={busy} onPress={() => void handleSubmit(submit)()}>
                {busy ? <ActivityIndicator color={colors.primaryOn} /> : (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Text style={styles.buttonText}>{mode === "signin" ? "Sign in" : mode === "reset" ? "Send reset link" : "Create account"}</Text>
                    <Icon name="arrow-up-right" size={16} color={colors.primaryOn} />
                  </View>
                )}
              </Pressable>
            </View>
            {supabase ? (
              <View style={{ gap: 8 }}>
                <Button
                  label={checkingConnection ? "Checking connection…" : "Test Supabase connection"}
                  icon="activity"
                  variant="secondary"
                  disabled={busy || checkingConnection}
                  onPress={() => void testConnection()}
                />
                {connectionFeedback ? (
                  <Text
                    accessibilityRole={connectionFeedback.error ? "alert" : "text"}
                    accessibilityLiveRegion={connectionFeedback.error ? "assertive" : "polite"}
                    style={{ color: connectionFeedback.error ? colors.danger : colors.success, fontSize: 12, lineHeight: 18 }}
                  >
                    {connectionFeedback.message}
                  </Text>
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" }}>
                  Checks the Supabase Auth health endpoint only; it does not verify database access or policies.
                </Text>
              </View>
            ) : null}
            {!supabase ? (
              <View style={{ gap: 8 }}>
                <Button
                  label="Continue to local development preview"
                  icon="activity"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => void continueLocalPreview()}
                />
                <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" }}>
                  No sign-in or account is created. Roles and sample records are stored only on this device.
                </Text>
              </View>
            ) : null}
            {!!feedback && <Text accessibilityRole="alert" style={styles.feedback}>{feedback}</Text>}
            {mode === "signin" && <Pressable onPress={() => { setMode("reset"); setFeedback(""); }}><Text style={styles.switch}>Forgot password?</Text></Pressable>}
            <Pressable onPress={() => { setMode(mode === "signup" ? "signin" : mode === "reset" ? "signin" : "signup"); setFeedback(""); }}>
              <Text style={styles.switch}>{mode === "signup" || mode === "reset" ? "Already have an account? Sign in" : "New to MOVEIT? Create account"}</Text>
            </Pressable>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
