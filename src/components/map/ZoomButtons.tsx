import { zoomIn, zoomOut } from '@/components/map/NavigationCamera';
import { Button, Divider, VStack } from '@expo/ui/swift-ui';
import {
  frame,
  glassEffect,
  glassEffectId,
  labelStyle,
} from '@expo/ui/swift-ui/modifiers';

const NS_ID = 'map-controls';

export function ZoomButtons() {
  return (
    <VStack
      spacing={0}
      modifiers={[
        glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'capsule' }),
        glassEffectId('zoom', NS_ID),
      ]}
    >
      <Button
        systemImage="plus"
        onPress={zoomIn}
        modifiers={[
          labelStyle('iconOnly'),
          frame({ width: 44, height: 44 }),
        ]}
        label="Zoom in"
      />
      <Divider />
      <Button
        systemImage="minus"
        onPress={zoomOut}
        modifiers={[
          labelStyle('iconOnly'),
          frame({ width: 44, height: 44 }),
        ]}
        label="Zoom out"
      />
    </VStack>
  );
}
