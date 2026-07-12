import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import type { RestaurantFull } from "@shared/types";
import { RestaurantForm, draftToPayload } from "@/components/RestaurantForm";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

export default function EditRestaurant() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, refresh } = useApp();
  const [initial, setInitial] = useState<RestaurantFull | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getRestaurant(id)
      .then((res) => setInitial(res.restaurant))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this place."));
  }, [api, id]);

  if (!initial) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {error && <Text style={{ color: colors.danger }}>{error}</Text>}
      <RestaurantForm
        initial={initial}
        submitLabel="Save changes"
        busy={busy}
        onSubmit={async (draft) => {
          setBusy(true);
          setError(null);
          try {
            await api.updateRestaurant(initial.id, draftToPayload(draft));
            await refresh();
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save changes.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </ScrollView>
  );
}
