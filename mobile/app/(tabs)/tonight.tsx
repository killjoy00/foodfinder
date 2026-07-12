import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { brandDistanceMiles } from "@shared/brand";
import { LatLng, formatMiles } from "@shared/distance";
import {
  DEFAULT_FILTERS,
  PickerFilters,
  WeightedCandidate,
  buildCandidates,
  buildCuisineRecency,
  collapseChains,
  pickTonight,
  sampleCandidates,
  wheelSegments,
} from "@shared/picker";
import {
  RestaurantFull,
  TAGS,
  TAG_LABELS,
  Tag,
  isSpecialCuisine,
  specialCuisineEmoji,
} from "@shared/types";
import { ResultCard } from "@/components/ResultCard";
import { SpinWheel } from "@/components/SpinWheel";
import { Button, Card, Chip, Muted, Row, SectionLabel, Segmented } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

type Phase = "idle" | "spinning" | "result";

const NEAR_ME_CHOICES = [1, 3, 5, 10];

export default function Tonight() {
  const { data, loading, error, refresh, api } = useApp();
  const restaurants = useMemo(() => data?.restaurants ?? [], [data]);
  const profiles = data?.profiles ?? [];
  const home: LatLng = {
    lat: data?.settings.homeLat ?? null,
    lng: data?.settings.homeLng ?? null,
  };

  const cuisineRecency = useMemo(() => {
    const cuisinesByRestaurant = new Map(restaurants.map((r) => [r.id, r.cuisines]));
    return buildCuisineRecency(data?.recentVisits ?? [], cuisinesByRestaurant);
  }, [restaurants, data?.recentVisits]);
  const allCuisines = useMemo(
    () => [...new Set(restaurants.flatMap((r) => r.cuisines))].sort(),
    [restaurants]
  );

  const [filters, setFilters] = useState<PickerFilters>(DEFAULT_FILTERS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [winner, setWinner] = useState<WeightedCandidate | null>(null);
  const [segments, setSegments] = useState<WeightedCandidate[]>([]);
  const [spinKey, setSpinKey] = useState(0);
  const [logged, setLogged] = useState(false);

  const [nearMe, setNearMe] = useState(false);
  const [deviceOrigin, setDeviceOrigin] = useState<LatLng | null>(null);
  const [maxDistance, setMaxDistance] = useState(10);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  // distances are measured from where you are (near-me) or from home
  const origin: LatLng | null = nearMe && deviceOrigin ? deviceOrigin : home;
  const hasOrigin = origin?.lat !== null && origin?.lng !== null;

  // when near-me is on with a fix, drop brands whose every branch is out of range
  const usable = useMemo(() => {
    if (!nearMe || !deviceOrigin) return restaurants;
    return restaurants.filter((r) => {
      const d = brandDistanceMiles(r, deviceOrigin);
      return d !== null && d <= maxDistance;
    });
  }, [restaurants, nearMe, deviceOrigin, maxDistance]);

  const collapsed = useMemo(() => collapseChains(usable, origin), [usable, origin]);
  const { regulars, wishlist } = useMemo(
    () => buildCandidates(collapsed, filters, cuisineRecency),
    [collapsed, filters, cuisineRecency]
  );
  const eligibleCount = regulars.length + wishlist.length;

  async function enableNearMe() {
    setGeoMsg("Finding you…");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGeoMsg("Couldn't get your location — check the app's location permission.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setDeviceOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setNearMe(true);
      setGeoMsg(null);
      setFilters((f) => ({ ...f, excludeIds: [] }));
    } catch {
      setGeoMsg("Couldn't get your location.");
    }
  }

  function spin(extraExclude?: string) {
    const f = extraExclude
      ? { ...filters, excludeIds: [...filters.excludeIds, extraExclude] }
      : filters;
    if (extraExclude) setFilters(f);
    const candidates = collapseChains(usable, origin);
    const picked = pickTonight(candidates, f, cuisineRecency);
    if (!picked) return;
    // build the wheel pool from THIS spin's candidates so a just-rerolled
    // (excluded) place can't reappear via a stale closure
    const built = buildCandidates(candidates, f, cuisineRecency);
    const pool = [...built.regulars, ...built.wishlist];
    setWinner(picked);
    setSegments(wheelSegments(picked, pool.length > 1 ? pool : [picked]));
    setLogged(false);
    setSpinKey((k) => k + 1);
    setPhase("spinning");
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  // Special cuisines (dessert/coffee/tea) are exclusive: choosing one clears
  // every other cuisine, and choosing a normal cuisine clears any special.
  function toggleCuisine(c: string) {
    const special = isSpecialCuisine(c);
    setFilters((f) => {
      const has = f.cuisines.includes(c);
      let cuisines: string[];
      if (has) cuisines = f.cuisines.filter((x) => x !== c);
      else if (special) cuisines = [c];
      else cuisines = [...f.cuisines.filter((x) => !isSpecialCuisine(x)), c];
      return { ...f, cuisines, excludeIds: [] };
    });
  }

  async function startVote(count: number) {
    // keep the restaurant we just spun as one of the options, then fill the
    // rest of the ballot with other weighted candidates
    const pool = [...regulars, ...wishlist];
    const seeded = winner
      ? [
          winner,
          ...sampleCandidates(
            pool.filter((c) => c.restaurant.id !== winner.restaurant.id),
            count - 1
          ),
        ]
      : sampleCandidates(pool, count);
    if (seeded.length < 2) return;
    await api.startVote(seeded.map((c) => c.restaurant.id));
    await refresh();
    router.push("/(tabs)/vote");
  }

  function distanceOf(r: RestaurantFull): number | null {
    return brandDistanceMiles(r, origin);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        <Text style={styles.title}>Where to tonight?</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        <Card>
          <View style={{ gap: 4 }}>
            <SectionLabel>Who&apos;s eating</SectionLabel>
            <Row>
              {profiles.map((p) => (
                <Chip
                  key={p.id}
                  active={filters.eaterIds.includes(p.id)}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      eaterIds: toggle(filters.eaterIds, p.id),
                      excludeIds: [],
                    })
                  }
                >
                  {p.emoji} {p.name}
                </Chip>
              ))}
            </Row>
          </View>

          <View style={{ gap: 4 }}>
            <SectionLabel>Cuisine (any if none picked)</SectionLabel>
            <Row>
              {allCuisines.map((c) => (
                <Chip key={c} active={filters.cuisines.includes(c)} onPress={() => toggleCuisine(c)}>
                  {specialCuisineEmoji(c) ? `${specialCuisineEmoji(c)} ${c}` : c}
                </Chip>
              ))}
            </Row>
          </View>

          <View style={{ gap: 4 }}>
            <SectionLabel>Vibe</SectionLabel>
            <Segmented
              options={[
                { label: "🍽️ Dine in", value: "dine_in" },
                { label: "🥡 Takeout", value: "takeout" },
              ]}
              value={filters.mode}
              onChange={(mode) => setFilters({ ...filters, mode, excludeIds: [] })}
            />
          </View>

          <View style={{ gap: 4 }}>
            <SectionLabel>Max price</SectionLabel>
            <Segmented
              options={[1, 2, 3, 4].map((p) => ({ label: "$".repeat(p), value: p }))}
              value={filters.maxPrice}
              onChange={(maxPrice) => setFilters({ ...filters, maxPrice, excludeIds: [] })}
            />
          </View>

          <View style={{ gap: 4 }}>
            <SectionLabel>Quality bar — lowest rating allowed on the wheel</SectionLabel>
            <Segmented
              options={[
                { label: "Any", value: 0 },
                ...[5, 6, 7, 8].map((n) => ({ label: `${n}+`, value: n })),
              ]}
              value={filters.minScore}
              onChange={(minScore) => setFilters({ ...filters, minScore, excludeIds: [] })}
            />
          </View>

          <View style={{ gap: 4 }}>
            <SectionLabel>Must have</SectionLabel>
            <Row>
              {TAGS.map((tag: Tag) => (
                <Chip
                  key={tag}
                  active={filters.tags.includes(tag)}
                  onPress={() =>
                    setFilters({ ...filters, tags: toggle(filters.tags, tag), excludeIds: [] })
                  }
                >
                  {TAG_LABELS[tag]}
                </Chip>
              ))}
            </Row>
          </View>

          <View style={{ gap: 4 }}>
            <SectionLabel>
              Adventure level —{" "}
              {filters.wishlistPercent === 0
                ? "always a regular spot"
                : filters.wishlistPercent === 100
                  ? "only wishlist places 🎈"
                  : `${filters.wishlistPercent}% chance of a wishlist place`}
            </SectionLabel>
            <Slider
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={filters.wishlistPercent}
              onSlidingComplete={(v: number) =>
                setFilters({ ...filters, wishlistPercent: Math.round(v), excludeIds: [] })
              }
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.accent}
            />
            {wishlist.length === 0 && filters.wishlistPercent > 0 && (
              <Text style={styles.warn}>
                No wishlist places match your filters — add some (⭐ on a restaurant) for this to
                do anything.
              </Text>
            )}
          </View>

          <View style={{ gap: 4 }}>
            <SectionLabel>
              Avoid repeats —{" "}
              {filters.recencyStrength === 0
                ? "ignore what we ate lately"
                : filters.recencyStrength === 100
                  ? "strongly avoid recent spots & cuisines"
                  : `${filters.recencyStrength}% nudge away from recent`}
            </SectionLabel>
            <Slider
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={filters.recencyStrength}
              onSlidingComplete={(v: number) =>
                setFilters({ ...filters, recencyStrength: Math.round(v), excludeIds: [] })
              }
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.accent}
            />
          </View>

          <View style={{ gap: 6 }}>
            <SectionLabel>Distance</SectionLabel>
            <Row>
              <Chip
                active={nearMe}
                onPress={() => (nearMe ? setNearMe(false) : void enableNearMe())}
              >
                📍 {geoMsg === "Finding you…" ? "Finding…" : nearMe ? "Near me now" : "Use my location"}
              </Chip>
              {!hasOrigin && !nearMe && <Muted>set home in Settings to show distances</Muted>}
            </Row>
            {geoMsg && geoMsg !== "Finding you…" && <Muted>{geoMsg}</Muted>}
            {nearMe && deviceOrigin && (
              <>
                <Segmented
                  options={NEAR_ME_CHOICES.map((mi) => ({ label: `${mi} mi`, value: mi }))}
                  value={maxDistance}
                  onChange={(mi) => {
                    setMaxDistance(mi);
                    setFilters((f) => ({ ...f, excludeIds: [] }));
                  }}
                />
                <Muted>
                  {usable.length} place{usable.length === 1 ? "" : "s"} within {maxDistance} mi of
                  you
                </Muted>
              </>
            )}
          </View>

          <Muted>
            {eligibleCount} place{eligibleCount === 1 ? "" : "s"} match
            {eligibleCount === 1 ? "es" : ""} ({wishlist.length} on the wishlist)
          </Muted>
        </Card>

        {phase === "idle" && (
          <Button
            title="🎡 Spin the wheel"
            onPress={() => spin()}
            disabled={eligibleCount === 0}
            style={styles.spinButton}
          />
        )}

        {phase !== "idle" && winner && (
          <SpinWheel
            segments={segments.map((s) => ({ id: s.restaurant.id, label: s.restaurant.name }))}
            winnerId={winner.restaurant.id}
            spinKey={spinKey}
            onDone={() => setPhase("result")}
          />
        )}

        {phase === "result" && winner && (
          <ResultCard
            candidate={winner}
            profiles={profiles}
            logged={logged}
            onLog={async (mode) => {
              await api.logVisit(winner.restaurant.id, mode);
              setLogged(true);
              void refresh();
            }}
            onReroll={() => spin(winner.restaurant.id)}
            onStartVote={(n) => void startVote(n)}
            maxVoteSize={eligibleCount}
            distanceLabel={formatMiles(distanceOf(winner.restaurant))}
            distanceFromMe={nearMe && !!deviceOrigin}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { color: colors.foreground, fontSize: 26, fontWeight: "800" },
  error: { color: colors.danger },
  warn: { color: colors.yellow, fontSize: 12 },
  spinButton: { paddingVertical: 20, borderRadius: 16 },
});
