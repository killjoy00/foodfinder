import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@/lib/theme";
import { useApp } from "@/lib/store";

/** Launch gate: no login → login; no profile picked → profiles; else the app. */
export default function Index() {
  const { ready, token, profileId } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!token) return <Redirect href="/login" />;
  if (!profileId) return <Redirect href="/profiles" />;
  return <Redirect href="/(tabs)/tonight" />;
}
