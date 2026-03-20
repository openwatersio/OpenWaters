import { useGlobalSearchParams, usePathname } from "expo-router";
import { useMemo } from "react";

export type Selection =
  | { type: "marker"; id: number }
  | { type: "track"; id: number }
  | { type: "location"; coords: [lng: number, lat: number] }
  | null;

/**
 * Derives the current map selection from expo-router state.
 * Only one thing can be selected at a time — enforced by the router.
 */
export function useSelection(): Selection {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ id?: string; coords?: string }>();

  return useMemo(() => {
    if (pathname.startsWith("/marker/") && params.id) {
      return { type: "marker", id: Number(params.id) };
    }
    if (pathname.startsWith("/track/") && params.id) {
      return { type: "track", id: Number(params.id) };
    }
    if (pathname.startsWith("/location/") && params.coords) {
      const [lng, lat] = params.coords.split(",").map(Number) as [number, number];
      return { type: "location", coords: [lng, lat] };
    }
    return null;
  }, [pathname, params.id, params.coords]);
}
