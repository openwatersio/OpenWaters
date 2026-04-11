import ChartSourceForm from "@/components/charts/ChartSourceForm";
import SheetView from "@/components/ui/SheetView";
import { useChartSources } from "@/hooks/useViewOptions";
import { updateChartSource } from "@/lib/database";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";

export default function EditChartSource() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sourceId = Number(id);

  const sources = useChartSources();
  const source = sources.find((s) => s.id === sourceId);

  const handleSave = useCallback(
    async (name: string, type: string, options: string) => {
      await updateChartSource(sourceId, { name, type, options });
      router.back();
    },
    [sourceId],
  );

  if (!source) return null;

  return (
    <SheetView id="charts-edit">
      <ChartSourceForm key={source.id} {...source} onSave={handleSave} />
    </SheetView>
  );
}
