/** The web app's palette (app/globals.css), shared so both clients match. */
export const colors = {
  background: "#0c0a09",
  surface: "#1c1917",
  surface2: "#292524",
  border: "#44403c",
  foreground: "#fafaf9",
  muted: "#a8a29e",
  accent: "#f97316",
  accentSoft: "#7c2d12",
  accentText: "#fdba74", // orange-200/300 accents used on chips
  green: "#86efac",
  greenBg: "#052e16",
  danger: "#f87171",
  yellow: "#fde047",
} as const;

export const radius = { card: 16, control: 12, chip: 999 } as const;

/** Wheel segment colors (components/SpinWheel.tsx on the web). */
export const WHEEL_COLORS = [
  "#f97316",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#ec4899",
  "#eab308",
  "#14b8a6",
  "#ef4444",
];
