import { flushAIS, useAIS } from "@/hooks/useAIS";
import { useAtoN } from "@/hooks/useAtoN";
import { getInstrumentData, resetInstrumentStore } from "@/hooks/useInstruments";
import {
  type SignalKClientState,
  SignalKClient,
  discoverEndpoints,
  processDelta,
} from "@/lib/signalk";

// Reset stores between tests
const initialAIS = useAIS.getState();
const initialAtoN = useAtoN.getState();

beforeEach(() => {
  resetInstrumentStore();
  useAIS.setState(initialAIS, true);
  useAtoN.setState(initialAtoN, true);
});

describe("discoverEndpoints", () => {
  it("parses Signal K discovery response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        endpoints: {
          v1: {
            version: "1.0.0",
            "signalk-http": "http://pi.local:3000/signalk/v1/api/",
            "signalk-ws": "ws://pi.local:3000/signalk/v1/stream",
          },
        },
        server: { id: "signalk-server-node", version: "2.0.0" },
      }),
    });

    const endpoints = await discoverEndpoints("http://pi.local:3000");
    expect(endpoints.httpUrl).toBe("http://pi.local:3000/signalk/v1/api/");
    expect(endpoints.wsUrl).toBe("ws://pi.local:3000/signalk/v1/stream");
    expect(endpoints.serverId).toBe("signalk-server-node");
    expect(endpoints.serverVersion).toBe("2.0.0");

    expect(fetch).toHaveBeenCalledWith("http://pi.local:3000/signalk");
  });

  it("strips trailing slash from base URL", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        endpoints: {
          v1: {
            version: "1.0.0",
            "signalk-http": "http://pi.local:3000/signalk/v1/api/",
            "signalk-ws": "ws://pi.local:3000/signalk/v1/stream",
          },
        },
        server: { id: "test", version: "1.0.0" },
      }),
    });

    await discoverEndpoints("http://pi.local:3000/");
    expect(fetch).toHaveBeenCalledWith("http://pi.local:3000/signalk");
  });

  it("throws on non-OK response", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(discoverEndpoints("http://bad.local")).rejects.toThrow(
      "Signal K discovery failed: 404",
    );
  });
});

describe("processDelta", () => {
  it("routes self vessel data to instrument store", () => {
    processDelta(
      {
        context: "vessels.self",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              {
                path: "environment.depth.belowTransducer",
                value: 8.7,
              },
              {
                path: "navigation.speedOverGround",
                value: 3.5,
              },
            ],
          },
        ],
      },
      "signalk.test",
    );


    const data = getInstrumentData();
    expect(data["environment.depth.belowTransducer"]?.value).toBe(8.7);
    expect(data["navigation.speedOverGround"]?.value).toBe(3.5);
    expect(data["environment.depth.belowTransducer"]?.source).toBe(
      "signalk.test",
    );
  });

  it("defaults to vessels.self when context is missing", () => {
    processDelta(
      {
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              { path: "environment.depth.belowTransducer", value: 5.0 },
            ],
          },
        ],
      },
      "signalk.test",
    );


    expect(
      getInstrumentData()["environment.depth.belowTransducer"]
        ?.value,
    ).toBe(5.0);
  });

  it("routes other vessels to AIS store by MMSI", () => {
    processDelta(
      {
        context: "vessels.urn:mrn:imo:mmsi:211234567",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              {
                path: "navigation.position",
                value: { latitude: 47.6, longitude: -122.3 },
              },
              {
                path: "navigation.speedOverGround",
                value: 3.5,
              },
            ],
          },
        ],
      },
      "signalk.test",
    );


    flushAIS();


    const vessel = useAIS.getState().vessels["211234567"];
    expect(vessel).toBeDefined();
    expect(vessel.data["navigation.position"]?.value).toEqual({
      latitude: 47.6,
      longitude: -122.3,
    });
    expect(vessel.data["navigation.speedOverGround"]?.value).toBe(3.5);
  });

  it("treats selfContext as self vessel, not AIS", () => {
    processDelta(
      {
        context: "vessels.urn:mrn:imo:mmsi:123456789",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              { path: "navigation.speedOverGround", value: 4.2 },
            ],
          },
        ],
      },
      "signalk.test",
      "vessels.urn:mrn:imo:mmsi:123456789",
    );


    // Should go to instrument store (self), not AIS store
    expect(getInstrumentData()["navigation.speedOverGround"]?.value).toBe(4.2);
    flushAIS();
    expect(useAIS.getState().vessels["123456789"]).toBeUndefined();
  });

  it("handles bare MMSI context", () => {
    processDelta(
      {
        context: "vessels.211234567",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              { path: "navigation.speedOverGround", value: 5.0 },
            ],
          },
        ],
      },
      "signalk.test",
    );


    flushAIS();


    expect(useAIS.getState().vessels["211234567"]).toBeDefined();
  });

  it("handles position objects", () => {
    processDelta(
      {
        context: "vessels.self",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              {
                path: "navigation.position",
                value: { latitude: 47.6, longitude: -122.3 },
              },
            ],
          },
        ],
      },
      "signalk.test",
    );


    const pos = getInstrumentData()["navigation.position"]?.value;
    expect(pos).toEqual({ latitude: 47.6, longitude: -122.3 });
  });

  it("expands empty-path deltas into individual properties", () => {
    processDelta(
      {
        context: "vessels.urn:mrn:imo:mmsi:211234567",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              {
                path: "",
                value: { name: "WRANGO", mmsi: "211234567", flag: "DE" },
              },
            ],
          },
        ],
      },
      "signalk.test",
    );


    flushAIS();


    const vessel = useAIS.getState().vessels["211234567"];
    expect(vessel).toBeDefined();
    expect(vessel.data["name"]?.value).toBe("WRANGO");
    expect(vessel.data["mmsi"]?.value).toBe("211234567");
    expect(vessel.data["flag"]?.value).toBe("DE");
  });

  it("extracts single numeric value from wrapper objects like design.length", () => {
    processDelta(
      {
        context: "vessels.urn:mrn:imo:mmsi:211234567",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              {
                path: "design.length",
                value: { overall: 18 },
              },
            ],
          },
        ],
      },
      "signalk.test",
    );


    flushAIS();


    const vessel = useAIS.getState().vessels["211234567"];
    expect(vessel.data["design.length"]?.value).toBe(18);
  });

  it("extracts id from Signal K enum objects like aisShipType", () => {
    processDelta(
      {
        context: "vessels.urn:mrn:imo:mmsi:211234567",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              {
                path: "design.aisShipType",
                value: { id: 36, name: "Sailing" },
              },
            ],
          },
        ],
      },
      "signalk.test",
    );


    flushAIS();


    const vessel = useAIS.getState().vessels["211234567"];
    expect(vessel.data["design.aisShipType"]?.value).toBe(36);
  });

  it("handles null values", () => {
    processDelta(
      {
        context: "vessels.self",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              { path: "environment.depth.belowTransducer", value: null },
            ],
          },
        ],
      },
      "signalk.test",
    );


    expect(
      getInstrumentData()["environment.depth.belowTransducer"]
        ?.value,
    ).toBeNull();
  });

  it("routes atons.* context to AtoN store", () => {
    processDelta(
      {
        context: "atons.urn:mrn:imo:mmsi:993661302",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              {
                path: "navigation.position",
                value: { latitude: 48.5, longitude: -123.1 },
              },
              {
                path: "atonType",
                value: 21,
              },
            ],
          },
        ],
      },
      "signalk.test",
    );

    const aton = useAtoN.getState().atons["993661302"];
    expect(aton).toBeDefined();
    expect(aton.data["navigation.position"]?.value).toEqual({
      latitude: 48.5,
      longitude: -123.1,
    });
    expect(aton.data["atonType"]?.value).toBe(21);

    // Should NOT appear in AIS store
    flushAIS();
    expect(useAIS.getState().vessels["993661302"]).toBeUndefined();
  });

  it("expands empty-path AtoN deltas into individual properties", () => {
    processDelta(
      {
        context: "atons.urn:mrn:imo:mmsi:993661302",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              {
                path: "",
                value: { name: "SMITH ISLAND BUOY", mmsi: "993661302" },
              },
            ],
          },
        ],
      },
      "signalk.test",
    );

    const aton = useAtoN.getState().atons["993661302"];
    expect(aton).toBeDefined();
    expect(aton.data["name"]?.value).toBe("SMITH ISLAND BUOY");
    expect(aton.data["mmsi"]?.value).toBe("993661302");
  });

  it("handles bare AtoN context", () => {
    processDelta(
      {
        context: "atons.993661302",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              { path: "atonType", value: 25 },
            ],
          },
        ],
      },
      "signalk.test",
    );

    expect(useAtoN.getState().atons["993661302"]).toBeDefined();
  });
});

describe("SignalKClient", () => {
  let mockWs: {
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    onmessage: ((event: { data: string }) => void) | null;
    onerror: (() => void) | null;
    send: jest.Mock;
    close: jest.Mock;
  };

  beforeEach(() => {
    mockWs = {
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      send: jest.fn(),
      close: jest.fn(),
    };

    global.WebSocket = jest.fn().mockImplementation(() => mockWs) as unknown as typeof WebSocket;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("connects and transitions to connected state", () => {
    const states: SignalKClientState[] = [];
    const client = new SignalKClient("ws://test:3000/signalk/v1/stream", "test", {
      onStateChange: (s) => states.push(s),
    });

    client.connect();
    expect(states).toContain("connecting");

    mockWs.onopen!();
    expect(states).toContain("connected");
    expect(client.state).toBe("connected");

    client.disconnect();
  });

  it("skips hello messages", () => {
    const client = new SignalKClient("ws://test:3000/signalk/v1/stream", "test");
    client.connect();
    mockWs.onopen!();

    mockWs.onmessage!({
      data: JSON.stringify({
        version: "1.0.0",
        name: "test-server",
        self: "vessels.self",
      }),
    });


    // Hello should not update instrument store
    expect(Object.keys(getInstrumentData())).toHaveLength(0);

    client.disconnect();
  });

  it("processes delta messages into stores", () => {
    const client = new SignalKClient("ws://test:3000/signalk/v1/stream", "test.sk");
    client.connect();
    mockWs.onopen!();

    mockWs.onmessage!({
      data: JSON.stringify({
        context: "vessels.self",
        updates: [
          {
            timestamp: "2026-03-19T10:30:00.000Z",
            values: [
              { path: "environment.depth.belowTransducer", value: 8.7 },
            ],
          },
        ],
      }),
    });


    expect(
      getInstrumentData()["environment.depth.belowTransducer"]
        ?.value,
    ).toBe(8.7);

    client.disconnect();
  });

  it("sends subscription messages", () => {
    const client = new SignalKClient("ws://test:3000/signalk/v1/stream", "test");
    client.connect();
    mockWs.onopen!();

    client.subscribe([
      { path: "environment.depth.*", period: 1000 },
    ]);

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        context: "vessels.self",
        subscribe: [{ path: "environment.depth.*", period: 1000 }],
      }),
    );

    client.disconnect();
  });

  it("reconnects with exponential backoff", () => {
    const states: SignalKClientState[] = [];
    const client = new SignalKClient("ws://test:3000/signalk/v1/stream", "test", {
      onStateChange: (s) => states.push(s),
    });

    client.connect();
    mockWs.onopen!();

    // Simulate disconnect
    mockWs.onclose!();
    expect(client.state).toBe("disconnected");

    // After 1s (initial backoff), should reconnect
    jest.advanceTimersByTime(1000);
    expect(global.WebSocket).toHaveBeenCalledTimes(2);

    // Simulate another disconnect
    mockWs.onclose!();
    // Next backoff is 2s
    jest.advanceTimersByTime(1000);
    expect(global.WebSocket).toHaveBeenCalledTimes(2); // not yet
    jest.advanceTimersByTime(1000);
    expect(global.WebSocket).toHaveBeenCalledTimes(3);

    client.disconnect();
  });

  it("does not reconnect after disconnect() is called", () => {
    const client = new SignalKClient("ws://test:3000/signalk/v1/stream", "test");
    client.connect();
    mockWs.onopen!();

    client.disconnect();
    jest.advanceTimersByTime(60_000);
    // Only the initial connect call
    expect(global.WebSocket).toHaveBeenCalledTimes(1);
  });

  it("resets backoff on successful connection", () => {
    const client = new SignalKClient("ws://test:3000/signalk/v1/stream", "test");

    client.connect();
    mockWs.onopen!();
    mockWs.onclose!();

    // First reconnect at 1s
    jest.advanceTimersByTime(1000);
    // Connect succeeds — backoff should reset
    mockWs.onopen!();
    mockWs.onclose!();

    // Should reconnect at 1s again (not 2s)
    jest.advanceTimersByTime(1000);
    expect(global.WebSocket).toHaveBeenCalledTimes(3);

    client.disconnect();
  });
});
