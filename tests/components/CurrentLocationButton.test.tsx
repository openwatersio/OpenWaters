import { fireEvent, render, screen } from '@testing-library/react-native';
import CurrentLocationButton from '@/components/CurrentLocationButton';
import { useCameraState } from '@/hooks/useCameraState';
import { useMapView } from '@/hooks/useMapView';

const initialCameraState = useCameraState.getState();
const initialMapViewState = useMapView.getState();

beforeEach(() => {
  useCameraState.setState(initialCameraState, true);
  useMapView.setState(initialMapViewState, true);
});

describe('CurrentLocationButton', () => {
  it('shows location-searching icon when not following', () => {
    useCameraState.setState({ followUserLocation: false });
    render(<CurrentLocationButton />);
    expect(screen.getByTestId('symbol-location')).toBeTruthy();
  });

  it('shows my-location icon when following with default tracking', () => {
    useCameraState.setState({ followUserLocation: true, trackingMode: 'default' });
    render(<CurrentLocationButton />);
    expect(screen.getByTestId('symbol-location.fill')).toBeTruthy();
  });

  it('shows compass dial when following with course tracking', () => {
    useCameraState.setState({ followUserLocation: true, trackingMode: 'course' });
    render(<CurrentLocationButton />);
    expect(screen.getByText('N')).toBeTruthy();
  });

  it('cycles from not-following to following default', () => {
    useCameraState.setState({ followUserLocation: false, trackingMode: undefined });
    render(<CurrentLocationButton />);
    fireEvent.press(screen.getByTestId('symbol-location').parent!);
    expect(useCameraState.getState().followUserLocation).toBe(true);
    expect(useCameraState.getState().trackingMode).toBe('default');
  });

  it('cycles from default to course', () => {
    useCameraState.setState({ followUserLocation: true, trackingMode: 'default' });
    render(<CurrentLocationButton />);
    fireEvent.press(screen.getByTestId('symbol-location.fill').parent!);
    expect(useCameraState.getState().trackingMode).toBe('course');
  });

  it('cycles from course to default', () => {
    useCameraState.setState({ followUserLocation: true, trackingMode: 'course' });
    useMapView.setState({ bearing: 45 });
    render(<CurrentLocationButton />);
    fireEvent.press(screen.getByText('N').parent!.parent!);
    expect(useCameraState.getState().followUserLocation).toBe(true);
    expect(useCameraState.getState().trackingMode).toBe('default');
  });
});
