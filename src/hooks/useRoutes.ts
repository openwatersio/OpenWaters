import { setFollowUserLocation } from "@/hooks/useCameraState";
import { useDbQuery } from "@/hooks/useDbQuery";
import { startTrackRecording } from "@/hooks/useTrackRecording";
import {
  deleteRoute as dbDeleteRoute,
  getAllRoutes,
  getRoute,
  getRoutePoints,
  insertRoute,
  replaceRoutePoints,
  updateRoute,
  type Route,
  type RoutesOrder,
} from "@/lib/database";
import { findNearestLegIndex } from "@/lib/geo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDistance } from "geolib";
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Nullable<T> = { [K in keyof T]: T[K] | null };

// -- Active route store --

let nextWaypointKey = 0;

export type ActiveWaypoint = {
  /** Stable identity for SwiftUI List.ForEach reorder/delete. */
  key: number;
  latitude: number;
  longitude: number;
};

/**
 * - `viewing`   — an existing saved route, no unsaved edits. Default
 *                 when loading from DB.
 * - `editing`   — either a brand-new route, or an existing route with
 *                 unsaved changes. Set implicitly by any mutator.
 * - `navigating` — user is actively following the route. Waypoint
 *                 mutators flip this back to `editing`.
 */
export enum RouteMode {
  Viewing = "viewing",
  Editing = "editing",
  Navigating = "navigating",
}

/**
 * The single "active" route the app is currently working with. Mirrors the
 * `Route` type with `id` / timestamps nullable until the first save, plus
 * the in-memory drafting + navigation state.
 */
export type ActiveRoute = Nullable<Route> & {
  points: ActiveWaypoint[];

  mode: RouteMode;

  /** The currently selected waypoint in viewing/editing, or the current target waypoint in navigating. */
  activeIndex: number | null;
};

type SlimPersistedRoute = {
  id: number;
  mode: RouteMode;
  activeIndex: number | null;
};

export const useActiveRoute = create<ActiveRoute | null>()(
  persist((): ActiveRoute | null => null, {
    name: "active-route",
    storage: createJSONStorage(() => AsyncStorage),
    // Only persist a slim subset, and only when mid-navigation. The rest is
    // rehydrated from the DB on app start.
    partialize: (state) => {
      if (!state || state.mode !== RouteMode.Navigating || state.id == null)
        return null;
      return {
        id: state.id,
        mode: state.mode,
        activeIndex: state.activeIndex,
      };
    },
    // The default merge does `{ ...current, ...persisted }`, which turns a
    // `null` store into `{}`. Bypass that: leave the store `null`
    // synchronously, and kick off an async reload from the DB if there was
    // anything persisted.
    merge: (persistedState, currentState) => {
      const slim = persistedState as SlimPersistedRoute | null | undefined;
      if (slim?.id != null) {
        setActiveRoute(slim.id, {
          mode: slim.mode ?? RouteMode.Navigating,
          activeIndex: slim.activeIndex ?? 0,
        });
      }
      return currentState;
    },
  }),
);

/** Direct (non-hook) access for imperative call sites. */
export function getActiveRoute(): ActiveRoute | null {
  return useActiveRoute.getState();
}

/** Internal: fully replace the store value. */
function setStore(next: ActiveRoute | null): void {
  useActiveRoute.setState(next, true);
}

// -- Hooks --

/**
 * Loads the route with the given id into the active store on mount.
 * Subsequent calls with the same id are no-ops (preserve in-flight edits).
 * Returns the active route value.
 */
export function useRoute(id: number): ActiveRoute | null {
  useEffect(() => {
    const current = getActiveRoute();
    if (current?.id === id) return; // already loaded — preserve edits
    setActiveRoute(id);
  }, [id]);
  return useActiveRoute();
}

type SetActiveRouteOptions = {
  mode?: RouteMode;
  activeIndex?: number | null;
};

export async function setActiveRoute(
  id: number,
  { mode = RouteMode.Viewing, activeIndex = null }: SetActiveRouteOptions = {},
) {
  const [route, points] = await Promise.all([getRoute(id), getRoutePoints(id)]);
  if (!route) {
    setStore(null);
    return;
  }
  setStore({
    id: route.id,
    name: route.name,
    created_at: route.created_at,
    updated_at: route.updated_at,
    distance: route.distance,
    points: points.map((p) => ({
      key: nextWaypointKey++,
      latitude: p.latitude,
      longitude: p.longitude,
    })),
    mode,
    activeIndex,
  });
}

/**
 * Reactive list of all routes, sorted in SQL by the requested order.
 * Re-runs automatically whenever the `routes` table changes.
 */
export function useRoutes({ order }: { order: RoutesOrder }): Route[] {
  const fetch = useCallback(() => getAllRoutes(order), [order]);
  return useDbQuery(["routes"], fetch) ?? [];
}

// -- Active-route mutators --

/**
 * Initialize a fresh empty active route in editing mode. Used by the
 * `/route/new` screen as the entry point for creating a new route.
 */
export function startRoute() {
  setStore({
    id: null,
    name: null,
    created_at: null,
    updated_at: null,
    distance: 0,
    points: [],
    mode: RouteMode.Editing,
    activeIndex: null,
  });
}

/** Clear the active route. Called by route screens on dismiss/cancel. */
export function clearActiveRoute() {
  setStore(null);
}

export function setRouteName(name: string | null) {
  updateActiveRoute({ name });
}

/**
 * Helper for mutations that modify the waypoint list. Provides a shallow
 * copy of `points` so callers can mutate it in-place with splice/push/etc.
 * without touching the store's original array.
 *
 * The callback can:
 * - Just mutate `points` and return nothing (void) — the new array is
 *   written back automatically.
 * - Return additional route fields (e.g. `{ activeIndex }`) to update
 *   alongside the points change.
 */
function updateRouteWaypoints(
  callback: (route: ActiveRoute) => Partial<ActiveRoute> | void,
) {
  updateActiveRoute((route) => {
    const { points: oldPoints, ...rest } = route;
    // Create a new points array to trigger updates.
    const points = [...oldPoints];
    return {
      points,
      ...(callback({ ...rest, points }) ?? {}),
    };
  });
}

export function addRouteWaypoint(
  point: { latitude: number; longitude: number },
  index?: number,
) {
  updateRouteWaypoints(({ points }) => {
    const insertAt = index ?? points.length;
    points.splice(insertAt, 0, { ...point, key: nextWaypointKey++ });
  });
}

export function updateRouteWaypoint(
  index: number,
  fields: Partial<Pick<ActiveWaypoint, "latitude" | "longitude">>,
) {
  updateRouteWaypoints(({ points }) => {
    points.splice(index, 1, { ...points[index], ...fields });
  });
}

export function moveRouteWaypoint(fromIndex: number, toIndex: number) {
  updateRouteWaypoints(({ points, activeIndex }) => {
    const [moved] = points.splice(fromIndex, 1);
    points.splice(toIndex, 0, moved);

    if (activeIndex === fromIndex) {
      activeIndex = toIndex;
    } else if (activeIndex !== null) {
      // Shift activeIndex to account for the removal and insertion
      if (activeIndex > fromIndex) activeIndex--;
      if (activeIndex >= toIndex) activeIndex++;
    }

    return { points, activeIndex };
  });
}

export function removeRouteWaypoint(index: number) {
  updateRouteWaypoints(({ points, activeIndex }) => {
    points.splice(index, 1);
    if (activeIndex === index) {
      activeIndex = null;
    } else if (activeIndex !== null && activeIndex > index) {
      activeIndex = activeIndex - 1;
    }
    return { points, activeIndex };
  });
}

export function setActiveIndex(index: number | null) {
  updateActiveRoute({ activeIndex: index });
}

/** Internal: apply a mutation to the active route. */
function updateActiveRoute(
  mutation:
    | Partial<ActiveRoute>
    | ((current: ActiveRoute) => Partial<ActiveRoute>),
) {
  // Single setState call to avoid intermediate renders where mode has
  // flipped to Editing but the mutation hasn't been applied yet.
  useActiveRoute.setState((state) => {
    if (!state) return state;
    const delta = typeof mutation === "function" ? mutation(state) : mutation;
    // Any mutation flips to editing mode by default,
    // but can be overridden by the mutator if needed.
    return { mode: RouteMode.Editing, ...delta };
  });
}

// -- Save --

/**
 * Persist the active route to the database. Computes total distance from
 * the in-memory points, inserts or updates as appropriate, replaces all
 * route_points in a single transaction, and flips `mode` back to `viewing`.
 *
 * Returns the route id.
 */
export async function saveActiveRoute(): Promise<number> {
  const active = getActiveRoute();
  if (!active) throw new Error("No active route to save");

  const distance = computeTotalDistance(active.points);
  const points = active.points.map(({ latitude, longitude }) => ({
    latitude,
    longitude,
  }));

  let routeId: number;
  if (active.id == null) {
    const created = await insertRoute(active.name ?? undefined);
    routeId = created.id;
    if (active.name != null || distance > 0) {
      await updateRoute(routeId, { distance, name: active.name ?? null });
    }
    await replaceRoutePoints(routeId, points);
  } else {
    routeId = active.id;
    await updateRoute(routeId, { name: active.name, distance });
    await replaceRoutePoints(routeId, points);
  }

  // Refresh active route metadata from DB (id/timestamps/distance) but keep
  // the in-memory points (and their stable keys) intact.
  const fresh = await getRoute(routeId);
  const latest = getActiveRoute();
  if (fresh && latest) {
    setStore({
      ...latest,
      id: fresh.id,
      name: fresh.name,
      created_at: fresh.created_at,
      updated_at: fresh.updated_at,
      distance: fresh.distance,
      mode: RouteMode.Viewing,
    });
  }

  return routeId;
}

function computeTotalDistance(points: ActiveWaypoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += getDistance(points[i - 1], points[i]);
  }
  return total;
}

// -- Navigation mutators --

/** Maximum distance (m) from a route that still counts as "on the route"
 *  when snapping to the nearest leg at the start of navigation. */
const START_NAV_SNAP_THRESHOLD_M = 5000;

export type StartNavigationOptions = {
  /** Explicit starting waypoint index. Used if `from` is omitted or snap fails. */
  startIndex?: number;
  /** Current vessel position. When provided, snaps the active waypoint to
   *  the end of the nearest leg (within ~5 km). Falls back to `startIndex`
   *  or the first waypoint if the position is too far from the route. */
  from?: { latitude: number; longitude: number };
};

/**
 * Begin navigating the given route. Loads the route into the active store
 * if it isn't already, then sets `mode = "navigating"` and picks the
 * starting waypoint.
 *
 * If `from` is provided, snaps the active waypoint to the end of the leg
 * the vessel is currently on — so resuming mid-route picks up where you
 * actually are, not at the first waypoint.
 */
export async function startNavigation(
  routeId: number,
  options: StartNavigationOptions = {},
) {
  let route = getActiveRoute();
  if (route?.id !== routeId) {
    await setActiveRoute(routeId);
    route = getActiveRoute();
  }
  if (!route) return;

  let activeIndex = options.startIndex ?? 0;
  if (options.from && route.points.length >= 2) {
    const snapped = findNearestLegIndex(
      options.from.latitude,
      options.from.longitude,
      route.points,
      START_NAV_SNAP_THRESHOLD_M,
    );
    if (snapped != null) {
      activeIndex = snapped;
    }
  }
  // Clamp to valid range.
  if (route.points.length > 0) {
    activeIndex = Math.max(0, Math.min(activeIndex, route.points.length - 1));
  } else {
    activeIndex = 0;
  }

  setStore({ ...route, mode: RouteMode.Navigating, activeIndex });
  setFollowUserLocation(true);
  startTrackRecording();
}

export function advanceToNext() {
  const current = getActiveRoute();
  if (!current) return;
  const next = (current.activeIndex ?? 0) + 1;
  setStore({
    ...current,
    activeIndex: Math.min(next, current.points.length - 1),
  });
}

export function goToPrevious() {
  const current = getActiveRoute();
  if (!current) return;
  const prev = (current.activeIndex ?? 0) - 1;
  setStore({ ...current, activeIndex: Math.max(0, prev) });
}

export function stopNavigation() {
  const current = getActiveRoute();
  if (!current) return;
  setStore({ ...current, mode: RouteMode.Viewing, activeIndex: null });
}

// -- Route-list mutations --

export async function handleDeleteRoute(routeId: number) {
  await dbDeleteRoute(routeId);
  // If the deleted route is the active one, clear it.
  const active = getActiveRoute();
  if (active?.id === routeId) clearActiveRoute();
}

export async function handleRenameRoute(routeId: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await updateRoute(routeId, { name: trimmed });
  // If the renamed route is the active one, reflect the change in memory.
  const active = getActiveRoute();
  if (active?.id === routeId) {
    setStore({ ...active, name: trimmed });
  }
}
