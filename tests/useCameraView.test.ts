import { useCameraView } from '@/hooks/useCameraView';

const initialState = useCameraView.getState();

beforeEach(() => {
  useCameraView.setState(initialState, true);
});

describe('useCameraView', () => {
  it('has correct initial state', () => {
    const { bearing, bounds, zoom, cameraRef } = useCameraView.getState();
    expect(bearing).toBe(0);
    expect(bounds).toBeUndefined();
    expect(zoom).toBe(0);
    expect(cameraRef).toBeNull();
  });

  describe('onRegionIsChanging', () => {
    it('updates bearing only', () => {
      useCameraView.getState().onRegionIsChanging(45);
      expect(useCameraView.getState().bearing).toBe(45);
      expect(useCameraView.getState().bounds).toBeUndefined();
      expect(useCameraView.getState().zoom).toBe(0);
    });
  });

  describe('onRegionDidChange', () => {
    it('updates bearing, bounds, and zoom', () => {
      const bounds = [-122.5, 37.7, -122.3, 37.9] as [number, number, number, number];
      useCameraView.getState().onRegionDidChange(90, bounds, 12);
      expect(useCameraView.getState().bearing).toBe(90);
      expect(useCameraView.getState().bounds).toEqual(bounds);
      expect(useCameraView.getState().zoom).toBe(12);
    });
  });

  describe('zoomIn', () => {
    it('calls zoomTo with zoom + 1', () => {
      const mockZoomTo = jest.fn();
      const cameraRef = { current: { zoomTo: mockZoomTo } };
      useCameraView.setState({ cameraRef: cameraRef as any, zoom: 10 });
      useCameraView.getState().zoomIn();
      expect(mockZoomTo).toHaveBeenCalledWith(11, { duration: 300 });
    });
  });

  describe('zoomOut', () => {
    it('calls zoomTo with zoom - 1', () => {
      const mockZoomTo = jest.fn();
      const cameraRef = { current: { zoomTo: mockZoomTo } };
      useCameraView.setState({ cameraRef: cameraRef as any, zoom: 10 });
      useCameraView.getState().zoomOut();
      expect(mockZoomTo).toHaveBeenCalledWith(9, { duration: 300 });
    });
  });
});
