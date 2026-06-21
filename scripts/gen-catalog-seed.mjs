// Convert a restaurant CSV (Name, Neighborhood, Cuisine, Price, ..., Google Maps)
// into an idempotent SQL seed that inserts into the shared `restaurants`
// catalog. Usage: node scripts/gen-catalog-seed.mjs <input.csv> <output.sql> [city]
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath, city = "Austin, TX"] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node scripts/gen-catalog-seed.mjs <input.csv> <output.sql> [city]");
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

function priceTier(raw) {
  const s = (raw || "").trim();
  if (/^\$+$/.test(s)) return Math.min(4, s.length);
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return 2;
  const hi = Math.max(...nums);
  if (hi <= 15) return 1;
  if (hi <= 30) return 2;
  if (hi <= 60) return 3;
  return 4;
}

function placeId(mapsUrl) {
  const m = (mapsUrl || "").match(/query_place_id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

const sq = (s) => `'${String(s).replace(/'/g, "''")}'`;

const text = readFileSync(inPath, "utf8").replace(/^﻿/, "");
const rows = parseCsv(text);
const header = rows[0].map((h) => h.trim().toLowerCase());
const col = (name) => header.indexOf(name);
const iName = col("name");
const iHood = col("neighborhood");
const iCuisine = col("cuisine");
const iPrice = col("price");
const iMaps = col("google maps");
const iSite = col("website");

const seen = new Set();
const values = [];
for (const r of rows.slice(1)) {
  const name = (r[iName] || "").trim();
  if (!name) continue;
  const pid = placeId(r[iMaps]);
  const key = pid || name.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);

  const cuisine = (r[iCuisine] || "").trim();
  const cuisines = cuisine ? `ARRAY[${sq(cuisine)}]` : "ARRAY[]::text[]";
  const hood = (r[iHood] || "").trim();
  const address = hood ? `${hood}, ${city}` : city;
  const mapsUrl = (r[iMaps] || "").trim() || null;
  void iSite; // website column intentionally not imported

  values.push(
    `(${sq(name)}, ${cuisines}, ${priceTier(r[iPrice])}, ${sq(address)}, ` +
      `${pid ? sq(pid) : "null"}, ${mapsUrl ? sq(mapsUrl) : "null"})`
  );
}

const sql = `-- Austin restaurant catalog seed (${values.length} restaurants).
-- Adds to the shared master catalog. Run once in the Supabase SQL Editor.
-- Idempotent: re-running skips rows whose google_place_id already exists.
-- Coordinates are filled in when a family adds a place to their list.

insert into restaurants (name, cuisines, price, address, google_place_id, maps_url)
values
${values.join(",\n")}
on conflict (google_place_id) do nothing;
`;

writeFileSync(outPath, sql);
console.log(`wrote ${values.length} restaurants to ${outPath}`);
