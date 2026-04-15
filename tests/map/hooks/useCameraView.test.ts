import {
  cameraViewState,
  onRegionDidChange,
  onRegionIsChanging,
  useBounds,
  withinDeadband,
} from "@/map/hooks/useCameraView";
import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";

const initialState = { ...cameraViewState };

beforeEach(() => {
  Object.assign(cameraViewState, initialState);
});

describe("useCameraView", () => {
  it("has correct initial state", () => {
    const { bearing, bounds, zoom } = cameraViewState;
    expect(bearing).toBe(0);
    expect(bounds).toBeUndefined();
    expect(zoom).toBe(0);
  });

  describe("onRegionIsChanging", () => {
    it("updates bearing only", () => {
      onRegionIsChanging(45);
      expect(cameraViewState.bearing).toBe(45);
      expect(cameraViewState.bounds).toBeUndefined();
      expect(cameraViewState.zoom).toBe(0);
    });
  });

  describe("onRegionDidChange", () => {
    it("updates bearing, bounds, and zoom", () => {
      const bounds = [-122.5, 37.7, -122.3, 37.9] as [
        number,
        number,
        number,
        number,
      ];
      onRegionDidChange(90, bounds, 12);
      expect(cameraViewState.bearing).toBe(90);
      expect(cameraViewState.bounds).toEqual(bounds);
      expect(cameraViewState.zoom).toBe(12);
    });
  });

  describe("useBounds", () => {
    it("re-commits when the viewport shrinks beyond hysteresis", async () => {
      const initialBounds = [-122.5, 37.7, -122.3, 37.9] as [
        number,
        number,
        number,
        number,
      ];
      const zoomedOutBounds = [-122.6, 37.6, -122.2, 38.0] as [
        number,
        number,
        number,
        number,
      ];
      const zoomedInBounds = [-122.48, 37.72, -122.32, 37.88] as [
        number,
        number,
        number,
        number,
      ];
      const seen: ([number, number, number, number] | undefined)[] = [];

      function BoundsProbe() {
        const bounds = useBounds({ hysteresis: 0.1 });
        seen.push(
          bounds
            ? ([...bounds] as [number, number, number, number])
            : undefined,
        );
        return null;
      }

      act(() => {
        onRegionDidChange(90, initialBounds, 12);
      });
      render(React.createElement(BoundsProbe));

      act(() => {
        onRegionDidChange(90, zoomedOutBounds, 10);
      });

      act(() => {
        onRegionDidChange(90, zoomedInBounds, 13);
      });

      expect(seen).toContainEqual(initialBounds);
      await waitFor(() => {
        expect(seen).toContainEqual(zoomedOutBounds);
        expect(seen).toContainEqual(zoomedInBounds);
        expect(seen.at(-1)).toEqual(zoomedInBounds);
      });
    });
  });

  describe("withinDeadband", () => {
    const baseline = [-122.5, 37.7, -122.3, 37.9] as [
      number,
      number,
      number,
      number,
    ];

    it("returns true for a small pan within threshold", () => {
      const nudged = [-122.49, 37.71, -122.29, 37.91] as [
        number,
        number,
        number,
        number,
      ];
      expect(withinDeadband(baseline, nudged, 0.1)).toBe(true);
    });

    it("returns false when viewport grows beyond threshold", () => {
      const expanded = [-122.6, 37.6, -122.2, 38.0] as [
        number,
        number,
        number,
        number,
      ];
      expect(withinDeadband(baseline, expanded, 0.1)).toBe(false);
    });

    it("returns false when viewport shrinks beyond threshold", () => {
      const shrunk = [-122.45, 37.75, -122.35, 37.85] as [
        number,
        number,
        number,
        number,
      ];
      expect(withinDeadband(baseline, shrunk, 0.1)).toBe(false);
    });
  });
});
