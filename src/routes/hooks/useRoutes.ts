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
} from "@/database";
import { findNearestLegIndex } from "@/geo";
import { useDbQuery } from "@/hooks/useDbQuery";
import { setFollowUserLocation } from "@/map/hooks/useCameraState";
import { persistProxy } from "@/persistProxy";
import { startTrackRecording } from "@/tracks/hooks/useTrackRecording";
import { getDistance } from "geolib";
import { useCallback, useEffect } from "react";
import { proxy, useSnapshot } from "valtio";

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
 * The active route — route metadata flattened alongside in-memory drafting
 * and navigation state. `mode === null` means "no active route".
 * `id === null` means the route is an unsaved draft.
 */
export type ActiveRoute = {
  /** `null` for an unsaved draft; DB id once saved. */
  id: number | null;
  name: string | null;
  created_at: string;
  updated_at: string;
  distance: number;
  points: ActiveWaypoint[];
  mode: RouteMode | null;
  /** The currently selected waypoint in viewing/editing, or the current
   *  target waypoint in navigating. */
  activeIndex: number | null;

  // -- computed --
  readonly isActive: boolean;
  readonly isNavigating: boolean;
  readonly isEditing: boolean;
  readonly isViewing: boolean;
};

type SlimPersistedRoute = {
  id: number;
  mode: RouteMode;
  activeIndex: number | null;
};

const EMPTY: Omit<
  ActiveRoute,
  "isActive" | "isNavigating" | "isEditing" | "isViewing"
> = {
  id: null,
  name: null,
  created_at: "",
  updated_at: "",
  distance: 0,
  points: [],
  mode: null,
  activeIndex: null,
};

export const activeRouteState = proxy<ActiveRoute>({
  ...EMPTY,
  get isActive(): boolean {
    return this.mode !== null;
  },
  get isNavigating(): boolean {
    return this.mode === RouteMode.Navigating;
  },
  get isEditing(): boolean {
    return this.mode === RouteMode.Editing;
  },
  get isViewing(): boolean {
    return this.mode === RouteMode.Viewing;
  },
});

persistProxy<ActiveRoute, SlimPersistedRoute | null>(activeRouteState, {
  name: "active-route",
  // Only persist a slim subset, and only when mid-navigation. Everything
  // else is rehydrated from the DB on app start.
  partialize: (state) => {
    if (state.mode !== RouteMode.Navigating || state.id == null) {
      return null;
    }
    return {
      id: state.id,
      mode: state.mode,
      activeIndex: state.activeIndex,
    };
  },
  // Async reload from the DB if there was anything persisted.
  hydrate: (_state, persisted) => {
    if (persisted?.id != null) {
      setActiveRoute(persisted.id, {
        mode: persisted.mode ?? RouteMode.Navigating,
        activeIndex: persisted.activeIndex ?? 0,
      });
    }
  },
});

/**
 * React hook — returns a tracked snapshot of the active route state.
 * Destructure what you need; reads are tracked per-field:
 *
 *   const { id, name, points, mode, activeIndex,
 *           isActive, isNavigating, isEditing, isViewing } = useActiveRoute();
 */
export function useActiveRoute() {
  return useSnapshot(activeRouteState);
}

/** Direct (non-hook) access for imperative call sites. Returns the live
 *  proxy itself — read `.mode`, `.name`, `.points`, etc. */
export function getActiveRoute() {
  return activeRouteState;
}

/** Internal: reset to the empty (no active route) state. */
function clearStore() {
  Object.assign(activeRouteState, { ...EMPTY });
}

// -- Hooks --

/**
 * Loads the route with the given id into the active store on mount.
 * Subsequent calls with the same id are no-ops (preserve in-flight edits).
 * Returns the DB-backed route (or null while loading).
 */
export function useRoute(id: number) {
  useEffect(() => {
    if (activeRouteState.id === id) return; // already loaded
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
    clearStore();
    return;
  }
  Object.assign(activeRouteState, {
    ...route,
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
  Object.assign(activeRouteState, {
    ...EMPTY,
    mode: RouteMode.Editing,
  });
}

/** Clear the active route. Called by route screens on dismiss/cancel. */
export function clearActiveRoute() {
  clearStore();
}

export function setRouteName(name: string | null) {
  editActiveRoute({ name });
}

export function addRouteWaypoint(
  point: { latitude: number; longitude: number },
  insertAt: number = activeRouteState.points.length,
) {
  editActiveRoute(({ points }) => {
    points.splice(insertAt, 0, {
      ...point,
      key: nextWaypointKey++,
    });
  });
}

export function updateRouteWaypoint(
  index: number,
  fields: Partial<Pick<ActiveWaypoint, "latitude" | "longitude">>,
) {
  editActiveRoute(({ points }) => {
    points.splice(index, 1, { ...points[index], ...fields });
  });
}

export function moveRouteWaypoint(fromIndex: number, toIndex: number) {
  editActiveRoute(({ points, activeIndex }) => {
    const [moved] = points.splice(fromIndex, 1);
    points.splice(toIndex, 0, moved);

    if (activeIndex === fromIndex) {
      return { activeIndex: toIndex };
    } else if (activeIndex !== null) {
      // Shift activeIndex to account for the removal and insertion
      if (activeIndex > fromIndex) activeIndex--;
      if (activeIndex >= toIndex) activeIndex++;
      return { activeIndex };
    }
  });
}

export function removeRouteWaypoint(index: number) {
  editActiveRoute(({ points, activeIndex }) => {
    points.splice(index, 1);
    if (activeIndex === index) {
      return { activeIndex: null };
    } else if (activeIndex !== null && activeIndex > index) {
      return { activeIndex: activeIndex - 1 };
    }
  });
}

export function setActiveIndex(index: number | null) {
  editActiveRoute({ activeIndex: index });
}

/** Internal: apply a mutation, flipping to editing mode by default. Only
 *  runs if there's an active route context (mode !== null).
 *
 *  Accepts either a partial update object or a callback that receives the
 *  current route and returns a partial update.
 */
function editActiveRoute(
  callback:
    | Partial<ActiveRoute>
    | ((route: ActiveRoute) => Partial<ActiveRoute> | void),
) {
  if (activeRouteState.mode === null) return;
  Object.assign(activeRouteState, {
    mode: RouteMode.Editing,
    ...(typeof callback === "function"
      ? (callback(activeRouteState) ?? {})
      : callback),
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
  if (activeRouteState.mode === null) {
    throw new Error("No active route to save");
  }

  const distance = computeTotalDistance(activeRouteState.points);
  const points = activeRouteState.points.map(({ latitude, longitude }) => ({
    latitude,
    longitude,
  }));
  const { id: existingId, name } = activeRouteState;

  let routeId: number;
  if (existingId == null) {
    const created = await insertRoute(name ?? undefined);
    routeId = created.id;
    if (name != null || distance > 0) {
      await updateRoute(routeId, { distance, name });
    }
    await replaceRoutePoints(routeId, points);
  } else {
    routeId = existingId;
    await updateRoute(routeId, { name, distance });
    await replaceRoutePoints(routeId, points);
  }

  // Refresh active route metadata from DB (id/timestamps/distance) but keep
  // the in-memory points (and their stable keys) intact.
  const fresh = await getRoute(routeId);
  if (fresh && activeRouteState.mode !== null) {
    Object.assign(activeRouteState, fresh);
    activeRouteState.mode = RouteMode.Viewing;
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

export async function startNavigation(
  routeId: number,
  options: StartNavigationOptions = {},
) {
  if (activeRouteState.id !== routeId) {
    await setActiveRoute(routeId);
  }
  if (activeRouteState.id !== routeId) return;

  let activeIndex = options.startIndex ?? 0;
  if (options.from && activeRouteState.points.length >= 2) {
    const snapped = findNearestLegIndex(
      options.from.latitude,
      options.from.longitude,
      activeRouteState.points as ActiveWaypoint[],
      START_NAV_SNAP_THRESHOLD_M,
    );
    if (snapped != null) {
      activeIndex = snapped;
    }
  }
  // Clamp to valid range.
  if (activeRouteState.points.length > 0) {
    activeIndex = Math.max(
      0,
      Math.min(activeIndex, activeRouteState.points.length - 1),
    );
  } else {
    activeIndex = 0;
  }

  activeRouteState.mode = RouteMode.Navigating;
  activeRouteState.activeIndex = activeIndex;
  setFollowUserLocation(true);
  startTrackRecording();
}

export function advanceToNext() {
  if (activeRouteState.mode === null) return;
  const next = (activeRouteState.activeIndex ?? 0) + 1;
  activeRouteState.activeIndex = Math.min(
    next,
    activeRouteState.points.length - 1,
  );
}

export function goToPrevious() {
  if (activeRouteState.mode === null) return;
  const prev = (activeRouteState.activeIndex ?? 0) - 1;
  activeRouteState.activeIndex = Math.max(0, prev);
}

export function stopNavigation() {
  if (activeRouteState.mode === null) return;
  activeRouteState.mode = RouteMode.Viewing;
  activeRouteState.activeIndex = null;
}

// -- Route-list mutations --

export async function handleDeleteRoute(routeId: number) {
  await dbDeleteRoute(routeId);
  // If the deleted route is the active one, clear it.
  if (activeRouteState.id === routeId) clearStore();
}

export async function handleRenameRoute(routeId: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await updateRoute(routeId, { name: trimmed });
  if (activeRouteState.id === routeId) {
    activeRouteState.name = trimmed;
  }
}
