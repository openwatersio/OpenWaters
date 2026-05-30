import { useChartThumbnailStyle } from "@/charts/hooks/useChartThumbnailStyle";
import { formatBearing } from "@/geo";
import { toDistance } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import FeatureThumbnail from "@/map/components/FeatureThumbnail";
import { type NearbyItem, type NearbyKind, useNearbyFeatures } from "@/map/hooks/useNearbyFeatures";
import { useSelectionHandler } from "@/map/hooks/useSelection";
import { Button, HStack, Image, RNHostView, Section, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, lineLimit } from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";

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

        // For chart features, render a preview drawing the whole group together.
        let thumbnail = null;
        if (item.kind === "chart" && item.features && item.features.length > 0) {
          thumbnail = (
            <RNHostView matchContents>
              <View style={{ width: 36, height: 36, borderRadius: 4, overflow: "hidden" }}>
                <FeatureThumbnail
                  style={chartStyle}
                  styleKey={chartId}
                  features={item.features}
                  size={36}
                />
              </View>
            </RNHostView>
          );
        }

        return (
          <Button key={`${item.kind}:${item.id}`} onPress={() => navigate(item.kind, item.id)}>
            <HStack spacing={12}>
              {thumbnail || (
                <Image systemName={item.icon} size={20} color={iconColor(item, theme)} />
              )}
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
