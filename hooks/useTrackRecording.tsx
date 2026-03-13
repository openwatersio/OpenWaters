import {
  addPointRecordedListener,
  requestPermissions,
  resetLastPoint,
  startBackgroundTracking,
  startForegroundTracking,
  stopBackgroundTracking,
} from "@/lib/backgroundLocation";
import { endTrack, startTrack } from "@/lib/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type * as Location from "expo-location";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SpeedSample = { speed: number; timestamp: number };

type State = {
  isRecording: boolean;
  activeTrackId: number | null;
  pointCount: number;
  distance: number;
  startedAt: string | null;
  maxSpeed: number;
  speedSamples: SpeedSample[];
};

type Actions = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  resume: () => Promise<void>;
};

let fgSubscription: Location.LocationSubscription | null = null;
let removePointListener: (() => void) | null = null;

export const useTrackRecording = create<State & Actions>()(
  persist(
    (set, get) => ({
      isRecording: false,
      activeTrackId: null,
      pointCount: 0,
      distance: 0,
      startedAt: null,
      maxSpeed: 0,
      speedSamples: [],

      start: async () => {
        const granted = await requestPermissions();
        if (!granted) return;

        const trackId = await startTrack();
        resetLastPoint();

        set({
          isRecording: true,
          activeTrackId: trackId,
          pointCount: 0,
          distance: 0,
          startedAt: new Date().toISOString(),
          maxSpeed: 0,
          speedSamples: [],
        });

        removePointListener = addPointRecordedListener((_lat, _lon, segmentDistance, speed, timestamp) => {
          set((state) => ({
            pointCount: state.pointCount + 1,
            distance: state.distance + segmentDistance,
            maxSpeed: speed != null ? Math.max(state.maxSpeed, speed) : state.maxSpeed,
            speedSamples: speed != null
              ? [...state.speedSamples, { speed, timestamp }]
              : state.speedSamples,
          }));
        });

        fgSubscription = await startForegroundTracking(trackId);
        await startBackgroundTracking(trackId);
      },

      resume: async () => {
        const { isRecording, activeTrackId } = get();
        if (!isRecording || !activeTrackId) return;

        removePointListener = addPointRecordedListener((_lat, _lon, segmentDistance, speed, timestamp) => {
          set((state) => ({
            pointCount: state.pointCount + 1,
            distance: state.distance + segmentDistance,
            maxSpeed: speed != null ? Math.max(state.maxSpeed, speed) : state.maxSpeed,
            speedSamples: speed != null
              ? [...state.speedSamples, { speed, timestamp }]
              : state.speedSamples,
          }));
        });

        fgSubscription = await startForegroundTracking(activeTrackId);
      },

      stop: async () => {
        const { activeTrackId, distance } = get();

        if (fgSubscription) {
          fgSubscription.remove();
          fgSubscription = null;
        }
        await stopBackgroundTracking();
        removePointListener?.();
        removePointListener = null;
        resetLastPoint();

        if (activeTrackId) {
          await endTrack(activeTrackId, distance);
        }

        set({
          isRecording: false,
          activeTrackId: null,
          pointCount: 0,
          distance: 0,
          startedAt: null,
          maxSpeed: 0,
          speedSamples: [],
        });
      },
    }),
    {
      name: "track-recording",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        const { speedSamples: _, ...rest } = state;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        if (state?.isRecording) {
          state.resume();
        }
      },
    },
  ),
);
