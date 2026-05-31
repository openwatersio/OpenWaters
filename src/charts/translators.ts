import s57, { type DescribedFeature } from "@/charts/s57";

/** Turns a raw vector feature's properties into a {@link DescribedFeature}, or
 *  returns null when the feature isn't this translator's schema. */
export type ChartTranslator = (
  props: Record<string, unknown>,
) => DescribedFeature | null;

/**
 * Ordered chart-schema translators. Each self-detects by feature *shape* and
 * returns null when the feature isn't its schema (S-57 keys on a numeric
 * `OBJL`); the first non-null result wins.
 */
const TRANSLATORS: ChartTranslator[] = [s57];

/** Describe a vector chart feature by detecting its schema, or null if no known
 *  schema recognizes it (our own map overlays, unsupported sources). */
export function describeChartFeature(
  props: Record<string, unknown>,
): DescribedFeature | null {
  for (const translate of TRANSLATORS) {
    const described = translate(props);
    if (described) return described;
  }
  return null;
}
