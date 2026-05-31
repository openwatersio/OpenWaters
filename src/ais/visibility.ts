/**
 * Minimum map zoom at which AIS targets render and the AIS Stream subscribes.
 * Below this the viewport spans such a large area that the worldwide AIS Stream
 * firehose overwhelms both the map (hundreds of un-culled symbols) and the
 * device (an unbounded vessel store). Local SignalK/NMEA sources are not gated
 * by this — only rendering and the internet AIS Stream subscription are.
 */
export const MIN_AIS_ZOOM = 8;

/** Whether AIS targets should be visible / streaming at the given map zoom. */
export function isAISVisibleAtZoom(zoom: number): boolean {
  return zoom >= MIN_AIS_ZOOM;
}
