import type { ComponentProps, PropsWithChildren, ReactElement, ReactNode } from "react";
import Feather from "@expo/vector-icons/Feather";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { design, useMoveitTheme } from "../theme";

export type IconName = ComponentProps<typeof Feather>["name"];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useMoveitTheme();
  return <Feather name={name} size={size} color={color ?? colors.text} />;
}

export function IconButton({
  name,
  label,
  onPress,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useMoveitTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={name} size={19} color={colors.accent} />
    </Pressable>
  );
}

export function Page({
  children,
  scroll = true,
  refreshControl,
}: PropsWithChildren<{ scroll?: boolean; refreshControl?: ReactElement }>) {
  const { colors } = useMoveitTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: design.spacing.lg, paddingTop: design.spacing.md, paddingBottom: 28, gap: design.spacing.xl }}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: design.spacing.lg, paddingTop: design.spacing.md }}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function Header({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  const { colors } = useMoveitTheme();

  return (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 5 }}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.muted }]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={[design.typography.title, { color: colors.text }]}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) {
  const { colors } = useMoveitTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  accessibilityLabel,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: PressableProps["onPress"];
  variant?: "primary" | "secondary" | "quiet";
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: IconName;
}) {
  const { colors } = useMoveitTheme();
  const backgroundColor = variant === "primary" ? colors.accent : variant === "secondary" ? colors.surface : "transparent";
  const color = variant === "primary" ? colors.primaryOn : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed && variant === "primary" ? colors.accentPressed : backgroundColor,
          borderWidth: variant === "secondary" ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.55 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <View style={styles.buttonContent}>
        {icon ? <Icon name={icon} size={16} color={color} /> : null}
        <Text style={[styles.buttonLabel, { color }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function Pill({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useMoveitTheme();
  const body = (
    <Text style={{ color: selected ? colors.accent : colors.muted, fontSize: 12, fontWeight: selected ? "600" : "500" }}>
      {label}
    </Text>
  );
  const pillStyle = [
    styles.pill,
    {
      backgroundColor: selected ? colors.softGreen : "transparent",
      borderWidth: selected ? 0 : StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  ];

  if (!onPress) return <View style={pillStyle}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        pillStyle,
        { minHeight: 40, justifyContent: "center", opacity: pressed ? 0.68 : 1 },
      ]}
    >
      {body}
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useMoveitTheme();

  return (
    <View style={styles.sectionTitle}>
      <Text accessibilityRole="header" style={[design.typography.heading, { color: colors.text }]}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function DemoTag() {
  const { colors } = useMoveitTheme();

  return (
    <View style={{ alignSelf: "flex-start", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: design.radius.pill, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ color: colors.muted, fontSize: 9, fontWeight: "600", letterSpacing: 0.35 }}>DEMO</Text>
    </View>
  );
}

export function SportArtwork({ glyph, color = "green", size = 48 }: { glyph: string; color?: "green" | "blue" | "orange"; size?: number }) {
  const { colors } = useMoveitTheme();
  const backgrounds = { green: colors.softGreen, blue: colors.softBlue, orange: colors.softOrange };
  const monograms: Record<string, string> = {
    football: "F",
    cricket: "C",
    badminton: "B",
    running: "R",
    basketball: "B",
  };
  const mark = monograms[glyph.toLowerCase()] ?? glyph;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: backgrounds[color], justifyContent: "center", alignItems: "center" }}
    >
      <Text style={{ color: colors.text, fontSize: size * 0.34, fontWeight: "600" }}>{mark}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: "600", letterSpacing: 1.1 },
  card: {
    borderRadius: design.radius.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: design.spacing.md,
    paddingHorizontal: design.spacing.lg,
    gap: design.spacing.md,
  },
  button: {
    minHeight: 48,
    borderRadius: design.radius.sm,
    paddingHorizontal: design.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonLabel: { fontSize: 14, fontWeight: "600" },
  pill: { borderRadius: design.radius.pill, paddingHorizontal: 12, paddingVertical: 7, minHeight: 36, justifyContent: "center" },
  sectionTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
});
