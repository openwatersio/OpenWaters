import HeadsUpDisplay from '@/components/HeadsUpDisplay';
import { NavigationState, useNavigationState } from '@/hooks/useNavigationState';
import { usePreferredUnits } from '@/hooks/usePreferredUnits';
import { useTrackRecording } from '@/hooks/useTrackRecording';
import { render, screen } from '@testing-library/react-native';

const initialNavState = useNavigationState.getState();
const initialUnitsState = usePreferredUnits.getState();
const initialTrackState = useTrackRecording.getState();

beforeEach(() => {
  useNavigationState.setState(initialNavState, true);
  usePreferredUnits.setState(initialUnitsState, true);
  useTrackRecording.setState(initialTrackState, true);
});

describe('HeadsUpDisplay', () => {
  it('is hidden when moored and not recording', () => {
    useNavigationState.setState({ state: NavigationState.Moored });
    const { toJSON } = render(<HeadsUpDisplay />);
    expect(toJSON()).toBeNull();
  });

  it('renders SOG when underway', () => {
    useNavigationState.setState({ state: NavigationState.Underway });
    render(<HeadsUpDisplay />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });

  it('converts speed to the preferred unit', () => {
    useNavigationState.setState({ state: NavigationState.Underway, coords: { speed: 1 } as any });
    render(<HeadsUpDisplay />);
    // 1 m/s ≈ 1.9 knots (default unit)
    expect(screen.getByText('1.9')).toBeTruthy();
  });

  it('is visible when recording even if moored', () => {
    useNavigationState.setState({ state: NavigationState.Moored });
    useTrackRecording.setState({ isRecording: true, track: { id: 1, name: null, started_at: new Date().toISOString(), ended_at: null, distance: 0, color: null } });
    render(<HeadsUpDisplay />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });
});
