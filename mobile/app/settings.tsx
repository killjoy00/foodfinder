import React, { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { Button, Card, Field, Muted, Segmented } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors } from "@/lib/theme";

const RADIUS_CHOICES = [3, 5, 10, 20];

export default function SettingsScreen() {
  const { api, data, refresh } = useApp();
  const settings = data?.settings;

  const [zip, setZip] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(
    settings ? Math.round(settings.radiusMeters / 1609.34) || 5 : 5
  );
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  async function saveLocation() {
    setLocBusy(true);
    setLocMsg(null);
    try {
      const result = await api.saveHomeLocation({ zip, radiusMiles });
      setLocMsg(result.message);
      setZip("");
      void refresh();
    } catch (err) {
      setLocMsg(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setLocBusy(false);
    }
  }

  async function changePassword() {
    if (password !== confirm) {
      setPwMsg("The two passwords don't match.");
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    try {
      await api.changePassword(password);
      setPwMsg("Password changed ✓ — tell the family!");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : "Couldn't change the password.");
    } finally {
      setPwBusy(false);
    }
  }

  const nearestRadius = RADIUS_CHOICES.reduce((best, r) =>
    Math.abs(r - radiusMiles) < Math.abs(best - radiusMiles) ? r : best
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <Text style={styles.section}>🏠 Home location</Text>
        <Muted>
          {settings?.homeLabel
            ? `Home is set to ${settings.homeLabel}.`
            : "Set home to get distances, the near-me filter, discovery sweeps, and recommendations."}
        </Muted>
        <Field
          placeholder="ZIP code"
          value={zip}
          onChangeText={setZip}
          keyboardType="number-pad"
          maxLength={10}
        />
        <Muted>Search radius for discovery & recommendations</Muted>
        <Segmented
          options={RADIUS_CHOICES.map((mi) => ({ label: `${mi} mi`, value: mi }))}
          value={nearestRadius}
          onChange={setRadiusMiles}
        />
        <Button
          title="Save home location"
          busy={locBusy}
          disabled={!zip.trim()}
          onPress={() => void saveLocation()}
        />
        {locMsg && <Muted style={{ color: colors.accentText }}>{locMsg}</Muted>}
      </Card>

      <Card>
        <Text style={styles.section}>🔑 Group password</Text>
        <Muted>
          Anyone still logged in can set a new password — that&apos;s also the recovery path if
          it&apos;s forgotten.
        </Muted>
        <Field
          placeholder="New password (4+ characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Field
          placeholder="Same password again"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
        <Button
          title="Change password"
          kind="secondary"
          busy={pwBusy}
          disabled={password.length < 4}
          onPress={() => void changePassword()}
        />
        {pwMsg && <Muted style={{ color: colors.accentText }}>{pwMsg}</Muted>}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  section: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
});
