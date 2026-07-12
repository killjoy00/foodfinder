import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CatalogEntry } from "@shared/data/adapter";
import { Button, Chip, Field, Muted, Row } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors, radius } from "@/lib/theme";

/** The shared master catalog — every place any group has added. */
export default function Browse() {
  const { api, refresh } = useApp();
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [onlyUntracked, setOnlyUntracked] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { catalog } = await api.listCatalog();
      setCatalog(catalog);
    } catch {
      setCatalog([]);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog
      .filter((e) => !onlyUntracked || !e.tracked)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.cuisines.some((c) => c.toLowerCase().includes(q)) ||
          (e.address ?? "").toLowerCase().includes(q)
      )
      .slice(0, 200);
  }, [catalog, query, onlyUntracked]);

  async function track(entry: CatalogEntry, status: "active" | "wishlist") {
    setBusyId(entry.id);
    try {
      await api.trackRestaurant(entry.id, status);
      await load();
      void refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (!catalog) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Field placeholder="Search the master list…" value={query} onChangeText={setQuery} />
        <Row>
          <Chip active={onlyUntracked} onPress={() => setOnlyUntracked(!onlyUntracked)}>
            Hide places we already track
          </Chip>
          <Muted>{catalog.length} in the catalog</Muted>
        </Row>
      </View>
      <FlatList
        data={shown}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8 }}
        ListEmptyComponent={<Muted style={{ textAlign: "center" }}>No matches.</Muted>}
        renderItem={({ item: e }) => (
          <View style={styles.item}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.itemName}>
                {e.name}
                {e.tracked ? (e.trackedStatus === "wishlist" ? "  ⭐" : "  ✓") : ""}
              </Text>
              <Muted numberOfLines={1}>
                {[e.cuisines.join(" · ") || null, "$".repeat(e.price), e.address]
                  .filter(Boolean)
                  .join(" · ")}
              </Muted>
            </View>
            {!e.tracked && (
              <>
                <Button
                  title="✓ Been"
                  kind="secondary"
                  busy={busyId === e.id}
                  onPress={() => void track(e, "active")}
                />
                <Button
                  title="⭐"
                  kind="secondary"
                  busy={busyId === e.id}
                  onPress={() => void track(e, "wishlist")}
                />
              </>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: { padding: 16, paddingBottom: 8, gap: 8 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 12,
  },
  itemName: { color: colors.foreground, fontSize: 15, fontWeight: "600" },
});
