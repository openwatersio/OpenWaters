import {
  setAISStreamEnabled,
  useAISStream,
} from "@/aisstream/hooks/useAISStream";
import useTheme from "@/hooks/useTheme";
import {
  type DiscoveredService,
  startDiscovery,
  stopDiscovery,
} from "@/instruments/discovery";
import {
  type ConnectionStatus,
  addNMEAConnection,
  addSignalKConnection,
  disableConnection,
  enableConnection,
  useConnections,
} from "@/instruments/hooks/useConnections";
import SheetView from "@/ui/SheetView";
import { Button, Host, HStack, Image, List, Picker, ProgressView, Section, Spacer, Text, TextField, Toggle, VStack } from "@expo/ui/swift-ui";
import { autocorrectionDisabled, buttonStyle, clipShape, font, foregroundStyle, frame, keyboardType, labelStyle, onTapGesture, pickerStyle, progressViewStyle, tag, textInputAutocapitalization, tint } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";

function typeLabel(type: string): string {
  return type === "signalk" ? "Signal K" : "NMEA";
}

function StatusIcon({ status, hasError }: { status: ConnectionStatus; hasError: boolean }) {
  const theme = useTheme();
  if (status === "connected") {
    return <Image systemName="antenna.radiowaves.left.and.right" color={theme.success} />;
  }
  if (status === "connecting") {
    return <ProgressView modifiers={[progressViewStyle("circular")]} />;
  }
  if (hasError) {
    return <Image systemName="exclamationmark.triangle.fill" color={theme.danger} />;
  }
  return <Image systemName="antenna.radiowaves.left.and.right.slash" color={theme.labelSecondary} />;
}

export default function Connections() {
  const { connections } = useConnections();
  const aisStream = useAISStream();
  const [discovered, setDiscovered] = useState<DiscoveredService[]>([]);
  const [addType, setAddType] = useState<"signalk" | "nmea">("signalk");
  const [signalKUrl, setSignalKUrl] = useState("");
  const [nmeaHost, setNmeaHost] = useState("");
  // Port field starts empty; the "10110" placeholder and the `|| 10110`
  // fallback in handleAddNMEA supply the default when left blank.
  const [nmeaPort, setNmeaPort] = useState("");
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
    setNmeaPort("");
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
          <Section
            title="AIS Stream"
            footer={
              <Text>
                {"Streams worldwide AIS vessel positions over the internet from aisstream.io. Shows vessels beyond your AIS receiver's range, or anywhere when no receiver is connected. Turn off to save cellular data."}
              </Text>
            }
          >
            <HStack spacing={12}>
              <VStack alignment="leading" spacing={2}>
                <Text modifiers={[foregroundStyle("primary"), font({ weight: "semibold" })]}>
                  Internet AIS
                </Text>
                <Text modifiers={[foregroundStyle("secondary"), font({ size: 12 })]}>
                  aisstream.io
                </Text>
              </VStack>
              <Spacer />
              <StatusIcon
                status={aisStream.status}
                hasError={!!aisStream.error}
              />
              <Toggle
                isOn={aisStream.enabled}
                onIsOnChange={setAISStreamEnabled}
              />
            </HStack>
          </Section>

          {connections.length > 0 ? (
            <Section title="Connections">
              {connections.map((conn) => (
                <HStack key={conn.id} spacing={12}>
                  <VStack
                    alignment="leading"
                    spacing={2}
                    modifiers={[
                      onTapGesture(() =>
                        router.push({ pathname: "/connection/[id]", params: { id: conn.id } }),
                      ),
                    ]}
                  >
                    <Text modifiers={[foregroundStyle("primary"), font({ weight: "semibold" })]}>
                      {typeLabel(conn.type)}
                    </Text>
                    <Text modifiers={[foregroundStyle("secondary"), font({ size: 12 })]}>
                      {conn.host}:{conn.port}
                    </Text>
                  </VStack>
                  <Spacer />
                  <StatusIcon status={conn.status} hasError={!!conn.error} />
                  <Toggle
                    isOn={!conn.disabled}
                    onIsOnChange={(on) =>
                      on ? enableConnection(conn.id) : disableConnection(conn.id)
                    }
                  />
                </HStack>
              ))}
            </Section>
          ) : null}

          {availableServices.length > 0 ? (
            <Section title="Discovered">
              {availableServices.map((service) => (
                <HStack
                  key={service.id}
                  spacing={12}
                  modifiers={[onTapGesture(() => handleAddDiscovered(service))]}
                >
                  <VStack alignment="leading" spacing={2}>
                    <Text modifiers={[foregroundStyle("primary"), font({ weight: "semibold" })]}>
                      {typeLabel(service.type)}
                    </Text>
                    <Text modifiers={[foregroundStyle("secondary"), font({ size: 12 })]}>
                      {service.host}:{service.port}
                    </Text>
                  </VStack>
                  <Spacer />
                  <Button
                    systemImage="plus"
                    label="Add"
                    modifiers={[
                      labelStyle("iconOnly"),
                      buttonStyle("borderedProminent"),
                      clipShape("circle"),
                      frame({ width: 32, height: 32 }),
                    ]}
                    onPress={() => handleAddDiscovered(service)}
                  />
                </HStack>
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
                  onTextChange={setSignalKUrl}
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
                  onTextChange={setNmeaHost}
                  modifiers={[
                    keyboardType("url"),
                    textInputAutocapitalization("never"),
                    autocorrectionDisabled(),
                  ]}
                />
                <TextField
                  placeholder="10110"
                  onTextChange={setNmeaPort}
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
