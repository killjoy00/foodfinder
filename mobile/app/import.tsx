import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { parseTakeoutAny } from "@shared/takeout";
import { Button, Card, Muted } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

export default function ImportExport() {
  const { api, refresh } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importTakeout() {
    setError(null);
    setMessage(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/csv", "text/comma-separated-values", "text/plain"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setBusy("import");
    try {
      const text = await FileSystem.readAsStringAsync(asset.uri);
      const items = parseTakeoutAny(text, asset.name ?? "");
      if (items.length === 0) {
        setError(
          "Couldn't find any places in that file. Export your Google Maps reviews or saved places from Google Takeout and pick that file."
        );
        return;
      }
      const result = await api.importTakeout(items);
      setMessage(
        `Imported ${result.imported} place${result.imported === 1 ? "" : "s"}` +
          (result.skipped ? ` (skipped ${result.skipped} you already had)` : "") +
          " 🎉"
      );
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(null);
    }
  }

  async function exportCsv(kind: "restaurants" | "visits") {
    setError(null);
    setMessage(null);
    setBusy(kind);
    try {
      const csv = await api.exportCsv(kind);
      const date = new Date().toISOString().slice(0, 10);
      const path = `${FileSystem.cacheDirectory}foodfinder-${kind}-${date}.csv`;
      await FileSystem.writeAsStringAsync(path, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "text/csv" });
      } else {
        setMessage(`Saved to ${path}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
    >
      <Card>
        <Text style={styles.section}>📦 Import from Google Takeout</Text>
        <Muted>
          Seed the app from your existing Google Maps history: takeout.google.com → export
          &quot;Maps (your places)&quot; and/or your reviews, then pick the .json or .csv file
          here. Reviewed places land in &quot;Been there&quot; (stars become ratings); saved
          places land on the wishlist.
        </Muted>
        <Button
          title="Pick a Takeout file"
          busy={busy === "import"}
          onPress={() => void importTakeout()}
        />
      </Card>

      <Card>
        <Text style={styles.section}>📤 Export as CSV</Text>
        <Muted>Your data is yours — share or save a spreadsheet anytime.</Muted>
        <Button
          title="Export restaurants"
          kind="secondary"
          busy={busy === "restaurants"}
          onPress={() => void exportCsv("restaurants")}
        />
        <Button
          title="Export visits"
          kind="secondary"
          busy={busy === "visits"}
          onPress={() => void exportCsv("visits")}
        />
      </Card>

      {message && <Text style={{ color: colors.green, textAlign: "center" }}>{message}</Text>}
      {error && <Text style={{ color: colors.danger, textAlign: "center" }}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  section: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
});
