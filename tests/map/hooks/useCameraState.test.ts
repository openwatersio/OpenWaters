import { useCameraPosition, saveViewport } from '@/map/hooks/useCameraPosition';
import { useCameraState, setFollowUserLocation, cycleTrackingMode } from '@/map/hooks/useCameraState';

const initialState = useCameraState.getState();
const initialPosition = useCameraPosition.getState();

beforeEach(() => {
  useCameraState.setState(initialState, true);
  useCameraPosition.setState(initialPosition, true);
});

describe('useCameraState', () => {
  it('has correct initial state', () => {
    const { followUserLocation, trackingMode } = useCameraState.getState();
    expect(followUserLocation).toBe(true);
    expect(trackingMode).toBe("default");
  });

  describe('setFollowUserLocation', () => {
    it('sets followUserLocation to false and clears trackingMode', () => {
      setFollowUserLocation(false);
      expect(useCameraState.getState().followUserLocation).toBe(false);
      expect(useCameraState.getState().trackingMode).toBeUndefined();
    });

    it('sets followUserLocation to true and defaults trackingMode when undefined', () => {
      useCameraState.setState({ followUserLocation: false, trackingMode: undefined });
      setFollowUserLocation(true);
      expect(useCameraState.getState().followUserLocation).toBe(true);
      expect(useCameraState.getState().trackingMode).toBe("default");
    });

    it('preserves existing trackingMode when enabling follow', () => {
      useCameraState.setState({ followUserLocation: true, trackingMode: "course" });
      setFollowUserLocation(true);
      expect(useCameraState.getState().trackingMode).toBe("course");
    });
  });

  describe('cycleTrackingMode', () => {
    it('enables follow when not following', () => {
      useCameraState.setState({ followUserLocation: false, trackingMode: undefined });
      cycleTrackingMode();
      expect(useCameraState.getState().followUserLocation).toBe(true);
      expect(useCameraState.getState().trackingMode).toBe("default");
    });

    it('switches to course when following with default', () => {
      useCameraState.setState({ followUserLocation: true, trackingMode: "default" });
      cycleTrackingMode();
      expect(useCameraState.getState().trackingMode).toBe("course");
    });

    it('switches to default when following with course', () => {
      useCameraState.setState({ followUserLocation: true, trackingMode: "course" });
      cycleTrackingMode();
      expect(useCameraState.getState().followUserLocation).toBe(true);
      expect(useCameraState.getState().trackingMode).toBe("default");
    });
  });
});

describe('useCameraPosition', () => {
  it('has correct initial state', () => {
    const { center, zoom } = useCameraPosition.getState();
    expect(center).toBeUndefined();
    expect(zoom).toBeUndefined();
  });

  describe('saveViewport', () => {
    it('saves center and zoom for persistence', () => {
      const center = [-122.4, 37.8] as [number, number];
      saveViewport(center, 12);
      expect(useCameraPosition.getState().center).toEqual(center);
      expect(useCameraPosition.getState().zoom).toBe(12);
    });
  });
});
