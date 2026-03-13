import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import ZoomAndScale from '@/components/ZoomAndScale';
import { CameraRefContext } from '@/hooks/useCameraRef';
import { useMapView } from '@/hooks/useMapView';

const mockZoomTo = jest.fn();
const mockCameraRef = { current: { zoomTo: mockZoomTo } };

const initialMapViewState = useMapView.getState();

beforeEach(() => {
  useMapView.setState(initialMapViewState, true);
  mockZoomTo.mockClear();
});

function renderWithCamera(ui: React.ReactElement) {
  return render(
    <CameraRefContext.Provider value={mockCameraRef as any}>
      {ui}
    </CameraRefContext.Provider>
  );
}

describe('ZoomAndScale', () => {
  it('calls zoomTo with zoom+1 when the + button is pressed', () => {
    useMapView.setState({ zoom: 10 });
    renderWithCamera(<ZoomAndScale />);
    fireEvent.press(screen.getByTestId('symbol-plus').parent!);
    expect(mockZoomTo).toHaveBeenCalledWith(11, { duration: 300 });
  });

  it('calls zoomTo with zoom-1 when the - button is pressed', () => {
    useMapView.setState({ zoom: 10 });
    renderWithCamera(<ZoomAndScale />);
    fireEvent.press(screen.getByTestId('symbol-minus').parent!);
    expect(mockZoomTo).toHaveBeenCalledWith(9, { duration: 300 });
  });
});
