import AnchorIcon from "@/assets/map/svg/marker-anchor.svg";
import BridgeIcon from "@/assets/map/svg/marker-bridge.svg";
import FerryIcon from "@/assets/map/svg/marker-ferry.svg";
import FireIcon from "@/assets/map/svg/marker-fire.svg";
import FishIcon from "@/assets/map/svg/marker-fish.svg";
import FuelIcon from "@/assets/map/svg/marker-fuel.svg";
import GroceryIcon from "@/assets/map/svg/marker-grocery.svg";
import HomeIcon from "@/assets/map/svg/marker-home.svg";
import LifepreserverIcon from "@/assets/map/svg/marker-lifepreserver.svg";
import ObstructionIcon from "@/assets/map/svg/marker-obstruction.svg";
import PinIcon from "@/assets/map/svg/marker-pin.svg";
import PointIcon from "@/assets/map/svg/marker-point.svg";
import RestaurantIcon from "@/assets/map/svg/marker-restaurant.svg";
import SailboatIcon from "@/assets/map/svg/marker-sailboat.svg";
import TrashIcon from "@/assets/map/svg/marker-trash.svg";
import useTheme from "@/hooks/useTheme";
import type { ImageSourcePropType } from "react-native";
import type { SvgProps } from "react-native-svg";

type SvgComponent = React.FC<SvgProps>;

/**
 * Single registry for marker icons. Each entry pairs the SVG component
 * (for React rendering in Annotation) with the SDF PNG (for MapLibre's
 * SymbolLayer). Adding a new icon = one entry here + the SVG/PNG files.
 */
const ICON_REGISTRY: Record<
  string,
  { svg: SvgComponent; png: ImageSourcePropType }
> = {
  anchor: { svg: AnchorIcon, png: require("@/assets/map/png/marker-anchor.png") },
  bridge: { svg: BridgeIcon, png: require("@/assets/map/png/marker-bridge.png") },
  ferry: { svg: FerryIcon, png: require("@/assets/map/png/marker-ferry.png") },
  fire: { svg: FireIcon, png: require("@/assets/map/png/marker-fire.png") },
  fish: { svg: FishIcon, png: require("@/assets/map/png/marker-fish.png") },
  fuel: { svg: FuelIcon, png: require("@/assets/map/png/marker-fuel.png") },
  grocery: { svg: GroceryIcon, png: require("@/assets/map/png/marker-grocery.png") },
  home: { svg: HomeIcon, png: require("@/assets/map/png/marker-home.png") },
  lifepreserver: { svg: LifepreserverIcon, png: require("@/assets/map/png/marker-lifepreserver.png") },
  obstruction: { svg: ObstructionIcon, png: require("@/assets/map/png/marker-obstruction.png") },
  pin: { svg: PinIcon, png: require("@/assets/map/png/marker-pin.png") },
  point: { svg: PointIcon, png: require("@/assets/map/png/marker-point.png") },
  restaurant: { svg: RestaurantIcon, png: require("@/assets/map/png/marker-restaurant.png") },
  sailboat: { svg: SailboatIcon, png: require("@/assets/map/png/marker-sailboat.png") },
  trash: { svg: TrashIcon, png: require("@/assets/map/png/marker-trash.png") },
};

/** SVG components keyed by icon name (for React rendering). */
export const ICONS: Record<string, SvgComponent> = Object.fromEntries(
  Object.entries(ICON_REGISTRY).map(([k, v]) => [k, v.svg]),
);

/** All icon names. */
export const ICON_NAMES = Object.keys(ICON_REGISTRY);

/** MapLibre image entries keyed by sprite ID (for <Images> registration). */
export const MARKER_IMAGES: Record<string, { source: ImageSourcePropType; sdf: true }> =
  Object.fromEntries(
    Object.entries(ICON_REGISTRY).map(([k, v]) => [
      `marker-${k}`,
      { source: v.png, sdf: true as const },
    ]),
  );

export type AnnotationIconName = keyof typeof ICON_REGISTRY;

export interface AnnotationIconProps {
  name: string;
  color?: string;
  size?: number;
}

export function AnnotationIcon({ name, color, size = 24 }: AnnotationIconProps) {
  const theme = useTheme();
  const Icon = ICONS[name] ?? ICONS.pin;

  return <Icon width={size} height={size} color={color ?? theme.textPrimary} />;
}
