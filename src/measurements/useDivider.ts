import { metersPerPixel, projectPosition } from "@/geo";
import { cameraPositionState } from "@/map/hooks/useCameraPosition";
import type { SnapRef } from "@/measurements/snapTargets";
import { navigationState } from "@/navigation/hooks/useNavigation";
import { proxy, useSnapshot } from "valtio";

interface Point {
  latitude: number;
  longitude: number;
}

interface Endpoint {
  latitude: number;
  longitude: number;
  /** When set, this endpoint tracks the named feature — its lat/lng is
   *  refreshed from the feature's current position by the snap tracker. */
  snapTo: SnapRef | null;
}

interface State {
  active: boolean;
  center: Endpoint | null;
  radius: Endpoint | null;
}

const INITIAL_STATE: State = {
  active: false,
  center: null,
  radius: null,
};

export const dividerState = proxy<State>({ ...INITIAL_STATE });

export function useDivider() {
  return useSnapshot(dividerState);
}

/**
 * Transient drag state, separate from `dividerState` so high-frequency
 * gesture updates don't churn React snapshots of the persisted endpoints.
 * `DividerGesture` writes it during a drag; `DividerOverlay` reads it
 * via a `subscribe()` callback (no React render per tick).
 */
interface DragLiveState {
  kind: "center" | "radius" | null;
  point: Point | null;
  snapTo: SnapRef | null;
}

export const dragLiveState = proxy<DragLiveState>({
  kind: null,
  point: null,
  snapTo: null,
});

export function setDragLive(
  value: { kind: "center" | "radius"; point: Point; snapTo?: SnapRef | null } | null,
) {
  dragLiveState.kind = value?.kind ?? null;
  dragLiveState.point = value?.point ?? null;
  dragLiveState.snapTo = value?.snapTo ?? null;
}

/**
 * Toggle the divider tool on/off. Every activation reseeds endpoints —
 * divider state is not persisted, so the tool always starts fresh, with
 * the center anchored at the user's current location (or the map center
 * when there's no GPS fix). Returns false if there's no camera yet to
 * seed from, in which case the tool stays off.
 */
export function toggleDivider(): boolean {
  if (dividerState.active) {
    dividerState.active = false;
    dividerState.center = null;
    dividerState.radius = null;
    return true;
  }

  if (!seedDivider()) return false;
  dividerState.active = true;
  return true;
}

/** Update an endpoint position. `snapTo` is preserved unless explicitly
 *  passed; pass `null` to break a snap. */
export function setDividerEndpoint(
  kind: "center" | "radius",
  point: Point,
  snapTo?: SnapRef | null,
) {
  const prev = dividerState[kind];
  dividerState[kind] = {
    latitude: point.latitude,
    longitude: point.longitude,
    snapTo: snapTo === undefined ? (prev?.snapTo ?? null) : snapTo,
  };
}

// Thin wrappers — keep the call-site readability. New code can call
// `setDividerEndpoint` directly.
export const setDividerCenter = (point: Point, snapTo?: SnapRef | null) =>
  setDividerEndpoint("center", point, snapTo);
export const setDividerRadius = (point: Point, snapTo?: SnapRef | null) =>
  setDividerEndpoint("radius", point, snapTo);

/** Swap the center and radius endpoints in place. The user's tap-to-swap
 *  gesture flips which point is the anchor and which is the moving end.
 *  Both `snapTo` references swap along with the positions. */
export function swapDividerRoles() {
  const c = dividerState.center;
  const r = dividerState.radius;
  if (!c || !r) return;
  dividerState.center = r;
  dividerState.radius = c;
}

/** Reset to defaults. Exposed for tests. */
export function resetDivider() {
  Object.assign(dividerState, INITIAL_STATE);
}

/**
 * Seed endpoints for a fresh activation. The center snaps to the user's
 * current location (so the divider follows the vessel via the snap
 * tracker); the radius sits ~80 px along the current course. Returns
 * false when there's no camera position to seed from — the toggle
 * should remain off in that case.
 */
function seedDivider(): boolean {
  const { center: cameraCenter, zoom } = cameraPositionState;
  if (!cameraCenter || zoom == null) return false;

  const nav = navigationState;
  const hasGpsFix = nav.latitude != null && nav.longitude != null;
  const latitude = hasGpsFix ? nav.latitude! : cameraCenter[1];
  const longitude = hasGpsFix ? nav.longitude! : cameraCenter[0];

  // Screen-space offset so the seed looks the same at any zoom.
  const OFFSET_PX = 80;
  const offsetMeters = metersPerPixel(zoom, latitude) * OFFSET_PX;
  const bearingRad = nav.course ?? Math.PI / 4;
  const [radiusLng, radiusLat] = projectPosition(
    latitude,
    longitude,
    bearingRad,
    offsetMeters,
  );

  dividerState.center = {
    latitude,
    longitude,
    snapTo: hasGpsFix ? { id: "current-location" } : null,
  };
  dividerState.radius = {
    latitude: radiusLat,
    longitude: radiusLng,
    snapTo: null,
  };
  return true;
}
