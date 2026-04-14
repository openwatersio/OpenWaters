import SheetView from "@/ui/SheetView";
import {
  addNMEAConnection,
  addSignalKConnection,
  useConnections,
} from "@/instruments/hooks/useConnections";
import {
  type DiscoveredService,
  startDiscovery,
  stopDiscovery,
} from "@/instruments/discovery";
import { Button, Host, LabeledContent, List, Picker, Section, Text, TextField } from "@expo/ui/swift-ui";
import { autocorrectionDisabled, foregroundStyle, keyboardType, pickerStyle, tag, textInputAutocapitalization, tint } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";

function typeLabel(type: string): string {
  return type === "signalk" ? "Signal K" : "NMEA";
}

export default function Connections() {
  const connections = useConnections((s) => s.connections);
  const [discovered, setDiscovered] = useState<DiscoveredService[]>([]);
  const [addType, setAddType] = useState<"signalk" | "nmea">("signalk");
  const [signalKUrl, setSignalKUrl] = useState("");
  const [nmeaHost, setNmeaHost] = useState("");
  const [nmeaPort, setNmeaPort] = useState("10110");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Start mDNS discovery when screen is visible
  useEffect(() => {
    startDiscovery(
      (service) =>
        setDiscovered((prev) =>
          prev.some((s) => s.id === service.id) ? prev : [...prev, service],
        ),
      (id) => setDiscovered((prev) => prev.filter((s) => s.id !== id)),
    );
    return () => {
      stopDiscovery();
      setDiscovered([]);
    };
  }, []);

  // Deduplicate and filter out already-connected services
  const existingUrls = new Set(connections.map((c) => c.url));
  const seen = new Set<string>();
  const availableServices = discovered.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    const url = s.type === "signalk" ? `http://${s.host}:${s.port}` : `${s.host}:${s.port}`;
    return !existingUrls.has(url);
  });

  const handleAddDiscovered = useCallback(async (service: DiscoveredService) => {
    setAdding(true);
    setError(null);
    try {
      if (service.type === "signalk") {
        await addSignalKConnection(
          `http://${service.host}:${service.port}`,
          service.name,
        );
      } else {
        addNMEAConnection(service.host, service.port, service.name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setAdding(false);
    }
  }, []);

  async function handleAddSignalK() {
    if (!signalKUrl.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addSignalKConnection(signalKUrl.trim());
      setSignalKUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setAdding(false);
    }
  }

  function handleAddNMEA() {
    const host = nmeaHost.trim();
    if (!host) return;
    const port = parseInt(nmeaPort, 10) || 10110;
    addNMEAConnection(host, port);
    setNmeaHost("");
    setNmeaPort("10110");
  }

  return (
    <SheetView id="connections">
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.dismiss()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <List>
          {availableServices.length > 0 ? (
            <Section title="Discovered">
              {availableServices.map((service) => (
                <Button
                  key={service.id}
                  onPress={() => handleAddDiscovered(service)}
                >
                  <LabeledContent
                    modifiers={[foregroundStyle("primary")]}
                    label={typeLabel(service.type)}
                  >
                    <Text>{service.host}:{service.port}</Text>
                  </LabeledContent>
                </Button>
              ))}
            </Section>
          ) : null}

          {connections.length > 0 ? (
            <Section title="Connections">
              {connections.map((conn) => (
                <Button
                  key={conn.id}
                  onPress={() => router.push({ pathname: "/connection/[id]", params: { id: conn.id } })}
                >
                  <LabeledContent
                    modifiers={[foregroundStyle("primary")]}
                    label={typeLabel(conn.type)}
                  >
                    <Text>{conn.host}:{conn.port}</Text>
                  </LabeledContent>

                </Button>
              ))}
            </Section>
          ) : null}

          <Section title="Add Connection">
            <Picker
              selection={addType}
              onSelectionChange={setAddType}
              modifiers={[pickerStyle("segmented")]}
            >
              <Text modifiers={[tag("signalk")]}>Signal K</Text>
              <Text modifiers={[tag("nmea")]}>NMEA</Text>
            </Picker>
            {addType === "signalk" ? (
              <>
                <TextField
                  placeholder="http://raspberrypi.local:3000"
                  defaultValue={signalKUrl}
                  onValueChange={setSignalKUrl}
                  modifiers={[
                    keyboardType("url"),
                    textInputAutocapitalization("never"),
                    autocorrectionDisabled(),
                  ]}
                />
                <Button
                  modifiers={[tint("primary")]}
                  label={adding ? "Connecting..." : "Add Server"}
                  onPress={handleAddSignalK}
                />
              </>
            ) : (
              <>
                <TextField
                  placeholder="192.168.1.1"
                  defaultValue={nmeaHost}
                  onValueChange={setNmeaHost}
                  modifiers={[
                    keyboardType("url"),
                    textInputAutocapitalization("never"),
                    autocorrectionDisabled(),
                  ]}
                />
                <TextField
                  placeholder="10110"
                  defaultValue={nmeaPort}
                  onValueChange={setNmeaPort}
                  modifiers={[
                    keyboardType("numeric"),
                    autocorrectionDisabled(),
                  ]}
                />
                <Button
                  modifiers={[tint("primary")]}
                  label="Add NMEA Source"
                  onPress={handleAddNMEA}
                />
              </>
            )}
          </Section>

          {error ? (
            <Section>
              <Text>{error}</Text>
            </Section>
          ) : null}
        </List>
      </Host>
    </SheetView>
  );
}
