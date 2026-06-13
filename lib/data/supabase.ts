import { SupabaseClient, createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SETTINGS,
  Discovery,
  Profile,
  Restaurant,
  RestaurantFull,
  Settings,
  Visit,
  VisitMode,
  Vote,
  VoteSession,
} from "../types";
import { DataAdapter, DiscoveryInput, NewRestaurant } from "./adapter";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function rowToRestaurant(row: Row): Restaurant {
  return {
    id: row.id,
    name: row.name,
    cuisines: row.cuisines ?? [],
    price: row.price ?? 2,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    googlePlaceId: row.google_place_id,
    mapsUrl: row.maps_url,
    reserveUrl: row.reserve_url,
    tags: row.tags ?? [],
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function restaurantToRow(data: Partial<NewRestaurant>): Row {
  const row: Row = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.cuisines !== undefined) row.cuisines = data.cuisines;
  if (data.price !== undefined) row.price = data.price;
  if (data.address !== undefined) row.address = data.address;
  if (data.lat !== undefined) row.lat = data.lat;
  if (data.lng !== undefined) row.lng = data.lng;
  if (data.googlePlaceId !== undefined) row.google_place_id = data.googlePlaceId;
  if (data.mapsUrl !== undefined) row.maps_url = data.mapsUrl;
  if (data.reserveUrl !== undefined) row.reserve_url = data.reserveUrl;
  if (data.tags !== undefined) row.tags = data.tags;
  if (data.status !== undefined) row.status = data.status;
  if (data.notes !== undefined) row.notes = data.notes;
  return row;
}

function rowToVisit(row: Row): Visit {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    date: row.date,
    mode: row.mode,
    note: row.note,
  };
}

function rowToSession(row: Row): VoteSession {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    candidateIds: row.candidate_ids ?? [],
    winnerId: row.winner_id,
  };
}

export class SupabaseAdapter implements DataAdapter {
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  private async unwrap<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await promise;
    if (error) throw new Error(`Database error: ${error.message}`);
    return data;
  }

  async listProfiles(): Promise<Profile[]> {
    const rows = await this.unwrap(
      this.client.from("profiles").select("*").order("created_at", { ascending: true })
    );
    return (rows ?? []).map((r: Row) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      color: r.color,
      doubleCredits: r.double_credits ?? 0,
    }));
  }

  async createProfile(name: string, emoji: string, color: string): Promise<Profile> {
    const row = await this.unwrap(
      this.client.from("profiles").insert({ name, emoji, color }).select().single()
    );
    return { id: row.id, name: row.name, emoji: row.emoji, color: row.color, doubleCredits: 0 };
  }

  async setDoubleCredits(profileId: string, credits: number): Promise<void> {
    await this.unwrap(
      this.client.from("profiles").update({ double_credits: Math.max(0, credits) }).eq("id", profileId)
    );
  }

  async updateProfile(id: string, data: Partial<Omit<Profile, "id">>): Promise<void> {
    const row: Row = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.emoji !== undefined) row.emoji = data.emoji;
    if (data.color !== undefined) row.color = data.color;
    await this.unwrap(this.client.from("profiles").update(row).eq("id", id));
  }

  async deleteProfile(id: string): Promise<void> {
    await this.unwrap(this.client.from("profiles").delete().eq("id", id));
  }

  private async enrichAll(restaurants: Restaurant[]): Promise<RestaurantFull[]> {
    if (restaurants.length === 0) return [];
    const ids = restaurants.map((r) => r.id);
    const [ratingRows, visitRows] = await Promise.all([
      this.unwrap(
        this.client.from("ratings").select("restaurant_id, profile_id, score").in("restaurant_id", ids)
      ),
      this.unwrap(
        this.client.from("visits").select("restaurant_id, date").in("restaurant_id", ids)
      ),
    ]);
    const ratingsByRestaurant = new Map<string, Record<string, number>>();
    for (const row of (ratingRows ?? []) as Row[]) {
      const map = ratingsByRestaurant.get(row.restaurant_id) ?? {};
      map[row.profile_id] = row.score;
      ratingsByRestaurant.set(row.restaurant_id, map);
    }
    const lastVisit = new Map<string, string>();
    const visitCount = new Map<string, number>();
    for (const row of (visitRows ?? []) as Row[]) {
      visitCount.set(row.restaurant_id, (visitCount.get(row.restaurant_id) ?? 0) + 1);
      const prev = lastVisit.get(row.restaurant_id);
      if (!prev || row.date > prev) lastVisit.set(row.restaurant_id, row.date);
    }
    return restaurants.map((r) => ({
      ...r,
      ratings: ratingsByRestaurant.get(r.id) ?? {},
      lastVisitAt: lastVisit.get(r.id) ?? null,
      visitCount: visitCount.get(r.id) ?? 0,
    }));
  }

  async listRestaurants(): Promise<RestaurantFull[]> {
    const rows = await this.unwrap(
      this.client.from("restaurants").select("*").order("name", { ascending: true })
    );
    return this.enrichAll((rows ?? []).map(rowToRestaurant));
  }

  async getRestaurant(id: string): Promise<RestaurantFull | null> {
    const row = await this.unwrap(
      this.client.from("restaurants").select("*").eq("id", id).maybeSingle()
    );
    if (!row) return null;
    const [full] = await this.enrichAll([rowToRestaurant(row)]);
    return full;
  }

  async createRestaurant(data: NewRestaurant): Promise<Restaurant> {
    const row = await this.unwrap(
      this.client.from("restaurants").insert(restaurantToRow(data)).select().single()
    );
    return rowToRestaurant(row);
  }

  async updateRestaurant(id: string, data: Partial<NewRestaurant>): Promise<void> {
    await this.unwrap(this.client.from("restaurants").update(restaurantToRow(data)).eq("id", id));
  }

  async deleteRestaurant(id: string): Promise<void> {
    await this.unwrap(this.client.from("restaurants").delete().eq("id", id));
  }

  async mergeRestaurants(survivorId: string, loserId: string): Promise<void> {
    if (survivorId === loserId) return;
    const [survivor, loser] = await Promise.all([
      this.unwrap(this.client.from("restaurants").select("*").eq("id", survivorId).maybeSingle()),
      this.unwrap(this.client.from("restaurants").select("*").eq("id", loserId).maybeSingle()),
    ]);
    if (!survivor || !loser) return;

    // free up the loser's unique google_place_id before the survivor adopts it
    if (!survivor.google_place_id && loser.google_place_id) {
      await this.unwrap(
        this.client.from("restaurants").update({ google_place_id: null }).eq("id", loserId)
      );
    }

    const merged: Row = {
      cuisines: [...new Set([...(survivor.cuisines ?? []), ...(loser.cuisines ?? [])])],
      tags: [...new Set([...(survivor.tags ?? []), ...(loser.tags ?? [])])],
      address: survivor.address ?? loser.address,
      lat: survivor.lat ?? loser.lat,
      lng: survivor.lng ?? loser.lng,
      google_place_id: survivor.google_place_id ?? loser.google_place_id,
      maps_url: survivor.maps_url ?? loser.maps_url,
      reserve_url: survivor.reserve_url ?? loser.reserve_url,
      notes: survivor.notes || loser.notes,
      status: survivor.status === "active" || loser.status === "active" ? "active" : survivor.status,
    };
    await this.unwrap(this.client.from("restaurants").update(merged).eq("id", survivorId));

    // move visits over
    await this.unwrap(
      this.client.from("visits").update({ restaurant_id: survivorId }).eq("restaurant_id", loserId)
    );

    // adopt the loser's ratings only for profiles the survivor hasn't rated
    const survivorRatings = await this.unwrap(
      this.client.from("ratings").select("profile_id").eq("restaurant_id", survivorId)
    );
    const taken = (survivorRatings ?? []).map((r: Row) => r.profile_id);
    let move = this.client.from("ratings").update({ restaurant_id: survivorId }).eq("restaurant_id", loserId);
    if (taken.length > 0) move = move.not("profile_id", "in", `(${taken.join(",")})`);
    await this.unwrap(move);

    // deleting the loser cascade-drops any leftover (duplicate) ratings/visits
    await this.unwrap(this.client.from("restaurants").delete().eq("id", loserId));
  }

  async setRating(restaurantId: string, profileId: string, score: number): Promise<void> {
    await this.unwrap(
      this.client.from("ratings").upsert(
        { restaurant_id: restaurantId, profile_id: profileId, score, updated_at: new Date().toISOString() },
        { onConflict: "restaurant_id,profile_id" }
      )
    );
  }

  async addVisit(restaurantId: string, date: string, mode: VisitMode, note: string | null): Promise<void> {
    await this.unwrap(
      this.client.from("visits").insert({ restaurant_id: restaurantId, date, mode, note })
    );
  }

  async listRecentVisits(limit: number): Promise<Visit[]> {
    const rows = await this.unwrap(
      this.client.from("visits").select("*").order("date", { ascending: false }).limit(limit)
    );
    return (rows ?? []).map(rowToVisit);
  }

  async listVisitsForRestaurant(restaurantId: string): Promise<Visit[]> {
    const rows = await this.unwrap(
      this.client
        .from("visits")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("date", { ascending: false })
    );
    return (rows ?? []).map(rowToVisit);
  }

  async createVoteSession(candidateIds: string[]): Promise<VoteSession> {
    await this.unwrap(
      this.client.from("vote_sessions").update({ status: "closed" }).eq("status", "open")
    );
    const row = await this.unwrap(
      this.client
        .from("vote_sessions")
        .insert({ status: "open", candidate_ids: candidateIds })
        .select()
        .single()
    );
    return rowToSession(row);
  }

  async getOpenVoteSession(): Promise<VoteSession | null> {
    const row = await this.unwrap(
      this.client
        .from("vote_sessions")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    );
    return row ? rowToSession(row) : null;
  }

  async getLatestVoteSession(): Promise<VoteSession | null> {
    const row = await this.unwrap(
      this.client
        .from("vote_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    );
    return row ? rowToSession(row) : null;
  }

  async getVoteSession(id: string): Promise<VoteSession | null> {
    const row = await this.unwrap(
      this.client.from("vote_sessions").select("*").eq("id", id).maybeSingle()
    );
    return row ? rowToSession(row) : null;
  }

  async listVotes(sessionId: string): Promise<Vote[]> {
    const rows = await this.unwrap(
      this.client.from("votes").select("*").eq("session_id", sessionId)
    );
    return (rows ?? []).map((r: Row) => ({
      sessionId: r.session_id,
      profileId: r.profile_id,
      pickId: r.pick_id,
      vetoId: r.veto_id,
      deferred: r.deferred ?? false,
    }));
  }

  async castVote(
    sessionId: string,
    profileId: string,
    pickId: string | null,
    vetoId: string | null,
    deferred: boolean
  ): Promise<void> {
    await this.unwrap(
      this.client.from("votes").upsert(
        {
          session_id: sessionId,
          profile_id: profileId,
          pick_id: pickId,
          veto_id: vetoId,
          deferred,
        },
        { onConflict: "session_id,profile_id" }
      )
    );
  }

  async closeVoteSession(sessionId: string, winnerId: string | null): Promise<void> {
    await this.unwrap(
      this.client
        .from("vote_sessions")
        .update({ status: "closed", winner_id: winnerId })
        .eq("id", sessionId)
    );
  }

  async listDiscoveries(): Promise<Discovery[]> {
    const rows = await this.unwrap(
      this.client
        .from("discoveries")
        .select("*")
        .eq("dismissed", false)
        .order("found_at", { ascending: false })
    );
    return (rows ?? []).map((r: Row) => ({
      placeId: r.place_id,
      name: r.name,
      address: r.address,
      rating: r.rating,
      mapsUrl: r.maps_url,
      foundAt: r.found_at,
      dismissed: r.dismissed,
    }));
  }

  async upsertDiscoveries(items: DiscoveryInput[]): Promise<number> {
    if (items.length === 0) return 0;
    const rows = items.map((d) => ({
      place_id: d.placeId,
      name: d.name,
      address: d.address,
      rating: d.rating,
      maps_url: d.mapsUrl,
    }));
    const inserted = await this.unwrap(
      this.client
        .from("discoveries")
        .upsert(rows, { onConflict: "place_id", ignoreDuplicates: true })
        .select("place_id")
    );
    return (inserted ?? []).length;
  }

  async dismissDiscovery(placeId: string): Promise<void> {
    await this.unwrap(
      this.client.from("discoveries").update({ dismissed: true }).eq("place_id", placeId)
    );
  }

  async listSeenPlaceIds(): Promise<string[]> {
    const rows = await this.unwrap(this.client.from("seen_places").select("place_id"));
    return (rows ?? []).map((r: Row) => r.place_id);
  }

  async markPlacesSeen(placeIds: string[]): Promise<void> {
    if (placeIds.length === 0) return;
    await this.unwrap(
      this.client
        .from("seen_places")
        .upsert(placeIds.map((place_id) => ({ place_id })), { ignoreDuplicates: true })
    );
  }

  async getSettings(): Promise<Settings> {
    const row = await this.unwrap(
      this.client.from("settings").select("value").eq("key", "app").maybeSingle()
    );
    return row?.value ? { ...DEFAULT_SETTINGS, ...row.value } : { ...DEFAULT_SETTINGS };
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.unwrap(
      this.client.from("settings").upsert({ key: "app", value: settings }, { onConflict: "key" })
    );
  }
}
