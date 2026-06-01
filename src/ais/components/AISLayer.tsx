import { type AISVessel, useAIS } from "@/ais/hooks/useAIS";
import { MIN_AIS_ZOOM, isAISVisibleAtZoom } from "@/ais/visibility";
import { projectPosition } from "@/geo";
import useTheme from "@/hooks/useTheme";
import { cameraViewState } from "@/map/hooks/useCameraView";
import { useSelection, useSelectionHandler } from "@/map/hooks/useSelection";
import { vesselMppFactor, vesselScaleAt, vesselScaleDamped } from "@/map/iconSize";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { NativeSyntheticEvent } from "react-native";
import { subscribeKey } from "valtio/utils";

type Position = { latitude: number; longitude: number };

const STALE_AGE = 6 * 60 * 1000;   // 6 minutes
const EXPIRED_AGE = 9 * 60 * 1000;  // 9 minutes
const SOG_THRESHOLD = 0.25;         // m/s (~0.5 knots)
const COG_PROJECTION_SECONDS = 15 * 60; // 15 minutes

// Compressed scaling at low/mid zoom. Vessel size scales as `mppFactor^p`
// where `p = COMPRESSION_POWER`. Tweak `p` to control how flat the size
// hierarchy is at low zoom:
//   1     = linear (true real scale, 300m is 25× a 12m vessel)
//   0.333 = cube root (300m ≈ 2.9× a 12m vessel)
//   0.15  = heavy compression (300m ≈ 1.6× a 12m vessel)
// Anchored so a vessel of COMPRESSED_REF_LOA_M renders at REF_PX_AT_Z10
// at z=10 and REF_PX_AT_Z14 at z=14. From z=18+ the curve hands off to
// true real-world scale, where length ratios match size ratios directly.
const COMPRESSION_POWER = 0.15;
const COMPRESSED_REF_LOA_M = 50;
const REF_PX_AT_Z10 = 18;
const REF_PX_AT_Z14 = 44;
// Default LOA for vessels with no broadcast static report (typically Class B
// before Type 24B arrives). 12 m approximates a small recreational boat —
// the prevailing target type at this data-completeness level.
const DEFAULT_LOA_M = 12;
const DEFAULT_BEAM_M = 4; // ~3:1 aspect ratio for unknown vessels

// 8-bin aspect ratio bins for hull selection, optimized for MAE=0.203 against
// 199 real vessels in range. Bins are: 1.7, 2.3, 2.8, 3.4, 4.0, 5.2, 6.8, 9.0
const HULL_BINS = [1.7, 2.3, 2.8, 3.4, 4.0, 5.2, 6.8, 9.0];

const SHADOW_HALO_BLUR = 2.5;

/**
 * Select hull icon based on L/B aspect ratio.
 * All vessels use a generic hull silhouette sized by their broadcast L/B.
 * Type differentiation (if added later) will come via categorical color or
 * accent overlay, not hull shape.
 */
function vesselIcon(loa: number, beam: number): string {
  const aspectRatio = loa / beam;
  // Snap to nearest bin
  const bin = HULL_BINS.reduce((closest, candidate) =>
    Math.abs(candidate - aspectRatio) < Math.abs(closest - aspectRatio)
      ? candidate
      : closest
  );
  return `hull-${bin.toFixed(1)}`;
}

/** Combined navigation + freshness state */
function vesselState(vessel: AISVessel): string {
  const age = Date.now() - vessel.lastSeen;
  if (age > EXPIRED_AGE) return "expired";
  if (age > STALE_AGE) return "stale";
  const sog = vesselSOGmps(vessel);
  return sog > SOG_THRESHOLD ? "underway" : "moored";
}

function vesselPosition(vessel: AISVessel): Position | null {
  const pos = vessel.data["navigation.position"]?.value;
  if (pos && typeof pos === "object" && "latitude" in pos) {
    return pos as Position;
  }
  return null;
}

function vesselRotation(vessel: AISVessel): number {
  const heading = vessel.data["navigation.headingTrue"]?.value;
  if (typeof heading === "number") return (heading * 180) / Math.PI;
  const cog = vessel.data["navigation.courseOverGroundTrue"]?.value;
  if (typeof cog === "number") return (cog * 180) / Math.PI;
  return 0;
}

function vesselName(vessel: AISVessel): string {
  const name = vessel.data["name"]?.value;
  return typeof name === "string" ? name : vessel.mmsi;
}

function vesselSOG(vessel: AISVessel): number {
  const sog = vessel.data["navigation.speedOverGround"]?.value;
  return typeof sog === "number" ? sog * 1.9438 : 0;
}

function vesselSOGmps(vessel: AISVessel): number {
  const sog = vessel.data["navigation.speedOverGround"]?.value;
  return typeof sog === "number" ? sog : 0;
}

function vesselCOGrad(vessel: AISVessel): number | null {
  const cog = vessel.data["navigation.courseOverGroundTrue"]?.value;
  return typeof cog === "number" ? cog : null;
}

function vesselLength(vessel: AISVessel): number {
  const length = vessel.data["design.length"]?.value;
  return typeof length === "number" && length > 0 ? length : DEFAULT_LOA_M;
}

function vesselBeam(vessel: AISVessel): number {
  const beam = vessel.data["design.beam"]?.value;
  return typeof beam === "number" && beam > 0 ? beam : DEFAULT_BEAM_M;
}

export default function AISLayer() {
  const vessels = useAIS();
  const theme = useTheme();

  // Below MIN_AIS_ZOOM the viewport is too wide to draw individual vessels.
  // Subscribe to a derived boolean so we only re-render when crossing the
  // threshold, not on every zoom tick during a pinch. The `minzoom` on the
  // layers below is the authoritative native gate; this just lets us skip
  // building the (potentially huge) feature collections while hidden.
  const [visible, setVisible] = useState(() =>
    isAISVisibleAtZoom(cameraViewState.zoom),
  );
  useEffect(
    () =>
      subscribeKey(cameraViewState, "zoom", (zoom) => {
        setVisible(isAISVisibleAtZoom(zoom));
      }),
    [],
  );

  // Tick every 30s to re-evaluate staleness even when vessel data hasn't changed
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const cogLines = useMemo((): GeoJSON.FeatureCollection => {
    void tick;
    if (!visible) return { type: "FeatureCollection", features: [] };
    const features: GeoJSON.Feature[] = Object.values(vessels)
      .map((vessel): GeoJSON.Feature | null => {
        if (vesselState(vessel) !== "underway") return null;
        const pos = vesselPosition(vessel);
        const cog = vesselCOGrad(vessel);
        const sog = vesselSOGmps(vessel);
        if (!pos || cog === null) return null;
        const dist = sog * COG_PROJECTION_SECONDS;
        const end = projectPosition(pos.latitude, pos.longitude, cog, dist);
        return {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [[pos.longitude, pos.latitude], end],
          },
        };
      })
      .filter((f): f is GeoJSON.Feature => f !== null);
    return { type: "FeatureCollection", features };
  }, [vessels, tick, visible]);

  const geojson = useMemo((): GeoJSON.FeatureCollection => {
    void tick;
    if (!visible) return { type: "FeatureCollection", features: [] };
    const features: GeoJSON.Feature[] = Object.values(vessels)
      .map((vessel): GeoJSON.Feature | null => {
        const state = vesselState(vessel);
        if (state === "expired") return null;
        const pos = vesselPosition(vessel);
        if (!pos) return null;
        const loa = vesselLength(vessel);
        const beam = vesselBeam(vessel);
        const mppFactor = vesselMppFactor(loa, pos.latitude);
        return {
          type: "Feature",
          id: `vessel-${vessel.mmsi}`,
          properties: {
            mmsi: vessel.mmsi,
            snappable: true,
            name: vesselName(vessel),
            rotation: vesselRotation(vessel),
            sog: vesselSOG(vessel),
            state,
            icon: vesselIcon(loa, beam),
            mppFactor,
          },
          geometry: {
            type: "Point",
            coordinates: [pos.longitude, pos.latitude],
          },
        };
      })
      .filter((f): f is GeoJSON.Feature => f !== null);

    return { type: "FeatureCollection", features };
  }, [vessels, tick, visible]);

  const selection = useSelection();
  const navigate = useSelectionHandler();

  const handlePress = useCallback((e: NativeSyntheticEvent<{ features: GeoJSON.Feature[] }>) => {
    const mmsi = e.nativeEvent.features?.[0]?.properties?.mmsi;
    if (mmsi) {
      e.stopPropagation();
      navigate("vessel", mmsi);
    }
  }, [navigate]);

  const selectedMmsi = selection?.type === "vessel" ? selection.id : "";

  // Top-level zoom interpolate so MapLibre's `["zoom"]` constraint is met
  // (zoom may only appear as the input of a top-level step/interpolate).
  // Low/mid zoom uses heavily compressed power-law scaling so size differences
  // stay readable without inflating large vessels to their (gigantic) true
  // on-chart length. At z=18+ the curve hands off to true real-world scale.
  const fillIconSize = useMemo<ExpressionSpecification>(() => [
    "interpolate", ["exponential", 2], ["zoom"],
    10, vesselScaleDamped(COMPRESSED_REF_LOA_M, REF_PX_AT_Z10, COMPRESSION_POWER),
    14, vesselScaleDamped(COMPRESSED_REF_LOA_M, REF_PX_AT_Z14, COMPRESSION_POWER),
    18, vesselScaleAt(18),
    22, vesselScaleAt(22),
  ] as ExpressionSpecification, []);

  // Halo-width scaled with zoom. At low zoom (z10), small vessels need
  // conservative halos to stay within SDF budget. At high zoom (z18+), larger
  // vessels support wider halos for better visibility. Shadow uses
  // SHADOW_HALO_BLUR, symbol uses SYMBOL_HALO_BLUR — both share this width.
  const haloWidth = useMemo<ExpressionSpecification>(() => [
    "interpolate", ["exponential", 2], ["zoom"],
    10, 1.5,
    14, 2,
    18, 5,
    22, 7,
  ] as ExpressionSpecification, []);

  return (
    <>
      <GeoJSONSource id="ais-cog-lines" data={cogLines}>
        <Layer
          id="ais-cog-lines-layer"
          type="line"
          minzoom={MIN_AIS_ZOOM}
          paint={{
            "line-color": theme.ais,
            "line-width": 1.5,
            "line-opacity": 1,
          }}
          layout={{
            "line-cap": "round",
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        id="ais-vessels"
        data={geojson}
        hitbox={{ top: 0, right: 0, bottom: 0, left: 0 }}
        onPress={handlePress}
      >
        <Layer
          id="ais-vessels-shadow"
          type="symbol"
          minzoom={MIN_AIS_ZOOM}
          layout={{
            "icon-image": ["get", "icon"],
            "icon-size": fillIconSize,
            "icon-rotate": ["get", "rotation"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
          paint={{
            "icon-color": theme.shadow,
            "icon-halo-color": theme.shadow,
            "icon-translate": [1, 1],
            "icon-translate-anchor": "viewport",
            "icon-opacity": ["match", ["get", "state"], "stale", 0, "moored", 0.15, 0.5],
            "icon-halo-blur": SHADOW_HALO_BLUR,
            "icon-halo-width": haloWidth,
          }}
        />
        <Layer
          id="ais-vessels-symbol"
          type="symbol"
          minzoom={MIN_AIS_ZOOM}
          layout={{
            "icon-image": ["get", "icon"],
            "icon-size": fillIconSize,
            "icon-rotate": ["get", "rotation"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
          paint={{
            "icon-color": theme.ais,
            "icon-opacity": ["match", ["get", "state"], "stale", 0.2, "moored", 0.4, 1.0],
            "icon-halo-color": theme.contrast,
            "icon-halo-width": haloWidth,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
