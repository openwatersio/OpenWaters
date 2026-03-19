import { useRef } from "react";

export function useWhyDidYouRender(name: string, values: Record<string, unknown>) {
  const prev = useRef<Record<string, unknown>>({});
  const changed = Object.entries(values)
    .filter(([k, v]) => prev.current[k] !== v)
    .map(([k]) => k);
  if (changed.length > 0) console.log(`[${name}] re-render, changed:`, changed);
  prev.current = values;
}
