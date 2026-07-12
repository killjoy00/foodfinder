import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DEFAULT_VOTE_SIZE, VOTE_SIZE_CHOICES } from "@shared/picker";
import {
  PRICE_LABELS,
  Profile,
  RestaurantFull,
  Vote,
  VoteSession,
  daysSince,
  mapsLink,
} from "@shared/types";
import { Button, Muted, Row, Segmented } from "@/components/ui";
import { useApp } from "@/lib/store";
import { colors, radius } from "@/lib/theme";

export default function VoteTab() {
  const { data, loading, refresh, api, profile } = useApp();
  const [live, setLive] = useState<{ session: VoteSession | null; votes: Vote[] } | null>(null);

  // family members vote from their own phones — poll while this tab is open
  const poll = useCallback(async () => {
    try {
      setLive(await api.getVote());
    } catch {
      // keep showing the last state; the next poll may recover
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void poll();
      const timer = setInterval(() => void poll(), 4000);
      return () => clearInterval(timer);
    }, [poll])
  );

  const session = live ? live.session : data?.vote?.session ?? null;
  const votes = live ? live.votes : data?.vote?.votes ?? [];
  const restaurants = useMemo(() => data?.restaurants ?? [], [data]);

  if (!profile) return null;

  const open = session?.status === "open" ? session : null;

  if (!open) {
    // a vote that just closed shows its winner for a couple of hours
    if (
      session?.status === "closed" &&
      session.winnerId &&
      Date.now() - new Date(session.createdAt).getTime() < 2 * 60 * 60 * 1000
    ) {
      const winner = restaurants.find((r) => r.id === session.winnerId);
      if (winner) {
        return (
          <Screen loading={loading} refresh={refresh}>
            <WinnerView winner={winner} />
          </Screen>
        );
      }
    }
    return (
      <Screen loading={loading} refresh={refresh}>
        <QuickVoteStart
          available={restaurants.length}
          onStart={async (n) => {
            await api.startQuickVote(n);
            await poll();
          }}
        />
      </Screen>
    );
  }

  const candidates = open.candidateIds
    .map((id) => restaurants.find((r) => r.id === id))
    .filter((r): r is RestaurantFull => r !== undefined);

  return (
    <Screen loading={loading} refresh={refresh}>
      <VotePanel
        key={open.id}
        session={open}
        votes={votes}
        profiles={data?.profiles ?? []}
        candidates={candidates}
        activeProfile={profile}
        onChanged={poll}
        api={api}
      />
    </Screen>
  );
}

function Screen({
  children,
  loading,
  refresh,
}: {
  children: React.ReactNode;
  loading: boolean;
  refresh: () => Promise<unknown>;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.accent} />
      }
    >
      {children}
    </ScrollView>
  );
}

function QuickVoteStart({
  available,
  onStart,
}: {
  available: number;
  onStart: (count: number) => Promise<void>;
}) {
  const sizes = VOTE_SIZE_CHOICES.filter((n) => n <= Math.max(2, available));
  const [count, setCount] = useState(Math.min(DEFAULT_VOTE_SIZE, sizes[sizes.length - 1] ?? 2));
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 48 }}>🗳️</Text>
      <Text style={styles.title}>No vote running</Text>
      <Muted style={{ textAlign: "center", maxWidth: 300 }}>
        Put some options up for a family decision. Everyone picks a favorite — and everyone gets
        one veto.
      </Muted>
      {available >= 2 ? (
        <View style={{ gap: 10, width: "100%" }}>
          <Segmented
            options={sizes.map((n) => ({ label: `${n} options`, value: n }))}
            value={count}
            onChange={setCount}
          />
          <Button
            title="Start a quick vote"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await onStart(count);
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      ) : (
        <Muted>Add at least two restaurants first.</Muted>
      )}
      <Text style={styles.link} onPress={() => router.push("/(tabs)/tonight")}>
        or spin the wheel on Tonight first →
      </Text>
    </View>
  );
}

function VotePanel({
  session,
  votes,
  profiles,
  candidates,
  activeProfile,
  onChanged,
  api,
}: {
  session: VoteSession;
  votes: Vote[];
  profiles: Profile[];
  candidates: RestaurantFull[];
  activeProfile: Profile;
  onChanged: () => Promise<void>;
  api: ReturnType<typeof useApp>["api"];
}) {
  const myVote = votes.find((v) => v.profileId === activeProfile.id);
  const [pickId, setPickId] = useState<string | null>(myVote?.pickId ?? null);
  const [vetoId, setVetoId] = useState<string | null>(myVote?.vetoId ?? null);
  const [pending, setPending] = useState(false);

  // adopt my submitted ballot when it arrives from another render/poll
  useEffect(() => {
    if (myVote) {
      setPickId(myVote.pickId);
      setVetoId(myVote.vetoId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myVote?.pickId, myVote?.vetoId]);

  const voteByProfile = new Map(votes.map((v) => [v.profileId, v]));
  const submitted = !!myVote;
  const iDeferred = myVote?.deferred ?? false;
  const hasDouble = activeProfile.doubleCredits > 0;

  async function run(fn: () => Promise<unknown>) {
    setPending(true);
    try {
      await fn();
      await onChanged();
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.title}>Family vote 🗳️</Text>
      <Muted>
        Tap your favorite, or 🚫 to veto one. Not fussed tonight? Defer to bank a 2× vote for next
        time.
      </Muted>

      {hasDouble && !iDeferred && (
        <Text style={styles.doubleNote}>
          🔥 Your vote counts 2× this round — you deferred last time.
        </Text>
      )}
      {iDeferred && (
        <Text style={styles.deferredNote}>
          ⏭️ You deferred — you&apos;re out this round, and you&apos;ll get a 2× vote next time.
        </Text>
      )}

      <View style={{ gap: 10, opacity: iDeferred ? 0.5 : 1 }}>
        {candidates.map((r) => {
          const isPick = pickId === r.id;
          const isVeto = vetoId === r.id;
          const days = daysSince(r.lastVisitAt);
          return (
            <View
              key={r.id}
              style={[
                styles.candidate,
                isPick && styles.candidatePick,
                isVeto && styles.candidateVeto,
              ]}
            >
              <Pressable
                style={{ flex: 1 }}
                disabled={iDeferred}
                onPress={() => {
                  setPickId(isPick ? null : r.id);
                  if (vetoId === r.id) setVetoId(null);
                }}
              >
                <Text style={styles.candidateName}>
                  {isPick && "❤️ "}
                  {r.name}
                </Text>
                <Muted>
                  {r.cuisines.join(" · ")} · {PRICE_LABELS[r.price - 1]}
                  {days !== null ? ` · ${days}d ago` : " · never been"}
                </Muted>
              </Pressable>
              <Pressable style={styles.mapBtn} onPress={() => Linking.openURL(mapsLink(r))}>
                <Text style={{ fontSize: 16 }}>🗺️</Text>
              </Pressable>
              <Pressable
                disabled={iDeferred}
                onPress={() => {
                  setVetoId(isVeto ? null : r.id);
                  if (pickId === r.id) setPickId(null);
                }}
                style={[styles.mapBtn, isVeto && { backgroundColor: "#7f1d1d" }]}
              >
                <Text style={{ fontSize: 16 }}>🚫</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Row>
        <Button
          title={
            iDeferred
              ? "You deferred"
              : submitted
                ? "Update my vote"
                : `Vote as ${activeProfile.emoji} ${activeProfile.name}`
          }
          style={{ flex: 1 }}
          disabled={pending || iDeferred || (!pickId && !vetoId)}
          onPress={() => void run(() => api.castVote(session.id, pickId, vetoId, false))}
        />
        <Button
          title="⏭️ Defer"
          kind="ghost"
          disabled={pending || iDeferred}
          onPress={() => {
            setPickId(null);
            setVetoId(null);
            void run(() => api.castVote(session.id, null, null, true));
          }}
        />
      </Row>

      <Row>
        <Muted>Voted:</Muted>
        {profiles.map((p) => {
          const v = voteByProfile.get(p.id);
          const label = !v ? "…" : v.deferred ? "⏭️" : "✓";
          return (
            <Text key={p.id} style={[styles.votedChip, v ? styles.votedChipDone : { opacity: 0.5 }]}>
              {p.emoji} {p.name} {label}
              {p.doubleCredits > 0 && " 🔥2×"}
            </Text>
          );
        })}
      </Row>

      <Row>
        <Button
          title="🏁 Close vote & reveal winner"
          kind="ghost"
          style={{ flex: 1, borderColor: colors.accent }}
          disabled={pending || votes.length === 0}
          onPress={() => void run(() => api.closeVote(session.id))}
        />
        <Button
          title="Cancel"
          kind="ghost"
          disabled={pending}
          onPress={() => void run(() => api.cancelVote(session.id))}
        />
      </Row>
    </View>
  );
}

function WinnerView({ winner }: { winner: RestaurantFull }) {
  const { api, refresh } = useApp();
  const [logged, setLogged] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <View style={styles.winnerCard}>
      <Text style={{ fontSize: 48 }}>🏆</Text>
      <Text style={styles.kicker}>The family has spoken</Text>
      <Text style={styles.winnerName}>{winner.name}</Text>
      <Muted>{winner.cuisines.join(" · ")}</Muted>
      <Row style={{ width: "100%" }}>
        <Button
          title="🗺️ Maps"
          kind="secondary"
          style={{ flex: 1 }}
          onPress={() => Linking.openURL(mapsLink(winner))}
        />
        {logged ? (
          <Text style={[styles.loggedNote, { flex: 1 }]}>Logged 🎉</Text>
        ) : (
          <Button
            title="We went! 🎉"
            style={{ flex: 1 }}
            busy={pending}
            onPress={async () => {
              setPending(true);
              try {
                await api.logVisit(winner.id, "dine_in");
                setLogged(true);
                void refresh();
              } finally {
                setPending(false);
              }
            }}
          />
        )}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  empty: { alignItems: "center", gap: 14, paddingTop: 48 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: "800" },
  link: { color: colors.accent, textDecorationLine: "underline", fontSize: 14 },
  doubleNote: {
    color: colors.accentText,
    borderColor: colors.accent,
    borderWidth: 1,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.control,
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: "center",
    fontWeight: "600",
    overflow: "hidden",
  },
  deferredNote: {
    color: colors.muted,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: "center",
    fontWeight: "600",
    overflow: "hidden",
  },
  candidate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 14,
  },
  candidatePick: { borderColor: colors.accent, backgroundColor: "#7c2d1266" },
  candidateVeto: { borderColor: "#991b1b", backgroundColor: "#45091366", opacity: 0.7 },
  candidateName: { color: colors.foreground, fontSize: 17, fontWeight: "700" },
  mapBtn: {
    backgroundColor: colors.surface2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  votedChip: {
    color: colors.muted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    overflow: "hidden",
  },
  votedChipDone: { borderColor: "#15803d", color: colors.green },
  winnerCard: {
    alignItems: "center",
    gap: 10,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 22,
    marginTop: 24,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  winnerName: { color: colors.foreground, fontSize: 28, fontWeight: "800", textAlign: "center" },
  loggedNote: {
    color: colors.green,
    backgroundColor: colors.greenBg,
    borderRadius: radius.control,
    paddingVertical: 12,
    textAlign: "center",
    fontWeight: "700",
    overflow: "hidden",
  },
});
