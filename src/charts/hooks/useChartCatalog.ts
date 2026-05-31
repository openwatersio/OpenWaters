import type { CatalogEntry } from "@/charts/catalog/types";
import loadCatalog from "@/charts/catalog";
import { useChartStore } from "@/charts/store";
import { useMemo } from "react";

export type CatalogEntryWithStatus = CatalogEntry & {
  installed: boolean;
};

export function useChartCatalog(): { entries: CatalogEntryWithStatus[] } {
  const catalog = useMemo(() => loadCatalog(), []);
  const { charts } = useChartStore();

  const entries = useMemo(
    () =>
      catalog.map((entry) => ({
        ...entry,
        installed: entry.id in charts,
      })),
    [catalog, charts],
  );

  return { entries };
}
