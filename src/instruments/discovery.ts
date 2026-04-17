import log from "@/logger";
import Zeroconf from "react-native-zeroconf";

const logger = log.extend("discovery");

export type DiscoveredService = {
  /** Unique key: "type-host:port" */
  id: string;
  /** mDNS service name */
  name: string;
  /** Connection type to create */
  type: "signalk" | "nmea-tcp";
  /** Resolved IP or hostname */
  host: string;
  /** Service port */
  port: number;
};

type DiscoveryCallbacks = {
  onFound: (service: DiscoveredService) => void;
  onLost: (id: string) => void;
};

/** Map Bonjour service type string (from fullName) to our connection type */
function connectionTypeFromFullName(
  fullName: string,
): "signalk" | "nmea-tcp" | null {
  if (fullName.includes("_signalk-http._tcp")) return "signalk";
  if (fullName.includes("_nmea-0183._tcp")) return "nmea-tcp";
  return null;
}

/** Bonjour service types to scan (sequentially, one at a time) */
const SCAN_TYPES = ["signalk-http", "nmea-0183"];

let instance: Zeroconf | null = null;
let callbacks: DiscoveryCallbacks | null = null;
let scanIndex = 0;
let scanTimer: ReturnType<typeof setTimeout> | null = null;

/** Track discovered services for deduplication */
const discovered = new Map<string, DiscoveredService>();

function makeId(type: string, host: string, port: number): string {
  return `${type}-${host}:${port}`;
}

/**
 * Start mDNS discovery for marine instrument services.
 * Scans for Signal K and NMEA 0183 TCP services sequentially
 * using a single Zeroconf instance to avoid event crosstalk.
 */
export function startDiscovery(
  onFound: (service: DiscoveredService) => void,
  onLost: (id: string) => void,
) {
  stopDiscovery();
  callbacks = { onFound, onLost };

  const zc = new Zeroconf();
  instance = zc;

  zc.on(
    "resolved",
    (service: {
      name: string;
      fullName: string;
      host: string;
      port: number;
    }) => {
      const connectionType = connectionTypeFromFullName(service.fullName);
      if (!connectionType) return;

      const host = service.host.replace(/\.$/, "");
      const id = makeId(connectionType, host, service.port);

      if (discovered.has(id)) return;

      const entry: DiscoveredService = {
        id,
        name: service.name,
        type: connectionType,
        host,
        port: service.port,
      };

      discovered.set(id, entry);
      callbacks?.onFound(entry);
    },
  );

  zc.on("remove", (name: string) => {
    for (const [id, entry] of discovered) {
      if (entry.name === name) {
        discovered.delete(id);
        callbacks?.onLost(id);
        break;
      }
    }
  });

  zc.on("error", (error: Error) => {
    logger.warn("scan error:", error);
  });

  // Scan each service type for 3 seconds, then move to the next
  scanIndex = 0;
  scanNext();
}

function scanNext() {
  if (!instance || scanIndex >= SCAN_TYPES.length) {
    // All types scanned — restart the cycle to keep discovering
    scanIndex = 0;
  }

  const type = SCAN_TYPES[scanIndex];
  instance?.scan(type, "tcp", "local.");

  const zc = instance;
  scanTimer = setTimeout(() => {
    if (!zc) return;
    zc.stop();
    scanIndex++;
    scanNext();
  }, 3000);
}

/** Stop all mDNS discovery scans */
export function stopDiscovery() {
  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
  if (instance) {
    instance.stop();
    instance.removeAllListeners();
    instance = null;
  }
  callbacks = null;
  discovered.clear();
}

/** Get all currently discovered services */
export function getDiscoveredServices(): DiscoveredService[] {
  return Array.from(discovered.values());
}
