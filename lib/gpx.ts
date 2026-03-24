import { XMLBuilder } from "fast-xml-parser";
import type { Track, TrackPoint, Marker, Route, RoutePoint } from "@/lib/database";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  suppressEmptyNode: true,
});

/** Generate GPX 1.1 XML from a track and its points */
export function toGPX(track: Track, points: TrackPoint[]): string {
  const name = track.name || `Track ${track.started_at}`;

  const trkpt = points.map((p) => {
    const point: Record<string, unknown> = {
      "@_lat": p.latitude,
      "@_lon": p.longitude,
      time: p.timestamp,
    };

    if (p.speed != null || p.heading != null) {
      const ext: Record<string, unknown> = {};
      if (p.speed != null) ext.speed = Number(p.speed.toFixed(2));
      if (p.heading != null) ext.course = Number(p.heading.toFixed(1));
      point.extensions = ext;
    }

    return point;
  });

  const gpxObj = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    gpx: {
      "@_version": "1.1",
      "@_creator": "Open Waters",
      "@_xmlns": "http://www.topografix.com/GPX/1/1",
      "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@_xsi:schemaLocation":
        "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
      metadata: {
        name,
        time: track.started_at,
      },
      trk: {
        name,
        trkseg: {
          trkpt,
        },
      },
    },
  };

  return builder.build(gpxObj);
}

/** Generate GPX 1.1 XML for a route and its points */
export function routeToGPX(route: Route, points: RoutePoint[]): string {
  const name = route.name || `Route ${route.id}`;

  const rtept = points.map((p) => ({
    "@_lat": p.latitude,
    "@_lon": p.longitude,
  }));

  const gpxObj = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    gpx: {
      "@_version": "1.1",
      "@_creator": "Open Waters",
      "@_xmlns": "http://www.topografix.com/GPX/1/1",
      "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@_xsi:schemaLocation":
        "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
      metadata: { name, time: route.created_at },
      rte: {
        name,
        rtept,
      },
    },
  };

  return builder.build(gpxObj);
}

/** Generate GPX 1.1 XML for a single marker */
export function markerToGPX(marker: Marker): string {
  const name = marker.name || `Marker ${marker.id}`;

  const wpt: Record<string, unknown> = {
    "@_lat": marker.latitude,
    "@_lon": marker.longitude,
    name,
    time: marker.created_at,
  };
  if (marker.notes) wpt.desc = marker.notes;
  if (marker.icon) wpt.sym = marker.icon;

  const gpxObj = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    gpx: {
      "@_version": "1.1",
      "@_creator": "Open Waters",
      "@_xmlns": "http://www.topografix.com/GPX/1/1",
      "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@_xsi:schemaLocation":
        "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
      metadata: { name, time: marker.created_at },
      wpt,
    },
  };

  return builder.build(gpxObj);
}
