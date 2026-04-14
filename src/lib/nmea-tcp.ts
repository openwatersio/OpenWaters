import { updateAISVessel } from "@/hooks/useAIS";
import { updatePaths } from "@/hooks/useInstruments";
import { updateFromSignalK } from "@/hooks/useNavigation";
import { decodeAIS } from "@/lib/ais";
import { parseSentence } from "@/lib/nmea";
import TcpSocket from "react-native-tcp-socket";

export type NMEATCPClientState = "disconnected" | "connecting" | "connected";

export type NMEATCPClientOptions = {
  onStateChange?: (state: NMEATCPClientState) => void;
  onError?: (error: string) => void;
};

const MAX_BACKOFF = 30_000;
const INITIAL_BACKOFF = 1_000;

/** TCP client for NMEA 0183 instrument data */
export class NMEATCPClient {
  private socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = INITIAL_BACKOFF;
  private shouldReconnect = false;
  private lineBuffer = "";
  private host: string;
  private port: number;
  private sourceId: string;
  private options: NMEATCPClientOptions;

  state: NMEATCPClientState = "disconnected";

  constructor(
    host: string,
    port: number,
    sourceId: string,
    options: NMEATCPClientOptions = {},
  ) {
    this.host = host;
    this.port = port;
    this.sourceId = sourceId;
    this.options = options;
  }

  /** Connect to the NMEA TCP source */
  connect() {
    this.shouldReconnect = true;
    this.lineBuffer = "";
    this.setState("connecting");

    const socket = TcpSocket.createConnection(
      { host: this.host, port: this.port },
      () => {
        this.backoff = INITIAL_BACKOFF;
        this.setState("connected");
      },
    );

    socket.setEncoding("utf8");

    socket.on("data", (data: string | Buffer) => {
      this.onData(typeof data === "string" ? data : data.toString("utf8"));
    });

    socket.on("error", (error: Error) => {
      this.options.onError?.(error.message);
    });

    socket.on("close", () => {
      this.socket = null;
      this.setState("disconnected");
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    this.socket = socket;
  }

  /** Disconnect and stop reconnecting */
  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.setState("disconnected");
  }

  /** Process incoming TCP data — line-buffered, splits on \r\n */
  private onData(chunk: string) {
    this.lineBuffer += chunk;

    let newlineIndex: number;
    while ((newlineIndex = this.lineBuffer.indexOf("\n")) !== -1) {
      const line = this.lineBuffer.substring(0, newlineIndex).replace(/\r$/, "");
      this.lineBuffer = this.lineBuffer.substring(newlineIndex + 1);

      if (!line) continue;
      this.processLine(line);
    }
  }

  /** Process a single NMEA sentence */
  private processLine(line: string) {
    // AIS sentences start with !
    if (line.startsWith("!")) {
      const result = decodeAIS(line, this.sourceId);
      if (!result) return;

      if (result.isSelf) {
        updatePaths(result.paths);
        updateFromSignalK();
      } else {
        updateAISVessel(result.mmsi, result.paths);
      }
      return;
    }

    // Standard NMEA sentences
    const result = parseSentence(line, this.sourceId);
    if (!result) return;

    updatePaths(result.paths);
    updateFromSignalK();
  }

  private setState(state: NMEATCPClientState) {
    this.state = state;
    this.options.onStateChange?.(state);
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
  }
}
