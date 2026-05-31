import log from "@/logger";
import { useCameraPosition } from "@/map/hooks/useCameraPosition";
import { mapRef } from "@/map/hooks/useMapRef";
import { findSnap } from "@/measurements/snapTargets";
import {
  dividerState,
  dragLiveState,
  setDividerRadius,
  setDragLive,
  swapDividerRoles,
  useDivider,
} from "@/measurements/useDivider";
import * as Haptics from "expo-haptics";
import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const dlog = log.extend("divider-gesture");

/** Screen-pixel radius for marker hit-testing on touch-down. */
const HIT_RADIUS_PX = 30;
/** Screen-pixel radius for snap-target hit-testing during drag. */
const SNAP_RADIUS_PX = 44;
/** Minimum interval between async snap queries. The marker visual follows
 *  the finger at 60 Hz; only the native `queryRenderedFeatures` call is
 *  throttled. */
const SNAP_INTERVAL_MS = 50;
/** Distance the finger must travel for the gesture to be interpreted as
 *  a drag instead of a tap. */
const TAP_SLOP_PX = 8;

/** Small lng/lat offset used to derive pixel→degree scaling empirically.
 *  Picked so the derivative is well-resolved at the typical zoom range. */
const SCALE_PROBE_DEG = 0.001;

interface DragState {
  /** The marker the user originally touched (before any swap). */
  touchedKind: "center" | "radius";
  /** Which marker is currently being moved. Equals `touchedKind` until the
   *  swap fires; after a swap, this becomes "radius". */
  liveKind: "center" | "radius";
  /** True once the finger has crossed TAP_SLOP_PX from touch-down. Used to
   *  (a) apply the role swap on the first drag tick when touched was
   *  "center", and (b) distinguish drag from tap on release. */
  movedPastThreshold: boolean;
  anchorLat: number;
  anchorLng: number;
  /** Degrees of longitude per screen point, captured at touch-down. */
  lngPerPx: number;
  /** Negative — screen y grows down while latitude grows north. */
  latPerPx: number;
}

/**
 * Wraps `<Map>` with a `<GestureDetector>` so the divider's endpoint
 * markers can be tapped (swap roles) or dragged (move + snap). On
 * touch-down, the gesture hit-tests the markers and either fails (touch
 * passes through to MapLibre) or activates immediately (`manualActivation`
 * — claims the touch from MapLibre's native pan). Tap-vs-drag is decided
 * at release time from the cumulative translation.
 *
 * **Threading.** Worklet callbacks run on the UI thread; hit-test inputs
 * are a shared value updated by a JS-side effect. JS-side handlers are
 * dispatched via `scheduleOnRN`.
 *
 * **Pixel→lat/lng scaling** is pre-computed by projecting a small offset
 * point and measuring the resulting pixel displacement — no Web Mercator
 * constants, no unit-conversion bugs.
 */
export function DividerGesture({ children }: { children: ReactNode }) {
  const { active, center, radius } = useDivider();
  const { zoom, center: cameraCenter } = useCameraPosition();

  const dragStateRef = useRef<DragState | null>(null);
  const scaleRef = useRef<{ lngPerPx: number; latPerPx: number } | null>(null);
  /** Generation counter used to discard stale async snap-query results. */
  const snapGenRef = useRef(0);
  /** Last wall-clock time `findSnap` was kicked off. */
  const lastSnapAtRef = useRef(0);

  const markerScreensSV = useSharedValue<{
    center: [number, number] | null;
    radius: [number, number] | null;
  }>({ center: null, radius: null });

  useEffect(() => {
    if (!active || !center || !radius || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, r, east, north] = await Promise.all([
          mapRef.current!.project([center.longitude, center.latitude]),
          mapRef.current!.project([radius.longitude, radius.latitude]),
          mapRef.current!.project([
            center.longitude + SCALE_PROBE_DEG,
            center.latitude,
          ]),
          mapRef.current!.project([
            center.longitude,
            center.latitude + SCALE_PROBE_DEG,
          ]),
        ]);
        if (cancelled) return;
        markerScreensSV.value = {
          center: [c[0], c[1]],
          radius: [r[0], r[1]],
        };
        const dxEast = east[0] - c[0]; // px per +SCALE_PROBE_DEG longitude
        const dyNorth = north[1] - c[1]; // px per +SCALE_PROBE_DEG latitude (negative)
        if (Math.abs(dxEast) > 0.001 && Math.abs(dyNorth) > 0.001) {
          scaleRef.current = {
            lngPerPx: SCALE_PROBE_DEG / dxEast,
            latPerPx: SCALE_PROBE_DEG / dyNorth,
          };
        }
      } catch (err) {
        dlog.warn("project failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, center, radius, zoom, cameraCenter, markerScreensSV]);

  // --- JS-side handlers, called via scheduleOnRN from the worklet. ---

  /** Touch-down hit. Pan has manually-activated already (in onTouchesDown);
   *  this just sets up the drag state. The role swap (if needed) is
   *  deferred to either handleUpdate (drag crossing threshold) or handleEnd
   *  (tap on release without crossing). */
  const handleHit = useCallback((kind: "center" | "radius") => {
    const scale = scaleRef.current;
    const touched =
      kind === "center" ? dividerState.center : dividerState.radius;
    if (!touched || !scale) return;

    // Bump in case a stale handleEnd from a previous drag is still
    // awaiting its final snap query — its commit would overwrite this
    // new drag's setup.
    snapGenRef.current++;

    dragStateRef.current = {
      touchedKind: kind,
      liveKind: kind,
      movedPastThreshold: false,
      anchorLat: touched.latitude,
      anchorLng: touched.longitude,
      latPerPx: scale.latPerPx,
      lngPerPx: scale.lngPerPx,
    };
    // Mirror the touched marker's existing position in dragLive — no visual
    // change yet. The swap (if any) happens lazily once threshold is crossed.
    setDragLive({ kind, point: touched });
  }, []);

  // dx, dy are translations from `e.translationX/Y` (points, relative to
  // gesture start). screenX, screenY are the raw finger position from
  // `e.x, e.y` — already in map-view-relative pixels, so we can pass them
  // straight to `findSnap` without a roundtrip through `map.project()`.
  const handleUpdate = useCallback(
    (dx: number, dy: number, screenX: number, screenY: number) => {
      const drag = dragStateRef.current;
      if (!drag) return;

      // First time the finger crosses TAP_SLOP_PX, treat this as a real
      // drag — apply the role swap if the touched marker was center, so
      // the circle re-anchors on the un-touched marker.
      if (
        !drag.movedPastThreshold &&
        (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX)
      ) {
        drag.movedPastThreshold = true;
        if (drag.touchedKind === "center") {
          swapDividerRoles();
          drag.liveKind = "radius";
        }
      }

      const fingerLat = drag.anchorLat + dy * drag.latPerPx;
      const fingerLng = drag.anchorLng + dx * drag.lngPerPx;

      // Update the live position eagerly *only when not currently snapped*.
      // While snapped the marker stays glued to the target; the throttled
      // snap query below decides whether to keep, switch, or break the snap.
      if (!dragLiveState.snapTo) {
        setDragLive({
          kind: drag.liveKind,
          point: { latitude: fingerLat, longitude: fingerLng },
          snapTo: null,
        });
      }

      // Throttle the native snap query. Geometry keeps updating at 60 Hz
      // via the eager write above; only snap detection runs at reduced rate.
      const now = Date.now();
      if (now - lastSnapAtRef.current < SNAP_INTERVAL_MS) return;
      lastSnapAtRef.current = now;

      const gen = ++snapGenRef.current;
      (async () => {
        try {
          const snap = await findSnap([screenX, screenY], SNAP_RADIUS_PX);
          if (gen !== snapGenRef.current) return;
          const cur = dragStateRef.current;
          if (!cur) return;
          if (snap) {
            // Haptic on snap engage / target switch — not on un-snap.
            const prevSnapId = dragLiveState.snapTo?.id;
            if (prevSnapId !== snap.ref.id) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            setDragLive({
              kind: cur.liveKind,
              point: snap.point,
              snapTo: snap.ref,
            });
          } else {
            setDragLive({
              kind: cur.liveKind,
              point: { latitude: fingerLat, longitude: fingerLng },
              snapTo: null,
            });
          }
        } catch {
          // queryRenderedFeatures failed (map gone, etc.) — leave live state.
        }
      })();
    },
    [],
  );

  const handleEnd = useCallback(async (dx: number, dy: number) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    // Claim ownership immediately so a second call (from onFinalize) is a
    // no-op while we're awaiting the final snap query.
    dragStateRef.current = null;
    snapGenRef.current++; // invalidate in-flight onUpdate snap queries

    if (!drag.movedPastThreshold) {
      // Tap: swap center/radius roles. No position change.
      swapDividerRoles();
      setDragLive(null);
      dlog.debug("tap → swapped roles");
      return;
    }

    // Real drag. Run one final snap query at the release position so the
    // committed state reflects what the user sees at release. In-flight
    // onUpdate queries can resolve after onEnd, so trusting dragLive at
    // this moment misses snaps that engage on the last frame.
    const fingerLat = drag.anchorLat + dy * drag.latPerPx;
    const fingerLng = drag.anchorLng + dx * drag.lngPerPx;
    const gen = snapGenRef.current;
    let snap: Awaited<ReturnType<typeof findSnap>> = null;
    const map = mapRef.current;
    if (map) {
      try {
        const [x, y] = (await map.project([fingerLng, fingerLat])) as [
          number,
          number,
        ];
        if (gen === snapGenRef.current) {
          snap = await findSnap([x, y], SNAP_RADIUS_PX);
        }
      } catch {
        // ignore — fall through to commit without snap
      }
    }
    if (gen !== snapGenRef.current) {
      // A new drag started while we were awaiting. Don't trample it.
      return;
    }

    if (snap) {
      setDividerRadius(snap.point, snap.ref);
      dlog.debug(`drag committed snap=${snap.ref.id}`);
    } else {
      setDividerRadius({ latitude: fingerLat, longitude: fingerLng }, null);
      dlog.debug("drag committed (no snap)");
    }
    setDragLive(null);
  }, []);

  // --- Gesture. Pan with manualActivation so we claim the touch from
  // MapLibre's native pan immediately on a marker hit. Without manual
  // activation, MapLibre's pan races ours during the hold-phase and
  // often wins, making the divider gesture feel unreliable. ---

  const gesture = useMemo(() => {
    // RNGH manualActivation worklet builder: each worklet closes over shared
    // values and scheduleOnRN'd handlers — the standard gesture-handler
    // pattern, which React Compiler compiles cleanly (healthcheck verified).
    // react-hooks/refs can't see through the worklet closures.
    /* eslint-disable react-hooks/refs */
    return Gesture.Pan()
      .enabled(active && center != null && radius != null && zoom != null)
      .manualActivation(true)
      .onTouchesDown((event, manager) => {
        "worklet";
        const touch = event.allTouches[0];
        const kind = touch
          ? hitTest(touch.x, touch.y, markerScreensSV.value)
          : null;
        if (!kind) {
          manager.fail();
          return;
        }
        manager.activate();
        scheduleOnRN(handleHit, kind);
      })
      .onUpdate((e) => {
        "worklet";
        scheduleOnRN(handleUpdate, e.translationX, e.translationY, e.x, e.y);
      })
      .onEnd((e) => {
        "worklet";
        scheduleOnRN(handleEnd, e.translationX, e.translationY);
      })
      .onFinalize((e) => {
        "worklet";
        // Pan with manualActivation doesn't reliably fire onEnd for a
        // no-movement release (RNGH sometimes goes ACTIVE → cancellation).
        // handleEnd is idempotent via the dragStateRef null-check.
        scheduleOnRN(handleEnd, e.translationX, e.translationY);
      });
    /* eslint-enable react-hooks/refs */
  }, [
    active,
    center,
    radius,
    zoom,
    markerScreensSV,
    handleHit,
    handleUpdate,
    handleEnd,
  ]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}

function hitTest(
  x: number,
  y: number,
  markers: { center: [number, number] | null; radius: [number, number] | null },
): "center" | "radius" | null {
  "worklet";
  if (!markers.center || !markers.radius) return null;
  const dxC = x - markers.center[0];
  const dyC = y - markers.center[1];
  const dCenter = dxC * dxC + dyC * dyC;
  const dxR = x - markers.radius[0];
  const dyR = y - markers.radius[1];
  const dRadius = dxR * dxR + dyR * dyR;
  const r2 = HIT_RADIUS_PX * HIT_RADIUS_PX;
  if (dCenter < r2 && dCenter <= dRadius) return "center";
  if (dRadius < r2) return "radius";
  return null;
}
