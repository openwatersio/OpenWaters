import { LocationObject } from "expo-location";
import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "app.db";

// Single in-flight initialization promise. All concurrent callers of
// getDatabase() await the same promise, preventing duplicate migration
// connections and racing ALTER TABLE statements.
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!initPromise) {
    initPromise = initDatabase().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/** Close the open database connection so it can be deleted. */
export async function closeDatabase(): Promise<void> {
  if (!initPromise) return;
  const db = await initPromise;
  initPromise = null;
  await db.closeAsync();
}

/**
 * Run PRAGMA optimize to update query planner statistics for tables
 * whose data has changed significantly. Call after bulk writes (e.g.,
 * import completion) rather than at close time, since iOS kills apps
 * without warning and closeDatabase rarely runs.
 */
export async function optimizeDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA analysis_limit = 400;
    PRAGMA optimize;
  `);
}

async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Run migrations on a connection without change listeners — schema changes
  // that rebuild tables (DROP/RENAME) fail with "database table is locked"
  // when the change-listener session holds references.
  const migrationDb = await SQLite.openDatabaseAsync(DATABASE_NAME);
  try {
    await migrate(migrationDb);
  } finally {
    await migrationDb.closeAsync();
  }
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME, {
    enableChangeListener: true,
  });
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const { user_version: currentVersion } = (await db.getFirstAsync<{
    user_version: number;
  }>("PRAGMA user_version")) ?? { user_version: 0 };

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        distance REAL NOT NULL DEFAULT 0,
        color TEXT
      );

      CREATE TABLE IF NOT EXISTS track_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        speed REAL,
        heading REAL,
        accuracy REAL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_track_points_track_id
        ON track_points(track_id);

      CREATE TABLE IF NOT EXISTS markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        notes TEXT,
        color TEXT,
        icon TEXT,
        created_at TEXT NOT NULL
      );

      PRAGMA user_version = 1;
    `);
  }

  if (currentVersion < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS route_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id INTEGER NOT NULL,
        "order" INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        name TEXT,
        FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_route_points_route_id
        ON route_points(route_id);

      PRAGMA user_version = 2;
    `);
  }

  if (currentVersion < 4) {
    const columns = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(routes)",
    );
    if (!columns.some((c) => c.name === "distance")) {
      await db.execAsync(
        "ALTER TABLE routes ADD COLUMN distance REAL NOT NULL DEFAULT 0;",
      );
    }
    // Intentionally ignore DROP COLUMN errors (e.g. column already absent
    // or SQLite version doesn't support DROP COLUMN).
    await db
      .execAsync("ALTER TABLE route_points DROP COLUMN name;")
      .catch(() => {});
    await db.execAsync("PRAGMA user_version = 4;");
  }

  // Migrations 7–8 created and then removed the charts + sources tables.
  // Charts are now stored as style files on disk (see lib/charts/store.ts).
  // The next migration should use version 9.
  if (currentVersion < 8) {
    await db.execAsync("PRAGMA user_version = 8;");
  }

  // Add track_points.sequence so imported tracks without timestamps can still
  // be ordered. Make timestamp nullable since GPX <time> is optional. SQLite
  // can't DROP NOT NULL in-place, so we rebuild the table. Order backfill uses
  // ROW_NUMBER() over (track_id, timestamp, id) during the copy. The DROP+
  // RENAME sequence requires change listeners to be paused, otherwise their
  // internal triggers keep the old table open and we hit "table is locked".
  if (currentVersion < 9) {
    await db.execAsync(`
      DROP TABLE IF EXISTS track_points_new;
      CREATE TABLE track_points_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id INTEGER NOT NULL,
        sequence INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        speed REAL,
        heading REAL,
        accuracy REAL,
        timestamp TEXT,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );
      INSERT INTO track_points_new (id, track_id, sequence, latitude, longitude, speed, heading, accuracy, timestamp)
        SELECT id, track_id,
               ROW_NUMBER() OVER (PARTITION BY track_id ORDER BY timestamp, id) - 1 AS sequence,
               latitude, longitude, speed, heading, accuracy, timestamp
        FROM track_points;
      DROP TABLE track_points;
      ALTER TABLE track_points_new RENAME TO track_points;
      CREATE INDEX IF NOT EXISTS idx_track_points_track_id ON track_points(track_id);
      CREATE INDEX IF NOT EXISTS idx_track_points_track_seq ON track_points(track_id, sequence);
      PRAGMA user_version = 9;
    `);
  }

  if (currentVersion < 10) {
    await db.execAsync(`
      ALTER TABLE tracks ADD COLUMN max_speed REAL;
      UPDATE tracks SET max_speed = (
        SELECT MAX(speed) FROM track_points
        WHERE track_id = tracks.id AND speed IS NOT NULL
      );
      PRAGMA user_version = 10;
    `);
  }
}

// -- Track operations --

export type Track = {
  id: number;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  distance: number;
  color: string | null;
  max_speed: number | null; // m/s — cached at endTrack / insertTrack time
};

export type TrackPoint = {
  id: number;
  track_id: number;
  sequence: number;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  timestamp: string | null;
};

export type TrackPointFields = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  timestamp?: string | null;
};

export async function startTrack(): Promise<Track> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO tracks (started_at) VALUES (?)",
    new Date().toISOString(),
  );
  const track = await db.getFirstAsync<Track>(
    "SELECT * FROM tracks WHERE id = ?",
    result.lastInsertRowId,
  );
  return track!;
}

/**
 * Check if a track with the same started_at and ended_at already exists.
 * Falls back to first/last point comparison when timestamps are null.
 */
export async function findDuplicateTrack(
  startedAt: string | null,
  endedAt: string | null,
  points: { latitude: number; longitude: number }[],
): Promise<Track | null> {
  const db = await getDatabase();
  if (startedAt && endedAt) {
    return db.getFirstAsync<Track>(
      "SELECT * FROM tracks WHERE started_at = ? AND ended_at = ?",
      startedAt,
      endedAt,
    );
  }
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return db.getFirstAsync<Track>(
    `SELECT t.* FROM tracks t
     JOIN track_points tp_first ON tp_first.track_id = t.id AND tp_first.sequence = 0
     JOIN track_points tp_last ON tp_last.track_id = t.id
       AND tp_last.sequence = (SELECT MAX(sequence) FROM track_points WHERE track_id = t.id)
     WHERE tp_first.latitude = ? AND tp_first.longitude = ?
       AND tp_last.latitude = ? AND tp_last.longitude = ?`,
    first.latitude,
    first.longitude,
    last.latitude,
    last.longitude,
  );
}

/**
 * Insert a pre-existing track (e.g., from GPX import) with an explicit
 * name/start/end. `distance` is computed by the caller.
 */
export async function insertTrack(fields: {
  name?: string | null;
  started_at: string;
  ended_at?: string | null;
  distance?: number;
}): Promise<Track> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO tracks (name, started_at, ended_at, distance) VALUES (?, ?, ?, ?)",
    fields.name ?? null,
    fields.started_at,
    fields.ended_at ?? null,
    fields.distance ?? 0,
  );
  const track = await db.getFirstAsync<Track>(
    "SELECT * FROM tracks WHERE id = ?",
    result.lastInsertRowId,
  );
  return track!;
}

export async function endTrack(
  trackId: number,
  distance: number,
  maxSpeed: number | null = null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE tracks SET ended_at = ?, distance = ?, max_speed = ? WHERE id = ?",
    new Date().toISOString(),
    distance,
    maxSpeed,
    trackId,
  );
}

export async function insertTrackPoint(
  trackId: number,
  { coords, timestamp }: LocationObject,
): Promise<TrackPoint> {
  const { latitude, longitude, speed, heading, accuracy } = coords;
  const db = await getDatabase();
  const isoTimestamp = new Date(timestamp).toISOString();
  const sequence = await nextSequence(db, trackId);
  const result = await db.runAsync(
    `INSERT INTO track_points (track_id, sequence, latitude, longitude, speed, heading, accuracy, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    trackId,
    sequence,
    latitude,
    longitude,
    speed,
    heading,
    accuracy,
    isoTimestamp,
  );
  return {
    id: result.lastInsertRowId,
    track_id: trackId,
    sequence,
    latitude,
    longitude,
    speed,
    heading,
    accuracy,
    timestamp: isoTimestamp,
  };
}

async function nextSequence(
  db: SQLite.SQLiteDatabase,
  trackId: number,
): Promise<number> {
  const row = await db.getFirstAsync<{ next: number }>(
    "SELECT COALESCE(MAX(sequence), -1) + 1 AS next FROM track_points WHERE track_id = ?",
    trackId,
  );
  return row?.next ?? 0;
}

/**
 * Bulk-insert track points using a prepared multi-row INSERT. Each
 * executeAsync call inserts 4000 rows (32000 params), reusing a single
 * prepared statement. The remainder chunk passes its values as an array
 * (not spread) to avoid call-stack overflow from 32000+ function args.
 */
export async function insertTrackPoints(
  trackId: number,
  points: TrackPointFields[],
): Promise<void> {
  if (points.length === 0) return;
  const db = await getDatabase();
  const startSeq = await nextSequence(db, trackId);
  const CHUNK = 4000;
  const COLS = 8;
  const INSERT_PREFIX =
    "INSERT INTO track_points (track_id, sequence, latitude, longitude, speed, heading, accuracy, timestamp) VALUES ";

  function buildValues(
    offset: number,
    count: number,
  ): (string | number | null)[] {
    const values: (string | number | null)[] = new Array(count * COLS);
    for (let i = 0; i < count; i++) {
      const p = points[offset + i];
      const base = i * COLS;
      values[base] = trackId;
      values[base + 1] = startSeq + offset + i;
      values[base + 2] = p.latitude;
      values[base + 3] = p.longitude;
      values[base + 4] = p.speed ?? null;
      values[base + 5] = p.heading ?? null;
      values[base + 6] = p.accuracy ?? null;
      values[base + 7] = p.timestamp ?? null;
    }
    return values;
  }

  const fullChunks = Math.floor(points.length / CHUNK);
  const remainder = points.length % CHUNK;

  if (fullChunks > 0) {
    const placeholders = Array(CHUNK)
      .fill("(?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");
    const stmt = await db.prepareAsync(`${INSERT_PREFIX}${placeholders}`);
    try {
      for (let i = 0; i < fullChunks; i++) {
        await stmt.executeAsync(buildValues(i * CHUNK, CHUNK));
      }
    } finally {
      await stmt.finalizeAsync();
    }
  }

  if (remainder > 0) {
    const offset = fullChunks * CHUNK;
    const placeholders = Array(remainder)
      .fill("(?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");
    await db.runAsync(
      `${INSERT_PREFIX}${placeholders}`,
      buildValues(offset, remainder),
    );
  }
}

export async function getTrack(trackId: number): Promise<Track | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Track>("SELECT * FROM tracks WHERE id = ?", trackId);
}

export async function getAllTracks(): Promise<Track[]> {
  const db = await getDatabase();
  return db.getAllAsync<Track>("SELECT * FROM tracks ORDER BY started_at DESC");
}

export type TrackWithStats = Track & {
  avg_speed: number | null; // m/s — computed in SQL from distance/duration
};

export type TracksOrder = "date" | "distance" | "duration" | "speed" | "nearby";

// Seconds elapsed between started_at and ended_at (or "now" if still
// recording). Used to compute avg_speed and to sort by duration. The outer
// parens matter: SQL's `/` and `*` share precedence and are left-associative,
// so without them `distance / DURATION_SECONDS_SQL` parses as
// `(distance / days) * 86400` — a factor-of-86400² error.
const DURATION_SECONDS_SQL =
  "((julianday(COALESCE(t.ended_at, datetime('now'))) - julianday(t.started_at)) * 86400.0)";

// avg_speed = distance / duration. NULL when distance is 0 so the UI can
// render "—" instead of a meaningless 0.
const AVG_SPEED_SQL = `CASE WHEN t.distance > 0 AND ${DURATION_SECONDS_SQL} > 0
    THEN t.distance / ${DURATION_SECONDS_SQL}
    ELSE NULL END`;

export async function getAllTracksWithStats(
  order: TracksOrder = "date",
  position?: { latitude: number; longitude: number } | null,
): Promise<TrackWithStats[]> {
  const db = await getDatabase();

  if (order === "nearby" && position) {
    // Min squared planar distance from any track_point to the user. Tracks
    // with no points sort to the end via COALESCE → 1e308. This is the one
    // sort that still needs to touch track_points; revisit with a bbox
    // cached on the track row if it becomes a bottleneck.
    return db.getAllAsync<TrackWithStats>(
      `SELECT t.*,
         ${AVG_SPEED_SQL} as avg_speed,
         COALESCE(MIN((tp.latitude - ?) * (tp.latitude - ?)
                    + (tp.longitude - ?) * (tp.longitude - ?)), 1e308) as dist_sq
       FROM tracks t
       LEFT JOIN track_points tp ON tp.track_id = t.id
       GROUP BY t.id
       ORDER BY dist_sq ASC`,
      position.latitude,
      position.latitude,
      position.longitude,
      position.longitude,
    );
  }

  const effectiveOrder = order === "nearby" ? "date" : order;
  const orderBy = {
    date: "t.started_at DESC",
    distance: "t.distance DESC",
    duration: `${DURATION_SECONDS_SQL} DESC`,
    speed: "avg_speed DESC",
  }[effectiveOrder];

  return db.getAllAsync<TrackWithStats>(`
    SELECT t.*, ${AVG_SPEED_SQL} as avg_speed
    FROM tracks t
    ORDER BY ${orderBy}
  `);
}

export async function getTrackPoints(trackId: number): Promise<TrackPoint[]> {
  const db = await getDatabase();
  return db.getAllAsync<TrackPoint>(
    "SELECT * FROM track_points WHERE track_id = ? ORDER BY sequence ASC",
    trackId,
  );
}

export async function deleteTrack(trackId: number): Promise<void> {
  // track_points are removed by ON DELETE CASCADE (PRAGMA foreign_keys = ON).
  const db = await getDatabase();
  await db.runAsync("DELETE FROM tracks WHERE id = ?", trackId);
}

export async function renameTrack(
  trackId: number,
  name: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE tracks SET name = ? WHERE id = ?", name, trackId);
}

export type SpeedStats = {
  avgSpeed: number;
  maxSpeed: number;
};

// -- Marker operations --

export type Marker = {
  id: number;
  name: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  color: string | null;
  icon: string | null;
  created_at: string;
};

export type MarkerFields = {
  latitude: number;
  longitude: number;
  name?: string | null;
  notes?: string | null;
  color?: string | null;
  icon?: string | null;
};

/** Check if a marker with the same name and coordinates already exists. */
export async function findDuplicateMarker(
  fields: MarkerFields,
): Promise<Marker | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Marker>(
    "SELECT * FROM markers WHERE name IS ? AND latitude = ? AND longitude = ?",
    fields.name ?? null,
    fields.latitude,
    fields.longitude,
  );
}

export async function insertMarker(fields: MarkerFields): Promise<Marker> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO markers (latitude, longitude, name, notes, color, icon, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    fields.latitude,
    fields.longitude,
    fields.name ?? null,
    fields.notes ?? null,
    fields.color ?? null,
    fields.icon ?? null,
    new Date().toISOString(),
  );
  const marker = await db.getFirstAsync<Marker>(
    "SELECT * FROM markers WHERE id = ?",
    result.lastInsertRowId,
  );
  return marker!;
}

export async function getMarker(id: number): Promise<Marker | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Marker>("SELECT * FROM markers WHERE id = ?", id);
}

export type MarkersOrder = "created" | "name" | "nearby";

export async function getAllMarkers(
  order: MarkersOrder = "created",
  position?: { latitude: number; longitude: number } | null,
  bounds?: Readonly<[number, number, number, number]>,
): Promise<Marker[]> {
  const db = await getDatabase();

  // "nearby" without a position falls back to default ordering — keeps
  // call sites simple when the GPS hasn't reported in yet.
  if (order === "nearby" && position) {
    if (!bounds) {
      // Squared planar distance is fine for sorting — we never compare across
      // wildly different latitudes and we never need true distance here.
      return db.getAllAsync<Marker>(
        `SELECT *,
           (latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?) as dist_sq
         FROM markers
         ORDER BY dist_sq ASC`,
        position.latitude,
        position.latitude,
        position.longitude,
        position.longitude,
      );
    }

    const [west, south, east, north] = bounds;
    // Squared planar distance is fine for sorting — we never compare across
    // wildly different latitudes and we never need true distance here.
    return db.getAllAsync<Marker>(
      `SELECT *,
         (latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?) as dist_sq
       FROM markers
       WHERE longitude >= ? AND longitude <= ? AND latitude >= ? AND latitude <= ?
       ORDER BY dist_sq ASC`,
      position.latitude,
      position.latitude,
      position.longitude,
      position.longitude,
      west,
      east,
      south,
      north,
    );
  }

  if (order === "name") {
    if (!bounds) {
      return db.getAllAsync<Marker>(
        "SELECT * FROM markers ORDER BY COALESCE(name, '') ASC, created_at DESC",
      );
    }

    const [west, south, east, north] = bounds;
    return db.getAllAsync<Marker>(
      `SELECT * FROM markers
       WHERE longitude >= ? AND longitude <= ? AND latitude >= ? AND latitude <= ?
       ORDER BY COALESCE(name, '') ASC, created_at DESC`,
      west,
      east,
      south,
      north,
    );
  }

  if (!bounds) {
    return db.getAllAsync<Marker>(
      "SELECT * FROM markers ORDER BY created_at DESC",
    );
  }

  const [west, south, east, north] = bounds;

  return db.getAllAsync<Marker>(
    `SELECT * FROM markers
     WHERE longitude >= ? AND longitude <= ? AND latitude >= ? AND latitude <= ?
     ORDER BY created_at DESC`,
    west,
    east,
    south,
    north,
  );
}

const MARKER_COLUMNS = new Set<string>(["name", "notes", "color", "icon", "latitude", "longitude"]);

export async function updateMarker(
  id: number,
  fields: Partial<
    Pick<Marker, "name" | "notes" | "color" | "icon" | "latitude" | "longitude">
  >,
): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(fields).filter(
    ([k, v]) => MARKER_COLUMNS.has(k) && v !== undefined,
  );
  if (entries.length === 0) return;
  const setClauses = entries.map(([k]) => `${k} = ?`).join(", ");
  const values = entries.map(([, v]) => v);
  await db.runAsync(
    `UPDATE markers SET ${setClauses} WHERE id = ?`,
    ...values,
    id,
  );
}

export async function deleteMarker(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM markers WHERE id = ?", id);
}

// -- Route operations --

export type Route = {
  id: number;
  name: string | null;
  created_at: string;
  updated_at: string;
  distance: number; // meters
};

export type RoutePoint = {
  id: number;
  route_id: number;
  order: number;
  latitude: number;
  longitude: number;
};

export type RoutesOrder = "recent" | "name" | "distance" | "nearby";

const ROUTES_ORDER_BY: Record<Exclude<RoutesOrder, "nearby">, string> = {
  recent: "updated_at DESC",
  name: "name COLLATE NOCASE ASC",
  distance: "distance DESC",
};

/**
 * Check if a route with the same name, first/last points, and point count
 * already exists.
 */
export async function findDuplicateRoute(
  name: string | null,
  points: { latitude: number; longitude: number }[],
): Promise<Route | null> {
  if (points.length === 0) return null;
  const db = await getDatabase();
  const first = points[0];
  const last = points[points.length - 1];
  return db.getFirstAsync<Route>(
    `SELECT r.* FROM routes r
     JOIN route_points rp_first ON rp_first.route_id = r.id AND rp_first."order" = 0
     JOIN route_points rp_last ON rp_last.route_id = r.id
       AND rp_last."order" = (SELECT MAX("order") FROM route_points WHERE route_id = r.id)
     WHERE r.name IS ?
       AND rp_first.latitude = ? AND rp_first.longitude = ?
       AND rp_last.latitude = ? AND rp_last.longitude = ?
       AND (SELECT COUNT(*) FROM route_points WHERE route_id = r.id) = ?`,
    name ?? null,
    first.latitude,
    first.longitude,
    last.latitude,
    last.longitude,
    points.length,
  );
}

export async function insertRoute(name?: string): Promise<Route> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    "INSERT INTO routes (name, created_at, updated_at) VALUES (?, ?, ?)",
    name ?? null,
    now,
    now,
  );
  const route = await db.getFirstAsync<Route>(
    "SELECT * FROM routes WHERE id = ?",
    result.lastInsertRowId,
  );
  return route!;
}

export async function getRoute(id: number): Promise<Route | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Route>("SELECT * FROM routes WHERE id = ?", id);
}

export async function getAllRoutes(
  order: RoutesOrder = "recent",
  position?: { latitude: number; longitude: number } | null,
): Promise<Route[]> {
  const db = await getDatabase();

  if (order === "nearby" && position) {
    // Min squared planar distance from any route_point to the user. Routes
    // with no points sort to the end via COALESCE -> 1e308.
    return db.getAllAsync<Route>(
      `SELECT r.*,
         COALESCE(MIN((rp.latitude - ?) * (rp.latitude - ?)
                    + (rp.longitude - ?) * (rp.longitude - ?)), 1e308) as dist_sq
       FROM routes r
       LEFT JOIN route_points rp ON rp.route_id = r.id
       GROUP BY r.id
       ORDER BY dist_sq ASC`,
      position.latitude,
      position.latitude,
      position.longitude,
      position.longitude,
    );
  }

  const orderBy = ROUTES_ORDER_BY[order as Exclude<RoutesOrder, "nearby">];
  return db.getAllAsync<Route>(`SELECT * FROM routes ORDER BY ${orderBy}`);
}

const ROUTE_COLUMNS = new Set<string>(["name", "distance"]);

export async function updateRoute(
  id: number,
  fields: Partial<Pick<Route, "name" | "distance">>,
): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(fields).filter(
    ([k, v]) => ROUTE_COLUMNS.has(k) && v !== undefined,
  );
  if (entries.length === 0) return;
  const setClauses = [
    ...entries.map(([k]) => `${k} = ?`),
    "updated_at = ?",
  ].join(", ");
  const values = entries.map(([, v]) => v);
  await db.runAsync(
    `UPDATE routes SET ${setClauses} WHERE id = ?`,
    ...values,
    new Date().toISOString(),
    id,
  );
}

export async function deleteRoute(id: number): Promise<void> {
  // route_points are removed by ON DELETE CASCADE (PRAGMA foreign_keys = ON).
  const db = await getDatabase();
  await db.runAsync("DELETE FROM routes WHERE id = ?", id);
}

export async function getRoutePoints(routeId: number): Promise<RoutePoint[]> {
  const db = await getDatabase();
  return db.getAllAsync<RoutePoint>(
    'SELECT * FROM route_points WHERE route_id = ? ORDER BY "order" ASC',
    routeId,
  );
}

/**
 * Replaces all points for a route in a single transaction. Deletes existing
 * points and bulk-inserts the new set, then bumps `routes.updated_at`.
 */
export async function replaceRoutePoints(
  routeId: number,
  points: { latitude: number; longitude: number }[],
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM route_points WHERE route_id = ?", routeId);
    for (let i = 0; i < points.length; i++) {
      await db.runAsync(
        `INSERT INTO route_points (route_id, "order", latitude, longitude)
         VALUES (?, ?, ?, ?)`,
        routeId,
        i,
        points[i].latitude,
        points[i].longitude,
      );
    }
    await db.runAsync(
      "UPDATE routes SET updated_at = ? WHERE id = ?",
      new Date().toISOString(),
      routeId,
    );
  });
}

export async function getAllTimeSpeedStats(): Promise<SpeedStats> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ avg_speed: number; max_speed: number }>(
    `SELECT COALESCE(AVG(speed), 0) as avg_speed, COALESCE(MAX(speed), 0) as max_speed
     FROM track_points tp
     JOIN tracks t ON tp.track_id = t.id
     WHERE tp.speed IS NOT NULL AND t.ended_at IS NOT NULL`,
  );
  return {
    avgSpeed: row?.avg_speed ?? 0,
    maxSpeed: row?.max_speed ?? 0,
  };
}

// -- Chart operations removed --
// Charts are now stored as style.json files on disk.
// See lib/charts/store.ts and lib/charts/install.ts.
