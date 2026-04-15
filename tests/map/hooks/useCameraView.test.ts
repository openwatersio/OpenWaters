import { cameraViewState, onRegionDidChange, onRegionIsChanging } from '@/map/hooks/useCameraView';

const initialState = { ...cameraViewState };

beforeEach(() => {
  Object.assign(cameraViewState, initialState);
});

describe('useCameraView', () => {
  it('has correct initial state', () => {
    const { bearing, bounds, zoom } = cameraViewState;
    expect(bearing).toBe(0);
    expect(bounds).toBeUndefined();
    expect(zoom).toBe(0);
  });

  describe('onRegionIsChanging', () => {
    it('updates bearing only', () => {
      onRegionIsChanging(45);
      expect(cameraViewState.bearing).toBe(45);
      expect(cameraViewState.bounds).toBeUndefined();
      expect(cameraViewState.zoom).toBe(0);
    });
  });

  describe('onRegionDidChange', () => {
    it('updates bearing, bounds, and zoom', () => {
      const bounds = [-122.5, 37.7, -122.3, 37.9] as [number, number, number, number];
      onRegionDidChange(90, bounds, 12);
      expect(cameraViewState.bearing).toBe(90);
      expect(cameraViewState.bounds).toEqual(bounds);
      expect(cameraViewState.zoom).toBe(12);
    });
  });
});
