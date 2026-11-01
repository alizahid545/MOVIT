import { Tabs } from "expo-router";
import { Icon } from "../../src/components/ui";
import { useMoveitTheme } from "../../src/theme";

const destinations = [
  { name: "index", title: "Home", icon: "home" },
  { name: "discover", title: "Discover", icon: "search" },
  { name: "create", title: "Create", icon: "plus-square" },
  { name: "community", title: "Community", icon: "users" },
  { name: "profile", title: "Profile", icon: "user" },
] as const;

export default function TabLayout() {
  const { colors } = useMoveitTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
    </Tabs>
  );
}
