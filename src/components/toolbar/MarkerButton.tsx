import { addMarker } from "@/hooks/useMarkers";
import { router, Stack } from "expo-router";

type Props = {
  latitude: number;
  longitude: number;
};

export default function MarkerButton({ latitude, longitude }: Props) {
  return (
    <Stack.Toolbar.Button
      icon="mappin.and.ellipse"
      onPress={async () => {
        const marker = await addMarker({ latitude, longitude });
        router.replace({ pathname: "/marker/edit", params: { id: marker.id } });
      }}
    />
  );
}
