import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Muted } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

const ITEMS = [
  { href: "/settings", emoji: "⚙️", label: "Settings", sub: "Home location, radius, password" },
  { href: "/insights", emoji: "📊", label: "Insights", sub: "Stats and superlatives" },
  { href: "/browse", emoji: "🔎", label: "Browse the catalog", sub: "The shared master list" },
  { href: "/duplicates", emoji: "🔁", label: "Find duplicates", sub: "Merge double entries" },
  { href: "/import", emoji: "📦", label: "Import & export", sub: "Google Takeout in, CSV out" },
] as const;

export default function More() {
  const { profile, householdName, data, selectProfile, logout } = useApp();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
    >
      <Card>
        <View style={styles.me}>
          <View style={[styles.avatar, { backgroundColor: profile?.color ?? colors.surface2 }]}>
            <Text style={{ fontSize: 26 }}>{profile?.emoji ?? "🙂"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.meName}>{profile?.name ?? "No profile"}</Text>
            <Muted>
              {householdName ?? "FoodFinder"}
              {data?.demo ? " · demo mode" : ""}
            </Muted>
          </View>
        </View>
        <Pressable
          onPress={async () => {
            await selectProfile(null);
            router.replace("/profiles");
          }}
        >
          <Text style={styles.link}>Switch profile</Text>
        </Pressable>
      </Card>

      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {ITEMS.map((item, i) => (
          <Pressable
            key={item.href}
            style={[styles.item, i > 0 && styles.itemBorder]}
            onPress={() => router.push(item.href)}
          >
            <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Muted>{item.sub}</Muted>
            </View>
            <Text style={{ color: colors.muted }}>›</Text>
          </Pressable>
        ))}
      </Card>

      <Pressable
        onPress={async () => {
          await logout();
          router.replace("/login");
        }}
      >
        <Text style={[styles.link, { color: colors.danger, textAlign: "center" }]}>
          Log out of the group
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  me: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  meName: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
  link: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  itemLabel: { color: colors.foreground, fontSize: 16, fontWeight: "600" },
});
