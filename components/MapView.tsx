"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LatLng } from "@/lib/distance";
import { PRICE_LABELS, RestaurantFull } from "@/lib/types";

function avgRating(r: RestaurantFull): number | null {
  const scores = Object.values(r.ratings);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

function markerColor(r: RestaurantFull): string {
  if (r.status === "wishlist") return "#3b82f6"; // blue = want to try
  const avg = avgRating(r);
  if (avg === null) return "#a8a29e"; // grey = unrated
  if (avg >= 7.5) return "#22c55e"; // green = loved
  if (avg >= 5) return "#f97316"; // orange = ok
  return "#ef4444"; // red = meh
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

export default function MapView({
  restaurants,
  home,
}: {
  restaurants: RestaurantFull[];
  home: LatLng;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const located = restaurants.filter((r) => r.lat !== null && r.lng !== null);

    const map = L.map(ref.current, { attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    const points: [number, number][] = [];
    for (const r of located) {
      const avg = avgRating(r);
      const marker = L.circleMarker([r.lat as number, r.lng as number], {
        radius: 8,
        color: "#0c0a09",
        weight: 1,
        fillColor: markerColor(r),
        fillOpacity: 0.95,
      }).addTo(map);
      marker.bindPopup(
        `<strong>${escapeHtml(r.name)}</strong><br/>` +
          `${escapeHtml(r.cuisines.join(", ") || "—")} · ${PRICE_LABELS[r.price - 1]}` +
          (avg !== null ? ` · ★ ${avg.toFixed(1)}` : "") +
          (r.status === "wishlist" ? " · ⭐ wishlist" : "") +
          `<br/><a href="/restaurants/${r.id}">Open →</a>`
      );
      points.push([r.lat as number, r.lng as number]);
    }

    if (home.lat !== null && home.lng !== null) {
      L.circleMarker([home.lat, home.lng], {
        radius: 6,
        color: "#fafaf9",
        weight: 2,
        fillColor: "#0c0a09",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup("🏠 Home");
      points.push([home.lat, home.lng]);
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.2));
    } else {
      map.setView([39.5, -98.35], 4); // continental US fallback
    }

    return () => {
      map.remove();
    };
  }, [restaurants, home]);

  return <div ref={ref} className="h-[60vh] w-full rounded-2xl border border-border-soft" />;
}
