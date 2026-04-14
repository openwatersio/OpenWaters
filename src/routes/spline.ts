/**
 * Catmull-Rom spline interpolation for smoothing coordinate paths.
 * Generates intermediate points between GPS fixes to create smooth curves
 * instead of hard turns at each waypoint.
 */

type Coord = [number, number]; // [lon, lat]

/**
 * Interpolate a Catmull-Rom spline segment between p1 and p2,
 * using p0 and p3 as control points.
 */
function catmullRom(
  p0: Coord,
  p1: Coord,
  p2: Coord,
  p3: Coord,
  t: number,
): Coord {
  const t2 = t * t;
  const t3 = t2 * t;

  return [
    0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

/**
 * Smooth an array of coordinates using Catmull-Rom spline interpolation.
 * @param coords Input coordinates [lon, lat][]
 * @param segments Number of interpolated points per segment (default 4)
 * @returns Smoothed coordinate array (always includes original endpoints)
 */
export function smoothCoordinates(
  coords: Coord[],
  segments = 4,
): Coord[] {
  if (coords.length < 3) return coords;

  const result: Coord[] = [coords[0]];

  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(i - 1, 0)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(i + 2, coords.length - 1)];

    for (let s = 1; s <= segments; s++) {
      result.push(catmullRom(p0, p1, p2, p3, s / segments));
    }
  }

  return result;
}
