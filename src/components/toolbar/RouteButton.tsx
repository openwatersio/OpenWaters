import { addRouteWaypoint, useActiveRoute } from "@/hooks/useRoutes";
import useTheme from "@/hooks/useTheme";
import { router, Stack } from "expo-router";

type Props = {
  latitude: number;
  longitude: number;
};

export default function RouteButton({ latitude, longitude }: Props) {
  const theme = useTheme();
  const hasActiveRoute = useActiveRoute((a) => a != null);

  return (
    <Stack.Toolbar.Button
      icon="point.topright.arrow.triangle.backward.to.point.bottomleft.scurvepath.fill"
      tintColor={hasActiveRoute ? theme.primary : undefined}
      onPress={() => {
        if (hasActiveRoute) {
          addRouteWaypoint({ latitude, longitude });
          router.back();
        } else {
          router.replace({
            pathname: "/route/new",
            params: { to: `${longitude},${latitude}` },
          });
        }
      }}
    />
  );
}
