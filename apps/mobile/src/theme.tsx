import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type PropsWithChildren,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "system" | "light" | "dark";

export const palettes = {
  light: {
    canvas: "#F7F7F5",
    surface: "#FFFFFF",
    surfaceAlt: "#FFF1F2",
    surfaceElevated: "#FFFFFF",
    text: "#191B19",
    muted: "#737770",
    primary: "#E92736",
    accent: "#E92736",
    accentPressed: "#C91E2B",
    primaryOn: "#FFFFFF",
    border: "#E5E6E1",
    field: "#FFFFFF",
    hero: "#FFF1F2",
    heroLine: "#F4D8DB",
    softGreen: "#FFF1F2",
    softBlue: "#F2F2EF",
    softOrange: "#F4F2EE",
    danger: "#A53A32",
    success: "#35734B",
    shadow: "#191B19",
  },
  dark: {
    canvas: "#0B0E0B",
    surface: "#141914",
    surfaceAlt: "#1C231B",
    surfaceElevated: "#1C231B",
    text: "#F5F7F2",
    muted: "#A3ADA0",
    primary: "#B7FF45",
    accent: "#B7FF45",
    accentPressed: "#91D92B",
    primaryOn: "#0B0E0B",
    border: "#2B3429",
    field: "#141914",
    hero: "#141914",
    heroLine: "#2B3429",
    softGreen: "#1C231B",
    softBlue: "#1C231B",
    softOrange: "#1C231B",
    danger: "#F0A097",
    success: "#B7FF45",
    shadow: "#000000",
  },
} as const;

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 44 } as const;
const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "700" as const, letterSpacing: -0.9 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "600" as const, letterSpacing: -0.45 },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  label: { fontSize: 12, lineHeight: 17, fontWeight: "600" as const, letterSpacing: 0.1 },
  caption: { fontSize: 11, lineHeight: 16, fontWeight: "400" as const },
} as const;

const context = createContext<{
  colors: (typeof palettes)["light"] | (typeof palettes)["dark"];
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  isDark: boolean;
  modeLoaded: boolean;
  modeError: string;
  setMode: (mode: ThemeMode) => void;
}>({
  colors: palettes.light,
  mode: "system",
  resolvedMode: "light",
  isDark: false,
  modeLoaded: false,
  modeError: "",
  setMode: () => undefined,
});

const themeStorageKey = "moveit:theme:v1";

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [modeLoaded, setModeLoaded] = useState(false);
  const [modeError, setModeError] = useState("");
  const pendingMode = useRef<ThemeMode | null>(null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(themeStorageKey)
      .then(async (saved) => {
        if (!active) return;
        const selected = pendingMode.current
          ?? (saved === "system" || saved === "light" || saved === "dark" ? saved : "system");
        setModeState(selected);
        if (pendingMode.current) await AsyncStorage.setItem(themeStorageKey, selected);
      })
      .catch((caught: unknown) => {
        if (active) setModeError(caught instanceof Error ? caught.message : "Theme preference could not be loaded.");
      })
      .finally(() => {
        if (active) setModeLoaded(true);
      });
    return () => { active = false; };
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    if (!modeLoaded) {
      pendingMode.current = nextMode;
      return;
    }
    void AsyncStorage.setItem(themeStorageKey, nextMode)
      .then(() => setModeError(""))
      .catch((caught: unknown) => {
        setModeError(caught instanceof Error ? caught.message : "Theme preference could not be saved.");
      });
  }, [modeLoaded]);

  const resolvedMode = mode === "system" ? (systemScheme ?? "light") : mode;
  const value = useMemo(
    () => ({
      colors: palettes[resolvedMode],
      mode,
      resolvedMode,
      isDark: resolvedMode === "dark",
      modeLoaded,
      modeError,
      setMode,
    }),
    [mode, resolvedMode, modeLoaded, modeError, setMode],
  );

  return <context.Provider value={value}>{children}</context.Provider>;
}

export function useMoveitTheme() {
  return useContext(context);
}

export const design = { spacing, radius, typography };
