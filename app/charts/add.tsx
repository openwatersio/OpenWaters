import type { CatalogSource } from "@/catalog/types";
import ChartPreview from "@/components/charts/ChartPreview";
import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import useTheme from "@/hooks/useTheme";
import { detectFile, detectUrl } from "@/lib/charts/detect";
import { installManualChart } from "@/lib/charts/install";
import { buildPreviewStyle, computeBounds } from "@/lib/charts/sources";
import {
  Button,
  Form,
  Host,
  RNHostView,
  Section,
  Stepper,
  Text,
  TextField,
  type TextFieldRef,
  VStack,
} from "@expo/ui/swift-ui";
import {
  autocorrectionDisabled,
  disabled,
  foregroundStyle,
  frame,
  listRowInsets,
  textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import { File } from "expo-file-system";
import { router, Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";

type DetectStatus =
  | { state: "idle" }
  | { state: "detecting" }
  | { state: "detected"; sources: CatalogSource[]; suggestedName?: string }
  | { state: "error"; message: string };

export default function AddChart() {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<DetectStatus>({ state: "idle" });
  const [saving, setSaving] = useState(false);
  const nameFieldRef = useRef<TextFieldRef>(null);

  const sources =
    status.state === "detected" ? status.sources : [];

  const handleUrlSubmit = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setStatus({ state: "detecting" });
    try {
      const result = await detectUrl(trimmed);
      setStatus({
        state: "detected",
        sources: [result.source],
        suggestedName: result.suggestedName,
      });
      if (result.suggestedName && !name.trim()) {
        setName(result.suggestedName);
        nameFieldRef.current?.setText(result.suggestedName);
      }
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [name]);

  const handleFilePick = useCallback(async () => {
    setStatus({ state: "detecting" });
    try {
      const picked = await File.pickFileAsync();
      const source = Array.isArray(picked) ? picked[0] : picked;
      if (!source) {
        setStatus({ state: "idle" });
        return;
      }
      const result = await detectFile(source.uri, source.name);
      setStatus({
        state: "detected",
        sources: [result.source],
        suggestedName: result.suggestedName,
      });
      if (result.suggestedName && !name.trim()) {
        setName(result.suggestedName);
        nameFieldRef.current?.setText(result.suggestedName);
      }
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [name]);

  const handleAddSource = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || status.state !== "detected") return;

    setStatus((prev) =>
      prev.state === "detected"
        ? { ...prev, state: "detecting" as const }
        : { state: "detecting" },
    );
    try {
      const result = await detectUrl(trimmed);
      setStatus((prev) => ({
        state: "detected" as const,
        sources: [
          ...(prev.state === "detected" ? prev.sources : sources),
          result.source,
        ],
      }));
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [status, sources]);

  const handleUpdateSource = useCallback(
    (index: number, updated: CatalogSource) => {
      setStatus((prev) => {
        if (prev.state !== "detected") return prev;
        const next = [...prev.sources];
        next[index] = updated;
        return { ...prev, sources: next };
      });
    },
    [],
  );

  const handleRemoveSource = useCallback(
    (index: number) => {
      setStatus((prev) => {
        if (prev.state !== "detected") return prev;
        const next = prev.sources.filter((_, i) => i !== index);
        if (next.length === 0) return { state: "idle" };
        return { ...prev, sources: next };
      });
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!name.trim() || sources.length === 0) return;
    setSaving(true);
    try {
      await installManualChart(name.trim(), sources);
      router.back();
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      setSaving(false);
    }
  }, [name, sources]);

  const canSave = name.trim().length > 0 && sources.length > 0 && !saving;
  const hasSources = sources.length > 0;

  const previewStyle = useMemo(
    () => (hasSources ? buildPreviewStyle(sources) : null),
    [hasSources, sources],
  );
  const previewBounds = useMemo(
    () => (hasSources ? computeBounds(sources) : undefined),
    [hasSources, sources],
  );

  return (
    <SheetView id="charts-add">
      <SheetHeader title="Add Chart" />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="chevron.left"
          onPress={() => router.back()}
        >
          Back
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      {hasSources ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="checkmark"
            onPress={handleSave}
            variant={canSave ? "prominent" : undefined}
            disabled={!canSave}
          >
            {saving ? "Saving..." : "Save"}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}

      <Host style={{ flex: 1 }}>
        <Form>
          {!hasSources ? (
            <Section
              header={<Text>Add a chart source</Text>}
              footer={
                <Text>
                  Paste a tile URL, style JSON URL, or TileJSON URL. Or choose a
                  local .mbtiles file.
                </Text>
              }
            >
              <TextField
                placeholder="https://..."
                onSubmit={handleUrlSubmit}
                autocorrection={false}
                keyboardType="url"
                modifiers={[
                  textInputAutocapitalization("never"),
                  autocorrectionDisabled(),
                ]}
              />
              <Button
                systemImage="doc.badge.plus"
                label={
                  status.state === "detecting"
                    ? "Detecting..."
                    : "Choose File..."
                }
                onPress={handleFilePick}
                modifiers={[disabled(status.state === "detecting")]}
              />
            </Section>
          ) : null}

          {status.state === "detecting" && !hasSources ? (
            <Section>
              <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                Detecting source type...
              </Text>
            </Section>
          ) : null}

          {status.state === "error" ? (
            <Section>
              <Text modifiers={[foregroundStyle(theme.danger)]}>
                {status.message}
              </Text>
            </Section>
          ) : null}

          {hasSources ? (
            <>
              <Section>
                <TextField
                  ref={nameFieldRef}
                  placeholder="Chart Name"
                  defaultValue={name}
                  onChangeText={setName}
                  autocorrection={false}
                />
              </Section>

              {previewStyle ? (
                <VStack
                  modifiers={[
                    listRowInsets({ top: -0.001, bottom: 0 }),
                    frame({ height: 200 }),
                  ]}
                >
                  <RNHostView>
                    <ChartPreview
                      mapStyle={previewStyle}
                      bounds={previewBounds}
                    />
                  </RNHostView>
                </VStack>
              ) : null}

              {sources.map((source, index) => (
                <SourceCard
                  key={`${source.type}-${index}`}
                  source={source}
                  onUpdate={(updated) => handleUpdateSource(index, updated)}
                  onRemove={() => handleRemoveSource(index)}
                />
              ))}

              <Section
                header={<Text>Add another source</Text>}
              >
                <TextField
                  placeholder="https://..."
                  onSubmit={handleAddSource}
                  autocorrection={false}
                  keyboardType="url"
                  modifiers={[
                    textInputAutocapitalization("never"),
                    autocorrectionDisabled(),
                  ]}
                />
                <Button
                  systemImage="doc.badge.plus"
                  label="Choose File..."
                  onPress={handleFilePick}
                />
              </Section>
            </>
          ) : null}
        </Form>
      </Host>
    </SheetView>
  );
}

// ---------------------------------------------------------------------------
// Source card
// ---------------------------------------------------------------------------

function SourceCard({
  source,
  onUpdate,
  onRemove,
}: {
  source: CatalogSource;
  onUpdate: (source: CatalogSource) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();

  const typeLabel =
    source.type === "style"
      ? "Style JSON"
      : source.type === "raster"
        ? "Raster Tiles"
        : source.type === "mbtiles"
          ? "MBTiles"
          : "PMTiles";

  return (
    <Section
      header={<Text>{typeLabel}</Text>}
    >
      <TextField
        placeholder="Source Title"
        defaultValue={source.title}
        onChangeText={(title) => onUpdate({ ...source, title })}
        autocorrection={false}
      />

      {"url" in source && source.url ? (
        <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
          {source.url}
        </Text>
      ) : null}

      {"tiles" in source && source.tiles?.[0] ? (
        <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
          {source.tiles[0]}
        </Text>
      ) : null}

      {source.type !== "style" ? (
        <>
          <Stepper
            label={`Min zoom: ${source.minzoom ?? 0}`}
            value={source.minzoom ?? 0}
            min={0}
            max={source.maxzoom ?? 24}
            step={1}
            onValueChange={(minzoom) =>
              onUpdate({ ...source, minzoom } as CatalogSource)
            }
          />
          <Stepper
            label={`Max zoom: ${source.maxzoom ?? 22}`}
            value={source.maxzoom ?? 22}
            min={source.minzoom ?? 0}
            max={24}
            step={1}
            onValueChange={(maxzoom) =>
              onUpdate({ ...source, maxzoom } as CatalogSource)
            }
          />
          <Stepper
            label={`Tile size: ${source.tileSize ?? 256}`}
            value={source.tileSize ?? 256}
            min={256}
            max={1024}
            step={256}
            onValueChange={(tileSize) =>
              onUpdate({ ...source, tileSize } as CatalogSource)
            }
          />
          {source.attribution != null ? (
            <TextField
              placeholder="Attribution"
              defaultValue={source.attribution}
              onChangeText={(attribution) =>
                onUpdate({ ...source, attribution } as CatalogSource)
              }
              autocorrection={false}
            />
          ) : null}
        </>
      ) : null}

      <Button
        systemImage="trash"
        label="Remove Source"
        role="destructive"
        onPress={onRemove}
      />
    </Section>
  );
}
