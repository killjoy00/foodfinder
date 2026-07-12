import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { computeInsights } from "@shared/insights";
import type { Visit } from "@shared/types";
import { Card, Muted } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <View style={styles.barRow}>
      <Text numberOfLines={1} style={styles.barLabel}>
        {label}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${max > 0 ? (value / max) * 100 : 0}%` }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

export default function InsightsScreen() {
  const { api, data } = useApp();
  const [visits, setVisits] = useState<Visit[] | null>(null);

  useEffect(() => {
    api
      .listRecentVisits(100000)
      .then(({ visits }) => setVisits(visits))
      .catch(() => setVisits([]));
  }, [api]);

  const restaurants = useMemo(() => data?.restaurants ?? [], [data]);
  const profiles = useMemo(() => data?.profiles ?? [], [data]);
  const insights = useMemo(
    () => (visits ? computeInsights(restaurants, visits, profiles) : null),
    [restaurants, visits, profiles]
  );

  if (!insights) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (restaurants.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48 }}>📊</Text>
        <Muted>Add and rate some restaurants first — then the stats get fun.</Muted>
      </View>
    );
  }

  const i = insights;
  const maxCuisine = Math.max(1, ...i.topCuisines.map((c) => c.count));
  const maxVisited = Math.max(1, ...i.visitedCuisines.map((c) => c.visits));
  const maxPrice = Math.max(1, ...i.priceSpread.map((p) => p.count));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.tiles}>
        <Tile big={String(i.totalPlaces)} label="places tracked" />
        <Tile big={String(i.totalVisits)} label="visits logged" />
        <Tile big={String(i.totalWishlist)} label="on the wishlist" />
        <Tile big={`${Math.round(i.takeoutShare * 100)}%`} label="takeout share" />
      </View>

      {i.topCuisines.length > 0 && (
        <Card>
          <Text style={styles.section}>Cuisines in the rotation</Text>
          {i.topCuisines.map((c) => (
            <Bar key={c.cuisine} label={c.cuisine} value={c.count} max={maxCuisine} />
          ))}
        </Card>
      )}

      {i.visitedCuisines.length > 0 && (
        <Card>
          <Text style={styles.section}>What we actually eat</Text>
          {i.visitedCuisines.map((c) => (
            <Bar key={c.cuisine} label={c.cuisine} value={c.visits} max={maxVisited} />
          ))}
        </Card>
      )}

      <Card>
        <Text style={styles.section}>Price spread</Text>
        {i.priceSpread.map((p) => (
          <Bar key={p.price} label={"$".repeat(p.price)} value={p.count} max={maxPrice} />
        ))}
      </Card>

      {i.mostVisited.length > 0 && (
        <Card>
          <Text style={styles.section}>Most visited</Text>
          {i.mostVisited.map(({ restaurant, visits }) => (
            <Muted key={restaurant.id}>
              {restaurant.name} · {visits} visit{visits === 1 ? "" : "s"}
            </Muted>
          ))}
        </Card>
      )}

      {i.topRated.length > 0 && (
        <Card>
          <Text style={styles.section}>Family favorites</Text>
          {i.topRated.map(({ restaurant, avg }) => (
            <Muted key={restaurant.id}>
              {restaurant.name} · ★ {avg.toFixed(1)}
            </Muted>
          ))}
        </Card>
      )}

      {i.overdueFavorites.length > 0 && (
        <Card>
          <Text style={styles.section}>Overdue favorites 🥺</Text>
          <Muted>Loved, but it&apos;s been a while.</Muted>
          {i.overdueFavorites.map(({ restaurant, avg, days }) => (
            <Muted key={restaurant.id}>
              {restaurant.name} · ★ {avg.toFixed(1)} · {days}d ago
            </Muted>
          ))}
        </Card>
      )}

      {i.perProfile.length > 0 && (
        <Card>
          <Text style={styles.section}>Toughest critic</Text>
          {i.perProfile.map(({ profile, rated, avg }) => (
            <Muted key={profile.id}>
              {profile.emoji} {profile.name} · {rated} rating{rated === 1 ? "" : "s"} · averages{" "}
              {avg.toFixed(1)}
            </Muted>
          ))}
        </Card>
      )}

      {i.agreement && (
        <Card>
          <Text style={styles.section}>Taste twins 👯</Text>
          <Muted>
            {i.agreement.a.emoji} {i.agreement.a.name} and {i.agreement.b.emoji}{" "}
            {i.agreement.b.name} agree the most — {Math.round(i.agreement.closeness * 100)}% in
            sync across {i.agreement.sharedRatings} shared ratings.
          </Muted>
        </Card>
      )}
    </ScrollView>
  );
}

function Tile({ big, label }: { big: string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileBig}>{big}</Text>
      <Muted>{label}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.background,
    padding: 24,
  },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    flexGrow: 1,
    minWidth: "45%",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  tileBig: { color: colors.accent, fontSize: 28, fontWeight: "800" },
  section: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { color: colors.foreground, fontSize: 13, width: 110 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface2,
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  barValue: { color: colors.muted, fontSize: 12, width: 32, textAlign: "right" },
});
