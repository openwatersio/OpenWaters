import { cameraPositionState, saveViewport } from '@/map/hooks/useCameraPosition';
import { cameraState, setFollowUserLocation, cycleTrackingMode } from '@/map/hooks/useCameraState';

const initialState = { ...cameraState };
const initialPosition = { ...cameraPositionState };

beforeEach(() => {
  Object.assign(cameraState, initialState);
  Object.assign(cameraPositionState, initialPosition);
});

describe('useCameraState', () => {
  it('has correct initial state', () => {
    expect(cameraState.followUserLocation).toBe(true);
    expect(cameraState.trackingMode).toBe("default");
  });

  describe('setFollowUserLocation', () => {
    it('sets followUserLocation to false and clears trackingMode', () => {
      setFollowUserLocation(false);
      expect(cameraState.followUserLocation).toBe(false);
      expect(cameraState.trackingMode).toBeUndefined();
    });

    it('sets followUserLocation to true and defaults trackingMode when undefined', () => {
      Object.assign(cameraState, { followUserLocation: false, trackingMode: undefined });
      setFollowUserLocation(true);
      expect(cameraState.followUserLocation).toBe(true);
      expect(cameraState.trackingMode).toBe("default");
    });

    it('preserves existing trackingMode when enabling follow', () => {
      Object.assign(cameraState, { followUserLocation: true, trackingMode: "course" });
      setFollowUserLocation(true);
      expect(cameraState.trackingMode).toBe("course");
    });
  });

  describe('cycleTrackingMode', () => {
    it('enables follow when not following', () => {
      Object.assign(cameraState, { followUserLocation: false, trackingMode: undefined });
      cycleTrackingMode();
      expect(cameraState.followUserLocation).toBe(true);
      expect(cameraState.trackingMode).toBe("default");
    });

    it('switches to course when following with default', () => {
      Object.assign(cameraState, { followUserLocation: true, trackingMode: "default" });
      cycleTrackingMode();
      expect(cameraState.trackingMode).toBe("course");
    });

    it('switches to default when following with course', () => {
      Object.assign(cameraState, { followUserLocation: true, trackingMode: "course" });
      cycleTrackingMode();
      expect(cameraState.followUserLocation).toBe(true);
      expect(cameraState.trackingMode).toBe("default");
    });
  });
});

describe('useCameraPosition', () => {
  it('has correct initial state', () => {
    expect(cameraPositionState.center).toBeUndefined();
    expect(cameraPositionState.zoom).toBeUndefined();
  });

  describe('saveViewport', () => {
    it('saves center and zoom for persistence', () => {
      const center = [-122.4, 37.8] as [number, number];
      saveViewport(center, 12);
      expect(cameraPositionState.center).toEqual(center);
      expect(cameraPositionState.zoom).toBe(12);
    });
  });
});
