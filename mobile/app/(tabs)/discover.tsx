import * as Linking from "expo-linking";
import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import type { RecommendationGroup } from "@shared/services";
import type { Discovery } from "@shared/types";
import { Button, Card, Muted, Row, Segmented } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

const RADIUS_CHOICES = [3, 5, 10, 20];

export default function DiscoverTab() {
  const { api, refresh } = useApp();
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);

  const [radius, setRadius] = useState(5);
  const [recs, setRecs] = useState<RecommendationGroup[] | null>(null);
  const [recsBusy, setRecsBusy] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { discoveries } = await api.listDiscoveries();
      setDiscoveries(discoveries.filter((d) => !d.dismissed));
    } catch {
      // pull-to-refresh can retry
    } finally {
      setLoading(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function sweep() {
    setSweeping(true);
    setSweepMsg(null);
    try {
      const result = await api.runSweep();
      setSweepMsg(
        result.ok
          ? result.baseline
            ? `Baseline recorded (${result.seen} places seen) — new openings show up from now on.`
            : `Swept: ${result.added} new place${result.added === 1 ? "" : "s"} found.`
          : result.error
      );
      await load();
    } catch (err) {
      setSweepMsg(err instanceof Error ? err.message : "Sweep failed.");
    } finally {
      setSweeping(false);
    }
  }

  async function fetchRecs() {
    setRecsBusy(true);
    setRecsError(null);
    try {
      const { groups } = await api.fetchRecommendations(radius);
      setRecs(groups);
    } catch (err) {
      setRecsError(err instanceof Error ? err.message : "Couldn't fetch recommendations.");
    } finally {
      setRecsBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.accent} />
      }
    >
      <Text style={styles.title}>Discover ✨</Text>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={styles.section}>Newly opened nearby</Text>
          <Button title={sweeping ? "Sweeping…" : "🔄 Sweep now"} kind="secondary" busy={sweeping} onPress={() => void sweep()} />
        </Row>
        <Muted>
          A weekly sweep flags restaurants that just opened around home (needs a Google Places
          key and a home location).
        </Muted>
        {sweepMsg && <Muted style={{ color: colors.accentText }}>{sweepMsg}</Muted>}
        {discoveries.map((d) => (
          <View key={d.placeId} style={styles.discovery}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.discoveryName}>
                {d.name}
                {d.rating !== null ? `  ★ ${d.rating.toFixed(1)}` : ""}
              </Text>
              <Muted numberOfLines={1}>{d.address ?? ""}</Muted>
            </View>
            {d.mapsUrl && (
              <Button title="🗺️" kind="secondary" onPress={() => Linking.openURL(d.mapsUrl!)} />
            )}
            <Button
              title="⭐"
              kind="secondary"
              onPress={async () => {
                await api.addDiscoveryToWishlist(d.placeId);
                await load();
                void refresh();
              }}
            />
            <Button
              title="✕"
              kind="ghost"
              onPress={async () => {
                await api.dismissDiscovery(d.placeId);
                await load();
              }}
            />
          </View>
        ))}
        {discoveries.length === 0 && <Muted>Nothing new right now.</Muted>}
      </Card>

      <Card>
        <Text style={styles.section}>Recommended for your family</Text>
        <Muted>
          Suggestions matching the cuisines and prices your ratings show you love — excluding
          places you already track.
        </Muted>
        <Segmented
          options={RADIUS_CHOICES.map((mi) => ({ label: `${mi} mi`, value: mi }))}
          value={radius}
          onChange={setRadius}
        />
        <Button
          title={recsBusy ? "Looking…" : "🔮 Find recommendations"}
          busy={recsBusy}
          onPress={() => void fetchRecs()}
        />
        {recsError && <Text style={{ color: colors.danger }}>{recsError}</Text>}
        {recs?.map((group) => (
          <View key={group.cuisine} style={{ gap: 8 }}>
            <Text style={styles.cuisine}>Because you love {group.cuisine}</Text>
            {group.places.map((p) => {
              const key = p.placeId;
              return (
                <View key={key} style={styles.discovery}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.discoveryName}>
                      {p.name}
                      {p.rating !== null ? `  ★ ${p.rating.toFixed(1)}` : ""}
                    </Text>
                    <Muted numberOfLines={1}>
                      {[p.address, p.distanceMiles !== null ? `${p.distanceMiles.toFixed(1)} mi` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Muted>
                  </View>
                  {p.mapsUrl && (
                    <Button title="🗺️" kind="secondary" onPress={() => Linking.openURL(p.mapsUrl!)} />
                  )}
                  {added.has(key) ? (
                    <Text style={{ color: colors.green, fontWeight: "700" }}>✓</Text>
                  ) : (
                    <Button
                      title="⭐"
                      kind="secondary"
                      onPress={async () => {
                        await api.addRecommendationToWishlist({
                          placeId: p.placeId,
                          name: p.name,
                          address: p.address,
                          mapsUrl: p.mapsUrl,
                          cuisine: group.cuisine,
                          lat: p.lat,
                          lng: p.lng,
                        });
                        setAdded((prev) => new Set(prev).add(key));
                        void refresh();
                      }}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}
        {recs?.length === 0 && <Muted>No suggestions right now — rate more places!</Muted>}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: "800" },
  section: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
  cuisine: { color: colors.accentText, fontSize: 14, fontWeight: "700", marginTop: 4 },
  discovery: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 10,
  },
  discoveryName: { color: colors.foreground, fontSize: 15, fontWeight: "600" },
});
