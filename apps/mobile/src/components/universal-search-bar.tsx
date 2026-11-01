import { Pressable, TextInput, View } from "react-native";
import { Icon } from "./ui";
import { useMoveitTheme } from "../theme";

export function UniversalSearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = "Search sports, players, venues…",
  accessibilityLabel = "Search MOVEIT",
  autoFocus = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  autoFocus?: boolean;
}) {
  const { colors } = useMoveitTheme();

  return (
    <View style={{
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.field,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingLeft: 14,
      paddingRight: 4,
    }}>
      <Icon name="search" size={18} color={colors.muted} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={() => onSubmit(value)}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        style={{ minHeight: 48, flex: 1, color: colors.text, fontSize: 14, paddingVertical: 8 }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText("")}
          hitSlop={6}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="x" size={17} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
