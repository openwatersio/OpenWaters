import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  type SignalKClientState,
  type SignalKEndpoints,
  SignalKClient,
  discoverEndpoints,
} from "@/lib/signalk";

export type Connection = {
  id: string;
  type: "signalk";
  url: string; // Base URL, e.g. "http://raspberrypi.local:3000"
  name: string; // User-friendly name
  status: SignalKClientState;
  error?: string;
};

interface State {
  connections: Connection[];
}

export const useConnections = create<State>()(
  persist(
    (): State => ({
      connections: [],
    }),
    {
      name: "connections",
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist runtime status — reset to disconnected on load
      partialize: (state) => ({
        connections: state.connections.map((c) => ({
          ...c,
          status: "disconnected" as const,
          error: undefined,
        })),
      }),
    },
  ),
);

/** Select a single connection by ID */
export function useConnection(id: string) {
  return useConnections((s) => s.connections.find((c) => c.id === id));
}

/** Active SignalKClient instances, keyed by connection ID */
const clients = new Map<string, SignalKClient>();

/** Prune timer for AIS vessels */
let pruneInterval: ReturnType<typeof setInterval> | null = null;

function updateConnectionStatus(
  id: string,
  status: SignalKClientState,
  error?: string,
) {
  useConnections.setState((s) => ({
    connections: s.connections.map((c) =>
      c.id === id ? { ...c, status, error } : c,
    ),
  }));
}

/** Add a new Signal K connection and connect to it */
export async function addConnection(
  url: string,
  name?: string,
): Promise<Connection> {
  let endpoints: SignalKEndpoints;
  try {
    endpoints = await discoverEndpoints(url);
  } catch (e) {
    throw new Error(
      `Could not discover Signal K server at ${url}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const id = `signalk-${Date.now()}`;
  const connection: Connection = {
    id,
    type: "signalk",
    url: url.replace(/\/$/, ""),
    name: name || endpoints.serverId || "Signal K Server",
    status: "disconnected",
  };

  useConnections.setState((s) => ({
    connections: [...s.connections, connection],
  }));

  connectClient(id, endpoints.wsUrl);
  return connection;
}

/** Remove a connection and disconnect its client */
export function removeConnection(id: string) {
  disconnectClient(id);
  useConnections.setState((s) => ({
    connections: s.connections.filter((c) => c.id !== id),
  }));
}

/** Connect a specific saved connection */
export async function connectConnection(id: string) {
  const connection = useConnections
    .getState()
    .connections.find((c) => c.id === id);
  if (!connection) return;

  try {
    const endpoints = await discoverEndpoints(connection.url);
    connectClient(id, endpoints.wsUrl);
  } catch {
    updateConnectionStatus(id, "disconnected", "Discovery failed");
  }
}

/** Disconnect a specific connection */
export function disconnectConnection(id: string) {
  disconnectClient(id);
  updateConnectionStatus(id, "disconnected");
}

/** Connect all saved connections (call on app launch) */
export async function connectAll() {
  const { connections } = useConnections.getState();
  for (const connection of connections) {
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

function connectClient(id: string, wsUrl: string) {
  // Disconnect existing client if any
  disconnectClient(id);

  const client = new SignalKClient(wsUrl, `signalk.${id}`, {
    onStateChange: (state) => {
      updateConnectionStatus(id, state);
      if (state === "connected") {
        client.subscribeAIS();
      }
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
  const { pruneStaleVessels } = require("@/hooks/useAIS");
  pruneInterval = setInterval(() => {
    pruneStaleVessels();
  }, 30_000);
}

function stopPruneTimer() {
  if (pruneInterval) {
    clearInterval(pruneInterval);
    pruneInterval = null;
  }
}
