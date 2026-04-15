import HeadsUpDisplay from '@/navigation/components/HeadsUpDisplay';
import { NavigationState, navigationState, resetNavigation } from '@/navigation/hooks/useNavigation';
import { resetPreferredUnits } from '@/hooks/usePreferredUnits';
import { resetTrackRecording, trackRecordingState } from '@/tracks/hooks/useTrackRecording';
import { render, screen } from '@testing-library/react-native';

beforeEach(() => {
  resetNavigation();
  resetPreferredUnits();
  resetTrackRecording();
});

describe('HeadsUpDisplay', () => {
  it('is hidden when moored and not recording', () => {
    Object.assign(navigationState, { state: NavigationState.Moored });
    const { toJSON } = render(<HeadsUpDisplay />);
    expect(toJSON()).toBeNull();
  });

  it('renders SOG when underway', () => {
    Object.assign(navigationState, { state: NavigationState.Underway });
    render(<HeadsUpDisplay />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });

  it('converts speed to the preferred unit', () => {
    Object.assign(navigationState, { state: NavigationState.Underway, speed: 1 });
    render(<HeadsUpDisplay />);
    // 1 m/s ≈ 1.9 knots (default unit)
    expect(screen.getByText('1.9')).toBeTruthy();
  });

  it('is visible when recording even if moored', () => {
    Object.assign(navigationState, { state: NavigationState.Moored });
    Object.assign(trackRecordingState, { track: { id: 1, name: null, started_at: new Date().toISOString(), ended_at: null, distance: 0, color: null } });
    render(<HeadsUpDisplay />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });
});
