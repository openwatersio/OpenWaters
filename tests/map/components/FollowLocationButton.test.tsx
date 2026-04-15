import { render, screen, fireEvent } from '@testing-library/react-native';
import { FollowLocationButton } from '@/map/components/FollowLocationButton';
import { cameraState } from '@/map/hooks/useCameraState';

const initialState = { ...cameraState };

beforeEach(() => {
  Object.assign(cameraState, initialState);
});

describe('FollowLocationButton', () => {
  it('shows location icon when not following', () => {
    cameraState.followUserLocation = false;
    render(<FollowLocationButton />);
    expect(screen.getByTestId('image-location')).toBeTruthy();
  });

  it('shows location.fill icon when following with default tracking', () => {
    Object.assign(cameraState, { followUserLocation: true, trackingMode: 'default' });
    render(<FollowLocationButton />);
    expect(screen.getByTestId('image-location.fill')).toBeTruthy();
  });

  it('shows location.north.line.fill icon when following with course tracking', () => {
    Object.assign(cameraState, { followUserLocation: true, trackingMode: 'course' });
    render(<FollowLocationButton />);
    expect(screen.getByTestId('image-location.north.line.fill')).toBeTruthy();
  });

  it('cycles tracking mode on press', () => {
    Object.assign(cameraState, { followUserLocation: false, trackingMode: undefined });
    render(<FollowLocationButton />);
    fireEvent.press(screen.getByTestId('image-location'));
    expect(cameraState.followUserLocation).toBe(true);
    expect(cameraState.trackingMode).toBe('default');
  });

  it('cycles from default to course', () => {
    Object.assign(cameraState, { followUserLocation: true, trackingMode: 'default' });
    render(<FollowLocationButton />);
    fireEvent.press(screen.getByTestId('image-location.fill'));
    expect(cameraState.trackingMode).toBe('course');
  });

  it('cycles from course to default', () => {
    Object.assign(cameraState, { followUserLocation: true, trackingMode: 'course' });
    render(<FollowLocationButton />);
    fireEvent.press(screen.getByTestId('image-location.north.line.fill'));
    expect(cameraState.trackingMode).toBe('default');
  });
});
