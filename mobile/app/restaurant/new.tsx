import { router } from "expo-router";
import React, { useState } from "react";
import { ScrollView, Text } from "react-native";
import { RestaurantForm, draftToPayload } from "@/components/RestaurantForm";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

export default function NewRestaurant() {
  const { api, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {error && <Text style={{ color: colors.danger }}>{error}</Text>}
      <RestaurantForm
        submitLabel="Add place"
        busy={busy}
        showSearch
        onSubmit={async (draft) => {
          setBusy(true);
          setError(null);
          try {
            const { restaurant } = await api.createRestaurant(draftToPayload(draft));
            await refresh();
            router.replace(`/restaurant/${restaurant.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't add that place.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </ScrollView>
  );
}
