import { AnnotationIcon, AnnotationIconName, ICONS } from "@/components/map/AnnotationIcon";
import { flyTo } from "@/components/map/NavigationCamera";
import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { updateMarker, useMarkers } from "@/hooks/useMarkers";
import useTheme from "@/hooks/useTheme";
import {
  ColorPicker,
  Form,
  Host,
  RNHostView,
  Section,
  Text,
  TextField
} from "@expo/ui/swift-ui";
import { font, foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { CoordinateFormat } from "coordinate-format";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

const coordFormat = new CoordinateFormat("minutes");

export default function EditMarkerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const markerId = Number(id);

  const marker = useMarkers((s) => s.markers.find((m) => m.id === markerId));
  const theme = useTheme();

  const [color, setColor] = useState<string | null>(marker?.color ?? null);
  const [icon, setIcon] = useState<AnnotationIconName>((marker?.icon as AnnotationIconName) ?? "pin");

  const subtitle = marker
    ? coordFormat.format(marker.longitude, marker.latitude).join("  ")
    : undefined;

  const handleSave = useCallback(() => {
    router.dismissTo({ pathname: "/feature/[type]/[id]", params: { type: "marker", id } });
  }, [id]);

  useEffect(() => {
    if (!marker) return;

    flyTo({
      center: [marker.longitude, marker.latitude],
      duration: 600,
    });
  }, [marker]);

  if (!marker) return null;

  return (
    <SheetView id="marker-edit" style={{ flex: 1 }}>
      <SheetHeader
        title={marker.name ?? "Edit Marker"}
        subtitle={subtitle}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="checkmark"
          onPress={handleSave}
          variant="prominent"
        >
          Save
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            <TextField
              placeholder="Name (optional)"
              defaultValue={marker.name ?? ""}
              onValueChange={(v: string) => updateMarker(markerId, { name: v.trim() || null })}
            />
            <TextField
              placeholder="Notes"
              defaultValue={marker.notes ?? ""}
              axis="vertical"
              onValueChange={(v: string) => updateMarker(markerId, { notes: v.trim() || null })}
            />
          </Section>

          <Section header={<Text modifiers={[font({ size: 13 }), foregroundStyle("secondary")]}>Icon</Text>}>
            <ColorPicker
              selection={color}
              onSelectionChange={(c) => {
                setColor(c);
                updateMarker(markerId, { color: c });
              }}
              label="Color"
              supportsOpacity={false}
            />
            <RNHostView matchContents>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 30 }}>
                {Object.keys(ICONS).map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => { setIcon(name as AnnotationIconName); updateMarker(markerId, { icon: name }); }}
                  >
                    <AnnotationIcon name={name} size={24} color={icon === name ? color ?? undefined : theme.textPrimary} />
                  </Pressable>
                ))}
              </View>
            </RNHostView>
          </Section>
        </Form>
      </Host>
    </SheetView>
  );
}
