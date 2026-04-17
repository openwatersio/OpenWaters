import log from "@/logger";
import { persistProxy } from "@/persistProxy";

const logger = log.extend("connections");
import { proxy, useSnapshot } from "valtio";

import { pruneStaleVessels } from "@/ais/hooks/useAIS";
import { pruneStaleAtoNs } from "@/aton/hooks/useAtoN";
import { NMEATCPClient } from "@/instruments/nmea-tcp";
import {
  type SignalKEndpoints,
  SignalKClient,
  discoverEndpoints,
} from "@/instruments/signalk";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type Connection = {
  id: string;
  type: "signalk" | "nmea-tcp";
  url: string; // Signal K: base URL. NMEA TCP: "host:port" for display.
  host?: string; // NMEA TCP only
  port?: number; // NMEA TCP only
  name: string; // User-friendly name
  status: ConnectionStatus;
  error?: string;
};

interface State {
  connections: Connection[];
}

export const connectionsState = proxy<State>({
  connections: [],
});

persistProxy<State, State>(connectionsState, {
  name: "connections",
  // Don't persist runtime status — reset to disconnected on load.
  partialize: (state) => ({
    connections: state.connections.map((c) => ({
      ...c,
      status: "disconnected" as const,
      error: undefined,
    })),
  }),
});

export function useConnections() {
  return useSnapshot(connectionsState);
}

/** Select a single connection by ID */
export function useConnection(id: string) {
  return useSnapshot(connectionsState).connections.find((c) => c.id === id);
}

/** Active client instances, keyed by connection ID */
const clients = new Map<string, SignalKClient | NMEATCPClient>();

/** Prune timer for AIS vessels */
let pruneInterval: ReturnType<typeof setInterval> | null = null;

function updateConnectionStatus(
  id: string,
  status: ConnectionStatus,
  error?: string,
) {
  const conn = connectionsState.connections.find((c) => c.id === id);
  if (!conn) return;
  conn.status = status;
  conn.error = error;
}

/** Add a new Signal K connection via HTTP discovery and connect to it */
export async function addSignalKConnection(
  url: string,
  name?: string,
): Promise<Connection> {
  let endpoints: SignalKEndpoints;
  try {
    logger.info("discovering Signal K at:", url);
    endpoints = await discoverEndpoints(url);
    logger.info("discovered:", endpoints.wsUrl);
  } catch (e) {
    logger.warn("discovery failed:", e);
    throw new Error(
      `Could not discover Signal K server at ${url}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const id = `signalk-${Date.now()}`;
  const connection: Connection = {
    id,
    type: "signalk",
    url: url.replace(/\/$/, ""),
    host: new URL(url).hostname,
    port: parseInt(new URL(url).port, 10) || 3000,
    name: name || endpoints.serverId || "Signal K Server",
    status: "disconnected",
  };

  connectionsState.connections.push(connection);

  connectSignalKClient(id, endpoints.wsUrl);
  return connection;
}

/** @deprecated Use addSignalKConnection instead */
export const addConnection = addSignalKConnection;

/** Add a discovered Signal K connection (bypasses HTTP discovery, connects WebSocket directly) */
export function addDiscoveredSignalKConnection(
  host: string,
  port: number,
  name?: string,
): Connection {
  const wsUrl = `ws://${host}:${port}/signalk/v1/stream`;
  const id = `signalk-${Date.now()}`;
  const connection: Connection = {
    id,
    type: "signalk",
    url: `http://${host}:${port}`,
    host,
    port,
    name: name || "Signal K Server",
    status: "disconnected",
  };

  connectionsState.connections.push(connection);

  connectSignalKClient(id, wsUrl);
  return connection;
}

/** Add a new NMEA TCP connection and connect to it */
export function addNMEAConnection(
  host: string,
  port: number = 10110,
  name?: string,
): Connection {
  const id = `nmea-tcp-${Date.now()}`;
  const connection: Connection = {
    id,
    type: "nmea-tcp",
    url: `${host}:${port}`,
    host,
    port,
    name: name || `NMEA ${host}:${port}`,
    status: "disconnected",
  };

  connectionsState.connections.push(connection);

  connectNMEAClient(id, host, port);
  return connection;
}

/** Remove a connection and disconnect its client */
export function removeConnection(id: string) {
  disconnectClient(id);
  const idx = connectionsState.connections.findIndex((c) => c.id === id);
  if (idx !== -1) connectionsState.connections.splice(idx, 1);
}

/** Connect a specific saved connection */
export async function connectConnection(id: string) {
  const connection = connectionsState.connections.find((c) => c.id === id);
  if (!connection) return;

  if (connection.type === "nmea-tcp") {
    if (connection.host && connection.port) {
      connectNMEAClient(id, connection.host, connection.port);
    }
    return;
  }

  // Signal K — use direct WS URL if host/port available, otherwise HTTP discovery
  if (connection.host && connection.port) {
    const wsUrl = `ws://${connection.host}:${connection.port}/signalk/v1/stream`;
    connectSignalKClient(id, wsUrl);
  } else {
    try {
      const endpoints = await discoverEndpoints(connection.url);
      connectSignalKClient(id, endpoints.wsUrl);
    } catch {
      updateConnectionStatus(id, "disconnected", "Discovery failed");
    }
  }
}

/** Disconnect a specific connection */
export function disconnectConnection(id: string) {
  disconnectClient(id);
  updateConnectionStatus(id, "disconnected");
}

/** Connect all saved connections (call on app launch) */
export async function connectAll() {
  for (const connection of connectionsState.connections) {
    connectConnection(connection.id);
  }
  startPruneTimer();
}

/** Disconnect all connections */
export function disconnectAll() {
  for (const id of clients.keys()) {
    disconnectClient(id);
  }
  stopPruneTimer();
}

function connectSignalKClient(id: string, wsUrl: string) {
  disconnectClient(id);

  const client = new SignalKClient(wsUrl, `signalk.${id}`, {
    onStateChange: (state) => {
      updateConnectionStatus(id, state);
      if (state === "connected") {
        client.subscribeAIS();
        client.subscribeAtoN();
      }
    },
    onError: (error) => {
      updateConnectionStatus(id, "disconnected", error);
    },
  });

  clients.set(id, client);
  client.connect();
}

function connectNMEAClient(id: string, host: string, port: number) {
  disconnectClient(id);

  const client = new NMEATCPClient(host, port, `nmea.${id}`, {
    onStateChange: (state) => {
      updateConnectionStatus(id, state);
    },
    onError: (error) => {
      updateConnectionStatus(id, "disconnected", error);
    },
  });

  clients.set(id, client);
  client.connect();
}

function disconnectClient(id: string) {
  const client = clients.get(id);
  if (client) {
    client.disconnect();
    clients.delete(id);
  }
}

function startPruneTimer() {
  if (pruneInterval) return;
  pruneInterval = setInterval(() => {
    pruneStaleVessels();
    pruneStaleAtoNs();
  }, 30_000);
}

function stopPruneTimer() {
  if (pruneInterval) {
    clearInterval(pruneInterval);
    pruneInterval = null;
  }
}
