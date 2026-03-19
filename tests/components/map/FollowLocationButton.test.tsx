import { render, screen, fireEvent } from '@testing-library/react-native';
import { FollowLocationButton } from '@/components/map/FollowLocationButton';
import { useCameraState } from '@/hooks/useCameraState';

const initialState = useCameraState.getState();

beforeEach(() => {
  useCameraState.setState(initialState, true);
});

describe('FollowLocationButton', () => {
  it('shows location icon when not following', () => {
    useCameraState.setState({ followUserLocation: false });
    render(<FollowLocationButton />);
    expect(screen.getByTestId('image-location')).toBeTruthy();
  });

  it('shows location.fill icon when following with default tracking', () => {
    useCameraState.setState({ followUserLocation: true, trackingMode: 'default' });
    render(<FollowLocationButton />);
    expect(screen.getByTestId('image-location.fill')).toBeTruthy();
  });

  it('shows location.north.line.fill icon when following with course tracking', () => {
    useCameraState.setState({ followUserLocation: true, trackingMode: 'course' });
    render(<FollowLocationButton />);
    expect(screen.getByTestId('image-location.north.line.fill')).toBeTruthy();
  });

  it('cycles tracking mode on press', () => {
    useCameraState.setState({ followUserLocation: false, trackingMode: undefined });
    render(<FollowLocationButton />);
    fireEvent.press(screen.getByTestId('image-location'));
    expect(useCameraState.getState().followUserLocation).toBe(true);
    expect(useCameraState.getState().trackingMode).toBe('default');
  });

  it('cycles from default to course', () => {
    useCameraState.setState({ followUserLocation: true, trackingMode: 'default' });
    render(<FollowLocationButton />);
    fireEvent.press(screen.getByTestId('image-location.fill'));
    expect(useCameraState.getState().trackingMode).toBe('course');
  });

  it('cycles from course to default', () => {
    useCameraState.setState({ followUserLocation: true, trackingMode: 'course' });
    render(<FollowLocationButton />);
    fireEvent.press(screen.getByTestId('image-location.north.line.fill'));
    expect(useCameraState.getState().trackingMode).toBe('default');
  });
});
