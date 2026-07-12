import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { findDuplicatePairs } from "@shared/duplicates";
import { Button, Card, Muted } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

/** Likely double entries — merge them (or they're really the same brand). */
export default function Duplicates() {
  const { data, api, refresh } = useApp();
  const restaurants = useMemo(() => data?.restaurants ?? [], [data]);
  const pairs = useMemo(() => findDuplicatePairs(restaurants), [restaurants]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function merge(survivorId: string, loserId: string) {
    const key = `${survivorId}:${loserId}`;
    setBusyKey(key);
    try {
      await api.mergeRestaurants(survivorId, loserId);
      await refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
    >
      <Muted>
        Pairs that look like the same place. Merging keeps the first entry (locations, ratings,
        and visits combine; the highest rating wins).
      </Muted>
      {pairs.map(({ a, b, reason, confidence }) => {
        const key = `${a.id}:${b.id}`;
        return (
          <Card key={key}>
            <Text style={styles.name}>
              {a.name} <Muted>vs</Muted> {b.name}
            </Text>
            <Muted>
              {reason} · {confidence} confidence
            </Muted>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                title={`Keep “${a.name}”`}
                kind="secondary"
                style={{ flex: 1 }}
                busy={busyKey === key}
                onPress={() => void merge(a.id, b.id)}
              />
              <Button
                title={`Keep “${b.name}”`}
                kind="secondary"
                style={{ flex: 1 }}
                busy={busyKey === key}
                onPress={() => void merge(b.id, a.id)}
              />
            </View>
          </Card>
        );
      })}
      {pairs.length === 0 && (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40 }}>✨</Text>
          <Muted>No likely duplicates — your list is clean.</Muted>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  name: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
  empty: { alignItems: "center", gap: 8, paddingTop: 40 },
});
