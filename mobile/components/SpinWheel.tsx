import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path, Text as SvgText } from "react-native-svg";
import { WHEEL_COLORS, colors } from "@/lib/theme";

export type WheelSegment = { id: string; label: string };

const SIZE = 320;
const R = SIZE / 2;

function polar(angleDeg: number, r: number): { x: number; y: number } {
  // 0° at the top, clockwise (matches the web wheel's conic-gradient)
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: R + r * Math.cos(rad), y: R + r * Math.sin(rad) };
}

function slicePath(a0: number, a1: number): string {
  const p0 = polar(a0, R);
  const p1 = polar(a1, R);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${R} ${R} L ${p0.x} ${p0.y} A ${R} ${R} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

/**
 * The pointer sits at the top. The winner is decided before the spin;
 * the wheel animates to land its segment under the pointer. Tap to skip.
 */
export function SpinWheel({
  segments,
  winnerId,
  spinKey,
  onDone,
}: {
  segments: WheelSegment[];
  winnerId: string;
  spinKey: number;
  onDone: () => void;
}) {
  const rotation = useRef(new Animated.Value(0)).current;
  const [target, setTarget] = useState(0);
  const prevTarget = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const n = segments.length;
  const segAngle = 360 / n;

  useEffect(() => {
    const winnerIndex = Math.max(0, segments.findIndex((s) => s.id === winnerId));
    const winnerCenter = winnerIndex * segAngle + segAngle / 2;
    const jitter = (Math.random() - 0.5) * segAngle * 0.5;
    // 5 full turns, then park the winner's center under the pointer
    const base = Math.ceil(prevTarget.current / 360) * 360;
    const next = base + 5 * 360 + (360 - winnerCenter) + jitter;
    prevTarget.current = next;
    setTarget(next);
    Animated.timing(rotation, {
      toValue: next,
      duration: 4000,
      easing: Easing.bezier(0.12, 0.8, 0.16, 1),
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => doneRef.current(), 4200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  const spin = rotation.interpolate({
    inputRange: [0, Math.max(target, 1)],
    outputRange: ["0deg", `${Math.max(target, 1)}deg`],
  });

  const wheel = useMemo(
    () => (
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {segments.map((seg, i) => (
          <Path
            key={seg.id + i}
            d={slicePath(i * segAngle, (i + 1) * segAngle)}
            fill={WHEEL_COLORS[i % WHEEL_COLORS.length]}
          />
        ))}
        {segments.map((seg, i) => {
          const angle = i * segAngle + segAngle / 2;
          const label = seg.label.length > 16 ? `${seg.label.slice(0, 15)}…` : seg.label;
          return (
            // spin the label's radial line to its segment, then write the
            // text down that line — reads from the rim toward the center
            <G key={`label-${seg.id}-${i}`} rotation={angle} originX={R} originY={R}>
              <SvgText
                x={R}
                y={18}
                rotation={90}
                originX={R}
                originY={18}
                fill="rgba(0,0,0,0.8)"
                fontSize={12}
                fontWeight="bold"
                textAnchor="start"
              >
                {label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    ),
    [segments, segAngle]
  );

  return (
    <Pressable onPress={() => doneRef.current()} style={styles.wrap}>
      <Text style={styles.pointer}>🔻</Text>
      <Animated.View style={[styles.wheel, { transform: [{ rotate: spin }] }]}>
        {wheel}
      </Animated.View>
      <View style={styles.hub}>
        <Text style={{ fontSize: 24 }}>🍴</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  wheel: {
    width: SIZE,
    height: SIZE,
    borderRadius: R,
    borderWidth: 4,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pointer: {
    position: "absolute",
    top: 2,
    zIndex: 10,
    fontSize: 28,
  },
  hub: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
