import { addDraftPoint, useRouteDraft } from "@/hooks/useRouteDraft";
import useTheme from "@/hooks/useTheme";
import { router, Stack } from "expo-router";

type Props = {
  latitude: number;
  longitude: number;
};

export default function RouteButton({ latitude, longitude }: Props) {
  const theme = useTheme();
  const isEditingRoute = useRouteDraft((s) => s.points.length > 0);

  return (
    <Stack.Toolbar.Button
      icon="point.topright.arrow.triangle.backward.to.point.bottomleft.scurvepath.fill"
      tintColor={isEditingRoute ? theme.primary : undefined}
      onPress={() => {
        if (isEditingRoute) {
          addDraftPoint({ latitude, longitude });
          router.back();
        } else {
          router.replace({
            pathname: "/route/edit",
            params: { to: `${longitude},${latitude}` },
          });
        }
      }}
    />
  );
}
