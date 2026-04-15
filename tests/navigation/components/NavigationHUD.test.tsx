import { resetInstrumentStore, updatePaths } from '@/instruments/hooks/useInstruments';
import { NavigationState, navigationState, resetNavigation } from '@/navigation/hooks/useNavigation';
import { resetPreferredUnits } from '@/hooks/usePreferredUnits';
import { resetTrackRecording, trackRecordingState } from '@/tracks/hooks/useTrackRecording';
import NavigationHUD from '@/navigation/components/NavigationHUD';
import { render, screen } from '@testing-library/react-native';

beforeEach(() => {
  resetNavigation();
  resetInstrumentStore();
  resetPreferredUnits();
  resetTrackRecording();
});

describe('NavigationHUD', () => {
  it('is hidden when moored, not recording, and no instrument data', () => {
    Object.assign(navigationState, { state: NavigationState.Moored });
    const { toJSON } = render(<NavigationHUD />);
    expect(toJSON()).toBeNull();
  });

  it('renders SOG when underway', () => {
    Object.assign(navigationState, { state: NavigationState.Underway });
    render(<NavigationHUD />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });

  it('converts speed to the preferred unit', () => {
    Object.assign(navigationState, { state: NavigationState.Underway, speed: 1 });
    render(<NavigationHUD />);
    // 1 m/s ≈ 1.9 knots (default unit)
    expect(screen.getByText('1.9')).toBeTruthy();
  });

  it('is visible when recording even if moored', () => {
    Object.assign(navigationState, { state: NavigationState.Moored });
    Object.assign(trackRecordingState, {
      track: { id: 1, name: null, started_at: new Date().toISOString(), ended_at: null, distance: 0, color: null },
    });
    render(<NavigationHUD />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });

  it('is visible when instrument data exists even if moored', () => {
    Object.assign(navigationState, { state: NavigationState.Moored });
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
    Object.assign(navigationState, { state: NavigationState.Underway });
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
