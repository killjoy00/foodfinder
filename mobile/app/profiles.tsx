import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Profile } from "@shared/types";
import { Button, Card, Field, Muted, Row, SectionLabel } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors, radius } from "@/lib/theme";

const EMOJI_CHOICES = ["🙂", "😎", "🦖", "🦄", "🐯", "🐸", "🐼", "🍕", "🌮", "🧁", "⭐", "❤️"];
const COLOR_CHOICES = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#eab308", "#14b8a6", "#ef4444"];

export default function Profiles() {
  const { data, loading, error, api, refresh, selectProfile, householdName } = useApp();
  const profiles = data?.profiles ?? [];
  const [editing, setEditing] = useState<Profile | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(p: Profile) {
    await selectProfile(p.id);
    router.replace("/(tabs)/tonight");
  }

  async function remove(p: Profile) {
    Alert.alert(`Remove ${p.name}?`, "Their ratings stay attached to their profile id.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await api.deleteProfile(p.id);
          await refresh();
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
      }
    >
      <Text style={styles.title}>Who&apos;s hungry{householdName ? ` in ${householdName}` : ""}?</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.grid}>
        {profiles.map((p) => (
          <Pressable key={p.id} style={styles.tile} onPress={() => pick(p)} onLongPress={() => setEditing(p)}>
            <View style={[styles.avatar, { backgroundColor: p.color }]}>
              <Text style={styles.avatarEmoji}>{p.emoji}</Text>
            </View>
            <Text style={styles.tileName}>{p.name}</Text>
            {p.doubleCredits > 0 && (
              <Text style={styles.credit}>×2 vote banked</Text>
            )}
          </Pressable>
        ))}
        <Pressable style={styles.tile} onPress={() => setEditing("new")}>
          <View style={[styles.avatar, styles.avatarAdd]}>
            <Text style={styles.avatarEmoji}>＋</Text>
          </View>
          <Text style={styles.tileName}>Add</Text>
        </Pressable>
      </View>
      <Muted style={{ textAlign: "center" }}>Long-press a profile to edit it.</Muted>

      {editing && (
        <ProfileForm
          initial={editing === "new" ? null : editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onDelete={
            editing !== "new" && profiles.length > 1
              ? () => {
                  const p = editing;
                  setEditing(null);
                  void remove(p);
                }
              : undefined
          }
          onSave={async (name, emoji, color) => {
            setBusy(true);
            try {
              if (editing === "new") await api.createProfile(name, emoji, color);
              else await api.updateProfile(editing.id, { name, emoji, color });
              await refresh();
              setEditing(null);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </ScrollView>
  );
}

function ProfileForm({
  initial,
  busy,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Profile | null;
  busy: boolean;
  onSave: (name: string, emoji: string, color: string) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🙂");
  const [color, setColor] = useState(initial?.color ?? COLOR_CHOICES[0]);

  return (
    <Card style={{ marginTop: 8 }}>
      <SectionLabel>{initial ? `Edit ${initial.name}` : "New profile"}</SectionLabel>
      <Field placeholder="Name" value={name} onChangeText={setName} />
      <Row>
        {EMOJI_CHOICES.map((e) => (
          <Pressable
            key={e}
            onPress={() => setEmoji(e)}
            style={[styles.pickDot, e === emoji && styles.pickDotActive]}
          >
            <Text style={{ fontSize: 18 }}>{e}</Text>
          </Pressable>
        ))}
      </Row>
      <Row>
        {COLOR_CHOICES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.pickDot,
              { backgroundColor: c },
              c === color && styles.pickDotActive,
            ]}
          />
        ))}
      </Row>
      <Row>
        <Button
          title="Save"
          onPress={() => name.trim() && onSave(name.trim(), emoji, color)}
          busy={busy}
          disabled={!name.trim()}
          style={{ flex: 1 }}
        />
        <Button title="Cancel" kind="ghost" onPress={onCancel} />
        {onDelete && <Button title="Delete" kind="danger" onPress={onDelete} />}
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16, paddingBottom: 48 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: "800", textAlign: "center" },
  error: { color: colors.danger, textAlign: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 18,
    marginTop: 8,
  },
  tile: { alignItems: "center", width: 92, gap: 6 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarAdd: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  avatarEmoji: { fontSize: 36, color: colors.foreground },
  tileName: { color: colors.foreground, fontSize: 15, fontWeight: "600" },
  credit: { color: colors.accentText, fontSize: 11 },
  pickDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  pickDotActive: { borderColor: colors.accent },
});
