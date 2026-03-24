import { useGlobalSearchParams, usePathname } from "expo-router";
import { router } from "expo-router";
import { useCallback, useMemo } from "react";

export type FeatureType = "marker" | "track" | "route" | "vessel" | "aton" | "location";

export type Selection = {
  type: FeatureType;
  id: string;
} | null;

/**
 * Derives the current map selection from expo-router state.
 * Only one thing can be selected at a time — enforced by the router.
 */
export function useSelection(): Selection {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ type?: string; id?: string }>();

  return useMemo(() => {
    if (!pathname.startsWith("/feature/") || !params.type || !params.id) {
      return null;
    }
    return { type: params.type as FeatureType, id: params.id };
  }, [pathname, params.type, params.id]);
}

/**
 * Returns a function to navigate to a feature detail sheet.
 * If a feature is already selected, swaps via setParams; otherwise navigates.
 */
export function useSelectionHandler() {
  const selection = useSelection();

  return useCallback(
    (type: FeatureType, id: string) => {
      if (selection) {
        router.setParams({ type, id });
      } else {
        router.navigate({
          pathname: "/feature/[type]/[id]",
          params: { type, id },
        });
      }
    },
    [selection],
  );
}
