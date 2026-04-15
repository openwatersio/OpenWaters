import useTheme from "@/hooks/useTheme";
import { addRouteWaypoint, useActiveRoute } from "@/routes/hooks/useRoutes";
import { router, Stack } from "expo-router";

type Props = {
  latitude: number;
  longitude: number;
};

export default function RouteButton({ latitude, longitude }: Props) {
  const theme = useTheme();
  const { isActive } = useActiveRoute();

  return (
    <Stack.Toolbar.Button
      icon="point.topright.arrow.triangle.backward.to.point.bottomleft.scurvepath.fill"
      tintColor={isActive ? theme.primary : undefined}
      onPress={() => {
        if (isActive) {
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
