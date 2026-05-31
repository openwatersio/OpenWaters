/**
 * S-57 object classes, keyed by `OBJL` (the integer object-class code OpenENC
 * includes on every chart feature).
 *
 * The class table is generated from the IHO S-57 Appendix A Object Catalogue
 * (see `catalogue.generated.ts` / `scripts/generate-s57.mjs`) — the full ~280
 * classes, not a hand-curated subset. Unknown codes fall back to a generic
 * descriptor so an unlisted feature still renders its `OBJNAM`.
 */
import { OBJECT_CLASSES } from "@/charts/s57/catalogue.generated";

export type S57Class = {
  acronym: string;
  label: string;
};

const GENERIC: S57Class = {
  acronym: "",
  label: "Chart feature",
};

/** Class metadata for an `OBJL` code, or a generic fallback for unlisted codes. */
export function getS57Class(objl: number | undefined): S57Class {
  return (objl !== undefined && OBJECT_CLASSES[objl]) || GENERIC;
}
