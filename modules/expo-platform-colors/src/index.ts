import { requireNativeModule } from "expo";

type Scheme = "light" | "dark";
type Override = Scheme | "system";

interface NativeModule {
  resolveSync(name: string, style: Scheme): string;
  setOverrideUserInterfaceStyle(style: Override): void;
}

const native: NativeModule = requireNativeModule("ExpoPlatformColors");

/** Resolve a UIKit semantic color name to a hex string for the given scheme. */
export function resolveSemanticColor(name: string, scheme: Scheme): string {
  return native.resolveSync(name, scheme);
}

/**
 * Force the app-wide user interface style. Passing "system" clears the override
 * and falls back to the device setting. Propagates to every window, so
 * `@expo/ui` Host subtrees, GlassView, `useColorScheme()`, and presented
 * sheets all follow.
 */
export function setOverrideUserInterfaceStyle(style: Override): void {
  native.setOverrideUserInterfaceStyle(style);
}
