import MarkerButton from "@/components/toolbar/MarkerButton";
import RouteButton from "@/components/toolbar/RouteButton";
import SheetBottomToolbar from "@/components/toolbar/SheetBottomToolbar";
import SheetHeader from "@/components/ui/SheetHeader";
import { useAISVessel } from "@/hooks/useAIS";
import { useNavigation, usePosition } from "@/hooks/useNavigation";
import { toDepth, toDistance, toSpeed } from "@/hooks/usePreferredUnits";
import { calculateCPA, formatBearing } from "@/lib/geo";
import {
  Form,
  Host,
  HStack,
  LabeledContent,
  Section,
  Spacer,
  Text,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  monospacedDigit,
} from "@expo/ui/swift-ui/modifiers";
import { getDistance, getGreatCircleBearing } from "geolib";
import { useEffect, useMemo, useState } from "react";

type Position = { latitude: number; longitude: number };

/** AIS ship type code → human-readable name */
function shipTypeName(code: number | undefined): string {
  if (code === undefined) return "Unknown";
  if (code >= 20 && code <= 29) return "Wing in Ground";
  if (code === 30) return "Fishing";
  if (code === 31 || code === 32) return "Towing";
  if (code === 33) return "Dredger";
  if (code === 34) return "Diving Ops";
  if (code === 35) return "Military";
  if (code === 36) return "Sailing";
  if (code === 37) return "Pleasure Craft";
  if (code >= 40 && code <= 49) return "High Speed Craft";
  if (code === 50) return "Pilot Vessel";
  if (code === 51) return "Search & Rescue";
  if (code === 52) return "Tug";
  if (code === 53) return "Port Tender";
  if (code === 55) return "Law Enforcement";
  if (code >= 60 && code <= 69) return "Passenger";
  if (code >= 70 && code <= 79) return "Cargo";
  if (code >= 80 && code <= 89) return "Tanker";
  return `Other (${code})`;
}

/** Determine AIS class from MMSI pattern */
function aisClass(mmsi: string): string {
  if (mmsi.length === 9 && mmsi.startsWith("9")) return "AtoN";
  if (mmsi.length === 9 && mmsi.startsWith("97")) return "SAR Aircraft";
  if (mmsi.length === 9 && mmsi.startsWith("98")) return "AIS-SART";
  if (mmsi.length === 9 && mmsi.startsWith("99")) return "Shore Station";
  return "A/B";
}

function radToDeg(rad: number | null | undefined): string {
  if (rad === null || rad === undefined) return "—";
  const deg = (rad * 180) / Math.PI;
  return `${Math.round(((deg % 360) + 360) % 360)}°`;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getPosition(value: unknown): Position | null {
  if (value && typeof value === "object" && "latitude" in value && "longitude" in value) {
    return value as Position;
  }
  return null;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "Now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function VesselDetail({ id }: { id: string }) {
  const mmsi = id;
  const vessel = useAISVessel(mmsi);
  const nav = useNavigation();
  const ownPosition = usePosition();

  const data = vessel?.data;
  const position = data ? getPosition(data["navigation.position"]?.value) : null;

  const name = data ? getString(data["name"]?.value) : undefined;
  const callSign = data ? getString(data["communication.callsignVhf"]?.value) : undefined;
  const shipType = data ? getNumber(data["design.aisShipType"]?.value) : undefined;
  const length = data ? getNumber(data["design.length"]?.value) : undefined;
  const beam = data ? getNumber(data["design.beam"]?.value) : undefined;
  const draft = data ? getNumber(data["design.draft"]?.value) : undefined;
  const imo = data ? getString(data["registrations.imo"]?.value) : undefined;
  const eta = data ? getString(data["navigation.eta"]?.value) : undefined;
  const sog = data ? getNumber(data["navigation.speedOverGround"]?.value) : undefined;
  const cog = data ? getNumber(data["navigation.courseOverGroundTrue"]?.value) : undefined;
  const heading = data ? getNumber(data["navigation.headingTrue"]?.value) : undefined;
  const rot = data ? getNumber(data["navigation.rateOfTurn"]?.value) : undefined;
  const navState = data ? getString(data["navigation.state"]?.value) : undefined;
  const destination = data ? getString(data["navigation.destination"]?.value) : undefined;

  const sogFormatted = toSpeed(sog);

  // Tick every 10s to keep derived values (distance, bearing, CPA) fresh
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);


  const { distance, bearing } = useMemo(() => {
    void tick;
    if (!ownPosition || !position) return {};
    return {
      distance: getDistance(ownPosition, position),
      bearing: getGreatCircleBearing(ownPosition, position)
    };
  }, [ownPosition, position, tick]);

  const cpa = useMemo(() => {
    void tick;
    if (!ownPosition || !position || sog === undefined || cog === undefined) return null;
    return calculateCPA(
      { ...ownPosition, sog: nav.speed ?? 0, cog: nav.course ?? 0 },
      { ...position, sog, cog },
    );
  }, [ownPosition, nav.speed, nav.course, position, sog, cog, tick]);

  function formatCPATime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)} sec`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${(seconds / 3600).toFixed(1)} hr`;
  }

  const valueMods = [font({ size: 15 }), monospacedDigit(), foregroundStyle("secondary")];

  if (!vessel) {
    return (
      <>
        <SheetHeader title={mmsi} />
        <Host style={{ flex: 1 }}>
          <Form>
            <Section>
              <Text>Vessel not found</Text>
            </Section>
          </Form>
        </Host>
      </>
    );
  }

  return (
    <>
      <SheetHeader
        title={name ?? mmsi}
        subtitle={[
          shipTypeName(shipType),
          distance && bearing && `${toDistance(distance).value} ${toDistance(distance).abbr} @ ${formatBearing(bearing)}`,
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
          <Section
            header={
              <HStack>
                <Text>Navigation</Text>
                <Spacer />
                <Text modifiers={[font({ weight: "regular" }), foregroundStyle("secondary")]}>
                  {formatTimeAgo(vessel.lastSeen)}
                </Text>
              </HStack>
            }
          >
            <LabeledContent label="CPA">
              <Text modifiers={valueMods}>
                {cpa ? `${toDistance(cpa.distance).value}${toDistance(cpa.distance).abbr} • ${formatCPATime(cpa.time)}` : "—"}
              </Text>
            </LabeledContent>
            <LabeledContent label="SOG">
              <Text modifiers={valueMods}>{sog !== undefined ? `${sogFormatted.value} ${sogFormatted.abbr}` : "—"}</Text>
            </LabeledContent>
            <LabeledContent label="COG">
              <Text modifiers={valueMods}>{radToDeg(cog)}</Text>
            </LabeledContent>
            <LabeledContent label="Heading">
              <Text modifiers={valueMods}>{radToDeg(heading)}</Text>
            </LabeledContent>
            <LabeledContent label="Rate of Turn">
              <Text modifiers={valueMods}>{rot !== undefined ? `${((rot * 180) / Math.PI).toFixed(1)}°/min` : "—"}</Text>
            </LabeledContent>
            <LabeledContent label="Status">
              <Text modifiers={valueMods}>{navState ?? "—"}</Text>
            </LabeledContent>
            <LabeledContent label="Destination">
              <Text modifiers={valueMods}>{destination ?? "—"}</Text>
            </LabeledContent>
            <LabeledContent label="ETA">
              <Text modifiers={valueMods}>{eta ?? "—"}</Text>
            </LabeledContent>
          </Section>

          <Section title="Vessel">
            <LabeledContent label="Type">
              <Text modifiers={valueMods}>{shipTypeName(shipType)}</Text>
            </LabeledContent>
            <LabeledContent label="Length">
              <Text modifiers={valueMods}>{length !== undefined ? `${toDepth(length, { decimals: 0 }).value} ${toDepth(length).abbr}` : "—"}</Text>
            </LabeledContent>
            <LabeledContent label="Beam">
              <Text modifiers={valueMods}>{beam !== undefined ? `${toDepth(beam, { decimals: 0 }).value} ${toDepth(beam).abbr}` : "—"}</Text>
            </LabeledContent>
            <LabeledContent label="Draft">
              <Text modifiers={valueMods}>{draft !== undefined ? `${toDepth(draft).value} ${toDepth(draft).abbr}` : "—"}</Text>
            </LabeledContent>
            <LabeledContent label="Call Sign">
              <Text modifiers={valueMods}>{callSign ?? "—"}</Text>
            </LabeledContent>
            <LabeledContent label="AIS Class">
              <Text modifiers={valueMods}>{aisClass(mmsi)}</Text>
            </LabeledContent>
            <LabeledContent label="MMSI">
              <Text modifiers={valueMods}>{mmsi}</Text>
            </LabeledContent>
            <LabeledContent label="IMO">
              <Text modifiers={valueMods}>{imo ?? "—"}</Text>
            </LabeledContent>
          </Section>
        </Form>
      </Host>
    </>
  );
}
