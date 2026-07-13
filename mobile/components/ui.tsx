import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius } from "@/lib/theme";

/** RN ports of the web app's UI primitives (components/ui.tsx). */

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Chip({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{children}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text
              numberOfLines={1}
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = "primary",
  disabled,
  busy,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}) {
  const styleOf = {
    primary: styles.btnPrimary,
    secondary: styles.btnSecondary,
    ghost: styles.btnGhost,
    danger: styles.btnDanger,
  }[kind];
  const textOf = {
    primary: styles.btnPrimaryText,
    secondary: styles.btnText,
    ghost: styles.btnGhostText,
    danger: styles.btnDangerText,
  }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.btn,
        styleOf,
        (disabled || busy) && { opacity: 0.4 },
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={kind === "primary" ? "#000" : colors.foreground} />
      ) : (
        <Text style={[styles.btnText, textOf]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.field, props.style]}
    />
  );
}

export function Muted({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: object;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[styles.mutedText, style]}>
      {children}
    </Text>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chip: {
    borderRadius: radius.chip,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipIdle: { borderColor: colors.border, backgroundColor: colors.surface2 },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { color: colors.muted, fontSize: 14 },
  chipTextActive: { color: colors.accentText, fontWeight: "600" },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    borderRadius: radius.control - 4,
    paddingVertical: 7,
    alignItems: "center",
  },
  segmentActive: { backgroundColor: colors.accentSoft },
  segmentText: { color: colors.muted, fontSize: 13 },
  segmentTextActive: { color: colors.accentText, fontWeight: "700" },
  btn: {
    borderRadius: radius.control,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: colors.foreground, fontSize: 16, fontWeight: "600" },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: "#000", fontWeight: "700" },
  btnSecondary: { backgroundColor: colors.surface2 },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.muted },
  btnDanger: { borderWidth: 1, borderColor: "#7f1d1d" },
  btnDangerText: { color: colors.danger },
  field: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.control,
    color: colors.foreground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  mutedText: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
});
