import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LatLng, distanceMiles, formatMiles } from "@shared/distance";
import { ratingStats } from "@shared/ratings";
import { PRICE_LABELS, daysSince } from "@shared/types";
import { MapOfPlaces } from "@/components/MapOfPlaces";
import { Button, Chip, Field, Muted, Row } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors, radius } from "@/lib/theme";

type SortKey = "name" | "rating" | "consensus" | "recency";

export default function Places() {
  const { data, loading, refresh, api } = useApp();
  const restaurants = useMemo(() => data?.restaurants ?? [], [data]);
  const home: LatLng = {
    lat: data?.settings.homeLat ?? null,
    lng: data?.settings.homeLng ?? null,
  };

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<"active" | "wishlist">("active");
  const [mode, setMode] = useState<"list" | "map">("list");
  const [pending, setPending] = useState(false);
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const hasHome = home.lat !== null && home.lng !== null;
  const wishlistCount = restaurants.filter((r) => r.status === "wishlist").length;

  // catch changes made from other screens (log visit, edits, votes)
  useFocusEffect(
    useCallback(() => {
      void refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return restaurants
      .filter((r) => r.status === view)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.cuisines.some((c) => c.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        if (sort === "rating") return ratingStats(b.ratings).mean - ratingStats(a.ratings).mean;
        if (sort === "consensus")
          return ratingStats(b.ratings).consensus - ratingStats(a.ratings).consensus;
        if (sort === "recency") return (a.lastVisitAt ?? "0000").localeCompare(b.lastVisitAt ?? "0000");
        return a.name.localeCompare(b.name);
      });
  }, [restaurants, query, sort, view]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.accent} />
      }
    >
      <Row style={{ justifyContent: "space-between" }}>
        <Text style={styles.title}>Our places</Text>
        <Row>
          <Button
            title={mode === "list" ? "🗺️ Map" : "📋 List"}
            kind="secondary"
            onPress={() => setMode(mode === "list" ? "map" : "list")}
          />
          <Button title="+ Add" onPress={() => router.push("/restaurant/new")} />
        </Row>
      </Row>

      <Row style={{ gap: 16 }}>
        <Text style={styles.link} onPress={() => router.push("/browse")}>
          🔎 Browse master list
        </Text>
        <Text style={styles.link} onPress={() => router.push("/duplicates")}>
          🔁 Find duplicates
        </Text>
        <Text style={styles.link} onPress={() => router.push("/insights")}>
          📊 Insights
        </Text>
      </Row>

      {mode === "map" ? (
        <MapOfPlaces restaurants={restaurants} home={home} />
      ) : (
        <>
          <Field placeholder="Search name or cuisine…" value={query} onChangeText={setQuery} />

          <Row>
            <Chip active={view === "active"} onPress={() => setView("active")}>
              🍽️ Been there ({restaurants.filter((r) => r.status === "active").length})
            </Chip>
            <Chip active={view === "wishlist"} onPress={() => setView("wishlist")}>
              ⭐ Wishlist ({wishlistCount})
            </Chip>
          </Row>
          <Row>
            <Chip active={sort === "name"} onPress={() => setSort("name")}>
              A→Z
            </Chip>
            <Chip active={sort === "rating"} onPress={() => setSort("rating")}>
              Top rated
            </Chip>
            <Chip active={sort === "consensus"} onPress={() => setSort("consensus")}>
              🤝 Loved by all
            </Chip>
            <Chip active={sort === "recency"} onPress={() => setSort("recency")}>
              Longest ago
            </Chip>
          </Row>

          {view === "wishlist" &&
            wishlistCount > 0 &&
            (confirmClear ? (
              <View style={styles.clearConfirm}>
                <Text style={{ color: "#fecaca", flex: 1, fontSize: 13 }}>
                  Delete all {wishlistCount} wishlist place{wishlistCount === 1 ? "" : "s"}? (Your
                  “Been there” list is untouched.)
                </Text>
                <Button
                  title={pending ? "Deleting…" : "Yes, delete all"}
                  kind="danger"
                  busy={pending}
                  onPress={async () => {
                    setPending(true);
                    try {
                      await api.clearWishlist();
                      await refresh();
                      setConfirmClear(false);
                    } finally {
                      setPending(false);
                    }
                  }}
                />
                <Button title="Cancel" kind="ghost" onPress={() => setConfirmClear(false)} />
              </View>
            ) : (
              <Button
                title={`🗑️ Clear wishlist (${wishlistCount})`}
                kind="danger"
                style={{ alignSelf: "flex-start" }}
                onPress={() => setConfirmClear(true)}
              />
            ))}

          <View style={{ gap: 8 }}>
            {shown.map((r) => {
              const days = daysSince(r.lastVisitAt);
              const stats = ratingStats(r.ratings);
              const dist = hasHome ? formatMiles(distanceMiles(home, r)) : null;
              const meta = [
                r.cuisines.join(" · ") || "uncategorized",
                PRICE_LABELS[r.price - 1],
                stats.count > 0 ? `★ ${stats.mean.toFixed(1)} (${stats.count})` : null,
                stats.divisive ? "😬 split" : null,
                dist,
                days !== null ? `${days}d ago` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <View key={r.id} style={styles.item}>
                  <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => router.push(`/restaurant/${r.id}`)}>
                    <Text numberOfLines={1} style={styles.itemName}>
                      {r.name}
                      {r.locationCount > 1 ? `  📍×${r.locationCount}` : ""}
                    </Text>
                    <Muted numberOfLines={1}>{meta}</Muted>
                  </Pressable>
                  {view === "wishlist" ? (
                    <Button
                      title="✓ Been"
                      kind="secondary"
                      disabled={pending}
                      onPress={async () => {
                        await api.setStatus(r.id, "active");
                        await refresh();
                      }}
                    />
                  ) : loggedIds.has(r.id) ? (
                    <Text style={styles.loggedNote}>Logged 🎉</Text>
                  ) : (
                    <Button
                      title="+1 visit"
                      kind="secondary"
                      disabled={pending}
                      onPress={async () => {
                        await api.logVisit(r.id, "dine_in");
                        setLoggedIds((prev) => new Set(prev).add(r.id));
                        void refresh();
                      }}
                    />
                  )}
                </View>
              );
            })}
            {shown.length === 0 && (
              <View style={styles.emptyBox}>
                <Muted style={{ textAlign: "center" }}>
                  {view === "wishlist"
                    ? "Nothing on the wishlist yet. Add places you want to try!"
                    : "No matches. Add your first restaurant with the + Add button."}
                </Muted>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: "800" },
  link: { color: colors.accent, textDecorationLine: "underline", fontSize: 13 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 12,
  },
  itemName: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
  loggedNote: {
    color: colors.green,
    backgroundColor: colors.greenBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
    overflow: "hidden",
  },
  clearConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderColor: "#7f1d1d",
    borderWidth: 1,
    backgroundColor: "#450a0a44",
    borderRadius: radius.control,
    padding: 8,
  },
  emptyBox: {
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 28,
  },
});
