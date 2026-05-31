/**
 * Formats raw OpenENC S-57 feature properties into human-readable rows and
 * summaries. Depths are rendered in the user's preferred unit via `toDepth`.
 *
 * Attribute labels and enumerated-value meanings come from the generated S-57
 * catalogue (`catalogue.generated.ts`); only the app-specific concerns live
 * here — which properties to hide, depth/light formatting, and the S-52 light
 * abbreviations (which are *not* in the S-57 catalogue: it stores full words
 * like "flashing", charts show "Fl").
 *
 * OpenENC mixes three kinds of properties on a feature:
 *  - real S-57 attributes (DRVAL1, OBJNAM, COLOUR, LITCHR, …) — translated here
 *  - render tokens (AC/LC/AP/SY — colors, patterns, symbols)
 *  - S-57 record plumbing (RVER/GRUP/CID/LNAM/…)
 * The latter two have no entry in the S-57 catalogue, so they're dropped
 * structurally rather than by an explicit name list.
 */
import { ATTRIBUTES, ENUMS } from "@/charts/s57/catalogue.generated";
import { toDepth } from "@/hooks/usePreferredUnits";

export type AttrRow = { label: string; value: string };

type Props = Record<string, unknown>;

/**
 * Catalogue attributes we deliberately don't surface. Everything else is
 * filtered *structurally*: any property with no entry in the generated S-57
 * catalogue is dropped (see `attributeRows`), which removes OpenENC render
 * tokens (AC/LC/SY…), S-57 record plumbing (RVER/GRUP/FIDN/AGEN…), and the
 * denormalized depth-unit copies (METERS/FEET/FATHOMS) without naming them.
 * This set is only the handful that *are* real catalogue attributes but aren't
 * worth showing.
 */
const HIDDEN = new Set([
  "DRVAL1", "DRVAL2", // rendered as the Depth/Sounding row instead
  "SCAMIN", "SCAMAX", // display-scale plumbing
  "SORIND", "SORDAT", "RECDAT", "RECIND", // source / record metadata
  "NINFOM", "NTXTDS", "NOBJNM", // national-language duplicates of INFORM/TXTDSC/OBJNAM
]);

/**
 * Light character → S-52 chart abbreviation. Hand-maintained: the S-57
 * catalogue's LITCHR enum stores full words ("flashing"), but charts render
 * the S-52 abbreviation ("Fl"). Keyed by the LITCHR enumerant.
 */
const LIGHT_CHARACTERS: Record<number, string> = {
  1: "F",
  2: "Fl",
  3: "LFl",
  4: "Q",
  5: "VQ",
  6: "UQ",
  7: "Iso",
  8: "Oc",
  9: "IQ",
  10: "IVQ",
  11: "IUQ",
  12: "Mo",
  13: "FFl",
  14: "Fl+LFl",
  15: "Oc+Fl",
  16: "FFl",
  17: "Al.Oc",
  18: "Al.LFl",
  19: "Al.Fl",
  20: "Al.Gr",
  25: "Q+LFl",
  26: "VQ+LFl",
  27: "UQ+LFl",
  28: "Al",
  29: "F+Fl",
};

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Normalize an enumerated/list value into its code tokens. njord serializes
 * S-57 list attributes as a JSON string array (`'["4","4"]'`); single enums
 * arrive as a plain number. Handles both, plus a bare comma-separated string.
 */
export function codeTokens(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim());
  const s = String(value).trim();
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim());
    } catch {
      // not valid JSON — fall through to comma-splitting
    }
  }
  return s.split(",").map((p) => p.trim());
}

/**
 * Resolve an enumerated/list attribute value to capitalized meanings via the
 * catalogue's ENUMS table. Duplicate codes are collapsed (njord repeats them,
 * e.g. COLOUR `["4","4"]`).
 */
function lookupEnum(acronym: string, value: unknown): string {
  const table = ENUMS[acronym];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of codeTokens(value)) {
    if (!token || seen.has(token)) continue;
    seen.add(token);
    const meaning = table?.[Number(token)];
    out.push(meaning ? capitalize(meaning) : `Code ${token}`);
  }
  return out.join(", ");
}

/** Depth-area range ("Depth 1.8–3.6 m") or sounding ("11 ft"), in preferred units. */
export function formatDepth(props: Props): string | undefined {
  const drval1 = num(props.DRVAL1);
  if (drval1 !== undefined) {
    const lo = toDepth(drval1);
    const drval2 = num(props.DRVAL2);
    if (drval2 !== undefined) {
      return `${lo.value}–${toDepth(drval2).value} ${lo.abbr}`;
    }
    return `${lo.value} ${lo.abbr}`;
  }
  const meters = num(props.METERS);
  if (meters !== undefined) {
    const d = toDepth(meters);
    return `${d.value} ${d.abbr}`;
  }
  return undefined;
}

/** True when the depth value comes from a sounding rather than a depth area. */
export function isSounding(props: Props): boolean {
  return num(props.DRVAL1) === undefined && num(props.METERS) !== undefined;
}

/** Chart-style light description, e.g. "Fl(2) R 10s". */
export function lightDescription(props: Props): string | undefined {
  const litchr = num(props.LITCHR);
  if (litchr === undefined) return undefined;
  const character = LIGHT_CHARACTERS[litchr] ?? "";
  const group = props.SIGGRP ? String(props.SIGGRP) : "";
  const colour = props.COLOUR
    ? lookupEnum("COLOUR", props.COLOUR)
        .split(", ")
        .map((c) => c[0]) // R, G, W, …
        .join("")
    : "";
  const period = num(props.SIGPER);
  return [
    `${character}${group}`,
    colour,
    period !== undefined ? `${period}s` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Comma-joined colour names (for buoys/beacons without a light character). */
export function colourSummary(props: Props): string | undefined {
  return props.COLOUR ? lookupEnum("COLOUR", props.COLOUR) : undefined;
}

/** Translate the meaningful, non-hidden attributes into display rows. */
export function attributeRows(props: Props): AttrRow[] {
  const rows: AttrRow[] = [];
  const consumed = new Set<string>(HIDDEN);

  const depth = formatDepth(props);
  if (depth)
    rows.push({
      label: isSounding(props) ? "Sounding" : "Depth",
      value: depth,
    });

  const light = lightDescription(props);
  if (light) {
    rows.push({ label: "Light", value: light });
    ["LITCHR", "SIGGRP", "SIGPER", "SIGSEQ", "EXCLIT", "COLOUR"].forEach((k) =>
      consumed.add(k),
    );
  }

  for (const [key, value] of Object.entries(props)) {
    if (consumed.has(key)) continue;
    if (value === null || value === undefined || value === "") continue;
    if (key === "OBJNAM") continue; // shown as the title

    // Structural filter: skip anything that isn't a known S-57 attribute —
    // render tokens, record plumbing, and denormalized depth copies all lack a
    // catalogue entry.
    const attr = ATTRIBUTES[key];
    if (!attr) continue;

    const isCoded = attr.type === "enum" || attr.type === "list";
    rows.push({ label: attr.label, value: isCoded ? lookupEnum(key, value) : String(value) });
  }

  return rows;
}
