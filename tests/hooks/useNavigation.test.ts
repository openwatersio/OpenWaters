import { type DataPoint, resetInstrumentStore, updatePaths } from "@/hooks/useInstruments";
import {
  NavigationState,
  flushNavigation,
  updateFromDevice,
  updateFromSignalK,
  useNavigation,
} from "@/hooks/useNavigation";

const initialState = useNavigation.getState();

beforeEach(() => {
  useNavigation.setState(initialState, true);
  resetInstrumentStore();
});

function deviceLocation(overrides: Partial<{
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
}> = {}) {
  return {
    coords: {
      latitude: overrides.latitude ?? 47.6,
      longitude: overrides.longitude ?? -122.3,
      speed: overrides.speed ?? 0,
      heading: overrides.heading ?? 0,
      accuracy: overrides.accuracy ?? 5,
      altitude: 0,
      altitudeAccuracy: 0,
    },
    timestamp: Date.now(),
  };
}

function signalkPosition(lat: number, lon: number, opts: { sog?: number; cog?: number; hdg?: number } = {}) {
  const data: Record<string, DataPoint> = {
    "navigation.position": {
      value: { latitude: lat, longitude: lon },
      timestamp: Date.now(),
      source: "signalk.test",
    },
  };
  if (opts.sog !== undefined) {
    data["navigation.speedOverGround"] = {
      value: opts.sog,
      timestamp: Date.now(),
      source: "signalk.test",
    };
  }
  if (opts.cog !== undefined) {
    data["navigation.courseOverGroundTrue"] = {
      value: opts.cog,
      timestamp: Date.now(),
      source: "signalk.test",
    };
  }
  if (opts.hdg !== undefined) {
    data["navigation.headingTrue"] = {
      value: opts.hdg,
      timestamp: Date.now(),
      source: "signalk.test",
    };
  }
  updatePaths(data);
}

describe("useNavigation", () => {
  it("starts with null values and Moored state", () => {
    const s = useNavigation.getState();
    expect(s.latitude).toBeNull();
    expect(s.longitude).toBeNull();
    expect(s.speed).toBeNull();
    expect(s.state).toBe(NavigationState.Moored);
    expect(s.source).toBe("device");
  });

  describe("device GPS updates", () => {
    it("updates position from device GPS", () => {
      updateFromDevice(deviceLocation({ latitude: 47.6, longitude: -122.3 }));
      const s = useNavigation.getState();
      expect(s.latitude).toBe(47.6);
      expect(s.longitude).toBe(-122.3);
      expect(s.source).toBe("device");
    });

    it("updates speed and heading from device", () => {
      updateFromDevice(deviceLocation({ speed: 5.0, heading: 90 }));
      const s = useNavigation.getState();
      expect(s.speed).toBe(5.0);
      expect(s.heading).toBe(90);
    });

    it("converts device heading to course in radians", () => {
      updateFromDevice(deviceLocation({ heading: 180 }));
      const s = useNavigation.getState();
      expect(s.course).toBeCloseTo(Math.PI, 5);
    });

    it("sets Underway when speed exceeds threshold", () => {
      updateFromDevice(deviceLocation({ speed: 1.0 }));
      expect(useNavigation.getState().state).toBe(NavigationState.Underway);
    });

    it("sets Moored when speed is below threshold", () => {
      updateFromDevice(deviceLocation({ speed: 0.1 }));
      expect(useNavigation.getState().state).toBe(NavigationState.Moored);
    });
  });

  describe("Signal K priority", () => {
    it("prefers Signal K when fresh", () => {
      // First set device position
      updateFromDevice(deviceLocation({ latitude: 47.6, longitude: -122.3 }));
      expect(useNavigation.getState().source).toBe("device");

      // Then set Signal K position
      signalkPosition(48.0, -123.0);
      updateFromSignalK();
      flushNavigation();

      const s = useNavigation.getState();
      expect(s.latitude).toBe(48.0);
      expect(s.longitude).toBe(-123.0);
      expect(s.source).toBe("signalk");
    });

    it("uses Signal K speed when available", () => {
      updateFromDevice(deviceLocation({ speed: 2.0 }));
      signalkPosition(48.0, -123.0, { sog: 5.0 });
      updateFromSignalK();
      flushNavigation();

      expect(useNavigation.getState().speed).toBe(5.0);
    });

    it("uses Signal K heading converted to degrees", () => {
      updateFromDevice(deviceLocation({ heading: 90 }));
      signalkPosition(48.0, -123.0, { hdg: Math.PI / 2 }); // 90° in radians
      updateFromSignalK();
      flushNavigation();

      expect(useNavigation.getState().heading).toBeCloseTo(90, 1);
    });

    it("falls back to device when Signal K position is stale", () => {
      updateFromDevice(deviceLocation({ latitude: 47.6, longitude: -122.3 }));

      // Set Signal K with old timestamp
      updatePaths({
        "navigation.position": {
          value: { latitude: 48.0, longitude: -123.0 },
          timestamp: Date.now() - 10_000, // 10 seconds ago
          source: "signalk.test",
        },
      });
      updateFromSignalK();
      flushNavigation();

      const s = useNavigation.getState();
      expect(s.latitude).toBe(47.6); // device value
      expect(s.source).toBe("device");
    });

    it("falls back to device speed when Signal K speed is missing", () => {
      updateFromDevice(deviceLocation({ speed: 3.0 }));
      signalkPosition(48.0, -123.0); // no sog
      updateFromSignalK();
      flushNavigation();

      expect(useNavigation.getState().speed).toBe(3.0);
    });
  });

  describe("moored/underway from resolved speed", () => {
    it("goes underway from Signal K speed", () => {
      signalkPosition(48.0, -123.0, { sog: 2.0 });
      updateFromSignalK();
      flushNavigation();

      expect(useNavigation.getState().state).toBe(NavigationState.Underway);
    });
  });
});
