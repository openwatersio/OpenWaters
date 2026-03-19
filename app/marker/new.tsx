import { useMarkers } from "@/hooks/useMarkers";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

// FIXME: Remove this and just call `addMarker` directly where necessary
export default function NewMarkerScreen() {
  const { lat, lon } = useLocalSearchParams<{ lat: string; lon: string }>();
  const addMarker = useMarkers((s) => s.addMarker);
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    addMarker({ latitude: Number(lat), longitude: Number(lon) }).then((m) => setId(m.id));
  }, []);

  if (id !== null) {
    return <Redirect href={{ pathname: "/marker/edit", params: { id } }} />;
  }

  return null;
}
