import { Button } from '@expo/ui/swift-ui';
import {
  frame,
  glassEffect,
  glassEffectId,
  labelStyle
} from '@expo/ui/swift-ui/modifiers';
import { usePathname, useRouter } from 'expo-router';

const NS_ID = 'map-controls';

export function MenuButton() {
  const router = useRouter();
  const pathname = '/menu';
  const isOpen = pathname === usePathname();

  return (
    <Button
      onPress={() => isOpen ? router.back() : router.navigate(pathname)}
      systemImage="line.3.horizontal"
      modifiers={[
        labelStyle('iconOnly'),
        frame({ width: 44, height: 44 }),
        glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' }),
        glassEffectId('menu', NS_ID),
      ]}
      label="Menu"
    />
  );
}
