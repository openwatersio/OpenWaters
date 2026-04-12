import { LocationObject } from "expo-location";
import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "app.db";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DATABASE_NAME, {
    enableChangeListener: true,
  });
  await migrate(db);
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

  if (currentVersion < 7) {
    // Create new tables (individual statements to avoid nested transaction
    // issues — execAsync with multiple statements auto-wraps in a transaction)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS charts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        catalog_entry_id TEXT
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chart_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT,
        tiles TEXT,
        bounds TEXT,
        minzoom INTEGER,
        maxzoom INTEGER,
        attribution TEXT,
        tile_size INTEGER,
        scheme TEXT,
        FOREIGN KEY (chart_id) REFERENCES charts(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS idx_sources_chart_id ON sources(chart_id);",
    );

    await db.execAsync("PRAGMA user_version = 7;");
  }

  // Seed default charts if the database is empty (first launch)
  const chartCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM charts;",
  );
  if (chartCount?.count === 0) {
    const { default: loadCatalog } = await import("@/catalog");
    const { installCatalogEntry } = await import("@/lib/charts/catalog");
    const defaultIds = new Set(["noaa-raster", "openseamap", "google-earth"]);
    const catalog = await loadCatalog();

    for (const entry of catalog) {
      if (defaultIds.has(entry.id)) {
        await installCatalogEntry(entry);
      }
    }
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
};

export type TrackPoint = {
  id: number;
  track_id: number;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  timestamp: string;
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

export async function endTrack(
  trackId: number,
  distance: number,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE tracks SET ended_at = ?, distance = ? WHERE id = ?",
    new Date().toISOString(),
    distance,
    trackId,
  );
}

export async function insertTrackPoint(
  trackId: number,
  { coords, timestamp }: LocationObject,
): Promise<void> {
  const { latitude, longitude, speed, heading, accuracy } = coords;
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO track_points (track_id, latitude, longitude, speed, heading, accuracy, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    trackId,
    latitude,
    longitude,
    speed,
    heading,
    accuracy,
    new Date(timestamp).toISOString(),
  );
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
  avg_speed: number | null; // m/s
  max_speed: number | null; // m/s
};

export async function getTrackDistances(
  lat: number,
  lng: number,
): Promise<Map<number, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ track_id: number; dist_sq: number }>(
    `SELECT track_id,
       MIN((latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?)) as dist_sq
     FROM track_points
     GROUP BY track_id`,
    lat,
    lat,
    lng,
    lng,
  );
  return new Map(rows.map((r) => [r.track_id, r.dist_sq]));
}

export async function getAllTracksWithStats(): Promise<TrackWithStats[]> {
  const db = await getDatabase();
  return db.getAllAsync<TrackWithStats>(`
    SELECT t.*,
      AVG(tp.speed) as avg_speed,
      MAX(tp.speed) as max_speed
    FROM tracks t
    LEFT JOIN track_points tp ON tp.track_id = t.id AND tp.speed IS NOT NULL
    GROUP BY t.id
    ORDER BY t.started_at DESC
  `);
}

export async function getTrackPoints(trackId: number): Promise<TrackPoint[]> {
  const db = await getDatabase();
  return db.getAllAsync<TrackPoint>(
    "SELECT * FROM track_points WHERE track_id = ? ORDER BY timestamp ASC",
    trackId,
  );
}

export async function deleteTrack(trackId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM track_points WHERE track_id = ?", trackId);
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

export async function getAllMarkers(): Promise<Marker[]> {
  const db = await getDatabase();
  return db.getAllAsync<Marker>(
    "SELECT * FROM markers ORDER BY created_at DESC",
  );
}

export async function updateMarker(
  id: number,
  fields: Partial<
    Pick<Marker, "name" | "notes" | "color" | "icon" | "latitude" | "longitude">
  >,
): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
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

export type RoutesOrder = "recent" | "name" | "distance";

const ROUTES_ORDER_BY: Record<RoutesOrder, string> = {
  recent: "updated_at DESC",
  name: "name COLLATE NOCASE ASC",
  distance: "distance DESC",
};

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
): Promise<Route[]> {
  const db = await getDatabase();
  return db.getAllAsync<Route>(
    `SELECT * FROM routes ORDER BY ${ROUTES_ORDER_BY[order]}`,
  );
}

export async function updateRoute(
  id: number,
  fields: Partial<Pick<Route, "name" | "distance">>,
): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
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
  const db = await getDatabase();
  await db.runAsync("DELETE FROM route_points WHERE route_id = ?", id);
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

// -- Chart operations --

export type ChartRow = {
  id: number;
  name: string;
  catalog_entry_id: string | null;
};

export type SourceRow = {
  id: number;
  chart_id: number;
  title: string;
  type: string;
  url: string | null;
  tiles: string | null;
  bounds: string | null;
  minzoom: number | null;
  maxzoom: number | null;
  attribution: string | null;
  tile_size: number | null;
  scheme: string | null;
};

export async function getAllCharts(): Promise<ChartRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ChartRow>("SELECT * FROM charts ORDER BY id ASC");
}

export async function getChartSources(chartId: number): Promise<SourceRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<SourceRow>(
    "SELECT * FROM sources WHERE chart_id = ? ORDER BY id ASC",
    chartId,
  );
}

export async function getChartWithSources(
  chartId: number,
): Promise<(ChartRow & { sources: SourceRow[] }) | null> {
  const db = await getDatabase();
  const chart = await db.getFirstAsync<ChartRow>(
    "SELECT * FROM charts WHERE id = ?",
    chartId,
  );
  if (!chart) return null;
  const sources = await db.getAllAsync<SourceRow>(
    "SELECT * FROM sources WHERE chart_id = ? ORDER BY id ASC",
    chartId,
  );
  return { ...chart, sources };
}

export async function getAllChartsWithSources(): Promise<
  (ChartRow & { sources: SourceRow[] })[]
> {
  const db = await getDatabase();
  const charts = await db.getAllAsync<ChartRow>(
    "SELECT * FROM charts ORDER BY id ASC",
  );
  const sources = await db.getAllAsync<SourceRow>(
    "SELECT * FROM sources ORDER BY chart_id ASC, id ASC",
  );

  const sourcesByChart = new Map<number, SourceRow[]>();
  for (const s of sources) {
    const list = sourcesByChart.get(s.chart_id) ?? [];
    list.push(s);
    sourcesByChart.set(s.chart_id, list);
  }

  return charts.map((c) => ({
    ...c,
    sources: sourcesByChart.get(c.id) ?? [],
  }));
}

export async function insertChart(
  name: string,
  catalogEntryId?: string,
): Promise<ChartRow> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO charts (name, catalog_entry_id) VALUES (?, ?)",
    name,
    catalogEntryId ?? null,
  );
  const row = await db.getFirstAsync<ChartRow>(
    "SELECT * FROM charts WHERE id = ?",
    result.lastInsertRowId,
  );
  return row!;
}

export async function insertSource(
  chartId: number,
  fields: {
    title: string;
    type: string;
    url?: string | null;
    tiles?: string[] | null;
    bounds?: number[] | null;
    minzoom?: number | null;
    maxzoom?: number | null;
    attribution?: string | null;
    tileSize?: number | null;
    scheme?: string | null;
  },
): Promise<SourceRow> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO sources (chart_id, title, type, url, tiles, bounds, minzoom, maxzoom, attribution, tile_size, scheme)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    chartId,
    fields.title,
    fields.type,
    fields.url ?? null,
    fields.tiles ? JSON.stringify(fields.tiles) : null,
    fields.bounds ? JSON.stringify(fields.bounds) : null,
    fields.minzoom ?? null,
    fields.maxzoom ?? null,
    fields.attribution ?? null,
    fields.tileSize ?? null,
    fields.scheme ?? null,
  );
  const row = await db.getFirstAsync<SourceRow>(
    "SELECT * FROM sources WHERE id = ?",
    result.lastInsertRowId,
  );
  return row!;
}

export async function updateChart(
  id: number,
  fields: Partial<Pick<ChartRow, "name">>,
): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClauses = entries.map(([k]) => `${k} = ?`).join(", ");
  const values = entries.map(([, v]) => v);
  await db.runAsync(
    `UPDATE charts SET ${setClauses} WHERE id = ?`,
    ...values,
    id,
  );
}

export async function deleteChart(id: number): Promise<void> {
  const { deleteMBTilesFile } = await import("@/lib/charts/mbtiles");
  const db = await getDatabase();

  // Clean up local MBTiles files before cascade-deleting sources
  const sources = await db.getAllAsync<SourceRow>(
    "SELECT * FROM sources WHERE chart_id = ?",
    id,
  );
  for (const source of sources) {
    if (source.type === "mbtiles" && source.url) {
      try {
        deleteMBTilesFile(source.url);
      } catch {
        // Proceed with delete even if file cleanup fails
      }
    }
  }

  await db.runAsync("DELETE FROM charts WHERE id = ?", id);
}
