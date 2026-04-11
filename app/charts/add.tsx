import ChartSourceForm from "@/components/charts/ChartSourceForm";
import SheetView from "@/components/ui/SheetView";
import { insertChartSource } from "@/lib/database";
import { router } from "expo-router";
import { useCallback } from "react";

export default function AddChartSource() {
  const handleSave = useCallback(
    async (name: string, type: string, options: string) => {
      await insertChartSource(name, type, options);
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
