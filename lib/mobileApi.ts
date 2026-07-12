import { NextResponse } from "next/server";
import { getActiveProfile, isAuthed } from "./auth";
import { db } from "./data";
import { DataAdapter } from "./data/adapter";
import { Profile } from "./types";

/**
 * Plumbing for the mobile REST API (app/api/mobile/*). Authentication
 * reuses the web app's guards: lib/household.ts accepts the signed
 * household token as `Authorization: Bearer`, and lib/auth.ts accepts the
 * chosen profile as an `X-FF-Profile` header — so `isAuthed()` /
 * `getActiveProfile()` behave identically for both clients.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** Route body: run the handler, mapping ApiError to a JSON status. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("mobile api error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

/** Require a logged-in group; returns its scoped data adapter. */
export async function requireApiAuth(): Promise<DataAdapter> {
  if (!(await isAuthed())) throw new ApiError(401, "Log in to a group first.");
  return db();
}

/** Require a group and a chosen profile (mirrors the web's requireProfile). */
export async function requireApiProfile(): Promise<{ adapter: DataAdapter; profile: Profile }> {
  const adapter = await requireApiAuth();
  const profile = await getActiveProfile();
  if (!profile) throw new ApiError(401, "Choose a profile first.");
  return { adapter, profile };
}

/** Parse the JSON body, or fail with a 400. */
export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Invalid JSON body.");
  }
}
