import type { Coordinates } from "@/geo";
import log from "@/logger";
import { mapRef } from "@/map/hooks/useMapRef";

const dlog = log.extend("snap");

/**
 * Convention for snappable map features:
 *   - GeoJSON feature carries a top-level `id` (prefixed by feature kind for
 *     global uniqueness, e.g. `marker-42`, `vessel-367123456`, `current-location`).
 *   - `properties.snappable: true` flags the feature for inclusion in snap
 *     hit-tests via the MapLibre filter `["has", "snappable"]`.
 *
 * Producers (MarkerOverlay, AISLayer, AtoNLayer, NavigationPuck — and future
 * snappable sources) follow the convention themselves. This module never
 * needs to be updated when a new snappable source is added.
 */
export interface SnapRef {
  /** The feature's prefixed top-level GeoJSON id (e.g. `marker-42`). */
  id: string;
}

const SNAP_FILTER: ["has", string] = ["has", "snappable"];

/** Query the entire viewport for snappable features. Encapsulates the
 *  options-only overload of `queryRenderedFeatures` whose JS runtime
 *  accepts no point/bounds but whose TS signature requires one. */
async function queryViewport(filter: unknown): Promise<GeoJSON.Feature[]> {
  const map = mapRef.current;
  if (!map) return [];
  return (
    map.queryRenderedFeatures as unknown as (opts: {
      filter: unknown;
    }) => Promise<GeoJSON.Feature[]>
  )({ filter });
}

/**
 * Find the nearest snappable feature within `radiusPx` of `screenPoint`.
 * Returns null if no feature is in range, the map isn't ready, or none of
 * the candidates carry a top-level id.
 */
export async function findSnap(
  screenPoint: [number, number],
  radiusPx: number,
): Promise<{ ref: SnapRef; point: Coordinates } | null> {
  const map = mapRef.current;
  if (!map) return null;

  const bbox: [[number, number], [number, number]] = [
    [screenPoint[0] - radiusPx, screenPoint[1] - radiusPx],
    [screenPoint[0] + radiusPx, screenPoint[1] + radiusPx],
  ];

  let features: GeoJSON.Feature[];
  try {
    features = await map.queryRenderedFeatures(bbox, { filter: SNAP_FILTER });
  } catch (err) {
    dlog.warn(`queryRenderedFeatures failed`, err);
    return null;
  }

  if (features.length === 0) return null;

  // Pick the candidate closest to the screen point.
  const r2 = radiusPx * radiusPx;
  let best: { ref: SnapRef; point: Coordinates; distSq: number } | null = null;
  for (const feature of features) {
    if (feature.id == null) continue;
    if (feature.geometry.type !== "Point") continue;
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    let projected: [number, number];
    try {
      projected = (await map.project([lng, lat])) as [number, number];
    } catch {
      continue;
    }
    const dx = projected[0] - screenPoint[0];
    const dy = projected[1] - screenPoint[1];
    const distSq = dx * dx + dy * dy;
    if (distSq > r2) continue;
    if (best && distSq >= best.distSq) continue;
    best = {
      ref: { id: String(feature.id) },
      point: { latitude: lat, longitude: lng },
      distSq,
    };
  }
  if (best) {
    dlog.debug(`snap → ${best.ref.id} at ${Math.sqrt(best.distSq).toFixed(1)}px`);
  }
  return best ? { ref: best.ref, point: best.point } : null;
}

/**
 * Resolve the current screen positions of a set of previously-snapped
 * features in a single native query. Returns a map keyed by id; missing
 * features (off-screen, expired, removed) map to `null`. Used by the
 * snap-tracking poll loop.
 *
 * Filters natively to snappable features only, then matches ids JS-side.
 * (Tried `["match", ["id"], ["literal", ids], …]` to filter natively, but
 * MapLibre v11.2 raises an uncaught NSException for that filter shape.)
 */
export async function resolveSnapRefs(
  ids: string[],
): Promise<Record<string, Coordinates | null>> {
  const result: Record<string, Coordinates | null> = {};
  for (const id of ids) result[id] = null;
  if (ids.length === 0) return result;

  let features: GeoJSON.Feature[];
  try {
    features = await queryViewport(SNAP_FILTER);
  } catch {
    return result;
  }

  for (const feature of features) {
    if (feature.id == null) continue;
    const id = String(feature.id);
    if (!(id in result)) continue;
    if (feature.geometry.type !== "Point") continue;
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    result[id] = { latitude: lat, longitude: lng };
  }
  return result;
}
