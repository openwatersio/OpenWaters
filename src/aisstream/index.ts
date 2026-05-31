import {
  AISStreamClient,
  type SubscriptionBox,
  boundsToSubscription,
  padBounds,
} from "@/aisstream/client";
import { isAISVisibleAtZoom } from "@/ais/visibility";
import {
  aisStreamState,
  setAISStreamStatus,
} from "@/aisstream/hooks/useAISStream";
import log from "@/logger";
import { cameraViewState } from "@/map/hooks/useCameraView";
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from "react-native";
import { subscribeKey } from "valtio/utils";

const logger = log.extend("aisstream");

/** Inflate the subscription window relative to the viewport. */
const BOUNDS_PAD_FACTOR = 0.5;

/** Initial subscription when no bounds are available yet. Replaced as soon as the camera settles. */
const WORLD_BOUNDS: [number, number, number, number] = [-179, -89, 179, 89];

let client: AISStreamClient | null = null;
let unsubscribers: (() => void)[] = [];
let appStateActive = AppState.currentState === "active";

function getApiKey(): string | undefined {
  // Metro's Babel plugin inlines references to `process.env.EXPO_PUBLIC_*` at
  // build time, so this read happens against the bundled value — no manifest
  // or Constants indirection.
  const key = process.env.EXPO_PUBLIC_AISSTREAM_API_KEY;
  return typeof key === "string" && key.length > 0 ? key : undefined;
}

function currentSubscription(): SubscriptionBox[] {
  const bounds = cameraViewState.bounds ?? WORLD_BOUNDS;
  return boundsToSubscription(padBounds(bounds, BOUNDS_PAD_FACTOR));
}

function connect() {
  if (client) return;
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn(
      "no API key configured; staying disconnected. " +
        "Set EXPO_PUBLIC_AISSTREAM_API_KEY in .env.local and restart Metro with `--clear`.",
    );
    setAISStreamStatus("disconnected", "Missing API key");
    return;
  }
  logger.info("connecting");
  client = new AISStreamClient(apiKey, currentSubscription(), {
    onStateChange: (state, error) => {
      setAISStreamStatus(state, error);
    },
  });
  client.connect();
}

function disconnect() {
  if (!client) return;
  logger.info("disconnecting");
  client.disconnect();
  client = null;
  setAISStreamStatus("disconnected");
}

function reconcile() {
  // Pause the worldwide firehose when zoomed too far out to render targets —
  // the subscription bounds would otherwise cover a huge area and flood the
  // store with vessels we never draw. Reconnects on zoom-in within ~1s.
  const wantConnection =
    aisStreamState.enabled &&
    appStateActive &&
    isAISVisibleAtZoom(cameraViewState.zoom);
  if (wantConnection) {
    connect();
  } else {
    disconnect();
  }
}

function handleAppStateChange(state: AppStateStatus) {
  appStateActive = state === "active";
  reconcile();
}

/**
 * Bring AIS Stream online if it's enabled. Idempotent — calling `activate`
 * again with no state change is a no-op. Subscribes to:
 *   - `aisStreamState.enabled` so user toggles reconnect/tear-down
 *   - `cameraViewState.bounds` so the subscription tracks the viewport
 *   - `AppState` to pause when backgrounded
 */
export function activate() {
  if (unsubscribers.length > 0) return; // already activated

  logger.info(
    `activating (enabled=${aisStreamState.enabled}, appState=${AppState.currentState}, hasKey=${!!getApiKey()})`,
  );

  // Enable/disable toggle
  unsubscribers.push(
    subscribeKey(aisStreamState, "enabled", () => reconcile()),
  );

  // Bounds tracking — the client's own throttle (1/sec) handles aisstream's cap.
  unsubscribers.push(
    subscribeKey(cameraViewState, "bounds", () => {
      if (!client) return;
      client.updateSubscription(currentSubscription());
    }),
  );

  // Zoom gate — connect/disconnect only when crossing MIN_AIS_ZOOM, not on
  // every zoom tick. reconcile() is idempotent, so we just need it to run once
  // per crossing.
  let zoomAllowed = isAISVisibleAtZoom(cameraViewState.zoom);
  unsubscribers.push(
    subscribeKey(cameraViewState, "zoom", (zoom) => {
      const allowed = isAISVisibleAtZoom(zoom);
      if (allowed !== zoomAllowed) {
        zoomAllowed = allowed;
        reconcile();
      }
    }),
  );

  // AppState — tear down when backgrounded.
  const appStateSub: NativeEventSubscription = AppState.addEventListener(
    "change",
    handleAppStateChange,
  );
  unsubscribers.push(() => appStateSub.remove());

  reconcile();
}

/** Tear down the WebSocket and all subscriptions. */
export function deactivate() {
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
  disconnect();
}
