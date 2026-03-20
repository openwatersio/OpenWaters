import { AnnotationIcon, AnnotationIconName, ICONS } from "@/components/map/AnnotationIcon";
import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { useCameraView } from "@/hooks/useCameraView";
import { updateMarker, useMarkers } from "@/hooks/useMarkers";
import useTheme from "@/hooks/useTheme";
import {
  Button,
  ColorPicker,
  Form,
  Host,
  RNHostView,
  Section,
  Text,
  TextField,
} from "@expo/ui/swift-ui";
import { font, foregroundStyle, labelStyle, tint } from "@expo/ui/swift-ui/modifiers";
import { CoordinateFormat } from "coordinate-format";
import { router, useLocalSearchParams } from "expo-router";
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
    router.dismiss();
  }, []);

  useEffect(() => {
    if (!marker) return;

    useCameraView.getState().cameraRef?.current?.flyTo({
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
        headerRight={() => (
          <Host matchContents>
            <Button
              systemImage="checkmark"
              label="Save"
              onPress={handleSave}
              modifiers={[
                labelStyle("iconOnly"),
                tint("primary"),
                font({ weight: "semibold" }),
              ]}
            />
          </Host>
        )}
      />
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            <TextField
              placeholder="Name (optional)"
              defaultValue={marker.name ?? ""}
              onChangeText={(v) => updateMarker(markerId, { name: v.trim() || null })}
              autocorrection={false}
            />
            <TextField
              placeholder="Notes"
              defaultValue={marker.notes ?? ""}
              multiline
              numberOfLines={3}
              onChangeText={(v) => updateMarker(markerId, { notes: v.trim() || null })}
            />
          </Section>

          <Section header={<Text modifiers={[font({ size: 13 }), foregroundStyle("secondary")]}>Icon</Text>}>
            <ColorPicker
              selection={color}
              onSelectionChange={(c) => { setColor(c); updateMarker(markerId, { color: c }); }}
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
