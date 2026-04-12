import ChartSourceForm from "@/components/charts/ChartSourceForm";
import SheetView from "@/components/ui/SheetView";
import { insertChart, insertSource } from "@/lib/database";
import { optionsToSourceFields } from "@/lib/charts/sources";
import { router } from "expo-router";
import { useCallback } from "react";

export default function AddChartSource() {
  const handleSave = useCallback(
    async (name: string, type: string, options: string) => {
      const chart = await insertChart(name);
      await insertSource(chart.id, {
        title: name,
        type,
        ...optionsToSourceFields(type, options),
      });
      router.back();
    },
    [],
  );

  return (
    <SheetView id="charts-add">
      <ChartSourceForm onSave={handleSave} />
    </SheetView>
  );
}
