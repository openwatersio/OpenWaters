import type { CatalogEntry } from "@/catalog/types";
import loadCatalog from "@/catalog";
import { useCharts } from "@/hooks/useCharts";
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
  const charts = useCharts();

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

  const installedIds = useMemo(
    () => new Set(charts.map((c) => c.catalog_entry_id).filter(Boolean)),
    [charts],
  );

  const entries = useMemo(
    () =>
      catalog.map((entry) => ({
        ...entry,
        installed: installedIds.has(entry.id),
      })),
    [catalog, installedIds],
  );

  return { entries, loading };
}
