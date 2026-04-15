import HeadsUpDisplay from '@/navigation/components/HeadsUpDisplay';
import { NavigationState, useNavigation } from '@/navigation/hooks/useNavigation';
import { usePreferredUnits } from '@/hooks/usePreferredUnits';
import { trackRecordingState } from '@/tracks/hooks/useTrackRecording';
import { render, screen } from '@testing-library/react-native';

const initialNavState = useNavigation.getState();
const initialUnitsState = usePreferredUnits.getState();
const initialTrackState = { ...trackRecordingState };

beforeEach(() => {
  useNavigation.setState(initialNavState, true);
  usePreferredUnits.setState(initialUnitsState, true);
  Object.assign(trackRecordingState, initialTrackState);
});

describe('HeadsUpDisplay', () => {
  it('is hidden when moored and not recording', () => {
    useNavigation.setState({ state: NavigationState.Moored });
    const { toJSON } = render(<HeadsUpDisplay />);
    expect(toJSON()).toBeNull();
  });

  it('renders SOG when underway', () => {
    useNavigation.setState({ state: NavigationState.Underway });
    render(<HeadsUpDisplay />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });

  it('converts speed to the preferred unit', () => {
    useNavigation.setState({ state: NavigationState.Underway, speed: 1 });
    render(<HeadsUpDisplay />);
    // 1 m/s ≈ 1.9 knots (default unit)
    expect(screen.getByText('1.9')).toBeTruthy();
  });

  it('is visible when recording even if moored', () => {
    useNavigation.setState({ state: NavigationState.Moored });
    Object.assign(trackRecordingState, { track: { id: 1, name: null, started_at: new Date().toISOString(), ended_at: null, distance: 0, color: null } });
    render(<HeadsUpDisplay />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });
});
