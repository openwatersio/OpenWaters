import {
  deleteMarker as dbDeleteMarker,
  updateMarker as dbUpdateMarker,
  getAllMarkers,
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

/** Reactive single-marker query. Returns null until loaded or if missing. */
export function useMarker(id: number): Marker | null {
  const fetch = useCallback(() => getMarker(id), [id]);
  return useDbQuery(["markers"], fetch) ?? null;
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
