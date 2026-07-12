import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PlaceResult } from "@shared/places";
import { RestaurantFull, TAGS, TAG_LABELS, Tag } from "@shared/types";
import { Button, Card, Chip, Field, Muted, Row, SectionLabel, Segmented } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors, radius } from "@/lib/theme";

export type RestaurantDraft = {
  name: string;
  cuisines: string; // comma separated in the form
  price: number;
  address: string;
  googlePlaceId: string | null;
  mapsUrl: string | null;
  reserveUrl: string;
  lat: number | null;
  lng: number | null;
  tags: string[];
  status: "active" | "wishlist";
  notes: string;
};

export function draftFrom(r?: RestaurantFull | null): RestaurantDraft {
  return {
    name: r?.name ?? "",
    cuisines: r?.cuisines.join(", ") ?? "",
    price: r?.price ?? 2,
    address: r?.address ?? "",
    googlePlaceId: r?.googlePlaceId ?? null,
    mapsUrl: r?.mapsUrl ?? null,
    reserveUrl: r?.reserveUrl ?? "",
    lat: r?.lat ?? null,
    lng: r?.lng ?? null,
    tags: r?.tags ?? [],
    status: r?.status ?? "active",
    notes: r?.notes ?? "",
  };
}

export function draftToPayload(d: RestaurantDraft) {
  return {
    name: d.name,
    cuisines: d.cuisines.split(",").map((c) => c.trim()).filter(Boolean),
    price: d.price,
    address: d.address || null,
    googlePlaceId: d.googlePlaceId,
    mapsUrl: d.mapsUrl,
    reserveUrl: d.reserveUrl || null,
    lat: d.lat,
    lng: d.lng,
    tags: d.tags,
    status: d.status,
    notes: d.notes || null,
  };
}

export function RestaurantForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
  showSearch = false,
}: {
  initial?: RestaurantFull | null;
  submitLabel: string;
  busy: boolean;
  onSubmit: (draft: RestaurantDraft) => void;
  showSearch?: boolean;
}) {
  const { api } = useApp();
  const [draft, setDraft] = useState<RestaurantDraft>(() => draftFrom(initial));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  // debounced Google Places autocomplete via the server (needs its API key)
  useEffect(() => {
    if (!showSearch || query.trim().length < 3) {
      setHits([]);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { places } = await api.searchPlaces(query.trim());
        if (seq === searchSeq.current) setHits(places.slice(0, 5));
      } catch {
        if (seq === searchSeq.current) setHits([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, showSearch, api]);

  function set<K extends keyof RestaurantDraft>(key: K, value: RestaurantDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function applyHit(hit: PlaceResult) {
    setDraft((d) => ({
      ...d,
      name: hit.name,
      address: hit.address ?? d.address,
      googlePlaceId: hit.placeId,
      mapsUrl: hit.mapsUrl,
      lat: hit.lat,
      lng: hit.lng,
      price: hit.priceLevel ?? d.price,
      cuisines: d.cuisines || hit.cuisines.join(", "),
    }));
    setQuery("");
    setHits([]);
  }

  return (
    <View style={{ gap: 12 }}>
      {showSearch && (
        <Card>
          <SectionLabel>Search Google Places (autofills everything)</SectionLabel>
          <Field
            placeholder="Search restaurants…"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {searching && <Muted>Searching…</Muted>}
          {hits.map((hit) => (
            <Pressable key={hit.placeId} style={styles.hit} onPress={() => applyHit(hit)}>
              <Text style={styles.hitName}>{hit.name}</Text>
              <Muted numberOfLines={1}>{hit.address ?? ""}</Muted>
            </Pressable>
          ))}
        </Card>
      )}

      <Card>
        <SectionLabel>Name</SectionLabel>
        <Field value={draft.name} onChangeText={(v) => set("name", v)} placeholder="Restaurant name" />

        <SectionLabel>Cuisines (comma separated)</SectionLabel>
        <Field
          value={draft.cuisines}
          onChangeText={(v) => set("cuisines", v)}
          placeholder="Mexican, Tacos"
          autoCapitalize="words"
        />

        <SectionLabel>Price</SectionLabel>
        <Segmented
          options={[1, 2, 3, 4].map((p) => ({ label: "$".repeat(p), value: p }))}
          value={draft.price}
          onChange={(price) => set("price", price)}
        />

        <SectionLabel>Address</SectionLabel>
        <Field
          value={draft.address}
          onChangeText={(v) => set("address", v)}
          placeholder="Street address (used for distance)"
        />

        <SectionLabel>Tags</SectionLabel>
        <Row>
          {TAGS.map((tag: Tag) => (
            <Chip
              key={tag}
              active={draft.tags.includes(tag)}
              onPress={() =>
                set(
                  "tags",
                  draft.tags.includes(tag)
                    ? draft.tags.filter((t) => t !== tag)
                    : [...draft.tags, tag]
                )
              }
            >
              {TAG_LABELS[tag]}
            </Chip>
          ))}
        </Row>

        <SectionLabel>List</SectionLabel>
        <Segmented
          options={[
            { label: "🍽️ Been there", value: "active" },
            { label: "⭐ Wishlist", value: "wishlist" },
          ]}
          value={draft.status}
          onChange={(status) => set("status", status)}
        />

        <SectionLabel>Reservation link (optional)</SectionLabel>
        <Field
          value={draft.reserveUrl}
          onChangeText={(v) => set("reserveUrl", v)}
          placeholder="https://…"
          autoCapitalize="none"
        />

        <SectionLabel>Notes</SectionLabel>
        <Field
          value={draft.notes}
          onChangeText={(v) => set("notes", v)}
          placeholder="Get the queso."
          multiline
        />
      </Card>

      <Button
        title={submitLabel}
        busy={busy}
        disabled={!draft.name.trim()}
        onPress={() => onSubmit(draft)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    backgroundColor: colors.surface2,
    borderRadius: radius.control,
    padding: 10,
  },
  hitName: { color: colors.foreground, fontWeight: "600" },
});
