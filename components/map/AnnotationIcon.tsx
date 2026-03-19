import useTheme from '@/hooks/useTheme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SFSymbol, SymbolView } from 'expo-symbols';

export interface AnnotationIconProps {
  name: string;
  color?: string;
  size?: number;
}

type IconProps = Omit<AnnotationIconProps, 'name'>;
type IconFn = (props: IconProps) => any;

export const ICONS = {
  anchor: (props: IconProps) => <MaterialIcons name="anchor" {...props} />,
  bridge: (props: IconProps) => <MaterialCommunityIcons name="bridge" {...props} />,
  ferry: (props: IconProps) => <MaterialIcons name="directions-ferry" {...props} />,
  fish: (props: IconProps) => <SymbolIcon name="fish.fill" {...props} />,
  fuel: (props: IconProps) => <SymbolIcon name="fuelpump.fill" {...props} />,
  grocery: (props: IconProps) => <SymbolIcon name="cart.fill" {...props} />,
  obstruction: (props: IconProps) => <SymbolIcon name="circle.dotted" {...props} />,
  pin: (props: IconProps) => <SymbolIcon name="mappin" {...props} />,
  point: ({ size, ...props }: IconProps) => <SymbolIcon name="circle.fill" size={size ? size * 0.6 : undefined} {...props} />,
  restaurant: (props: IconProps) => <SymbolIcon name="fork.knife" {...props} />,
  sailboat: (props: IconProps) => <MaterialIcons name="sailing" {...props} />,
  fire: (props: IconProps) => <SymbolIcon name="flame.fill" {...props} />,
  trash: (props: IconProps) => <SymbolIcon name="trash.fill" {...props} />,
  // TODO:
  // - marina
  // - port
  // - ship
  // - kayak
  // - canoe
  // - motorboat
  // - megayacht
  // - fishingboat
  // - tugboat
  // - windmill
  // - harbor
  // - dock
  // - pier
  // - boatyard
} satisfies Record<string, IconFn>;

export type AnnotationIconName = keyof typeof ICONS;

export function AnnotationIcon({ name, color, size }: AnnotationIconProps) {
  const theme = useTheme();
  const Icon = ICONS[name as AnnotationIconName] ?? DefaultIcon;

  return <Icon color={color || theme.textPrimary} size={size || 24} />;
}

// Adapt SymbolView to the interface expected by Annotation's icon prop
function SymbolIcon({ name, color, size }: { name: SFSymbol; color?: string, size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

export function DefaultIcon(props: IconProps) {
  return <SymbolIcon name="mappin" {...props} />;
}
