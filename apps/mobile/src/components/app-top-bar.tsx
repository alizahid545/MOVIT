import { Text, View } from "react-native";
import { router } from "expo-router";
import { IconButton } from "./ui";
import { useMoveitTheme } from "../theme";

export function AppTopBar() {
  const { colors } = useMoveitTheme();

  return (
    <View
      style={{
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        backgroundColor: colors.canvas,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <IconButton name="bell" label="Notifications" onPress={() => router.push("/notifications")} />
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900", letterSpacing: 1.4 }}>
        MOVEIT<Text style={{ color: colors.accent }}>.</Text>
      </Text>
      <IconButton name="message-circle" label="Messages" onPress={() => router.push("/messages")} />
    </View>
  );
}
