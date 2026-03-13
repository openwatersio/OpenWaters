import { useCameraState } from '@/hooks/useCameraState';

const initialState = useCameraState.getState();

beforeEach(() => {
  useCameraState.setState(initialState, true);
});

describe('useCameraState', () => {
  it('has correct initial state', () => {
    const { followUserLocation, trackingMode, lastZoom, lastCenter } = useCameraState.getState();
    expect(followUserLocation).toBe(true);
    expect(trackingMode).toBe("default");
    expect(lastZoom).toBeUndefined();
    expect(lastCenter).toBeUndefined();
  });

  describe('setFollowUserLocation', () => {
    it('sets followUserLocation to false and clears trackingMode', () => {
      useCameraState.getState().setFollowUserLocation(false);
      expect(useCameraState.getState().followUserLocation).toBe(false);
      expect(useCameraState.getState().trackingMode).toBeUndefined();
    });

    it('sets followUserLocation to true and defaults trackingMode when undefined', () => {
      useCameraState.setState({ followUserLocation: false, trackingMode: undefined });
      useCameraState.getState().setFollowUserLocation(true);
      expect(useCameraState.getState().followUserLocation).toBe(true);
      expect(useCameraState.getState().trackingMode).toBe("default");
    });

    it('preserves existing trackingMode when enabling follow', () => {
      useCameraState.setState({ followUserLocation: true, trackingMode: "course" });
      useCameraState.getState().setFollowUserLocation(true);
      expect(useCameraState.getState().trackingMode).toBe("course");
    });
  });

  describe('cycleTrackingMode', () => {
    it('enables follow when not following', () => {
      useCameraState.setState({ followUserLocation: false, trackingMode: undefined });
      useCameraState.getState().cycleTrackingMode();
      expect(useCameraState.getState().followUserLocation).toBe(true);
      expect(useCameraState.getState().trackingMode).toBe("default");
    });

    it('switches to course when following with default', () => {
      useCameraState.setState({ followUserLocation: true, trackingMode: "default" });
      useCameraState.getState().cycleTrackingMode();
      expect(useCameraState.getState().trackingMode).toBe("course");
    });

    it('switches to default when following with course', () => {
      useCameraState.setState({ followUserLocation: true, trackingMode: "course" });
      useCameraState.getState().cycleTrackingMode();
      expect(useCameraState.getState().followUserLocation).toBe(true);
      expect(useCameraState.getState().trackingMode).toBe("default");
    });
  });

  describe('saveViewport', () => {
    it('saves last center and zoom for persistence', () => {
      const center = [-122.4, 37.8] as [number, number];
      useCameraState.getState().saveViewport(center, 12);
      expect(useCameraState.getState().lastCenter).toEqual(center);
      expect(useCameraState.getState().lastZoom).toBe(12);
    });
  });
});
