// Generates the PWA icons (a plate on a rounded dark tile) as PNGs with
// no image dependencies — run `node scripts/make-icons.mjs` to regenerate.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [0x1c, 0x19, 0x17]; // surface
const ORANGE = [0xf9, 0x73, 0x16];
const CREAM = [0xfa, 0xfa, 0xf9];

function drawIcon(size, opaque) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const cornerR = size * 0.21;
  const set = (x, y, [r, g, b], a = 255) => {
    const i = (y * size + x) * 4;
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = a;
  };
  const inRoundedRect = (x, y) => {
    const rx = Math.max(cornerR - x, x - (size - 1 - cornerR), 0);
    const ry = Math.max(cornerR - y, y - (size - 1 - cornerR), 0);
    return rx * rx + ry * ry <= cornerR * cornerR;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!opaque && !inRoundedRect(x, y)) continue; // transparent corner
      const d = Math.hypot(x - c, y - c) / size;
      let color = BG;
      if (d < 0.38) color = ORANGE; // plate rim
      if (d < 0.31) color = CREAM; // plate
      if (d < 0.13) color = ORANGE; // the meal
      set(x, y, color);
    }
  }
  return png(size, size, rgba);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", drawIcon(192, false));
writeFileSync("public/icons/icon-512.png", drawIcon(512, false));
writeFileSync("public/icons/apple-touch-icon.png", drawIcon(180, true));
console.log("icons written to public/icons/");
