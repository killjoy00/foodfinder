// App icon generator — renders the FoodFinder spin-wheel mark at every
// size the iPhone app (mobile/assets) and the web PWA (public/icons)
// need. Rerun with `npm run icons` after tweaking the design below.
import sharp from "sharp";
import { fileURLToPath } from "url";
import path from "path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// the Tonight tab's wheel palette (mobile/lib/theme.ts WHEEL_COLORS)
const WHEEL_COLORS = [
  "#f97316", "#3b82f6", "#22c55e", "#a855f7",
  "#ec4899", "#eab308", "#14b8a6", "#ef4444",
];
const BG = "#0c0a09"; // app background
const SURFACE = "#1c1917"; // hub fill
const RING = "#44403c"; // wheel + hub border

const polar = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180; // 0° at top, clockwise
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

function slice(cx, cy, r, a0, a1, fill) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z" fill="${fill}"/>`;
}

/** A bold four-tine fork, tines up, centered on (0,0), 2×h tall. */
function fork(cx, cy, h, color) {
  const s = h / 100; // drawn in a ±100-unit space, scaled to h
  const tines = [-30, -10, 10, 30]
    .map((x) => `<rect x="${x - 7}" y="-100" width="14" height="62" rx="7" fill="${color}"/>`)
    .join("");
  // head joins the tines, tapers into a rounded-tipped handle
  const body = `M -37 -48 h 74 q 0 28 -28 36 v 97 q 0 15 -9 15 q -9 0 -9 -15 v -97 q -28 -8 -28 -36 Z`;
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
    ${tines}
    <path d="${body}" fill="${color}"/>
  </g>`;
}

/**
 * The mark. size: canvas px. opts:
 *  - bg: "solid" | "none"          background fill
 *  - margin: fraction of canvas the wheel diameter occupies (0-1)
 *  - mono: render white-only (Android themed icon)
 */
function wheelSvg(size, { bg = "solid", margin = 0.86, mono = false } = {}) {
  const c = size / 2;
  const R = (size * margin) / 2; // wheel radius incl. ring
  const ringW = R * 0.055;
  const wheelR = R - ringW / 2;
  const hubR = R * 0.34;
  const seg = 360 / WHEEL_COLORS.length;
  const rot = -seg / 2; // a segment centered under the pointer, like mid-spin

  const parts = [];
  if (bg === "solid") {
    parts.push(`<defs>
      <radialGradient id="bgGrad" cx="50%" cy="42%" r="75%">
        <stop offset="0%" stop-color="${SURFACE}"/>
        <stop offset="100%" stop-color="${BG}"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bgGrad)"/>`);
  }

  if (mono) {
    // Android themed icons read only the alpha channel, so the glyph is a
    // white mask: ring + spokes + hub, with the fork punched out of the hub
    const spokes = WHEEL_COLORS.map((_, i) => {
      const [x, y] = polar(c, c, wheelR, rot + i * seg);
      return `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="white" stroke-width="${ringW}"/>`;
    }).join("");
    parts.push(`<mask id="mono">
      <rect width="${size}" height="${size}" fill="black"/>
      <circle cx="${c}" cy="${c}" r="${wheelR}" fill="none" stroke="white" stroke-width="${ringW * 1.6}"/>
      ${spokes}
      <circle cx="${c}" cy="${c}" r="${hubR}" fill="white"/>
      ${fork(c, c, hubR * 0.68, "black")}
    </mask>
    <rect width="${size}" height="${size}" fill="white" mask="url(#mono)"/>`);
  } else {
    parts.push(
      // slices, rotated so the pointer bisects a slice
      ...WHEEL_COLORS.map((color, i) =>
        slice(c, c, wheelR, rot + i * seg, rot + (i + 1) * seg, color)
      ),
      // crisp slice separators
      ...WHEEL_COLORS.map((_, i) => {
        const [x, y] = polar(c, c, wheelR, rot + i * seg);
        return `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="${BG}" stroke-width="${R * 0.018}"/>`;
      }),
      // outer ring
      `<circle cx="${c}" cy="${c}" r="${wheelR}" fill="none" stroke="${RING}" stroke-width="${ringW}"/>`,
      // hub with fork
      `<circle cx="${c}" cy="${c}" r="${hubR}" fill="${SURFACE}" stroke="${RING}" stroke-width="${ringW * 0.8}"/>`,
      fork(c, c, hubR * 0.68, "#fafaf9"),
      // pointer notch at the top
      `<path d="M ${c - R * 0.11} ${c - R - ringW * 0.2} h ${R * 0.22} L ${c} ${c - R * 0.74} Z"
         fill="#fafaf9" stroke="${BG}" stroke-width="${R * 0.02}" stroke-linejoin="round"/>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${parts.join("\n")}</svg>`;
}

async function render(svg, file, size) {
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(path.join(root, file));
  console.log("✓", file);
}

const solidBgSvg = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${BG}"/></svg>`;

// iPhone app (Expo)
await render(wheelSvg(1024), "mobile/assets/icon.png", 1024);
await render(wheelSvg(1024, { bg: "none", margin: 0.8 }), "mobile/assets/splash-icon.png", 1024);
// Android adaptive: art inside the central safe zone (~66% of canvas)
await render(wheelSvg(512, { bg: "none", margin: 0.58 }), "mobile/assets/android-icon-foreground.png", 512);
await render(solidBgSvg(512), "mobile/assets/android-icon-background.png", 512);
await render(wheelSvg(432, { bg: "none", margin: 0.58, mono: true }), "mobile/assets/android-icon-monochrome.png", 432);
await render(wheelSvg(192, { margin: 0.92 }), "mobile/assets/favicon.png", 48);

// web PWA
await render(wheelSvg(1024), "public/icons/icon-512.png", 512);
await render(wheelSvg(1024), "public/icons/icon-192.png", 192);
await render(wheelSvg(1024), "public/icons/apple-touch-icon.png", 180);
