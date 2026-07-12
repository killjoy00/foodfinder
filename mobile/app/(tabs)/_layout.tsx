import { Tabs } from "expo-router";
import React from "react";
import { Text } from "react-native";
import { colors } from "@/lib/theme";

function emojiIcon(emoji: string) {
  return function Icon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
  };
}

/** Same five tabs as the web app's bottom nav (components/NavTabs.tsx). */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="tonight"
        options={{ title: "Tonight", headerShown: false, tabBarIcon: emojiIcon("🎲") }}
      />
      <Tabs.Screen name="vote" options={{ title: "Vote", tabBarIcon: emojiIcon("🗳️") }} />
      <Tabs.Screen name="places" options={{ title: "Places", tabBarIcon: emojiIcon("📍") }} />
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarIcon: emojiIcon("✨") }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: emojiIcon("⚙️") }} />
    </Tabs>
  );
}
