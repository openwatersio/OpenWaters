import ActivitiesOverlay from '@/activities/components/ActivitiesOverlay';
import { resetInstrumentStore, updatePaths } from '@/instruments/hooks/useInstruments';
import { resetPreferredUnits } from '@/hooks/usePreferredUnits';
import { NavigationState, navigationState, resetNavigation } from '@/navigation/hooks/useNavigation';
import { resetTrackRecording, trackRecordingState } from '@/tracks/hooks/useTrackRecording';
import { render, screen } from '@testing-library/react-native';

beforeEach(() => {
  resetNavigation();
  resetInstrumentStore();
  resetPreferredUnits();
  resetTrackRecording();
});

describe('ActivitiesOverlay', () => {
  it('renders nothing when moored, not recording, and no instrument data', () => {
    Object.assign(navigationState, { state: NavigationState.Moored });
    const { toJSON } = render(<ActivitiesOverlay />);
    expect(toJSON()).toBeNull();
  });

  it('shows the navigation card when underway', () => {
    Object.assign(navigationState, { state: NavigationState.Underway });
    render(<ActivitiesOverlay />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });

  it('converts speed to the preferred unit on the navigation card', () => {
    Object.assign(navigationState, { state: NavigationState.Underway, speed: 1 });
    render(<ActivitiesOverlay />);
    // 1 m/s ≈ 1.9 knots (default unit)
    expect(screen.getByText('1.9')).toBeTruthy();
  });

  it('shows the navigation card when recording even if moored', () => {
    Object.assign(navigationState, { state: NavigationState.Moored });
    Object.assign(trackRecordingState, {
      track: {
        id: 1,
        name: null,
        started_at: new Date().toISOString(),
        ended_at: null,
        distance: 0,
        color: null,
      },
    });
    render(<ActivitiesOverlay />);
    expect(screen.getByText('SOG')).toBeTruthy();
  });

  it('shows the instruments card only when external instrument data is present', () => {
    Object.assign(navigationState, { state: NavigationState.Moored });
    updatePaths({
      "environment.depth.belowTransducer": {
        value: 8.5,
        timestamp: Date.now(),
        source: "signalk.test",
      },
    });
    render(<ActivitiesOverlay />);
    expect(screen.getByText('Depth')).toBeTruthy();
    // Navigation card should not appear when only external instrument data exists
    expect(screen.queryByText('SOG')).toBeNull();
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
    render(<ActivitiesOverlay />);
    expect(screen.getByText('8.5')).toBeTruthy();
  });
});
