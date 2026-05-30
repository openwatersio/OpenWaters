/**
 * Public entry point for the S-57 translation layer. Turns a raw OpenENC
 * feature's `properties` into a class label, icon, a short subtitle, and
 * human-readable attribute rows.
 *
 * Returns `null` when `properties` has no numeric `OBJL` — that's how we tell a
 * chart feature apart from our own map overlays (vessels, markers, location,
 * measurements), which a bounding-box query also returns.
 */
import {
  attributeRows,
  colourSummary,
  formatDepth,
  lightDescription,
  type AttrRow,
} from "./attributes";
import { getS57Class, type S57Class } from "./objects";

export type DescribedFeature = {
  lnam: string;
  objl: number;
  class: S57Class;
  title: string;
  subtitle?: string;
  attributes: AttrRow[];
};

export default function describeS57Feature(
  props: Record<string, unknown>,
): DescribedFeature | null {
  const objl = typeof props.OBJL === "number" ? props.OBJL : undefined;
  if (objl === undefined) return null;

  const cls = getS57Class(objl);
  const objnam =
    typeof props.OBJNAM === "string" && props.OBJNAM.trim()
      ? props.OBJNAM.trim()
      : undefined;
  const subtitle =
    formatDepth(props) ?? lightDescription(props) ?? colourSummary(props);

  return {
    lnam: typeof props.LNAM === "string" ? props.LNAM : "",
    objl,
    class: cls,
    title: objnam ?? cls.label,
    subtitle,
    attributes: attributeRows(props),
  };
}
