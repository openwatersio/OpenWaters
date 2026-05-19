import { cameraPositionState } from "@/map/hooks/useCameraPosition";
import {
  dividerState,
  resetDivider,
  setDividerCenter,
  setDividerRadius,
  toggleDivider,
} from "@/measurements/useDivider";

beforeEach(() => {
  resetDivider();
});

describe("toggleDivider", () => {
  it("activates and seeds endpoints from the camera on first activation", () => {
    cameraPositionState.center = [-70, 42];
    cameraPositionState.zoom = 10;

    toggleDivider();

    expect(dividerState.active).toBe(true);
    expect(dividerState.center).toEqual({
      latitude: 42,
      longitude: -70,
      snapTo: null,
    });
    // Radius offset is northeast (bearing π/4) so both lat and lng increase.
    expect(dividerState.radius?.latitude).toBeGreaterThan(42);
    expect(dividerState.radius?.longitude).toBeGreaterThan(-70);
    expect(dividerState.radius?.snapTo).toBeNull();
  });

  it("deactivates on second call and clears endpoints", () => {
    cameraPositionState.center = [-70, 42];
    cameraPositionState.zoom = 10;

    toggleDivider(); // on, seeds endpoints
    toggleDivider(); // off

    // Divider state is intentionally not persisted; clearing endpoints on
    // deactivate ensures the next activation reseeds at the current map
    // center rather than restoring a stale position.
    expect(dividerState.active).toBe(false);
    expect(dividerState.center).toBeNull();
    expect(dividerState.radius).toBeNull();
  });

  it("reactivates by reseeding from the current camera", () => {
    cameraPositionState.center = [-70, 42];
    cameraPositionState.zoom = 10;

    toggleDivider();
    toggleDivider();

    // Move the camera; reactivation should seed at the new center.
    cameraPositionState.center = [-71, 43];
    toggleDivider();

    expect(dividerState.active).toBe(true);
    expect(dividerState.center).toEqual({
      latitude: 43,
      longitude: -71,
      snapTo: null,
    });
  });

  it("stays off when the camera position is unknown", () => {
    cameraPositionState.center = undefined;
    cameraPositionState.zoom = undefined;

    const result = toggleDivider();

    // No camera → no seed → tool stays off. Avoids the UX where the user
    // taps the button, it appears to toggle on, but nothing renders.
    expect(result).toBe(false);
    expect(dividerState.active).toBe(false);
    expect(dividerState.center).toBeNull();
    expect(dividerState.radius).toBeNull();
  });
});

describe("setDividerCenter / setDividerRadius", () => {
  it("update the corresponding endpoint and default snapTo to null", () => {
    setDividerCenter({ latitude: 1, longitude: 2 });
    setDividerRadius({ latitude: 3, longitude: 4 });
    expect(dividerState.center).toEqual({
      latitude: 1,
      longitude: 2,
      snapTo: null,
    });
    expect(dividerState.radius).toEqual({
      latitude: 3,
      longitude: 4,
      snapTo: null,
    });
  });

  it("preserves snapTo across position-only updates", () => {
    setDividerCenter({ latitude: 1, longitude: 2 }, { id: "marker-7" });
    setDividerCenter({ latitude: 1.1, longitude: 2.1 });
    expect(dividerState.center?.snapTo).toEqual({ id: "marker-7" });
  });

  it("clears snapTo when explicitly passed null", () => {
    setDividerCenter({ latitude: 1, longitude: 2 }, { id: "marker-7" });
    setDividerCenter({ latitude: 1.1, longitude: 2.1 }, null);
    expect(dividerState.center?.snapTo).toBeNull();
  });
});
