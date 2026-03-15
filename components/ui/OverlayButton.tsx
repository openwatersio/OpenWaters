import { Link, LinkProps } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { IconSymbol, type IconSymbolProps } from './IconSymbol';
import OverlayView from './OverlayView';

export type OverlyButtonProps = {
  icon: IconSymbolProps['name'];
  iconStyle?: IconSymbolProps['style'];
} & (LinkProps | React.ComponentProps<typeof Pressable>);

export default function OverlayButton({ icon, iconStyle, ...props }: OverlyButtonProps) {
  const Wrapper = 'href' in props ? Link : Pressable;

  return (
    <OverlayView style={styles.overlay}>
      <Wrapper {...props as any} style={styles.button}>
        <IconSymbol name={icon} style={iconStyle} />
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
