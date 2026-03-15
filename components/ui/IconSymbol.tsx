import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, SymbolViewProps, SymbolWeight, SymbolType } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, View, ViewStyle, type StyleProp, type TextStyle } from 'react-native';

// Map MaterialIcons names to SymbolView names.
// See Symbols app for names: https://developer.apple.com/sf-symbols/
export const ICON_MAPPING: Partial<Record<ComponentProps<typeof MaterialIcons>['name'], SymbolViewProps['name']>> = {
  'layers': 'square.3.layers.3d',
  'my-location': 'location.fill',
  'location-searching': 'location',
  'zoom-in': 'plus',
  'zoom-out': 'minus',
  'fiber-manual-record': 'record.circle',
  'stop': 'stop.circle',
  'route': 'point.bottomleft.forward.to.arrow.triangle.scurvepath',
  'menu': 'line.3.horizontal',
  'close': 'xmark.circle.fill',
};

export type IconSymbolProps = {
  name: keyof typeof ICON_MAPPING;
  size?: number;
  color?: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle> | StyleProp<TextStyle>;
  weight?: SymbolWeight;
  type?: SymbolType;
}

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
  type,
}: IconSymbolProps) {
  return (
    <View style={[{ width: size, height: size }, style as StyleProp<ViewStyle>]}>
      <SymbolView
        weight={weight}
        tintColor={color}
        type={type}
        size={size}
        resizeMode="scaleAspectFit"
        name={ICON_MAPPING[name]!}
        fallback={<MaterialIcons color={color} size={size} name={name} />}
      />
    </View>
  );
}
