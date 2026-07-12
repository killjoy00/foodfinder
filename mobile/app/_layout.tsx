import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/lib/theme";
import { AppProvider } from "@/lib/store";

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="profiles" options={{ title: "Who's this?", headerBackVisible: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="restaurant/new" options={{ title: "Add a place" }} />
        <Stack.Screen name="restaurant/[id]" options={{ title: "" }} />
        <Stack.Screen name="restaurant/edit/[id]" options={{ title: "Edit place" }} />
        <Stack.Screen name="browse" options={{ title: "Browse the catalog" }} />
        <Stack.Screen name="duplicates" options={{ title: "Duplicates" }} />
        <Stack.Screen name="insights" options={{ title: "Insights" }} />
        <Stack.Screen name="import" options={{ title: "Import & export" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </AppProvider>
  );
}
