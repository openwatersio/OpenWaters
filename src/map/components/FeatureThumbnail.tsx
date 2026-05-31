import { geometryBounds } from "@/geo";
import { cameraViewState } from "@/map/hooks/useCameraView";
import {
  StaticMapImageManager,
  type StyleSpecification,
} from "@maplibre/maplibre-react-native";
import { SymbolView } from "expo-symbols";
import type { Feature } from "geojson";
import { useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

/** Fallback zoom when the live chart zoom isn't available yet. */
const FRAME_ZOOM = 16;
/** Cap concurrent snapshotters so a list of rows doesn't spawn one renderer
 *  each at mount. Snapshots are cached, so this only bounds the first paint. */
const MAX_CONCURRENT = 3;

type Props = {
  /** The chart style to render the feature(s) with (e.g. the selected chart). */
  style: StyleSpecification | null;
  /** Cache discriminator for the style (the chart id) — feature ids overlap
   *  across charts, so snapshots must not be shared between them. */
  styleKey?: string;
  features: Feature[] | null;
  size?: number;
  /** Override for the geometry-based fallback symbol. */
  icon?: SFSymbol;
};

type SnapshotOptions = {
  mapStyle: object;
  center: [number, number];
  zoom: number;
  width: number;
  height: number;
  output: "file";
  logo: boolean;
};

// --- Snapshot cache + concurrency gate (module-wide) ---------------------------
// Each unique feature/group is rendered to a PNG once via MapLibre's off-screen
// snapshotter and reused; the list then shows cheap <Image>s instead of N live
// GL maps (which made scrolling unusable).

const snapshotCache = new Map<string, Promise<string>>();
let activeSnapshots = 0;
const snapshotQueue: (() => void)[] = [];

function pumpQueue() {
  while (activeSnapshots < MAX_CONCURRENT && snapshotQueue.length > 0) {
    activeSnapshots++;
    snapshotQueue.shift()!();
  }
}

function toUri(path: string): string {
  return path.startsWith("file://") || path.startsWith("data:")
    ? path
    : `file://${path}`;
}

function getSnapshot(key: string, options: SnapshotOptions): Promise<string> {
  const cached = snapshotCache.get(key);
  if (cached) return cached;

  const promise = new Promise<string>((resolve, reject) => {
    snapshotQueue.push(() => {
      StaticMapImageManager.createImage(options)
        .then((path) => resolve(toUri(path)), reject)
        .finally(() => {
          activeSnapshots--;
          pumpQueue();
        });
    });
    pumpQueue();
  });
  // Evict failed snapshots (e.g. tiles not cached yet) so a later mount retries.
  promise.catch(() => snapshotCache.delete(key));
  snapshotCache.set(key, promise);
  return promise;
}

/** SF Symbol for the no-snapshot fallback, chosen by geometry type. */
function fallbackIcon(features: Feature[] | null, override?: SFSymbol): SFSymbol {
  if (override) return override;
  switch (features?.[0]?.geometry?.type) {
    case "LineString":
    case "MultiLineString":
      return "line.diagonal";
    case "Polygon":
    case "MultiPolygon":
      return "square.dashed";
    default:
      return "mappin";
  }
}

/**
 * A legacy filter selecting the given features, schema-free where possible.
 * Prefers the vector-tile feature `id` (works for any source that emits ids),
 * falling back to the S-57 `LNAM` property. Returns null when neither is
 * available on every feature, so the caller shows the geometry fallback.
 *
 * The `id` is a per-tile index — fine here because we snapshot the *current*
 * view at the *query* zoom, the same tile the ids came from.
 */
function isolationFilter(features: Feature[]): unknown[] | null {
  const ids = features
    .map((f) => f.id)
    .filter((id): id is string | number => id !== undefined && id !== null);
  if (ids.length === features.length) return ["in", "$id", ...ids];

  const lnams = features
    .map((f) => f.properties?.LNAM)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  if (lnams.length === features.length) return ["in", "LNAM", ...lnams];

  return null;
}

/**
 * Renders a thumbnail of one or more chart features as a static image, by
 * reusing the given chart `style` — its real vector-tile source and symbology —
 * with every feature layer restricted to the target features, so only those
 * draw (the rest of the chart is hidden) and a group (a buoy with its light and
 * daymark) renders together exactly as on the chart.
 *
 * The image is produced by MapLibre's off-screen snapshotter and cached, so the
 * list renders plain `<Image>`s rather than live maps. Centred on the
 * feature(s) at the chart's current zoom. When the feature(s) can't be isolated
 * (no id/LNAM) or the snapshot fails, shows an SF Symbol chosen by geometry.
 * Relies on the area's tiles being cached — true while the chart is being
 * viewed.
 */
export default function FeatureThumbnail({
  style,
  styleKey,
  features,
  size = 36,
  icon,
}: Props) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fallbackSize = Math.ceil(size * 0.6);
  // The chart's current zoom, so the symbol matches what's on screen and the
  // feature ids match the tile they were queried from (don't round — that could
  // cross a tile-zoom boundary and break id matching).
  const zoom = cameraViewState.zoom || FRAME_ZOOM;

  const request = useMemo(() => {
    try {
      const renderable = (features ?? []).filter(
        (f): f is Feature =>
          !!f?.geometry && f.geometry.type !== "GeometryCollection",
      );
      if (!style || renderable.length === 0) return null;

      const filter = isolationFilter(renderable);
      if (!filter) return null; // can't isolate → geometry fallback

      // Keep the style's vector source(s) and feature layers, restricting each
      // to our features; drop background/raster/hillshade so the rest is
      // transparent. The style's filters compose with ours via legacy `all`.
      const layers = (style.layers ?? [])
        .filter(
          (layer) =>
            layer.type !== "background" &&
            layer.type !== "raster" &&
            layer.type !== "hillshade",
        )
        .map((layer) => {
          const { filter: existing, ...rest } = layer as Record<
            string,
            unknown
          >;
          return {
            ...rest,
            filter: existing ? ["all", existing, filter] : filter,
          };
        });
      const mapStyle = { ...style, layers };

      // Centre on the features' bounds centre.
      let combined: [number, number, number, number] | null = null;
      for (const f of renderable) {
        const b = geometryBounds(f.geometry);
        if (!b) continue;
        combined = combined
          ? [
            Math.min(combined[0], b[0]),
            Math.min(combined[1], b[1]),
            Math.max(combined[2], b[2]),
            Math.max(combined[3], b[3]),
          ]
          : b;
      }
      if (!combined) return null;
      const center: [number, number] = [
        (combined[0] + combined[2]) / 2,
        (combined[1] + combined[3]) / 2,
      ];

      const options: SnapshotOptions = {
        mapStyle,
        center,
        zoom,
        width: size,
        height: size,
        output: "file",
        logo: false,
      };
      const key = `${styleKey ?? ""}|${size}|${zoom}|${JSON.stringify(filter)}`;
      return { key, options };
    } catch {
      return null;
    }
  }, [style, styleKey, features, zoom, size]);

  const key = request?.key;
  useEffect(() => {
    if (!request) {
      // Reset when there's nothing to render; the snapshot fetch below must
      // stay synchronous. RC healthcheck compiles this cleanly.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUri(null);
      return;
    }
    let active = true;
    setFailed(false);
    setUri(null);
    getSnapshot(request.key, request.options).then(
      (u) => active && setUri(u),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
    // request is derived from key; depending on key avoids re-running per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Can't build a request, or the snapshot failed — SF Symbol by geometry.
  if (!request || failed) {
    return (
      <SymbolView
        name={fallbackIcon(features, icon)}
        size={fallbackSize}
        tintColor="blue"
        style={{ width: size, height: size }}
      />
    );
  }

  // Blank (no fallback flash) until the snapshot is ready.
  if (!uri) return <View style={{ width: size, height: size }} />;

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: 4 }}
    />
  );
}
