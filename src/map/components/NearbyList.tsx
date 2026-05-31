import { useChartThumbnailStyle } from "@/charts/hooks/useChartThumbnailStyle";
import { formatBearing } from "@/geo";
import { toDistance } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import FeatureThumbnail from "@/map/components/FeatureThumbnail";
import { type NearbyItem, type NearbyKind, useNearbyFeatures } from "@/map/hooks/useNearbyFeatures";
import { useSelectionHandler } from "@/map/hooks/useSelection";
import { Button, HStack, Image, RNHostView, Section, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, lineLimit } from "@expo/ui/swift-ui/modifiers";
import { SymbolView } from "expo-symbols";
import { View } from "react-native";

/** Fixed size of every row's leading icon/thumbnail box, so the title column
 *  starts at the same x regardless of which kind of leading content draws. */
const LEADING_SIZE = 36;

type Props = {
  center: { latitude: number; longitude: number };
  exclude?: { kind: NearbyKind; id: string };
};

function iconColor(item: NearbyItem, theme: ReturnType<typeof useTheme>): string {
  switch (item.kind) {
    case "vessel": return theme.ais;
    case "aton": return theme.aton;
    case "marker": return theme.markers;
    case "chart": return theme.accent;
  }
}

/**
 * Ranked list of features near `center` — chart features, vessels, AtoN, and
 * markers — rendered as a "Nearby" Form section. Reusable across detail sheets;
 * pass the subject as `exclude` so it doesn't list itself. Renders nothing when
 * there's nothing nearby.
 */
export default function NearbyList({ center, exclude }: Props) {
  const items = useNearbyFeatures(center, { exclude });
  const theme = useTheme();
  const navigate = useSelectionHandler();
  const { style: chartStyle, chartId } = useChartThumbnailStyle();

  if (items.length === 0) return null;

  return (
    <Section title="Nearby">
      {items.map((item) => {
        const dist = toDistance(item.distance);
        const detail = [
          item.subtitle,
          `${dist.value} ${dist.abbr} @ ${formatBearing(item.bearing)}`,
        ]
          .filter(Boolean)
          .join("  ·  ");

        // Every row's leading slot is the same fixed-size RN-hosted box, so the
        // title column lines up whether the row draws a chart thumbnail or an
        // SF Symbol. Chart features render a preview of the whole group; the
        // rest (and chart features that can't render) fall back to a symbol.
        const leading = (
          <RNHostView matchContents>
            <View
              style={{
                width: LEADING_SIZE,
                height: LEADING_SIZE,
                borderRadius: 4,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.kind === "chart" && item.features && item.features.length > 0 ? (
                <FeatureThumbnail
                  style={chartStyle}
                  styleKey={chartId}
                  features={item.features}
                  size={LEADING_SIZE}
                />
              ) : (
                <SymbolView
                  name={item.icon}
                  size={22}
                  tintColor={iconColor(item, theme)}
                  style={{ width: LEADING_SIZE, height: LEADING_SIZE }}
                />
              )}
            </View>
          </RNHostView>
        );

        return (
          <Button
            key={`${item.kind}:${item.id}`}
            // Chart features select as a location (id carries the LNAM hint) so
            // the one draggable selection pin shows and LocationDetail renders
            // their ChartFeatureDetail. Other kinds keep their own detail type.
            onPress={() => navigate(item.kind === "chart" ? "location" : item.kind, item.id)}
          >
            <HStack spacing={12}>
              {leading}
              <VStack alignment="leading" spacing={2}>
                <Text modifiers={[foregroundStyle(theme.label), lineLimit(1)]}>
                  {item.title}
                </Text>
                <Text
                  modifiers={[font({ size: 13 }), foregroundStyle("secondary"), lineLimit(1)]}
                >
                  {detail}
                </Text>
              </VStack>
              <Spacer />
              <Image systemName="chevron.right" size={13} color="secondary" />
            </HStack>
          </Button>
        );
      })}
    </Section>
  );
}
