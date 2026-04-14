import { updateAISVessel } from "@/ais/hooks/useAIS";
import { updateAtoN } from "@/aton/hooks/useAtoN";
import { type DataPoint, updatePaths } from "@/instruments/hooks/useInstruments";
import { updateFromSignalK } from "@/navigation/hooks/useNavigation";

/** Signal K server endpoint discovery response */
type SignalKDiscovery = {
  endpoints: {
    v1: {
      version: string;
      "signalk-http": string;
      "signalk-ws": string;
    };
  };
  server: {
    id: string;
    version: string;
  };
};

/** Signal K delta message */
type SignalKDelta = {
  context?: string;
  updates: {
    timestamp: string;
    source?: { label?: string; type?: string };
    values: {
      path: string;
      value: unknown;
    }[];
  }[];
};

/** Subscription request sent over WebSocket */
type SignalKSubscription = {
  context: string;
  subscribe: {
    path: string;
    period?: number;
    policy?: "instant" | "ideal" | "fixed";
  }[];
};

export type SignalKEndpoints = {
  httpUrl: string;
  wsUrl: string;
  version: string;
  serverId: string;
  serverVersion: string;
};

export type SignalKClientState = "disconnected" | "connecting" | "connected";

export type SignalKClientOptions = {
  onStateChange?: (state: SignalKClientState) => void;
  onError?: (error: string) => void;
};

const MAX_BACKOFF = 30_000;
const INITIAL_BACKOFF = 1_000;

/** Discover Signal K server endpoints from a base URL */
export async function discoverEndpoints(
  baseUrl: string,
): Promise<SignalKEndpoints> {
  const url = baseUrl.replace(/\/$/, "");
  const response = await fetch(`${url}/signalk`);
  if (!response.ok) {
    throw new Error(`Signal K discovery failed: ${response.status}`);
  }
  const data: SignalKDiscovery = await response.json();
  const v1 = data.endpoints.v1;
  return {
    httpUrl: v1["signalk-http"],
    wsUrl: v1["signalk-ws"],
    version: v1.version,
    serverId: data.server.id,
    serverVersion: data.server.version,
  };
}

/** Extract MMSI from a Signal K vessel context string */
function extractMMSI(context: string): string | null {
  // "vessels.urn:mrn:imo:mmsi:211234567" → "211234567"
  const match = context.match(/mmsi:(\d+)/);
  if (match) return match[1];
  // "vessels.123456789" — bare MMSI
  const bare = context.match(/^vessels\.(\d{9})$/);
  if (bare) return bare[1];
  return null;
}

/** Extract identifier from a Signal K AtoN context string */
function extractAtoNId(context: string): string | null {
  // "atons.urn:mrn:imo:mmsi:993661302" → "993661302"
  const mmsi = context.match(/^atons\..*mmsi:(\d+)/);
  if (mmsi) return mmsi[1];
  // "atons.urn:mrn:signalk:uuid:..." → full URN
  const uuid = context.match(/^atons\.(urn:.+)$/);
  if (uuid) return uuid[1];
  // "atons.993661302" — bare ID
  const bare = context.match(/^atons\.(.+)$/);
  if (bare) return bare[1];
  return null;
}

/** Convert a Signal K delta value to a DataPoint value */
function toDataPointValue(value: unknown): DataPoint["value"] {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    // Position objects
    if ("latitude" in value && "longitude" in value) {
      return value as { latitude: number; longitude: number };
    }
    // Signal K enum objects like {id: 36, name: "Sailing"} — extract the id
    if (
      "id" in value &&
      typeof (value as Record<string, unknown>).id === "number"
    ) {
      return (value as Record<string, unknown>).id as number;
    }
    // Objects with a single numeric value like {overall: 18} — extract it
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1 && typeof entries[0][1] === "number") {
      return entries[0][1];
    }
  }
  return null;
}

/** Process a Signal K delta message and write directly to stores */
export function processDelta(
  delta: SignalKDelta,
  sourceId: string,
  selfContext: string = "vessels.self",
) {
  const context = delta.context ?? "vessels.self";
  const isSelf = context === "vessels.self" || context === selfContext;
  const isAtoN = context.startsWith("atons.");

  // Accumulate all updates from this delta before writing to stores
  const selfUpdates: Record<string, DataPoint> = {};
  const aisUpdates: Record<string, Record<string, DataPoint>> = {};
  const atonUpdates: Record<string, Record<string, DataPoint>> = {};

  for (const update of delta.updates) {
    const timestamp = new Date(update.timestamp).getTime() || Date.now();

    for (const { path, value } of update.values) {
      // Empty path = top-level vessel properties (name, mmsi, etc.)
      // Expand into individual keyed entries
      if (path === "" && value && typeof value === "object") {
        for (const [key, val] of Object.entries(
          value as Record<string, unknown>,
        )) {
          const dp: DataPoint = {
            value: toDataPointValue(val),
            timestamp,
            source: sourceId,
          };
          if (isSelf) {
            selfUpdates[key] = dp;
          } else if (isAtoN) {
            const id = extractAtoNId(context);
            if (id) {
              if (!atonUpdates[id]) atonUpdates[id] = {};
              atonUpdates[id][key] = dp;
            }
          } else {
            const mmsi = extractMMSI(context);
            if (mmsi) {
              if (!aisUpdates[mmsi]) aisUpdates[mmsi] = {};
              aisUpdates[mmsi][key] = dp;
            }
          }
        }
      } else {
        const dataPoint: DataPoint = {
          value: toDataPointValue(value),
          timestamp,
          source: sourceId,
        };
        if (isSelf) {
          selfUpdates[path] = dataPoint;
        } else if (isAtoN) {
          const id = extractAtoNId(context);
          if (id) {
            if (!atonUpdates[id]) atonUpdates[id] = {};
            atonUpdates[id][path] = dataPoint;
          }
        } else {
          const mmsi = extractMMSI(context);
          if (mmsi) {
            if (!aisUpdates[mmsi]) aisUpdates[mmsi] = {};
            aisUpdates[mmsi][path] = dataPoint;
          }
        }
      }
    }
  }

  // Write accumulated updates to stores
  if (Object.keys(selfUpdates).length > 0) {
    updatePaths(selfUpdates);
    updateFromSignalK();
  }

  for (const [mmsi, paths] of Object.entries(aisUpdates)) {
    updateAISVessel(mmsi, paths);
  }

  for (const [id, paths] of Object.entries(atonUpdates)) {
    updateAtoN(id, paths);
  }
}

/** Signal K WebSocket client */
export class SignalKClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = INITIAL_BACKOFF;
  private shouldReconnect = false;
  private wsUrl: string;
  private sourceId: string;
  private options: SignalKClientOptions;
  /** The self identifier from the hello message (e.g. "vessels.urn:mrn:imo:mmsi:123456789") */
  private selfContext: string = "vessels.self";

  state: SignalKClientState = "disconnected";

  constructor(
    wsUrl: string,
    sourceId: string,
    options: SignalKClientOptions = {},
  ) {
    this.wsUrl = wsUrl;
    this.sourceId = sourceId;
    this.options = options;
  }

  /** Connect to the Signal K WebSocket stream */
  connect() {
    this.shouldReconnect = true;
    this.setState("connecting");

    const ws = new WebSocket(`${this.wsUrl}?subscribe=none`);

    ws.onopen = () => {
      this.backoff = INITIAL_BACKOFF;
      this.setState("connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        // Capture self identifier from hello message
        if (data.version) {
          if (data.self) this.selfContext = data.self;
          return;
        }
        // Process delta messages
        if (data.updates) {
          processDelta(data as SignalKDelta, this.sourceId, this.selfContext);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      this.options.onError?.("WebSocket error");
    };

    ws.onclose = () => {
      this.ws = null;
      this.setState("disconnected");
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws = ws;
  }

  /** Send a subscription request */
  subscribe(subscriptions: SignalKSubscription["subscribe"]) {
    if (!this.ws || this.state !== "connected") return;
    const message: SignalKSubscription = {
      context: "vessels.self",
      subscribe: subscriptions,
    };
    this.ws.send(JSON.stringify(message));
  }

  /** Subscribe to AIS vessel data (position, identity, navigation) */
  subscribeAIS() {
    if (!this.ws || this.state !== "connected") return;
    this.ws.send(
      JSON.stringify({
        context: "vessels.*",
        subscribe: [
          // Top-level properties (name, mmsi, flag, port, registrations, uuid)
          { path: "", period: 10000, policy: "fixed" },
          // Identity
          { path: "communication.callsignVhf", period: 10000, policy: "fixed" },
          // Design
          { path: "design.aisShipType", period: 10000, policy: "fixed" },
          { path: "design.length", period: 10000, policy: "fixed" },
          { path: "design.beam", period: 10000, policy: "fixed" },
          { path: "design.draft", period: 10000, policy: "fixed" },
          // Navigation
          { path: "navigation.position", period: 1000, policy: "fixed" },
          {
            path: "navigation.courseOverGroundTrue",
            period: 1000,
            policy: "fixed",
          },
          { path: "navigation.speedOverGround", period: 1000, policy: "fixed" },
          {
            path: "navigation.speedThroughWater",
            period: 1000,
            policy: "fixed",
          },
          { path: "navigation.headingTrue", period: 1000, policy: "fixed" },
          { path: "navigation.rateOfTurn", period: 1000, policy: "fixed" },
          { path: "navigation.destination", period: 30000, policy: "fixed" },
          { path: "navigation.state", period: 10000, policy: "fixed" },
          // Environment
          {
            path: "environment.depth.belowKeel",
            period: 10000,
            policy: "fixed",
          },
          // Sensors
          { path: "sensors.ais.class", period: 30000, policy: "fixed" },
        ],
      }),
    );
  }

  /** Subscribe to AtoN data (position, type, status) */
  subscribeAtoN() {
    if (!this.ws || this.state !== "connected") return;
    this.ws.send(
      JSON.stringify({
        context: "atons.*",
        subscribe: [
          // Top-level properties (name, mmsi)
          { path: "", period: 30000, policy: "fixed" },
          // Position
          { path: "navigation.position", period: 30000, policy: "fixed" },
          // AtoN-specific
          { path: "atonType", period: 60000, policy: "fixed" },
          { path: "virtual", period: 60000, policy: "fixed" },
          { path: "offPosition", period: 10000, policy: "fixed" },
        ],
      }),
    );
  }

  /** Disconnect and stop reconnecting */
  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState("disconnected");
  }

  private setState(state: SignalKClientState) {
    this.state = state;
    this.options.onStateChange?.(state);
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
  }
}
