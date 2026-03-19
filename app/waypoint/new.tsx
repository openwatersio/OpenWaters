import { useWaypoints } from "@/hooks/useWaypoints";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

// FIXME: Remove this and just call `addWaypoint` directly where necessary
export default function NewWaypointScreen() {
  const { lat, lon } = useLocalSearchParams<{ lat: string; lon: string }>();
  const addWaypoint = useWaypoints((s) => s.addWaypoint);
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    addWaypoint({ latitude: Number(lat), longitude: Number(lon) }).then((w) => setId(w.id));
  }, []);

  if (id !== null) {
    return <Redirect href={{ pathname: "/waypoint/edit", params: { id } }} />;
  }

  return null;
}
