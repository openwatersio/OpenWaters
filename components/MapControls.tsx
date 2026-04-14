import { Compass } from '@/components/map/Compass';
import { FollowLocationButton } from '@/components/map/FollowLocationButton';
import { MenuButton } from '@/components/map/MenuButton';
import { ZoomButtons } from '@/components/map/ZoomButtons';
import {
  GlassEffectContainer,
  Host,
  Namespace,
  VStack,
} from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { memo } from 'react';

export const NS_ID = 'map-controls';

export const MapControls = memo(function MapControls() {
  return (
    <Host matchContents>
      <Namespace id={NS_ID}>
        <GlassEffectContainer>
          <VStack spacing={16} modifiers={[tint('primary')]}>
            <Compass />
            <ZoomButtons />
            <FollowLocationButton />
            <MenuButton />
          </VStack>
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
});
