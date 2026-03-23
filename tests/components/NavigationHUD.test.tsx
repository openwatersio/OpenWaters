import { resetInstrumentStore, updatePaths } from '@/hooks/useInstruments';
import { NavigationState, useNavigation } from '@/hooks/useNavigation';
import { usePreferredUnits } from '@/hooks/usePreferredUnits';
import { useTrackRecording } from '@/hooks/useTrackRecording';
import NavigationHUD from '@/components/NavigationHUD';
import { render, screen } from '@testing-library/react-native';

const initialNavState = useNavigation.getState();
const initialUnitsState = usePreferredUnits.getState();
const initialTrackState = useTrackRecording.getState();

beforeEach(() => {
  useNavigation.setState(initialNavState, true);
  resetInstrumentStore();
  usePreferredUnits.setState(initialUnitsState, true);
  useTrackRecording.setState(initialTrackState, true);
});

describe('NavigationHUD', () => {
  it('is hidden when moored, not recording, and no instrument data', () => {
    useNavigation.setState({ state: NavigationState.Moored });
    const { toJSON } = render(<NavigationHUD />);
    expect(toJSON()).toBeNull();
  });

  it('renders SOG when underway', () => {
    useNavigation.setState({ state: NavigationState.Underway });
    render(<NavigationHUD />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });

  it('converts speed to the preferred unit', () => {
    useNavigation.setState({ state: NavigationState.Underway, speed: 1 });
    render(<NavigationHUD />);
    // 1 m/s ≈ 1.9 knots (default unit)
    expect(screen.getByText('1.9')).toBeTruthy();
  });

  it('is visible when recording even if moored', () => {
    useNavigation.setState({ state: NavigationState.Moored });
    useTrackRecording.setState({
      isRecording: true,
      track: { id: 1, name: null, started_at: new Date().toISOString(), ended_at: null, distance: 0, color: null },
    });
    render(<NavigationHUD />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });

  it('is visible when instrument data exists even if moored', () => {
    useNavigation.setState({ state: NavigationState.Moored });
    updatePaths({
      "environment.depth.belowTransducer": {
        value: 8.5,
        timestamp: Date.now(),
        source: "signalk.test",
      },
    });
    render(<NavigationHUD />);
    expect(screen.getByText('Depth')).toBeTruthy();
  });

  it('shows depth from instruments when available', () => {
    useNavigation.setState({ state: NavigationState.Underway });
    updatePaths({
      "environment.depth.belowTransducer": {
        value: 8.5,
        timestamp: Date.now(),
        source: "signalk.test",
      },
    });
    render(<NavigationHUD />);
    expect(screen.getByText('8.5')).toBeTruthy();
  });
});
