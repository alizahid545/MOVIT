import { StyleSheet } from "react-native";
import { design, type palettes } from "./theme";

type MoveitColors = (typeof palettes)[keyof typeof palettes];

export function createStyles(colors: MoveitColors) {
  return StyleSheet.create({
    screen: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: design.spacing.lg,
      paddingVertical: design.spacing.xl,
      backgroundColor: colors.canvas,
    },
    center: {
      flex: 1,
      backgroundColor: colors.canvas,
      justifyContent: "center",
      alignItems: "center",
      padding: design.spacing.xl,
    },
    content: { width: "100%", maxWidth: 480, alignSelf: "center" },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    brand: { color: colors.text, fontSize: 23, fontWeight: "700", letterSpacing: 1 },
    accentMark: { color: colors.accent },
    eyebrow: { color: colors.muted, fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginTop: 30, marginBottom: 12 },
    title: { color: colors.text, fontSize: 36, fontWeight: "700", lineHeight: 42, letterSpacing: -1, marginBottom: 12 },
    body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginBottom: 26 },
    form: { gap: 7 },
    label: { color: colors.text, fontSize: 12, fontWeight: "600", marginTop: 10 },
    input: {
      color: colors.text,
      backgroundColor: colors.field,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: design.radius.sm,
      paddingHorizontal: 13,
      paddingVertical: 13,
      marginTop: 6,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: design.radius.sm,
      paddingHorizontal: 16,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 18,
    },
    buttonText: { color: colors.primaryOn, fontSize: 14, fontWeight: "600" },
    error: { color: colors.danger, fontSize: 11, marginTop: 3 },
    feedback: {
      color: colors.text,
      backgroundColor: colors.surfaceAlt,
      padding: 12,
      borderRadius: design.radius.sm,
      lineHeight: 18,
      marginTop: 16,
      fontSize: 12,
    },
    switch: { color: colors.accent, fontSize: 12, textAlign: "center", marginTop: 22, minHeight: 24 },
    link: { color: colors.accent, fontSize: 13, marginTop: 14 },
    footnote: { color: colors.muted, fontSize: 11, marginTop: 44 },
  });
}
