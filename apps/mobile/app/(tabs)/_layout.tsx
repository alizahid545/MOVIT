import { Tabs } from "expo-router";
import { Icon } from "../../src/components/ui";
import { AppTopBar } from "../../src/components/app-top-bar";
import { useMoveitTheme } from "../../src/theme";

const destinations = [
  { name: "community", title: "Community", icon: "users" },
  { name: "venues", title: "Venues", icon: "map-pin" },
  { name: "fitness", title: "Fitness", icon: "activity" },
  { name: "activities", title: "Activities", icon: "calendar" },
  { name: "profile", title: "Profile", icon: "user" },
] as const;

export default function TabLayout() {
  const { colors } = useMoveitTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <AppTopBar />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", marginTop: 2 },
        tabBarHideOnKeyboard: true,
      }}
    >
      {destinations.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarAccessibilityLabel: `${title} tab`,
            tabBarIcon: ({ focused }) => (
              <Icon
                name={icon}
                size={20}
                color={focused ? colors.accent : colors.muted}
              />
            ),
          }}
        />
      ))}
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="discover" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="create" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
