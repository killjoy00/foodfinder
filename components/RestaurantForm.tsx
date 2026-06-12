"use client";

import { useEffect, useRef, useState } from "react";
import { Restaurant, TAGS, TAG_LABELS } from "@/lib/types";

type PlaceSuggestion = {
  placeId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  priceLevel: number | null;
  mapsUrl: string | null;
};

/**
 * Shared add/edit form. If the Places API key is configured, typing a
 * name offers autocomplete that prefills address, location, and links.
 */
export function RestaurantForm({
  action,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  initial?: Partial<Restaurant>;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [placeId, setPlaceId] = useState(initial?.googlePlaceId ?? "");
  const [mapsUrl, setMapsUrl] = useState(initial?.mapsUrl ?? "");
  const [latLng, setLatLng] = useState<{ lat: number | null; lng: number | null }>({
    lat: initial?.lat ?? null,
    lng: initial?.lng ?? null,
  });
  const [price, setPrice] = useState(initial?.price ?? 2);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (name.trim().length < 3 || initial?.id) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(name)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.places ?? []);
        }
      } catch {
        // autocomplete is best-effort
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(debounce.current);
  }, [name, initial?.id]);

  function applySuggestion(s: PlaceSuggestion) {
    skipNextSearch.current = true;
    setName(s.name);
    setAddress(s.address ?? "");
    setPlaceId(s.placeId);
    setMapsUrl(s.mapsUrl ?? "");
    setLatLng({ lat: s.lat, lng: s.lng });
    if (s.priceLevel) setPrice(s.priceLevel);
    setSuggestions([]);
  }

  const inputCls =
    "rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 outline-none focus:border-accent";

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Name</span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="off"
          className={inputCls}
        />
        {searching && <span className="text-xs text-muted">Searching Google…</span>}
        {suggestions.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-xl border border-border-soft">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s.placeId}
                onClick={() => applySuggestion(s)}
                className="block w-full border-b border-border-soft bg-surface px-3 py-2 text-left text-sm last:border-0 hover:bg-surface-2"
              >
                <span className="font-semibold">{s.name}</span>
                {s.address && <span className="block truncate text-xs text-muted">{s.address}</span>}
              </button>
            ))}
          </div>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Cuisines (comma separated)</span>
        <input
          name="cuisines"
          defaultValue={initial?.cuisines?.join(", ") ?? ""}
          placeholder="Mexican, Tacos"
          className={inputCls}
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Price</span>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((p) => (
            <label
              key={p}
              className={`flex-1 cursor-pointer rounded-xl border px-3 py-2 text-center font-semibold ${
                price === p ? "border-accent bg-accent-soft text-orange-200" : "border-border-soft bg-surface-2 text-muted"
              }`}
            >
              <input
                type="radio"
                name="price"
                value={p}
                checked={price === p}
                onChange={() => setPrice(p)}
                className="hidden"
              />
              {"$".repeat(p)}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Tags</span>
        <div className="flex flex-wrap gap-3">
          {TAGS.map((tag) => (
            <label key={tag} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name={`tag_${tag}`}
                defaultChecked={initial?.tags?.includes(tag)}
                className="h-4 w-4 accent-orange-500"
              />
              {TAG_LABELS[tag]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="status"
            value="active"
            defaultChecked={(initial?.status ?? "active") === "active"}
            className="accent-orange-500"
          />
          🍽️ Been there
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="status"
            value="wishlist"
            defaultChecked={initial?.status === "wishlist"}
            className="accent-orange-500"
          />
          ⭐ Wishlist
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Address</span>
        <input
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Notes</span>
        <textarea name="notes" defaultValue={initial?.notes ?? ""} rows={2} className={inputCls} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Reservation link (optional)</span>
        <input
          name="reserveUrl"
          defaultValue={initial?.reserveUrl ?? ""}
          placeholder="https://www.opentable.com/…"
          className={inputCls}
        />
      </label>

      <input type="hidden" name="googlePlaceId" value={placeId} />
      <input type="hidden" name="mapsUrl" value={mapsUrl} />
      <input type="hidden" name="lat" value={latLng.lat ?? ""} />
      <input type="hidden" name="lng" value={latLng.lng ?? ""} />

      <button type="submit" className="rounded-xl bg-accent px-4 py-3 text-lg font-bold text-black">
        {submitLabel}
      </button>
    </form>
  );
}
