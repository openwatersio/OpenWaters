import { useCharts } from "@/charts/hooks/useCharts";
import { NavigationLink } from "@/ui/NavigationLink";
import SheetView from "@/ui/SheetView";
import { Host, LabeledContent, List, Section, Text } from "@expo/ui/swift-ui";
import { router, Stack, type ExternalPathString } from "expo-router";
import { useMemo } from "react";

type Attribution = {
  id: string;
  title: string;
  license: string;
  homepage?: string;
  attributions: string[];
};

export default function Attributions() {
  const charts = useCharts();

  const entries = useMemo<Attribution[]>(() => {
    return charts
      .filter((chart) => chart.catalogEntry)
      .map((chart) => {
        const entry = chart.catalogEntry!;
        const attributions = Array.from(
          new Set(
            entry.sources
              .map((s) => s.attribution)
              .filter((a): a is string => Boolean(a)),
          ),
        );
        return {
          id: chart.id,
          title: entry.title,
          license: entry.license,
          homepage: entry.homepage,
          attributions,
        };
      });
  }, [charts]);

  return (
    <SheetView id="attributions">
      <Stack.Screen options={{ title: "Attributions" }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.dismiss()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Host style={{ flex: 1 }}>
        <List>
          {entries.length === 0 ? (
            <Section>
              <Text>
                No charts installed yet. Install a chart from the chart picker
                to see attribution and license details for its data sources.
              </Text>
            </Section>
          ) : (
            entries.map((entry) => (
              <Section key={entry.id} title={entry.title}>
                <LabeledContent label="License">
                  <Text>{entry.license}</Text>
                </LabeledContent>
                {entry.homepage && (
                  <NavigationLink
                    label="Homepage"
                    destination={entry.homepage as ExternalPathString}
                  />
                )}
                {entry.attributions.map((attr) => (
                  <Text key={attr}>{attr}</Text>
                ))}
              </Section>
            ))
          )}
        </List>
      </Host>
    </SheetView>
  );
}
