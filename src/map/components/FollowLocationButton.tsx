import { cycleTrackingMode, useCameraState } from '@/map/hooks/useCameraState';
import { Button, Image } from '@expo/ui/swift-ui';
import {
  animation,
  Animation,
  contentTransition,
  frame,
  glassEffect,
  glassEffectId,
} from '@expo/ui/swift-ui/modifiers';

const NS_ID = 'map-controls';

export function FollowLocationButton() {
  const followUserLocation = useCameraState((s) => s.followUserLocation);
  const trackingMode = useCameraState((s) => s.trackingMode);

  return (
    <Button
      onPress={cycleTrackingMode}
      modifiers={[
        frame({ width: 44, height: 44 }),
        glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' }),
        glassEffectId('location', NS_ID),
      ]}
    >
      <Image
        systemName={followUserLocation ? trackingMode === "default" ? "location.fill" : "location.north.line.fill" : "location"}
        size={17}
        modifiers={[
          contentTransition('interpolate'),
          animation(Animation.default, trackingMode === "course"),
          animation(Animation.default, followUserLocation),
        ]}
      />
    </Button>
  );
}
