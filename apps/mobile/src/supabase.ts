import { createMoveitClient } from "@moveit/supabase";

const secureAuthStorage = {
  getItem: async (key: string) => (await import("expo-secure-store")).getItemAsync(key),
  setItem: async (key: string, value: string) => (await import("expo-secure-store")).setItemAsync(key, value),
  removeItem: async (key: string) => (await import("expo-secure-store")).deleteItemAsync(key),
};

export const supabase = createMoveitClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  process.env.EXPO_OS === "web" ? undefined : secureAuthStorage,
);
