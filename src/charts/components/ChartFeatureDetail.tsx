import FeatureInspector from "@/charts/components/FeatureInspector";
import describeS57Feature, { type DescribedFeature } from "@/charts/s57";
import { groupFeatures } from "@/charts/s57/relations";
import DistanceAndBearingText from "@/map/components/DistanceAndBearingText";
import SheetBottomToolbar from "@/map/components/SheetBottomToolbar";
import { mapRef } from "@/map/hooks/useMapRef";
import MarkerButton from "@/markers/components/MarkerButton";
import { ensureVisible } from "@/navigation/components/NavigationCamera";
import RouteButton from "@/routes/components/RouteButton";
import SheetHeader from "@/ui/SheetHeader";
import { Form, Host, LabeledContent, Section, Text } from "@expo/ui/swift-ui";
import { font, foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { showLocation } from "react-native-map-link";

/** Chart-feature id is "lon,lat,LNAM" (LNAM is hex, no commas). */
function parseId(id: string): { latitude: number; longitude: number; lnam: string } {
  const [lonStr, latStr, lnam] = id.split(",");
  return { longitude: Number(lonStr), latitude: Number(latStr), lnam: lnam ?? "" };
}

export default function ChartFeatureDetail({ id }: { id: string }) {
  const { latitude, longitude, lnam } = useMemo(() => parseId(id), [id]);
  // The tapped feature plus any related features (its light, fog signal, …),
  // primary first. Shown together as one detail view.
  const [features, setFeatures] = useState<GeoJSON.Feature[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [inspecting, setInspecting] = useState(false);

  // Bring the feature into view if it isn't already (deep-link or panned away).
  useFocusEffect(
    useCallback(() => {
      ensureVisible({ latitude, longitude });
    }, [latitude, longitude]),
  );

  // Recover the full feature by matching LNAM against rendered features.
  // Matching JS-side (rather than a query filter) avoids the `["id"]`-filter
  // NSException; a fly from ensureVisible may need a retry once tiles render.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async (attempt: number) => {
      const map = mapRef.current;
      if (!map) {
        setLoading(false);
        return;
      }
      const rendered = (await map.queryRenderedFeatures()) ?? [];
      if (cancelled) return;
      const group = groupFeatures(lnam, rendered);
      if (group) {
        setFeatures([group.primary, ...group.related]);
        setLoading(false);
      } else if (attempt < 2) {
        timer = setTimeout(() => run(attempt + 1), 600);
      } else {
        setLoading(false);
      }
    };

    run(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [lnam]);

  // Describe every feature in the group; primary is first. Members with no
  // OBJL (shouldn't happen post-grouping) are dropped.
  const described = useMemo<DescribedFeature[]>(
    () =>
      (features ?? [])
        .map((f) => describeS57Feature(f.properties ?? {}))
        .filter((d): d is DescribedFeature => d !== null),
    [features],
  );
  const primary = described[0] ?? null;

  const title = primary?.title ?? "Chart Feature";
  const subtitle = primary
    ? title === primary.class.label
      ? primary.subtitle
      : [primary.class.label, primary.subtitle].filter(Boolean).join(" · ")
    : undefined;

  const valueMods = [font({ size: 15 }), foregroundStyle("secondary")];

  // Section heading for a related feature: its class label, plus its own name
  // when it has one (e.g. a named light) so the label isn't lost.
  const relatedHeading = (d: DescribedFeature) =>
    d.title === d.class.label ? d.class.label : `${d.class.label} — ${d.title}`;

  return (
    <>
      <SheetHeader title={title} subtitle={subtitle} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="square.and.arrow.up"
          onPress={() => showLocation({ latitude, longitude, title })}
        >
          Open In…
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <SheetBottomToolbar>
        <MarkerButton latitude={latitude} longitude={longitude} />
        <RouteButton latitude={latitude} longitude={longitude} />
        {__DEV__ && features && features.length > 0 && (
          <Stack.Toolbar.Button icon="curlybraces" onPress={() => setInspecting(true)} />
        )}
      </SheetBottomToolbar>
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            <DistanceAndBearingText latitude={latitude} longitude={longitude} />
          </Section>

          {described.map((d, di) =>
            d.attributes.length > 0 ? (
              <Section
                key={`${d.lnam || di}`}
                title={di === 0 ? d.class.label : relatedHeading(d)}
              >
                {d.attributes.map((row, i) => (
                  <LabeledContent key={`${row.label}-${i}`} label={row.label}>
                    <Text modifiers={valueMods}>{row.value}</Text>
                  </LabeledContent>
                ))}
              </Section>
            ) : null,
          )}

          {!loading && !primary && (
            <Section>
              <Text>Feature not found</Text>
            </Section>
          )}
        </Form>
      </Host>
      <FeatureInspector
        value={features}
        visible={inspecting}
        onClose={() => setInspecting(false)}
      />
    </>
  );
}
