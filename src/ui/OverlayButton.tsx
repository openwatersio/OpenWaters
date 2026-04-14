import { Link, LinkProps } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import OverlayView from './OverlayView';

export type OverlyButtonProps = {
  icon: SymbolViewProps['name'];
  iconStyle?: StyleProp<ViewStyle>;
} & (LinkProps | React.ComponentProps<typeof Pressable>);

export default function OverlayButton({ icon, iconStyle, ...props }: OverlyButtonProps) {
  const Wrapper = 'href' in props ? Link : Pressable;

  return (
    <OverlayView style={styles.overlay}>
      <Wrapper {...props as any} style={styles.button}>
        <SymbolView name={icon} size={24} style={iconStyle} />
      </Wrapper>
    </OverlayView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    borderRadius: 100,
  },
  button: {
    padding: 12,
  },
})
