import { render, screen, fireEvent } from '@testing-library/react-native';
import { ZoomButtons } from '@/components/map/ZoomButtons';
import { useCameraView } from '@/hooks/useCameraView';

const mockZoomTo = jest.fn();
const mockCameraRef = { current: { zoomTo: mockZoomTo } };

const initialState = useCameraView.getState();

beforeEach(() => {
  useCameraView.setState(initialState, true);
  mockZoomTo.mockClear();
  useCameraView.setState({ cameraRef: mockCameraRef as any, zoom: 10 });
});

describe('ZoomButtons', () => {
  it('calls zoomTo with zoom+1 when zoom in is pressed', () => {
    render(<ZoomButtons />);
    fireEvent.press(screen.getByTestId('button-Zoom in'));
    expect(mockZoomTo).toHaveBeenCalledWith(11, { duration: 300 });
  });

  it('calls zoomTo with zoom-1 when zoom out is pressed', () => {
    render(<ZoomButtons />);
    fireEvent.press(screen.getByTestId('button-Zoom out'));
    expect(mockZoomTo).toHaveBeenCalledWith(9, { duration: 300 });
  });
});
