import AtoNDetail from "@/components/features/AtoNDetail";
import LocationDetail from "@/components/features/LocationDetail";
import MarkerDetail from "@/components/features/MarkerDetail";
import TrackDetail from "@/components/features/TrackDetail";
import VesselDetail from "@/components/features/VesselDetail";
import SheetView from "@/components/ui/SheetView";
import { useLocalSearchParams } from "expo-router";

export default function FeatureScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();

  if (!type || !id) return null;

  return (
    <SheetView id="feature" style={{ flex: 1 }} headerDetent additionalDetents={[0.3, 0.5, 1]}>
      <FeatureDetail type={type} id={id} />
    </SheetView>
  );
}

function FeatureDetail({ type, id }: { type: string; id: string }) {
  switch (type) {
    case "marker":
      return <MarkerDetail id={id} />;
    case "track":
      return <TrackDetail id={id} />;
    case "vessel":
      return <VesselDetail id={id} />;
    case "aton":
      return <AtoNDetail id={id} />;
    case "location":
      return <LocationDetail id={id} />;
    default:
      return null;
  }
}
