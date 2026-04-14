import { cycleTrackingMode, useCameraState } from '@/hooks/useCameraState';
import { resetNorth } from '@/components/map/NavigationCamera';
import { useCameraView } from '@/hooks/useCameraView';
import {
  Button,
  Image,
  Text,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  frame,
  glassEffect,
  glassEffectId,
  labelStyle,
  offset,
  rotationEffect
} from '@expo/ui/swift-ui/modifiers';

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
function bearingToDirection(bearing: number): string {
  const normalized = ((bearing % 360) + 360) % 360;
  return DIRECTIONS[Math.round(normalized / (360 / DIRECTIONS.length)) % DIRECTIONS.length];
}

const NS_ID = 'map-controls';

export function Compass() {
  const bearing = useCameraView((s) => s.bearing);
  const trackingMode = useCameraState((s) => s.trackingMode);

  if (!trackingMode || trackingMode === "default") {
    return null;
  }

  function onPress() {
    resetNorth();
    cycleTrackingMode();
  }

  return (
    <Button
      modifiers={[
        frame({ width: 44, height: 44 }),
        glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' }),
        glassEffectId('compass', NS_ID),
      ]}
      onPress={onPress}
    >
      <ZStack alignment="center">
        {/* Cardinal tick marks - rotate with bearing */}
        <ZStack
          alignment="center"
          modifiers={[
            frame({ width: 44, height: 44 }),
            rotationEffect(-bearing),
          ]}
        >
          {Array.from({ length: 16 }, (_, i) => {
            const angle = i * 22.5;
            const rad = (angle * Math.PI) / 180;
            const isCardinal = i % 4 === 0;
            const isNorth = i === 0;
            const r = 17;
            return (
              <Image
                key={i}
                systemName={isNorth ? "arrowtriangle.up.fill" : "minus"}
                size={isNorth ? 10 : isCardinal ? 6 : 4}
                color={isNorth ? "red" : undefined}
                modifiers={[
                  rotationEffect(isNorth ? angle : angle + 90),
                  ...(!isNorth ? [foregroundStyle({ type: 'hierarchical', style: isCardinal ? 'primary' : 'secondary' })] : []),
                  offset({ x: Math.sin(rad) * r, y: -Math.cos(rad) * r }),
                ]}
              />
            );
          })}
        </ZStack>
        {/* Direction text - stays upright */}
        <Text
          modifiers={[
            labelStyle('automatic'),
            // font({ size: 14, design: 'rounded' }),
          ]}
        >
          {bearingToDirection(bearing)}
        </Text>
      </ZStack>
    </Button>
  );
}
