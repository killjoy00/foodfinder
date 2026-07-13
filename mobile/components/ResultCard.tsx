import { router } from "expo-router";
import * as Linking from "expo-linking";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DEFAULT_VOTE_SIZE, VOTE_SIZE_CHOICES, WeightedCandidate } from "@shared/picker";
import {
  PRICE_LABELS,
  Profile,
  VisitMode,
  daysSince,
  mapsLink,
  openTableLink,
} from "@shared/types";
import { colors, radius } from "@/lib/theme";
import { Button, Row } from "./ui";

export function ResultCard({
  candidate,
  profiles,
  logged,
  onLog,
  onReroll,
  onStartVote,
  maxVoteSize,
  distanceLabel,
  distanceFromMe,
}: {
  candidate: WeightedCandidate;
  profiles: Profile[];
  logged: boolean;
  onLog: (mode: VisitMode) => Promise<void>;
  onReroll: () => void;
  onStartVote: (count: number) => void;
  maxVoteSize: number;
  distanceLabel: string | null;
  distanceFromMe: boolean;
}) {
  const r = candidate.restaurant;
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<VisitMode>("dine_in");
  const [choosingVoteSize, setChoosingVoteSize] = useState(false);
  const days = daysSince(r.lastVisitAt);
  const voteSizes = VOTE_SIZE_CHOICES.filter((n) => n <= maxVoteSize);

  const meta = [
    r.cuisines.join(" · "),
    PRICE_LABELS[r.price - 1],
    distanceLabel ? `${distanceLabel}${distanceFromMe ? " away" : " from home"}` : null,
    days !== null
      ? `last visit ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}`
      : r.status === "wishlist"
        ? "first time! 🎈"
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Tonight you eat at</Text>
      <Text style={styles.name}>{r.name}</Text>
      <Text style={styles.meta}>{meta}</Text>
      {r.locationCount > 1 && (
        <Text style={styles.nearest}>
          📍 Nearest of {r.locationCount} locations{r.address ? ` · ${r.address}` : ""}
        </Text>
      )}

      {candidate.reasons.length > 0 && (
        <Row>
          {candidate.reasons.map((reason) => (
            <Text key={reason} style={styles.reason}>
              {reason}
            </Text>
          ))}
        </Row>
      )}

      {Object.keys(r.ratings).length > 0 && (
        <Row>
          {profiles
            .filter((p) => r.ratings[p.id] !== undefined)
            .map((p) => (
              <Text key={p.id} style={styles.rating}>
                {p.emoji} {r.ratings[p.id]}/10
              </Text>
            ))}
        </Row>
      )}

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
        <Button
          title="📄 Details"
          kind="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push(`/restaurant/${r.id}`)}
        />
      </Row>

      {logged ? (
        <Text style={styles.logged}>Logged — enjoy dinner! 🎉</Text>
      ) : (
        <Row>
          <Pressable
            onPress={() => setMode(mode === "dine_in" ? "takeout" : "dine_in")}
            style={styles.modeToggle}
          >
            <Text style={{ fontSize: 20 }}>{mode === "dine_in" ? "🍽️" : "🥡"}</Text>
          </Pressable>
          <Button
            title={pending ? "Logging…" : "We went! Log it 🎉"}
            style={{ flex: 1 }}
            busy={pending}
            onPress={async () => {
              setPending(true);
              try {
                await onLog(mode);
              } finally {
                setPending(false);
              }
            }}
          />
        </Row>
      )}

      {choosingVoteSize ? (
        <Row>
          <Text style={styles.voteLabel}>How many options?</Text>
          {voteSizes.map((n) => (
            <Button
              key={n}
              title={String(n)}
              kind={n === DEFAULT_VOTE_SIZE ? "secondary" : "ghost"}
              style={{ flex: 1 }}
              onPress={() => onStartVote(n)}
            />
          ))}
          <Button title="✕" kind="ghost" onPress={() => setChoosingVoteSize(false)} />
        </Row>
      ) : (
        <Row>
          <Button title="😒 Nope, spin again" kind="ghost" style={{ flex: 1 }} onPress={onReroll} />
          <Button
            title="🗳️ Let the family vote"
            kind="ghost"
            style={{ flex: 1 }}
            onPress={() =>
              voteSizes.length > 1 ? setChoosingVoteSize(true) : onStartVote(DEFAULT_VOTE_SIZE)
            }
          />
        </Row>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: radius.card,
    padding: 18,
    gap: 12,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  name: { color: colors.foreground, fontSize: 30, fontWeight: "800", lineHeight: 34 },
  meta: { color: colors.muted, fontSize: 14 },
  nearest: { color: colors.accentText, fontSize: 13 },
  reason: {
    color: colors.accentText,
    backgroundColor: colors.surface2,
    borderRadius: radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontSize: 12,
    overflow: "hidden",
  },
  rating: {
    color: colors.foreground,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontSize: 14,
    overflow: "hidden",
  },
  logged: {
    color: colors.green,
    backgroundColor: colors.greenBg,
    borderRadius: radius.control,
    paddingVertical: 12,
    textAlign: "center",
    fontWeight: "700",
    overflow: "hidden",
  },
  modeToggle: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.control,
    backgroundColor: colors.surface2,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  voteLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
});
