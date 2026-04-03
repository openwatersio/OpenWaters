import { Paths, File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getTrack, getTrackPoints, getRoute, getRoutePoints, type Marker } from "@/lib/database";
import { toGPX, markerToGPX, routeToGPX } from "@/lib/gpx";

export async function exportTrackAsGPX(trackId: number): Promise<void> {
  const track = await getTrack(trackId);
  if (!track) throw new Error(`Track ${trackId} not found`);

  const points = await getTrackPoints(trackId);
  const gpx = toGPX(track, points);

  const file = new File(Paths.cache, `track-${trackId}.gpx`);
  file.write(gpx);

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/gpx+xml",
    dialogTitle: "Export Track",
    UTI: "com.topografix.gpx",
  });
}

export async function exportRouteAsGPX(routeId: number): Promise<void> {
  const route = await getRoute(routeId);
  if (!route) throw new Error(`Route ${routeId} not found`);

  const points = await getRoutePoints(routeId);
  const gpx = routeToGPX(route, points);

  const file = new File(Paths.cache, `route-${routeId}.gpx`);
  file.write(gpx);

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/gpx+xml",
    dialogTitle: "Export Route",
    UTI: "com.topografix.gpx",
  });
}

export async function exportMarkerAsGPX(marker: Marker): Promise<void> {
  const gpx = markerToGPX(marker);
  const file = new File(Paths.cache, `marker-${marker.id}.gpx`);
  file.write(gpx);
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/gpx+xml",
    dialogTitle: "Export Marker",
    UTI: "com.topografix.gpx",
  });
}
