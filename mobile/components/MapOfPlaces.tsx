import { router } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { LatLng } from "@shared/distance";
import type { RestaurantFull } from "@shared/types";
import { Muted } from "@/components/ui";
import { colors, radius } from "@/lib/theme";

/** Every located branch of every brand, plus home, on an Apple map. */
export function MapOfPlaces({
  restaurants,
  home,
}: {
  restaurants: RestaurantFull[];
  home: LatLng;
}) {
  const pins = useMemo(
    () =>
      restaurants.flatMap((r) =>
        r.locations
          .filter((l) => l.lat !== null && l.lng !== null)
          .map((l) => ({
            id: l.id,
            brandId: r.id,
            name: r.name,
            address: l.address,
            lat: l.lat!,
            lng: l.lng!,
            wishlist: r.status === "wishlist",
          }))
      ),
    [restaurants]
  );

  const region = useMemo(() => {
    const points = [
      ...(home.lat !== null && home.lng !== null ? [{ lat: home.lat, lng: home.lng }] : []),
      ...pins,
    ];
    if (points.length === 0) {
      return { latitude: 39.5, longitude: -98.35, latitudeDelta: 30, longitudeDelta: 30 };
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.05, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.05, (maxLng - minLng) * 1.4),
    };
  }, [pins, home]);

  if (pins.length === 0) {
    return (
      <View style={styles.empty}>
        <Muted style={{ textAlign: "center" }}>
          No places have coordinates yet — they get geocoded when you add or edit them with an
          address.
        </Muted>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <MapView style={styles.map} initialRegion={region}>
        {home.lat !== null && home.lng !== null && (
          <Marker
            coordinate={{ latitude: home.lat, longitude: home.lng }}
            title="Home"
            pinColor="#3b82f6"
          />
        )}
        {pins.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.name}
            description={p.address ?? undefined}
            pinColor={p.wishlist ? "#eab308" : colors.accent}
            onCalloutPress={() => router.push(`/restaurant/${p.brandId}`)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    height: 480,
  },
  map: { flex: 1 },
  empty: {
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 28,
  },
});
