import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Profile } from "@shared/types";
import { colors } from "@/lib/theme";

/** Tap a number to set it; tap the same number again to clear the rating. */
export function RatingRows({
  profiles,
  ratings,
  onChange,
}: {
  profiles: Profile[];
  ratings: Record<string, number>;
  onChange: (profileId: string, score: number | null) => Promise<void>;
}) {
  const [local, setLocal] = useState<Record<string, number | undefined>>(ratings);
  useEffect(() => setLocal(ratings), [ratings]);

  function toggleScore(profileId: string, score: number) {
    const next = local[profileId] === score ? undefined : score;
    setLocal((s) => ({ ...s, [profileId]: next }));
    void onChange(profileId, next ?? null);
  }

  return (
    <View style={{ gap: 14 }}>
      {profiles.map((p) => {
        const score = local[p.id];
        return (
          <View key={p.id} style={styles.row}>
            <Text numberOfLines={1} style={styles.name}>
              {p.emoji} {p.name}
            </Text>
            <View style={styles.scale}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <Pressable
                  key={n}
                  onPress={() => toggleScore(p.id, n)}
                  style={[styles.cell, score !== undefined && n <= score && styles.cellOn]}
                >
                  <Text style={[styles.cellText, score !== undefined && n <= score && styles.cellTextOn]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6 },
  name: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
  scale: { flexDirection: "row", gap: 4 },
  cell: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  cellOn: { backgroundColor: colors.accent },
  cellText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  cellTextOn: { color: "#000" },
});
