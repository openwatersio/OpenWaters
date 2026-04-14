import type { CatalogEntry } from "@/charts/catalog/types";
import loadCatalog from "@/charts/catalog";
import { useChartStore } from "@/charts/store";
import { useEffect, useMemo, useState } from "react";

export type CatalogEntryWithStatus = CatalogEntry & {
  installed: boolean;
};

export function useChartCatalog(): {
  entries: CatalogEntryWithStatus[];
  loading: boolean;
} {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const charts = useChartStore((s) => s.charts);

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((entries) => {
        if (!cancelled) {
          setCatalog(entries);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(
    () =>
      catalog.map((entry) => ({
        ...entry,
        installed: entry.id in charts,
      })),
    [catalog, charts],
  );

  return { entries, loading };
}
