import {
  deleteMarker as dbDeleteMarker,
  updateMarker as dbUpdateMarker,
  getAllMarkers,
  getDatabase,
  getMarker,
  insertMarker,
  type Marker,
  type MarkerFields,
  type MarkersOrder,
} from "@/database";
import { useDbQuery } from "@/hooks/useDbQuery";
import { getPosition } from "@/navigation/hooks/useNavigation";
import { useCallback } from "react";

type UseMarkersOptions = {
  order?: MarkersOrder;
  /** Optional viewport bounds filter [west, south, east, north]. */
  bounds?: Readonly<[number, number, number, number]>;
};

/**
 * Reactive list of all markers, sorted in SQL by the requested order.
 * Re-runs automatically whenever the `markers` table changes.
 */
export function useMarkers({
  order = "created",
  bounds,
}: UseMarkersOptions = {}): Marker[] {
  const fetch = useCallback(
    () =>
      getAllMarkers(
        order,
        order === "nearby" ? getPosition() : undefined,
        bounds,
      ),
    [order, bounds],
  );
  return useDbQuery(["markers"], fetch) ?? [];
}

/** Reactive single-marker query. Returns null until loaded, if missing, or
 *  when `id` is null. When null, skips the DB subscription entirely — useful
 *  for "selected marker" patterns where no selection is the common case. */
export function useMarker(id: number | null): Marker | null {
  const fetch = useCallback(
    () => (id == null ? Promise.resolve(null) : getMarker(id)),
    [id],
  );
  const tables = id == null ? [] : ["markers"];
  return useDbQuery(tables, fetch) ?? null;
}

export async function addMarker(fields: MarkerFields) {
  return insertMarker(fields);
}

export async function updateMarker(
  id: number,
  fields: Partial<
    Pick<Marker, "name" | "notes" | "color" | "icon" | "latitude" | "longitude">
  >,
) {
  await dbUpdateMarker(id, fields);
}

export async function deleteMarker(id: number) {
  await dbDeleteMarker(id);
}

const fetchMarkerCount = async () => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM markers",
  );
  return row?.count ?? 0;
};

/** Reactive count of all markers. */
export function useMarkerCount(): number {
  return useDbQuery(["markers"], fetchMarkerCount) ?? 0;
}
