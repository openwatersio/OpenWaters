import useTheme from "@/hooks/useTheme";
import { useImport } from "@/import/state";
import { useMarkerCount } from "@/markers/hooks/useMarkers";
import { useRouteCount } from "@/routes/hooks/useRoutes";
import { useTrackCount } from "@/tracks/hooks/useTracks";
import SheetView from "@/ui/SheetView";
import { Button, Host, Image, Label, List, Section } from "@expo/ui/swift-ui";
import { badge, tint } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";

export default function Menu() {
  const theme = useTheme();
  const { errorCount } = useImport();
  const trackCount = useTrackCount();
  const markerCount = useMarkerCount();
  const routeCount = useRouteCount();
  const hasErrors = errorCount > 0;
  const importLabel = hasErrors
    ? `Import (${errorCount} ${errorCount === 1 ? "error" : "errors"})`
    : "Import";

  return (
    <SheetView id="main">
      <Host style={{ flex: 1 }}>
        <List>
          <Section>
            <Button
              modifiers={[
                tint('primary'),
                badge(trackCount > 0 ? String(trackCount) : undefined)
              ]}
              onPress={() => router.dismissTo("/tracks")}
            >
              <Label
                title="Tracks"
                icon={
                  <Image
                    systemName="point.bottomleft.forward.to.arrow.triangle.scurvepath"
                    size={18}
                    color={theme.tracks}
                  />
                }
              />
            </Button>
            <Button
              modifiers={[tint('primary'), badge(markerCount > 0 ? String(markerCount) : undefined)]}
              onPress={() => router.dismissTo("/markers")}
            >
              <Label
                title="Markers"
                icon={
                  <Image
                    systemName="mappin.and.ellipse"
                    size={18}
                    color={theme.markers}
                  />
                }
              />
            </Button>
            <Button
              modifiers={[tint('primary'), badge(routeCount > 0 ? String(routeCount) : undefined)]}
              onPress={() => router.dismissTo("/routes")}
            >
              <Label
                title="Routes"
                icon={
                  <Image
                    systemName="point.topright.arrow.triangle.backward.to.point.bottomleft.scurvepath.fill"
                    size={18}
                    color={theme.routes}
                  />
                }
              />
            </Button>
          </Section>
          <Section>
            <Button
              modifiers={[tint('primary')]}
              systemImage="map"
              label="Charts"
              onPress={() => router.navigate("/charts")}
            />
            <Button
              modifiers={[tint('primary')]}
              systemImage="antenna.radiowaves.left.and.right"
              label="Connections"
              onPress={() => router.navigate("/connections")}
            />
            <Button
              modifiers={[tint(hasErrors ? "red" : "primary")]}
              systemImage={
                hasErrors ? "exclamationmark.circle" : "square.and.arrow.down"
              }
              label={importLabel}
              onPress={() => router.navigate("/import")}
            />
            <Button
              modifiers={[tint('primary')]}
              systemImage="gearshape"
              label="Settings"
              onPress={() => router.navigate("/settings")}
            />
          </Section>
        </List>
      </Host>
    </SheetView>
  );
}
