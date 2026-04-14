import MarkerButton from "@/components/toolbar/MarkerButton";
import RouteButton from "@/components/toolbar/RouteButton";
import SheetBottomToolbar from "@/components/toolbar/SheetBottomToolbar";
import SheetHeader from "@/components/ui/SheetHeader";
import { useAtoNById } from "@/hooks/useAtoN";
import { usePosition } from "@/hooks/useNavigation";
import { toDistance } from "@/hooks/usePreferredUnits";
import { formatBearing } from "@/lib/geo";
import {
  Form,
  Host,
  LabeledContent,
  Section,
  Text,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  monospacedDigit,
} from "@expo/ui/swift-ui/modifiers";
import { getDistance, getGreatCircleBearing } from "geolib";
import { useMemo } from "react";

type Position = { latitude: number; longitude: number };

/** IALA AtoN type code → human-readable name */
function atonTypeName(code: number | undefined): string {
  if (code === undefined) return "Unknown";
  if (code === 1) return "Reference Point";
  if (code === 2) return "RACON";
  if (code === 3) return "Fixed Structure";
  if (code === 4) return "Spare";
  if (code === 5) return "Light, No Sectors";
  if (code === 6) return "Light, With Sectors";
  if (code === 7) return "Leading Light Front";
  if (code === 8) return "Leading Light Rear";
  if (code === 9) return "Beacon, Cardinal N";
  if (code === 10) return "Beacon, Cardinal E";
  if (code === 11) return "Beacon, Cardinal S";
  if (code === 12) return "Beacon, Cardinal W";
  if (code === 13) return "Beacon, Port";
  if (code === 14) return "Beacon, Starboard";
  if (code === 15) return "Beacon, Preferred Channel Port";
  if (code === 16) return "Beacon, Preferred Channel Starboard";
  if (code === 17) return "Beacon, Isolated Danger";
  if (code === 18) return "Beacon, Safe Water";
  if (code === 19) return "Beacon, Special Mark";
  if (code === 20) return "Beacon, Light Vessel / LANBY";
  if (code === 21) return "Buoy, Cardinal N";
  if (code === 22) return "Buoy, Cardinal E";
  if (code === 23) return "Buoy, Cardinal S";
  if (code === 24) return "Buoy, Cardinal W";
  if (code === 25) return "Buoy, Port";
  if (code === 26) return "Buoy, Starboard";
  if (code === 27) return "Buoy, Preferred Channel Port";
  if (code === 28) return "Buoy, Preferred Channel Starboard";
  if (code === 29) return "Buoy, Isolated Danger";
  if (code === 30) return "Buoy, Safe Water";
  if (code === 31) return "Buoy, Special Mark";
  return `Type ${code}`;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return undefined;
}

function getPosition(value: unknown): Position | null {
  if (value && typeof value === "object" && "latitude" in value && "longitude" in value) {
    return value as Position;
  }
  return null;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function AtoNDetail({ id }: { id: string }) {
  const aton = useAtoNById(id);
  const ownPosition = usePosition();

  const data = aton?.data;
  const position = data ? getPosition(data["navigation.position"]?.value) : null;

  const name = data ? getString(data["name"]?.value) : undefined;
  const atonType = data ? getNumber(data["atonType"]?.value) : undefined;
  const isVirtual = data ? getBoolean(data["virtual"]?.value) : undefined;
  const offPosition = data ? getBoolean(data["offPosition"]?.value) : undefined;
  const mmsi = data ? getString(data["mmsi"]?.value) : undefined;

  const { distance, bearing } = useMemo(() => {
    if (!ownPosition || !position) return {};
    return {
      distance: getDistance(ownPosition, position),
      bearing: getGreatCircleBearing(ownPosition, position),
    };
  }, [ownPosition, position]);

  const valueMods = [font({ size: 15 }), monospacedDigit(), foregroundStyle("secondary")];

  if (!aton) {
    return (
      <>
        <SheetHeader title={id} />
        <Host style={{ flex: 1 }}>
          <Form>
            <Section>
              <Text>Aid to Navigation not found</Text>
            </Section>
          </Form>
        </Host>
      </>
    );
  }

  return (
    <>
      <SheetHeader
        title={name ?? id}
        subtitle={[
          atonTypeName(atonType),
          distance !== undefined && bearing !== undefined &&
            `${toDistance(distance).value} ${toDistance(distance).abbr} @ ${formatBearing(bearing)}`,
        ].filter(Boolean).join(" · ")}
      />
      {position && (
        <SheetBottomToolbar>
          <MarkerButton latitude={position.latitude} longitude={position.longitude} />
          <RouteButton latitude={position.latitude} longitude={position.longitude} />
        </SheetBottomToolbar>
      )}
      <Host style={{ flex: 1 }}>
        <Form>
          <Section title="Aid to Navigation">
            <LabeledContent label="Type">
              <Text modifiers={valueMods}>{atonTypeName(atonType)}</Text>
            </LabeledContent>
            <LabeledContent label="Virtual">
              <Text modifiers={valueMods}>{isVirtual === true ? "Yes" : isVirtual === false ? "No" : "—"}</Text>
            </LabeledContent>
            {offPosition === true && (
              <LabeledContent label="Status">
                <Text modifiers={[font({ size: 15 }), monospacedDigit(), foregroundStyle("red")]}>Off Position</Text>
              </LabeledContent>
            )}
            {position && (
              <LabeledContent label="Position">
                <Text modifiers={valueMods}>
                  {position.latitude.toFixed(5)}°, {position.longitude.toFixed(5)}°
                </Text>
              </LabeledContent>
            )}
            {mmsi && (
              <LabeledContent label="MMSI">
                <Text modifiers={valueMods}>{mmsi}</Text>
              </LabeledContent>
            )}
          </Section>

          <Section title="">
            <LabeledContent label="Updated">
              <Text modifiers={valueMods}>{formatTimeAgo(aton.lastSeen)}</Text>
            </LabeledContent>
          </Section>
        </Form>
      </Host>
    </>
  );
}
