import { useImport } from "@/import/state";
import SheetView from "@/ui/SheetView";
import { Button, Host, List, Section } from "@expo/ui/swift-ui";
import { tint } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";

export default function Menu() {
  const { errorCount } = useImport();
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
              modifiers={[tint('primary')]}
              systemImage="point.bottomleft.forward.to.arrow.triangle.scurvepath"
              label="Tracks"
              onPress={() => router.dismissTo("/tracks")}
            />
            <Button
              modifiers={[tint('primary')]}
              systemImage="mappin.and.ellipse"
              label="Markers"
              onPress={() => router.dismissTo("/markers")}
            />
            <Button
              modifiers={[tint('primary')]}
              systemImage="point.topright.arrow.triangle.backward.to.point.bottomleft.scurvepath.fill"
              label="Routes"
              onPress={() => router.dismissTo("/routes")}
            />
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
