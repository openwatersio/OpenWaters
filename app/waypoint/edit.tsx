import { AnnotationIcon, AnnotationIconName, ICONS } from "@/components/map/AnnotationIcon";
import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { useCameraView } from "@/hooks/useCameraView";
import useTheme from "@/hooks/useTheme";
import { useWaypoints } from "@/hooks/useWaypoints";
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

export default function EditWaypointScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const waypointId = Number(id);

  const waypoint = useWaypoints((s) => s.waypoints.find((w) => w.id === waypointId));
  const updateWaypoint = useWaypoints((s) => s.updateWaypoint);
  const theme = useTheme();

  const [color, setColor] = useState<string | null>(waypoint?.color ?? null);
  const [icon, setIcon] = useState<AnnotationIconName>((waypoint?.icon as AnnotationIconName) ?? "pin");

  const subtitle = waypoint
    ? coordFormat.format(waypoint.longitude, waypoint.latitude).join("  ")
    : undefined;

  const handleSave = useCallback(() => {
    router.dismiss();
  }, []);

  useEffect(() => {
    if (!waypoint) return;

    useCameraView.getState().cameraRef?.current?.flyTo({
      center: [waypoint.longitude, waypoint.latitude],
      duration: 600,
    });
  }, [waypoint]);

  if (!waypoint) return null;

  return (
    <SheetView id="waypoint-edit" style={{ flex: 1 }}>
      <SheetHeader
        title={waypoint.name ?? "Edit Waypoint"}
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
              defaultValue={waypoint.name ?? ""}
              onChangeText={(v) => updateWaypoint(waypointId, { name: v.trim() || null })}
              autocorrection={false}
            />
            <TextField
              placeholder="Notes"
              defaultValue={waypoint.notes ?? ""}
              multiline
              numberOfLines={3}
              onChangeText={(v) => updateWaypoint(waypointId, { notes: v.trim() || null })}
            />
          </Section>

          <Section header={<Text modifiers={[font({ size: 13 }), foregroundStyle("secondary")]}>Icon</Text>}>
            <ColorPicker
              selection={color}
              onSelectionChange={(c) => { setColor(c); updateWaypoint(waypointId, { color: c }); }}
              label="Color"
              supportsOpacity={false}
            />
            <RNHostView matchContents>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 30 }}>
                {Object.keys(ICONS).map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => { setIcon(name as AnnotationIconName); updateWaypoint(waypointId, { icon: name }); }}
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
