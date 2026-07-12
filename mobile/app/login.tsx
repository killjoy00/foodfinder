import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Field, Muted } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

export default function Login() {
  const { login, baseUrl } = useApp();
  const [mode, setMode] = useState<"login" | "create">("login");
  const [server, setServer] = useState(baseUrl);
  const [group, setGroup] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showServer, setShowServer] = useState(!baseUrl);

  async function submit() {
    if (!server.trim()) {
      setError("Enter your FoodFinder server URL (the Vercel address of your web app).");
      setShowServer(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(server, group, password, mode === "create");
      router.replace("/profiles");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>🍽️</Text>
          <Text style={styles.title}>FoodFinder</Text>
          <Muted style={styles.subtitle}>
            {mode === "login"
              ? "Log into your family's group."
              : "Start a new group for your family."}
          </Muted>

          <View style={styles.form}>
            <Field
              placeholder="Group name"
              value={group}
              onChangeText={setGroup}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {showServer ? (
              <Field
                placeholder="Server URL (e.g. https://foodfinder.vercel.app)"
                value={server}
                onChangeText={setServer}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            ) : (
              <Muted style={{ textAlign: "center" }} >
                Server: {server || "not set"}{" "}
                <Text style={styles.link} onPress={() => setShowServer(true)}>
                  change
                </Text>
              </Muted>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            <Button
              title={mode === "login" ? "Log in" : "Create group"}
              onPress={submit}
              busy={busy}
            />
            <Button
              title={
                mode === "login" ? "New here? Create a group" : "Have a group? Log in instead"
              }
              kind="ghost"
              onPress={() => setMode(mode === "login" ? "create" : "login")}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logo: { fontSize: 56, textAlign: "center" },
  title: {
    color: colors.foreground,
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: { textAlign: "center", marginTop: 6, fontSize: 15 },
  form: { marginTop: 28, gap: 12 },
  link: { color: colors.accent, fontWeight: "600" },
  error: { color: colors.danger, textAlign: "center" },
});
