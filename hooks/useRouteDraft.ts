import { getRoute, getRoutePoints } from "@/lib/database";
import { create } from "zustand";

let nextKey = 0;

export type DraftWaypoint = {
  key: number;
  latitude: number;
  longitude: number;
};

type State = {
  routeId: number | null;
  name: string | null;
  points: DraftWaypoint[];
  selectedIndex: number | null;
};

export const useRouteDraft = create<State>()(() => ({
  routeId: null,
  name: null,
  points: [],
  selectedIndex: null,
}));

export function initDraft(points: Omit<DraftWaypoint, "key">[]) {
  useRouteDraft.setState({
    routeId: null,
    name: null,
    points: points.map((p) => ({ ...p, key: nextKey++ })),
    selectedIndex: null,
  });
}

export async function initDraftFromRoute(routeId: number) {
  const [route, points] = await Promise.all([
    getRoute(routeId),
    getRoutePoints(routeId),
  ]);
  useRouteDraft.setState({
    routeId,
    name: route?.name ?? null,
    points: points.map((p) => ({ key: nextKey++, latitude: p.latitude, longitude: p.longitude })),
    selectedIndex: null,
  });
}

export function setDraftName(name: string | null) {
  useRouteDraft.setState({ name });
}

export function addDraftPoint(point: Omit<DraftWaypoint, "key">) {
  useRouteDraft.setState((s) => ({
    points: [...s.points, { ...point, key: nextKey++ }],
  }));
}

export function updateDraftPoint(
  index: number,
  fields: Partial<DraftWaypoint>,
) {
  useRouteDraft.setState((s) => ({
    points: s.points.map((p, i) => (i === index ? { ...p, ...fields } : p)),
  }));
}

export function insertDraftPointAt(index: number, point: Omit<DraftWaypoint, "key">) {
  useRouteDraft.setState((s) => {
    const pts = [...s.points];
    pts.splice(index, 0, { ...point, key: nextKey++ });
    return { points: pts };
  });
}

export function moveDraftPoint(fromIndex: number, toIndex: number) {
  useRouteDraft.setState((s) => {
    const pts = [...s.points];
    const [moved] = pts.splice(fromIndex, 1);
    pts.splice(toIndex, 0, moved);
    return { points: pts, selectedIndex: null };
  });
}

export function removeDraftPoint(index: number) {
  useRouteDraft.setState((s) => ({
    points: s.points.filter((_, i) => i !== index),
    selectedIndex: s.selectedIndex === index ? null
      : s.selectedIndex !== null && s.selectedIndex > index ? s.selectedIndex - 1
      : s.selectedIndex,
  }));
}

export function selectDraftPoint(index: number | null) {
  useRouteDraft.setState({ selectedIndex: index });
}

export function clearDraft() {
  useRouteDraft.setState({ points: [], selectedIndex: null });
}
