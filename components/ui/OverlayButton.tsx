import { Link, LinkProps } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { IconSymbol, type IconSymbolProps } from './IconSymbol';
import OverlayView from './OverlayView';

export type OverlyButtonProps = {
  icon: IconSymbolProps['name'];
} & (LinkProps | React.ComponentProps<typeof Pressable>);

export default function OverlayButton({ icon, ...props }: OverlyButtonProps) {
  const Wrapper = 'href' in props ? Link : Pressable;

  return (
    <OverlayView style={styles.overlay}>
      <Wrapper {...props as any} style={styles.button}>
        <IconSymbol name={icon} />
      </Wrapper>
    </OverlayView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  button: {
    padding: 12,
  },
})
