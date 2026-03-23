import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { useAIS } from "@/hooks/useAIS";
import {
  connectConnection,
  disconnectConnection,
  removeConnection,
  useConnection,
} from "@/hooks/useConnections";
import { useInstrumentData } from "@/hooks/useInstruments";
import {
  Button,
  Form,
  Host,
  LabeledContent,
  Section,
  Text,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  monospacedDigit,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { router, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";

function statusLabel(status: string): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting...";
    default:
      return "Disconnected";
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return value.toFixed(4);
  if (typeof value === "string") return value;
  if (typeof value === "object" && "latitude" in value) {
    const pos = value as { latitude: number; longitude: number };
    return `${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`;
  }
  return String(value);
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function ConnectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const connection = useConnection(id);
  const instrumentData = useInstrumentData();
  const vesselCount = useAIS((s) => Object.keys(s.vessels).length);

  const valueMods = [font({ size: 15 }), monospacedDigit(), foregroundStyle("secondary")];

  if (!connection) {
    return (
      <SheetView id="connection-detail">
        <SheetHeader title="Connection" />
        <Host style={{ flex: 1 }}>
          <Form>
            <Section>
              <Text>Connection not found</Text>
            </Section>
          </Form>
        </Host>
      </SheetView>
    );
  }

  // Get the most recent instrument paths from this connection's source
  const sourcePrefix = connection.type === "nmea-tcp"
    ? `nmea.${connection.id}`
    : `signalk.${connection.id}`;
  const recentPaths = Object.entries(instrumentData)
    .filter(([, dp]) => dp.source.startsWith(sourcePrefix))
    .sort(([, a], [, b]) => b.timestamp - a.timestamp)
    .slice(0, 10);

  function confirmRemove() {
    Alert.alert(
      "Remove Connection",
      `Remove "${connection!.name}"? This will disconnect and forget the server.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeConnection(id);
            router.dismiss();
          },
        },
      ],
    );
  }

  return (
    <SheetView id="connection-detail">
      <SheetHeader title={connection.name} subtitle={connection.url} />
      <Host style={{ flex: 1 }}>
        <Form>
          <Section title="Status">
            <LabeledContent label="State">
              <Text modifiers={valueMods}>{statusLabel(connection.status)}</Text>
            </LabeledContent>
            <LabeledContent label="Type">
              <Text modifiers={valueMods}>
                {connection.type === "signalk" ? "Signal K" : "NMEA 0183 TCP"}
              </Text>
            </LabeledContent>
            <LabeledContent label={connection.type === "nmea-tcp" ? "Host" : "URL"}>
              <Text modifiers={valueMods}>{connection.url}</Text>
            </LabeledContent>
            {connection.error && (
              <LabeledContent label="Error">
                <Text modifiers={valueMods}>{connection.error}</Text>
              </LabeledContent>
            )}
            <LabeledContent label="AIS Vessels">
              <Text modifiers={valueMods}>{vesselCount}</Text>
            </LabeledContent>
          </Section>

          {recentPaths.length > 0 && (
            <Section title="Recent Data">
              {recentPaths.map(([path, dp]) => (
                <LabeledContent key={path} label={path}>
                  <Text modifiers={valueMods}>
                    {`${formatValue(dp.value)} · ${timeAgo(dp.timestamp)}`}
                  </Text>
                </LabeledContent>
              ))}
            </Section>
          )}

          <Section>
            {connection.status === "connected" ? (
              <Button
                modifiers={[tint("orange")]}
                label="Disconnect"
                onPress={() => disconnectConnection(id)}
              />
            ) : (
              <Button
                modifiers={[tint("primary")]}
                label="Connect"
                onPress={() => connectConnection(id)}
              />
            )}
            <Button
              role="destructive"
              label="Remove Connection"
              onPress={confirmRemove}
            />
          </Section>
        </Form>
      </Host>
    </SheetView>
  );
}
