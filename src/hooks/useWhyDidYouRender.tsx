import log from "@/logger";
import { useRef } from "react";

export function useWhyDidYouRender(name: string, values: Record<string, unknown>) {
  // Dev-only re-render tracker: comparing against and updating the previous
  // values during render is the entire mechanism, so render-time ref access
  // is intentional here.
  /* eslint-disable react-hooks/refs */
  const prev = useRef<Record<string, unknown>>({});
  const changed = Object.entries(values)
    .filter(([k, v]) => prev.current[k] !== v)
    .map(([k]) => k);
  if (changed.length > 0) log.debug(`[${name}] re-render, changed:`, changed);
  prev.current = values;
  /* eslint-enable react-hooks/refs */
}
