import { zodResolver } from "@hookform/resolvers/zod";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  avatarUploadSchema,
  profileSchema,
  authFormSchema,
  type AthleteProfile,
  type AthleteOnboardingState,
  type AuthFormInput,
  type ProfileInput,
} from "@moveit/shared";
import { createAthleteProfileRepository, ProfileRepositoryError, SUPABASE_SETUP_ERROR } from "@moveit/supabase";
import { supabase } from "./supabase";
import { SportPreferencesForm } from "./SportPreferencesForm";
import { AthletePreferencesForm } from "./AthletePreferencesForm";
import { AthleteOnboardingReview } from "./AthleteOnboardingReview";
import { PlatformHub } from "./PlatformHub";

type AuthMode = "signin" | "signup" | "reset";
type ThemeChoice = "system" | "light" | "dark";

export default function App() {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [onboarding, setOnboarding] = useState<AthleteOnboardingState | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<AuthMode>("signin");

  useEffect(() => {
    if (theme !== "system") {
      document.documentElement.dataset.theme = theme;
      return;
    }
    const preference = window.matchMedia("(prefers-color-scheme: light)");
    const applySystemTheme = () => {
      document.documentElement.dataset.theme = preference.matches ? "light" : "dark";
    };
    applySystemTheme();
    preference.addEventListener("change", applySystemTheme);
    return () => preference.removeEventListener("change", applySystemTheme);
  }, [theme]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let alive = true;
    setProfileLoading(true);
    const repository = createAthleteProfileRepository(supabase);
    void repository.loadMyProfile()
      .then((data) => {
        if (!alive) return;
        setProfile(data);
        setProfileLoading(false);
      }).catch((profileError: unknown) => {
        if (!alive) return;
        if (!(profileError instanceof ProfileRepositoryError) || profileError.code !== "PROFILE_NOT_FOUND") {
          setError(profileError instanceof Error ? profileError.message : "Your profile could not be loaded.");
        }
        setProfile(null);
        setProfileLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  useEffect(() => {
    if (!supabase || !session?.user || !profile) {
      setOnboarding(null);
      setOnboardingLoading(false);
      return;
    }
    let alive = true;
    setOnboardingLoading(true);
    void createAthleteProfileRepository(supabase).loadMyAthleteOnboardingState()
      .then((state) => {
        if (alive) setOnboarding(state);
      })
      .catch((onboardingError: unknown) => {
        if (alive) setError(onboardingError instanceof Error ? onboardingError.message : "Onboarding progress could not be loaded.");
      })
      .finally(() => {
        if (alive) setOnboardingLoading(false);
      });
    return () => { alive = false; };
  }, [session, profile]);

  const updateOnboarding = async (
    step: Exclude<AthleteOnboardingState["step"], "complete" | null>,
    completed = false,
  ) => {
    if (!supabase) throw new Error(SUPABASE_SETUP_ERROR);
    const repository = createAthleteProfileRepository(supabase);
    await repository.saveMyAthleteOnboardingState(step, completed);
    if (completed) {
      setOnboarding(await repository.loadMyAthleteOnboardingState());
    } else {
      setOnboarding({
        version: 2,
        step,
        completedAt: onboarding?.completedAt ?? null,
      });
    }
    setError("");
  };

  if (!supabase) {
    return (
      <main className="page-shell">
        <div className="setup-card">
          <Brand />
          <p className="eyebrow">FOUNDATION · LAHORE</p>
          <h1>Let’s get MOVEIT moving.</h1>
          <p className="muted">{SUPABASE_SETUP_ERROR}</p>
          <div className="setup-note">
            Copy <code>.env.example</code> to <code>apps/web/.env</code>, add your
            Supabase project URL and anon key, then restart the dev server.
          </div>
        </div>
      </main>
    );
  }

  if (loading) return <Loading />;

  if (!session) {
    return (
      <main className="page-shell">
        <section className="auth-layout">
          <div className="hero-copy">
            <Brand />
            <ThemeSelector value={theme} onChange={setTheme} />
            <p className="eyebrow">YOUR CITY. YOUR PEOPLE. YOUR GAME.</p>
            <h1>Make room<br />for more <em>play.</em></h1>
            <p className="muted">Find your people. Find your game. MOVEIT.</p>
            <div className="city-chip"><span /> Starting in Lahore, Pakistan</div>
          </div>
          <div className="form-card">
            <p className="eyebrow">YOUR NEXT MOVE STARTS HERE</p>
            <h2>{mode === "signup" ? "Create your account" : mode === "reset" ? "Reset password" : "Welcome back"}</h2>
            <p className="muted">
              {mode === "signup" ? "Join a community built around getting out there." : mode === "reset" ? "We’ll send a password reset link to your email." : "Ready when you are. Pick up where you left off."}
            </p>
            <AuthForm mode={mode} onError={setError} onNotice={setNotice} />
            {error && <p className="feedback error" role="alert">{error}</p>}
            {notice && <p className="feedback success" role="status">{notice}</p>}
            <div className="auth-links">
              {mode === "signin" && <button onClick={() => { setMode("reset"); setError(""); setNotice(""); }}>Forgot password?</button>}
              <button onClick={() => { setMode(mode === "signup" ? "signin" : mode === "reset" ? "signin" : "signup"); setError(""); setNotice(""); }}>
                {mode === "signup" || mode === "reset" ? "Already have an account? Sign in" : "New to MOVEIT? Create account"}
              </button>
            </div>
            <p className="fine-print">By continuing, you agree to our Terms and Privacy Policy.</p>
          </div>
        </section>
      </main>
    );
  }

  if (profileLoading) return <Loading />;

  if (!profile) {
    return (
      <main className="page-shell">
        <div className="form-card profile-card">
          <Brand />
          <p className="eyebrow">FIRST THINGS FIRST</p>
          <h2>Make it yours.</h2>
          <p className="muted">Set up your profile so your local sports community can find you.</p>
          <ProfileForm
            client={supabase}
            initial={{
              username: "",
              displayName: session.user.user_metadata?.display_name ?? "",
              bio: "",
              city: "Lahore",
            }}
            onSaved={async (saved) => {
              setProfile(saved);
              setError("");
              await updateOnboarding("sports");
            }}
            onError={setError}
          />
          {error && <p className="feedback error" role="alert">{error}</p>}
        </div>
      </main>
    );
  }

  const onboardingStep = onboarding?.step === "complete" ? "complete" : onboarding?.step ?? "personal";
  const onboardingSteps = ["personal", "sports", "fitness", "location", "review"] as const;
  const onboardingIndex = onboardingStep === "complete" ? -1 : onboardingSteps.indexOf(onboardingStep);
  const goBackOnboarding = async () => {
    if (onboardingIndex <= 0) return;
    try {
      await updateOnboarding(onboardingSteps[onboardingIndex - 1]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your progress could not be saved.");
    }
  };
  return (
    <main className="page-shell">
      <div className="profile-view">
        <header className="topbar">
          <Brand />
          <div className="topbar-actions">
            <ThemeSelector value={theme} onChange={setTheme} />
            <button className="text-button" onClick={() => void signOut()}>Sign out</button>
          </div>
        </header>
        {error && <p className="feedback error" role="alert">{error}</p>}
        <div className="welcome-card">
          <p className="eyebrow">PROFILE · {profile.city.toUpperCase()}</p>
          <h1>Good to have you,<br /><em>{profile.displayName}.</em></h1>
          <p className="muted">Your MOVEIT profile is ready. The next step is finding your people and your game.</p>
          <div className="profile-details">
            <span>@{profile.username}</span>
            {profile.bio && <span>{profile.bio}</span>}
          </div>
        </div>
        <PlatformHub client={supabase} profile={profile} />
        {onboardingLoading ? <p className="muted" role="status">Restoring your onboarding progress…</p> : null}
        {!onboardingLoading && onboardingStep !== "complete" ? (
          <section className="onboarding-panel" aria-labelledby="onboarding-title">
            <p className="eyebrow">ATHLETE ONBOARDING · {onboardingStep.toUpperCase()}</p>
            <h2 id="onboarding-title">
              {onboardingStep === "personal" ? "Personal information" :
                onboardingStep === "sports" ? "Sports & skill levels" :
                  onboardingStep === "fitness" ? "Fitness goals" :
                    onboardingStep === "location" ? "Location & privacy" : "Review"}
            </h2>
            <div className="onboarding-progress" aria-label="Onboarding progress">
              {["personal", "sports", "fitness", "location", "review"].map((item) => (
                <span key={item} className={item === onboardingStep ? "active" : ""} />
              ))}
            </div>
            {onboardingIndex > 0 ? (
              <button type="button" className="text-button" onClick={() => void goBackOnboarding()}>
                Back to {onboardingSteps[onboardingIndex - 1]}
              </button>
            ) : null}
            {onboardingStep === "personal" ? (
              <p className="muted">Review the personal information below, then continue. Progress is saved to your MOVEIT account.</p>
            ) : null}
            {onboardingStep === "sports" ? (
              <SportPreferencesForm client={supabase} allowSkip onComplete={() => updateOnboarding("fitness")} />
            ) : null}
            {onboardingStep === "fitness" ? (
              <AthletePreferencesForm
                client={supabase}
                showLocation={false}
                allowSkip
                onComplete={() => updateOnboarding("location")}
              />
            ) : null}
            {onboardingStep === "location" ? (
              <AthletePreferencesForm
                client={supabase}
                showGoals={false}
                allowSkip
                onComplete={() => updateOnboarding("review")}
              />
            ) : null}
            {onboardingStep === "review" ? (
              <AthleteOnboardingReview
                client={supabase}
                onComplete={() => updateOnboarding("review", true)}
              />
            ) : null}
          </section>
        ) : null}
        <section className="web-profile-editor">
          <h2>Personal information</h2>
          <p className="muted">Your city and profile details are displayed to the MOVEIT community.</p>
          <ProfileForm
            client={supabase}
            currentProfile={profile}
            initial={{
              username: profile.username,
              displayName: profile.displayName,
              bio: profile.bio,
              city: profile.city,
            }}
            onSaved={async (saved) => {
              setProfile(saved);
              setError("");
              setNotice("Your profile was saved.");
              if (onboardingStep === "personal") await updateOnboarding("sports");
            }}
            onError={setError}
          />
        </section>
        {onboardingStep === "complete" ? (
          <>
            <SportPreferencesForm client={supabase} />
            <AthletePreferencesForm client={supabase} />
          </>
        ) : null}
        {notice && <p className="feedback success" role="status">{notice}</p>}
        {error && <p className="feedback error" role="alert">{error}</p>}
        <p className="fine-print">MOVEIT · Sports, activities, and community.</p>
      </div>
    </main>
  );

  async function signOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }
}

function AuthForm({ mode, onError, onNotice }: { mode: AuthMode; onError: (value: string) => void; onNotice: (value: string) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AuthFormInput>({
    resolver: zodResolver(authFormSchema(mode)),
    defaultValues: { email: "", password: "" },
  });

  const submit = async (values: AuthFormInput) => {
    if (!supabase) return;
    onError("");
    onNotice("");
    if (mode === "reset") {
      const email = values.email;
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) onError(error.message);
      else onNotice("If an account exists for that email, a reset link will be sent.");
      return;
    }
    if (mode === "signup") {
      if (!values.password) {
        onError("Enter your password.");
        return;
      }
      const { email, password } = values;
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) onError(error.message);
      else onNotice("Check your email to verify your account before signing in.");
    } else {
      if (!values.password) {
        onError("Enter your password.");
        return;
      }
      const { email, password } = values;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) onError(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} /></label>
      {errors.email && <p className="field-error">{errors.email.message}</p>}
      {mode !== "reset" && <>
        <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" {...register("password")} /></label>
        {errors.password && <p className="field-error">{errors.password.message}</p>}
      </>}
      <button className="primary-button" disabled={isSubmitting}>{isSubmitting ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"} <span aria-hidden="true">↗</span></button>
    </form>
  );
}

function ProfileForm({
  client,
  initial,
  currentProfile,
  onSaved,
  onError,
}: {
  client: typeof supabase;
  initial: ProfileInput;
  currentProfile?: AthleteProfile;
  onSaved: (profile: AthleteProfile) => void | Promise<void>;
  onError: (value: string) => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentProfile?.avatarPublicUrl ?? null);

  useEffect(() => {
    if (!avatarFile) {
      setPreviewUrl(removeAvatar ? null : currentProfile?.avatarPublicUrl ?? null);
      return;
    }
    const objectUrl = URL.createObjectURL(avatarFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile, currentProfile?.avatarPublicUrl, removeAvatar]);

  const chooseAvatar = (file: File | undefined) => {
    setAvatarError("");
    if (!file) return;
    const parsed = avatarUploadSchema.safeParse({ mimeType: file.type, size: file.size });
    if (!parsed.success) {
      setAvatarFile(null);
      setAvatarError(parsed.error.issues[0]?.message ?? "Choose a JPEG, PNG, or WebP image up to 5 MiB.");
      return;
    }
    setAvatarFile(file);
    setRemoveAvatar(false);
  };

  const submit = async (values: ProfileInput) => {
    onError("");
    try {
      if (!client) throw new Error(SUPABASE_SETUP_ERROR);
      const repository = createAthleteProfileRepository(client);
      let saved = await repository.saveMyProfile(values);
      if (avatarFile) {
        setAvatarBusy(true);
        saved = await repository.uploadAvatar({
          bytes: new Uint8Array(await avatarFile.arrayBuffer()),
          mimeType: avatarFile.type,
        });
      } else if (removeAvatar) {
        saved = await repository.removeAvatar();
      }
      await onSaved(saved);
      setAvatarFile(null);
      setRemoveAvatar(false);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Profile could not be saved.");
    } finally {
      setAvatarBusy(false);
    }
  };
  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <div className="avatar-editor">
        {previewUrl
          ? <img src={previewUrl} alt="Profile picture preview" />
          : <div className="avatar-placeholder" aria-hidden="true">Photo</div>}
        <div>
          <label htmlFor="avatar-file">Profile picture <span className="optional">(optional)</span></label>
          <input
            id="avatar-file"
            className="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              chooseAvatar(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
            aria-describedby={avatarError ? "avatar-error" : "avatar-help"}
          />
          <p className="avatar-help" id="avatar-help">Public picture · JPEG, PNG or WebP · up to 5 MiB</p>
          {currentProfile?.avatarPublicUrl && !removeAvatar && (
            <button type="button" className="text-button avatar-remove" onClick={() => { setAvatarFile(null); setRemoveAvatar(true); }}>
              Remove picture
            </button>
          )}
          {avatarError && <p className="field-error" id="avatar-error" role="alert">{avatarError}</p>}
        </div>
      </div>
      <label htmlFor="display-name">Display name<input id="display-name" autoComplete="name" placeholder="How people know you" {...register("displayName")} aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? "display-name-error" : undefined} /></label>
      {errors.displayName && <p className="field-error" id="display-name-error" role="alert">{errors.displayName.message}</p>}
      <label htmlFor="username">Username<input id="username" autoCapitalize="none" autoComplete="username" placeholder="e.g. fastbreak_ali" {...register("username")} aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? "username-error" : undefined} /></label>
      {errors.username && <p className="field-error" id="username-error" role="alert">{errors.username.message}</p>}
      <label htmlFor="city">City or area<input id="city" autoComplete="address-level2" placeholder="Lahore" {...register("city")} aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? "city-error" : undefined} /></label>
      {errors.city && <p className="field-error" id="city-error" role="alert">{errors.city.message}</p>}
      <label htmlFor="bio">Bio <span className="optional">(optional)</span><textarea id="bio" rows={3} placeholder="What do you like to play?" {...register("bio")} aria-invalid={Boolean(errors.bio)} aria-describedby={errors.bio ? "bio-error" : undefined} /></label>
      {errors.bio && <p className="field-error" id="bio-error" role="alert">{errors.bio.message}</p>}
      <button className="primary-button" disabled={isSubmitting}>
        {avatarBusy ? "Uploading picture…" : isSubmitting ? "Saving…" : "Save profile"}
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}

function Brand() {
  return <a className="brand" href="/" aria-label="MOVEIT home"><span className="brand-mark">M</span>MOVEIT<span className="brand-dot">.</span></a>;
}

function ThemeSelector({ value, onChange }: { value: ThemeChoice; onChange: (value: ThemeChoice) => void }) {
  const change = (newValue: string) => {
    if (newValue === "system" || newValue === "light" || newValue === "dark") onChange(newValue);
  };
  return (
    <label className="theme-selector">
      Theme
      <select aria-label="Color theme" value={value} onChange={(event) => change(event.currentTarget.value)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

function Loading() {
  return <main className="page-shell"><div className="loading">Getting your MOVEIT ready…</div></main>;
}
