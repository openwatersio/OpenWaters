import {
  deleteMarker as dbDeleteMarker,
  getAllMarkers,
  insertMarker,
  updateMarker as dbUpdateMarker,
  type Marker,
  type MarkerFields,
} from "@/lib/database";
import { create } from "zustand";

type State = {
  markers: Marker[];
};

export const useMarkers = create<State>()(() => ({
  markers: [],
}));

export async function loadMarkers() {
  const markers = await getAllMarkers();
  useMarkers.setState({ markers });
}

export async function addMarker(fields: MarkerFields) {
  const marker = await insertMarker(fields);
  useMarkers.setState((s) => ({ markers: [marker, ...s.markers] }));
  return marker;
}

export async function updateMarker(
  id: number,
  fields: Partial<Pick<Marker, "name" | "notes" | "color" | "icon" | "latitude" | "longitude">>,
) {
  await dbUpdateMarker(id, fields);
  useMarkers.setState((s) => ({
    markers: s.markers.map((m) => (m.id === id ? { ...m, ...fields } : m)),
  }));
}

export async function deleteMarker(id: number) {
  await dbDeleteMarker(id);
  useMarkers.setState((s) => ({
    markers: s.markers.filter((m) => m.id !== id),
  }));
}
