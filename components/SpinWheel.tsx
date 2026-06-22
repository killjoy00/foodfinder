"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#eab308", "#14b8a6", "#ef4444"];

export type WheelSegment = { id: string; label: string };

/**
 * The pointer sits at the top. The winner is decided before the spin;
 * the wheel animates to land its segment under the pointer.
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
  const [rotation, setRotation] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const n = segments.length;
  const segAngle = 360 / n;

  useEffect(() => {
    setReduceMotion(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) {
      // honor reduced-motion: reveal the result immediately, no spinning
      const timer = setTimeout(() => doneRef.current(), 250);
      return () => clearTimeout(timer);
    }
    const winnerIndex = Math.max(0, segments.findIndex((s) => s.id === winnerId));
    const winnerCenter = winnerIndex * segAngle + segAngle / 2;
    const jitter = (Math.random() - 0.5) * segAngle * 0.5;
    // 5 full turns, then park the winner's center under the pointer
    setRotation((prev) => {
      const base = Math.ceil(prev / 360) * 360;
      return base + 5 * 360 + (360 - winnerCenter) + jitter;
    });
    const timer = setTimeout(() => doneRef.current(), 4200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  const gradient = segments
    .map((_, i) => {
      const color = COLORS[i % COLORS.length];
      return `${color} ${i * segAngle}deg ${(i + 1) * segAngle}deg`;
    })
    .join(", ");

  return (
    <button
      type="button"
      onClick={() => doneRef.current()}
      aria-label="Spinning the wheel — tap to reveal the pick"
      title="Tap to skip"
      className="relative mx-auto block aspect-square w-full max-w-sm select-none"
    >
      {/* pointer */}
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1.5 text-3xl drop-shadow">
        🔻
      </div>
      <div
        className="h-full w-full rounded-full border-4 border-border-soft shadow-2xl"
        style={{
          background: `conic-gradient(${gradient})`,
          transform: `rotate(${rotation}deg)`,
          transition: reduceMotion ? "none" : "transform 4s cubic-bezier(0.12, 0.8, 0.16, 1)",
        }}
      >
        {segments.map((seg, i) => {
          const angle = i * segAngle + segAngle / 2;
          return (
            <div
              key={seg.id}
              className="absolute inset-0"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              {/* reads from the rim toward the center */}
              <span
                className="absolute left-1/2 top-3 block max-h-28 -translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold text-black/80"
                style={{ writingMode: "vertical-rl" }}
              >
                {seg.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-border-soft bg-surface text-2xl shadow">
        🍴
      </div>
    </button>
  );
}
