import * as Linking from "expo-linking";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { distanceMiles, formatMiles } from "@shared/distance";
import {
  PRICE_LABELS,
  RestaurantFull,
  Visit,
  daysSince,
  mapsLink,
  openTableLink,
} from "@shared/types";
import { RatingRows } from "@/components/RatingRows";
import { Button, Card, Muted, Row } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors, radius } from "@/lib/theme";

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, data, refresh, profile } = useApp();
  const [restaurant, setRestaurant] = useState<RestaurantFull | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logged, setLogged] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.getRestaurant(id);
      setRestaurant(res.restaurant);
      setVisits(res.visits);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this place.");
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !restaurant) {
    return (
      <View style={styles.center}>
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  const r = restaurant;
  const days = daysSince(r.lastVisitAt);
  const home = { lat: data?.settings.homeLat ?? null, lng: data?.settings.homeLng ?? null };
  // sort the brand's branches nearest-first when we know where home is
  const locations = [...r.locations]
    .map((loc) => ({ loc, dist: distanceMiles(home, loc) }))
    .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  const meta = [
    r.cuisines.join(" · ") || "uncategorized",
    PRICE_LABELS[r.price - 1],
    r.locationCount > 1 ? `📍 ${r.locationCount} locations` : null,
    days !== null ? `last visit ${days}d ago` : null,
    r.status === "wishlist" ? "⭐ wishlist" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function confirmDelete() {
    Alert.alert(`Remove ${r.name}?`, "It stays in the shared catalog; your ratings and visits for it go away.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await api.untrackRestaurant(r.id);
          await refresh();
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} tintColor={colors.accent} />}
    >
      <Stack.Screen options={{ title: r.name }} />
      <View>
        <Text style={styles.title}>{r.name}</Text>
        <Muted>{meta}</Muted>
      </View>

      <Row>
        <Button
          title="🗺️ Maps"
          kind="secondary"
          style={{ flex: 1 }}
          onPress={() => Linking.openURL(mapsLink(r))}
        />
        <Button
          title="🪑 Reserve"
          kind="secondary"
          style={{ flex: 1 }}
          onPress={() => Linking.openURL(openTableLink(r))}
        />
      </Row>

      <Card>
        <Text style={styles.section}>Family ratings</Text>
        <RatingRows
          profiles={data?.profiles ?? (profile ? [profile] : [])}
          ratings={r.ratings}
          onChange={async (profileId, score) => {
            const res = await api.setRating(r.id, profileId, score);
            setRestaurant(res.restaurant);
            void refresh();
          }}
        />
      </Card>

      <Card>
        <Text style={styles.section}>
          {r.locationCount > 1 ? `Locations (${r.locationCount})` : "Location"}
        </Text>
        {locations.map(({ loc, dist }) => (
          <View key={loc.id} style={styles.locRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.locName}>
                {loc.address?.split(",")[0]?.trim() || loc.name}
              </Text>
              <Muted numberOfLines={1}>
                {loc.address || "no address"}
                {dist !== null && ` · ${formatMiles(dist)}`}
              </Muted>
            </View>
            <Button title="🗺️" kind="secondary" onPress={() => Linking.openURL(mapsLink(loc))} />
            {r.locationCount > 1 && (
              <Button
                title="Split out"
                kind="ghost"
                onPress={async () => {
                  await api.splitLocation(r.id, loc.id);
                  await refresh();
                  await load();
                }}
              />
            )}
          </View>
        ))}
      </Card>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={styles.section}>
            Visits <Muted>({visits.length})</Muted>
          </Text>
          {logged ? (
            <Text style={{ color: colors.green, fontWeight: "600" }}>Logged 🎉</Text>
          ) : (
            <Button
              title="+1 visit today"
              kind="secondary"
              onPress={async () => {
                await api.logVisit(r.id, "dine_in");
                setLogged(true);
                await load();
                void refresh();
              }}
            />
          )}
        </Row>
        {visits.slice(0, 10).map((v) => (
          <Muted key={v.id}>
            {new Date(v.date).toLocaleDateString()} ·{" "}
            {v.mode === "takeout" ? "🥡 takeout" : "🍽️ dine in"}
            {v.note && ` · ${v.note}`}
          </Muted>
        ))}
        {visits.length === 0 && <Muted>No visits logged yet.</Muted>}
      </Card>

      <Row>
        <Button
          title="✏️ Edit details"
          kind="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push(`/restaurant/edit/${r.id}`)}
        />
        <Button title="🗑️ Remove" kind="danger" onPress={confirmDelete} />
      </Row>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: "800" },
  section: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.control,
    padding: 10,
  },
  locName: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
});
