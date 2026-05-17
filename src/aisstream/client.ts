import { updateAISVessel } from "@/ais/hooks/useAIS";
import {
  type AISStreamMessage,
  decodeAISStreamMessage,
} from "@/aisstream/messages";
import { updateAtoN } from "@/aton/hooks/useAtoN";
import log from "@/logger";

const logger = log.extend("aisstream");

export const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";

/**
 * Default message types we subscribe to. Each maps to a code path in
 * {@link decodeAISStreamMessage}:
 *   PositionReport, StandardClassBPositionReport,
 *   ExtendedClassBPositionReport, LongRangeAisBroadcastMessage,
 *   StandardSearchAndRescueAircraftReport — vessel positions.
 *   ShipStaticData, StaticDataReport — vessel identity/dimensions.
 *   AidsToNavigationReport — buoys / lights / racons (routed to AtoN store).
 */
const DEFAULT_MESSAGE_TYPES = [
  "PositionReport",
  "StandardClassBPositionReport",
  "ExtendedClassBPositionReport",
  "ShipStaticData",
  "StaticDataReport",
  "AidsToNavigationReport",
  "LongRangeAisBroadcastMessage",
  "StandardSearchAndRescueAircraftReport",
];

/** Subscription bounding box: [[swLat, swLng], [neLat, neLng]] (aisstream order). */
export type SubscriptionBox = [[number, number], [number, number]];

export type AISStreamClientState = "disconnected" | "connecting" | "connected";

export type AISStreamClientOptions = {
  onStateChange?: (state: AISStreamClientState, error?: string) => void;
};

const MAX_BACKOFF = 30_000;
const INITIAL_BACKOFF = 1_000;

/**
 * Minimum interval between subscription messages to AIS Stream.
 * aisstream.io caps subscription updates at 1/sec.
 */
const SUBSCRIPTION_THROTTLE = 1_000;

/** WebSocket client for aisstream.io. */
export class AISStreamClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptionTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSubscriptionAt = 0;
  private pendingBoxes: SubscriptionBox[] | null = null;
  private currentBoxes: SubscriptionBox[];
  private backoff = INITIAL_BACKOFF;
  private shouldReconnect = false;
  private apiKey: string;
  private options: AISStreamClientOptions;

  state: AISStreamClientState = "disconnected";

  constructor(
    apiKey: string,
    initialBoxes: SubscriptionBox[],
    options: AISStreamClientOptions = {},
  ) {
    this.apiKey = apiKey;
    this.currentBoxes = initialBoxes;
    this.options = options;
  }

  /** Open the WebSocket and send the initial subscription. */
  connect() {
    this.shouldReconnect = true;
    this.setState("connecting");

    const ws = new WebSocket(AISSTREAM_URL);
    // React Native's default `binaryType` is "blob", which arrives as an
    // opaque Blob that can't be inspected synchronously. ArrayBuffer lets us
    // decode the payload inline — aisstream uses permessage-deflate so frames
    // can arrive as binary even though the payload is JSON text.
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      this.backoff = INITIAL_BACKOFF;
      this.setState("connected");
      // The subscription must arrive within 3 s or aisstream closes the socket.
      this.sendSubscription(this.currentBoxes);
    };

    ws.onmessage = (event) => {
      const raw: unknown = event.data;
      let text: string | null = null;
      if (typeof raw === "string") {
        text = raw;
      } else if (raw instanceof ArrayBuffer) {
        try {
          text = new TextDecoder("utf-8").decode(raw);
        } catch {
          text = null;
        }
      }

      if (text === null) {
        logger.warn(
          `unhandled message payload type: ${typeof raw}` +
            (raw && typeof raw === "object"
              ? ` (constructor=${(raw as object).constructor?.name})`
              : ""),
        );
        return;
      }

      // aisstream returns plain-text errors (not JSON) for things like a bad
      // API key or an invalid bounding box. Surface those at warn level so
      // they don't get lost as "malformed message" noise.
      if (!text.startsWith("{")) {
        logger.warn(`server message: ${text.slice(0, 200)}`);
        return;
      }
      try {
        const data = JSON.parse(text) as AISStreamMessage;
        const decoded = decodeAISStreamMessage(data);
        if (!decoded) return;
        if (decoded.kind === "vessel") {
          updateAISVessel(decoded.mmsi, decoded.paths);
        } else {
          updateAtoN(decoded.id, decoded.paths);
        }
      } catch (err) {
        logger.debug("ignoring malformed message", err);
      }
    };

    ws.onerror = () => {
      // aisstream's error event carries no useful payload; details come on close.
      this.setState("disconnected", "WebSocket error");
    };

    ws.onclose = (event) => {
      this.ws = null;
      const reason = event.reason || `code ${event.code}`;
      this.setState("disconnected", reason);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws = ws;
  }

  /**
   * Update the subscription's bounding boxes. Throttled to one send per
   * {@link SUBSCRIPTION_THROTTLE} ms — calls within the window coalesce, and
   * the last requested boxes win.
   */
  updateSubscription(boxes: SubscriptionBox[]) {
    this.currentBoxes = boxes;
    if (this.state !== "connected") return; // queued — sent on next connect

    const now = Date.now();
    const elapsed = now - this.lastSubscriptionAt;
    if (elapsed >= SUBSCRIPTION_THROTTLE) {
      this.sendSubscription(boxes);
      return;
    }

    // Coalesce within the throttle window.
    this.pendingBoxes = boxes;
    if (this.subscriptionTimer) return;
    this.subscriptionTimer = setTimeout(() => {
      this.subscriptionTimer = null;
      const next = this.pendingBoxes;
      this.pendingBoxes = null;
      if (next && this.state === "connected") {
        this.sendSubscription(next);
      }
    }, SUBSCRIPTION_THROTTLE - elapsed);
  }

  /** Stop reconnecting and close the socket. */
  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.subscriptionTimer) {
      clearTimeout(this.subscriptionTimer);
      this.subscriptionTimer = null;
    }
    this.pendingBoxes = null;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState("disconnected");
  }

  private sendSubscription(boxes: SubscriptionBox[]) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const message = {
      APIKey: this.apiKey,
      BoundingBoxes: boxes,
      FilterMessageTypes: DEFAULT_MESSAGE_TYPES,
    };
    try {
      this.ws.send(JSON.stringify(message));
      this.lastSubscriptionAt = Date.now();
    } catch (err) {
      logger.warn("failed to send subscription", err);
    }
  }

  private setState(state: AISStreamClientState, error?: string) {
    if (this.state === state && !error) return;
    this.state = state;
    this.options.onStateChange?.(state, error);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
  }
}

/**
 * Split a `[west, south, east, north]` MapLibre bounds tuple into one or two
 * AIS Stream bounding boxes, handling antimeridian crossing. AIS Stream wants
 * `[[swLat, swLng], [neLat, neLng]]` (lat-first, opposite of MapLibre).
 */
export function boundsToSubscription(
  bounds: [number, number, number, number],
): SubscriptionBox[] {
  const [west, south, east, north] = bounds;
  const swLat = Math.max(-90, south);
  const neLat = Math.min(90, north);
  if (west <= east) {
    return [
      [
        [swLat, west],
        [neLat, east],
      ],
    ];
  }
  // Viewport crosses the antimeridian: split into two halves.
  return [
    [
      [swLat, west],
      [neLat, 180],
    ],
    [
      [swLat, -180],
      [neLat, east],
    ],
  ];
}

/**
 * Pad a `[west, south, east, north]` bounds by `factor` of its own span on
 * each side. e.g. factor=0.5 → subscription covers 1.5× viewport width.
 * Latitude is clamped to ±90; longitude wraps via antimeridian split in
 * {@link boundsToSubscription}.
 */
export function padBounds(
  bounds: [number, number, number, number],
  factor: number,
): [number, number, number, number] {
  const [west, south, east, north] = bounds;
  const lonSpan = east >= west ? east - west : east + 360 - west;
  const latSpan = north - south;
  const lonPad = lonSpan * factor;
  const latPad = latSpan * factor;
  // Wrap longitude into [-180, 180].
  const wrapLon = (x: number) => {
    let v = ((((x + 180) % 360) + 360) % 360) - 180;
    if (v === -180) v = 180;
    return v;
  };
  return [
    wrapLon(west - lonPad),
    Math.max(-90, south - latPad),
    wrapLon(east + lonPad),
    Math.min(90, north + latPad),
  ];
}
