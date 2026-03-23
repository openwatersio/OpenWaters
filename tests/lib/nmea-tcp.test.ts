import { flushAIS, useAIS } from "@/hooks/useAIS";
import { getInstrumentData, resetInstrumentStore } from "@/hooks/useInstruments";
import { type NMEATCPClientState, NMEATCPClient } from "@/lib/nmea-tcp";

// Mock react-native-tcp-socket
const mockSocket = {
  setEncoding: jest.fn(),
  on: jest.fn(),
  destroy: jest.fn(),
};

jest.mock("react-native-tcp-socket", () => ({
  createConnection: jest.fn((_opts: unknown, callback: () => void) => {
    // Call connect callback asynchronously
    setTimeout(callback, 0);
    return mockSocket;
  }),
}));

const SOURCE = "nmea.tcp.test";

// Reset stores and mocks between tests
const initialAIS = useAIS.getState();

beforeEach(() => {
  resetInstrumentStore();
  useAIS.setState(initialAIS, true);
  mockSocket.on.mockReset();
  mockSocket.setEncoding.mockReset();
  mockSocket.destroy.mockReset();
  const TcpSocket = require("react-native-tcp-socket");
  TcpSocket.createConnection.mockClear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Simulate receiving data by calling the 'data' event handler */
function emitData(data: string) {
  const dataHandler = mockSocket.on.mock.calls.find(
    ([event]: [string]) => event === "data",
  )?.[1];
  if (dataHandler) dataHandler(data);
}

/** Simulate socket close */
function emitClose() {
  const closeHandler = mockSocket.on.mock.calls.find(
    ([event]: [string]) => event === "close",
  )?.[1];
  if (closeHandler) closeHandler();
}

/** Trigger the connect callback */
function emitConnect() {
  jest.advanceTimersByTime(1);
}

describe("NMEATCPClient", () => {
  it("connects and transitions to connected state", () => {
    const states: NMEATCPClientState[] = [];
    const client = new NMEATCPClient("192.168.1.1", 10110, SOURCE, {
      onStateChange: (s) => states.push(s),
    });

    client.connect();
    expect(states).toContain("connecting");

    emitConnect();
    expect(states).toContain("connected");
    expect(client.state).toBe("connected");

    client.disconnect();
  });

  it("parses NMEA sentences and writes to instrument store", () => {
    const client = new NMEATCPClient("192.168.1.1", 10110, SOURCE);
    client.connect();
    emitConnect();

    // Send a depth sentence with correct checksum
    emitData("$SDDBT,17.5,f,5.3,M,2.9,F*38\r\n");

    const data = getInstrumentData();
    expect(data["environment.depth.belowTransducer"]?.value).toBe(5.3);
    expect(data["environment.depth.belowTransducer"]?.source).toBe(SOURCE);

    client.disconnect();
  });

  it("handles line buffering across multiple chunks", () => {
    const client = new NMEATCPClient("192.168.1.1", 10110, SOURCE);
    client.connect();
    emitConnect();

    // Send a sentence split across two chunks
    emitData("$SDDBT,17.5,f,5.3,");
    emitData("M,2.9,F*38\r\n");

    expect(
      getInstrumentData()["environment.depth.belowTransducer"]?.value,
    ).toBe(5.3);

    client.disconnect();
  });

  it("handles multiple sentences in one chunk", () => {
    const client = new NMEATCPClient("192.168.1.1", 10110, SOURCE);
    client.connect();
    emitConnect();

    emitData(
      "$SDDBT,17.5,f,5.3,M,2.9,F*38\r\n$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A\r\n",
    );

    const data = getInstrumentData();
    expect(data["environment.depth.belowTransducer"]?.value).toBe(5.3);
    expect(data["navigation.position"]).toBeDefined();

    client.disconnect();
  });

  it("decodes AIS sentences and writes to AIS store", () => {
    const client = new NMEATCPClient("192.168.1.1", 10110, SOURCE);
    client.connect();
    emitConnect();

    // Type 1 AIS: MMSI 265557232
    emitData("!AIVDM,1,1,,B,13u@Dt002s000000000000000000,0*63\r\n");

    flushAIS();

    const vessels = useAIS.getState().vessels;
    expect(vessels["265557232"]).toBeDefined();

    client.disconnect();
  });

  it("reconnects with exponential backoff", () => {
    const TcpSocket = require("react-native-tcp-socket");
    const states: NMEATCPClientState[] = [];
    const client = new NMEATCPClient("192.168.1.1", 10110, SOURCE, {
      onStateChange: (s) => states.push(s),
    });

    client.connect();
    emitConnect();

    // Simulate disconnect
    emitClose();
    expect(client.state).toBe("disconnected");

    // After 1s (initial backoff), should reconnect
    jest.advanceTimersByTime(1000);
    expect(TcpSocket.createConnection).toHaveBeenCalledTimes(2);

    client.disconnect();
  });

  it("does not reconnect after disconnect() is called", () => {
    const TcpSocket = require("react-native-tcp-socket");
    const client = new NMEATCPClient("192.168.1.1", 10110, SOURCE);
    client.connect();
    emitConnect();

    client.disconnect();
    jest.advanceTimersByTime(60_000);
    // Only the initial connect call
    expect(TcpSocket.createConnection).toHaveBeenCalledTimes(1);
  });

  it("ignores malformed sentences", () => {
    const client = new NMEATCPClient("192.168.1.1", 10110, SOURCE);
    client.connect();
    emitConnect();

    // Bad checksum — should be silently ignored
    emitData("$SDDBT,17.5,f,5.3,M,2.9,F*00\r\n");
    expect(
      getInstrumentData()["environment.depth.belowTransducer"],
    ).toBeUndefined();

    // Good sentence after bad — should still work
    emitData("$SDDBT,17.5,f,5.3,M,2.9,F*38\r\n");
    expect(
      getInstrumentData()["environment.depth.belowTransducer"]?.value,
    ).toBe(5.3);

    client.disconnect();
  });
});
