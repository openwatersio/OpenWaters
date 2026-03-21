import { create } from "zustand";

export type DraftWaypoint = {
  latitude: number;
  longitude: number;
};

type State = {
  points: DraftWaypoint[];
  selectedIndex: number | null;
};

export const useRouteDraft = create<State>()(() => ({
  points: [],
  selectedIndex: null,
}));

export function initDraft(points: DraftWaypoint[]) {
  useRouteDraft.setState({ points, selectedIndex: null });
}

export function addDraftPoint(point: DraftWaypoint) {
  useRouteDraft.setState((s) => ({
    points: [...s.points, point],
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

export function insertDraftPointAt(index: number, point: DraftWaypoint) {
  useRouteDraft.setState((s) => {
    const pts = [...s.points];
    pts.splice(index, 0, point);
    return { points: pts };
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
