import { mapStyles, setViewOptions } from '@/hooks/useViewOptions';
import { Button, Menu } from '@expo/ui/swift-ui';
import {
  contentShape,
  frame,
  glassEffect,
  glassEffectId,
  labelStyle,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

const NS_ID = 'map-controls';

export function SelectChartButton() {
  return (
    <Menu
      label="Map Type"
      systemImage={'square.3.layers.3d'}
      modifiers={[
        labelStyle('iconOnly'),
        frame({ width: 44, height: 44 }),
        contentShape(shapes.circle()),
        glassEffect({ glass: { variant: 'regular' }, shape: 'circle' }),
        glassEffectId('chart-type', NS_ID),
      ]}
    >
      {mapStyles.map(({ id, name }) => (
        <Button
          key={id}
          label={name}
          systemImage="map"
          onPress={() => setViewOptions({ mapStyleId: id })}
        />
      ))}
    </Menu>
  );
}
