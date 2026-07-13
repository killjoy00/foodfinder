import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Profile } from "@shared/types";
import {
  Api,
  ApiSession,
  Bootstrap,
  createGroup as apiCreateGroup,
  loginToGroup as apiLogin,
  makeApi,
  normalizeBaseUrl,
} from "./api";

const KEYS = {
  baseUrl: "ff_base_url",
  token: "ff_token",
  household: "ff_household_name",
  profile: "ff_profile_id",
} as const;

/** Default server URL; override on the login screen or via EXPO_PUBLIC_API_URL. */
const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

type AppState = {
  ready: boolean; // secure-store hydration finished
  baseUrl: string;
  token: string | null;
  householdName: string | null;
  profileId: string | null;
  data: Bootstrap | null; // last bootstrap payload
  loading: boolean; // a refresh is in flight
  error: string | null; // last refresh error
};

type AppApi = {
  api: Api;
  profile: Profile | null;
  login: (baseUrl: string, group: string, password: string, create: boolean) => Promise<void>;
  logout: () => Promise<void>;
  selectProfile: (profileId: string | null) => Promise<void>;
  refresh: () => Promise<Bootstrap | null>;
};

const AppContext = createContext<(AppState & AppApi) | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    ready: false,
    baseUrl: DEFAULT_BASE_URL,
    token: null,
    householdName: null,
    profileId: null,
    data: null,
    loading: false,
    error: null,
  });

  // hydrate the saved session once on launch
  useEffect(() => {
    (async () => {
      const [baseUrl, token, householdName, profileId] = await Promise.all([
        SecureStore.getItemAsync(KEYS.baseUrl),
        SecureStore.getItemAsync(KEYS.token),
        SecureStore.getItemAsync(KEYS.household),
        SecureStore.getItemAsync(KEYS.profile),
      ]);
      setState((s) => ({
        ...s,
        ready: true,
        baseUrl: baseUrl || DEFAULT_BASE_URL,
        token,
        householdName,
        profileId,
      }));
    })();
  }, []);

  const session: ApiSession = useMemo(
    () => ({ baseUrl: state.baseUrl, token: state.token ?? "", profileId: state.profileId }),
    [state.baseUrl, state.token, state.profileId]
  );
  const api = useMemo(() => makeApi(session), [session]);
  const apiRef = useRef(api);
  apiRef.current = api;

  const refresh = useCallback(async (): Promise<Bootstrap | null> => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await apiRef.current.bootstrap();
      setState((s) => ({ ...s, data, loading: false, error: null }));
      return data;
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Couldn't reach the server.",
      }));
      return null;
    }
  }, []);

  // load data whenever we have a usable session
  useEffect(() => {
    if (state.ready && state.token && state.baseUrl) void refresh();
  }, [state.ready, state.token, state.baseUrl, refresh]);

  const login = useCallback(
    async (rawUrl: string, group: string, password: string, create: boolean) => {
      const baseUrl = normalizeBaseUrl(rawUrl);
      const result = create
        ? await apiCreateGroup(baseUrl, group, password)
        : await apiLogin(baseUrl, group, password);
      await Promise.all([
        SecureStore.setItemAsync(KEYS.baseUrl, baseUrl),
        SecureStore.setItemAsync(KEYS.token, result.token),
        SecureStore.setItemAsync(KEYS.household, result.household?.name ?? "FoodFinder"),
        SecureStore.deleteItemAsync(KEYS.profile),
      ]);
      setState((s) => ({
        ...s,
        baseUrl,
        token: result.token,
        householdName: result.household?.name ?? "FoodFinder",
        profileId: null,
        data: null,
        error: null,
      }));
    },
    []
  );

  const logout = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.token),
      SecureStore.deleteItemAsync(KEYS.household),
      SecureStore.deleteItemAsync(KEYS.profile),
    ]);
    setState((s) => ({
      ...s,
      token: null,
      householdName: null,
      profileId: null,
      data: null,
      error: null,
    }));
  }, []);

  const selectProfile = useCallback(async (profileId: string | null) => {
    if (profileId) await SecureStore.setItemAsync(KEYS.profile, profileId);
    else await SecureStore.deleteItemAsync(KEYS.profile);
    setState((s) => ({ ...s, profileId }));
  }, []);

  const profile = useMemo(
    () => state.data?.profiles.find((p) => p.id === state.profileId) ?? null,
    [state.data, state.profileId]
  );

  const value = useMemo(
    () => ({ ...state, api, profile, login, logout, selectProfile, refresh }),
    [state, api, profile, login, logout, selectProfile, refresh]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
