/**
 * Grouping of related chart features so a buoy/beacon and its mounted equipment
 * (light, fog signal, daymark, topmark, …) show up as one detail view.
 *
 * Two signals connect them in OpenENC's GeoJSON, both used here:
 *  - **S-57 master/slave links** — a structure carries `LNAM_REFS` (a list of
 *    related features' `LNAM`s) and `FFPT_RIND`. The reference is *one-sided*
 *    (the buoy points to its light, not vice-versa), so links are followed in
 *    both directions.
 *  - **Exact shared position** — equipment sits at the structure's identical
 *    (quantized) coordinate. This catches sectored lights and equipment that
 *    lack an explicit link. Co-location is only trusted when one side is
 *    equipment, so two distinct structures collapsing to the same pixel at low
 *    zoom aren't merged.
 */
import { codeTokens } from "@/charts/s57/attributes";
import type { Feature, Geometry } from "geojson";

/**
 * OBJL codes for "equipment" mounted on a structure: LIGHTS, FOGSIG, DAYMAR,
 * RTPBCN, RETRFL, SISTAT, TOPMAR. The structure (buoy/beacon/landmark) is
 * preferred as the group's primary; these become related entries.
 */
const EQUIPMENT_OBJL = new Set([39, 58, 75, 103, 113, 123, 144]);

function lnamOf(f: Feature): string {
  return typeof f.properties?.LNAM === "string" ? f.properties.LNAM : "";
}

function objlOf(f: Feature): number | undefined {
  return typeof f.properties?.OBJL === "number" ? f.properties.OBJL : undefined;
}

function isEquipment(f: Feature): boolean {
  const objl = objlOf(f);
  return objl !== undefined && EQUIPMENT_OBJL.has(objl);
}

/**
 * Rounded first-point coordinate, used as a co-location key. Slaves share the
 * structure's exact (quantized) position; rounding absorbs float noise. Null
 * for non-point geometry — co-location only applies point↔point.
 */
function pointKey(geom: Geometry | null | undefined): string | null {
  if (!geom || geom.type !== "Point") return null;
  const [lon, lat] = geom.coordinates;
  return `${lon.toFixed(6)},${lat.toFixed(6)}`;
}

export type FeatureGroup = { primary: Feature; related: Feature[] };

/**
 * Assemble the group of chart features belonging to the one identified by
 * `lnam`, drawn from the rendered-feature set. Returns the structure as
 * `primary` with mounted equipment as `related`, or `null` if `lnam` isn't
 * present (e.g. tiles not yet rendered).
 */
export function groupFeatures(
  lnam: string,
  rendered: Feature[],
): FeatureGroup | null {
  // queryRenderedFeatures repeats a feature once per style layer that draws it;
  // dedup by LNAM and drop app overlays (no OBJL).
  const byLnam = new Map<string, Feature>();
  for (const f of rendered) {
    if (objlOf(f) === undefined) continue;
    const id = lnamOf(f);
    if (id && !byLnam.has(id)) byLnam.set(id, f);
  }

  const start = byLnam.get(lnam);
  if (!start) return null;

  // BFS over LNAM_REFS links (both directions) ∪ equipment co-location.
  const group = new Map<string, Feature>([[lnam, start]]);
  const queue: Feature[] = [start];
  while (queue.length) {
    const f = queue.shift()!;
    const id = lnamOf(f);
    const neighbors = new Set<string>();

    // Forward: features this one references.
    for (const ref of codeTokens(f.properties?.LNAM_REFS ?? "")) {
      if (ref) neighbors.add(ref);
    }
    // Backward: features that reference this one.
    for (const [otherId, other] of byLnam) {
      if (codeTokens(other.properties?.LNAM_REFS ?? "").includes(id)) {
        neighbors.add(otherId);
      }
    }
    // Co-location: same exact point, when one side is equipment.
    const key = pointKey(f.geometry);
    if (key) {
      for (const [otherId, other] of byLnam) {
        if (
          pointKey(other.geometry) === key &&
          (isEquipment(f) || isEquipment(other))
        ) {
          neighbors.add(otherId);
        }
      }
    }

    for (const neighborId of neighbors) {
      const next = byLnam.get(neighborId);
      if (next && !group.has(neighborId)) {
        group.set(neighborId, next);
        queue.push(next);
      }
    }
  }

  const members = [...group.values()];
  // Primary = a non-equipment structure (prefer one with a name); the tapped
  // feature otherwise (e.g. a standalone light, or an all-equipment cluster).
  const structures = members.filter((f) => !isEquipment(f));
  const named = structures.find(
    (f) =>
      typeof f.properties?.OBJNAM === "string" && f.properties.OBJNAM.trim(),
  );
  const primary = named ?? structures[0] ?? start;
  const related = members.filter((f) => f !== primary);
  return { primary, related };
}
