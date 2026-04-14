import { useCameraView, onRegionIsChanging, onRegionDidChange } from '@/map/hooks/useCameraView';

const initialState = useCameraView.getState();

beforeEach(() => {
  useCameraView.setState(initialState, true);
});

describe('useCameraView', () => {
  it('has correct initial state', () => {
    const { bearing, bounds, zoom } = useCameraView.getState();
    expect(bearing).toBe(0);
    expect(bounds).toBeUndefined();
    expect(zoom).toBe(0);
  });

  describe('onRegionIsChanging', () => {
    it('updates bearing only', () => {
      onRegionIsChanging(45);
      expect(useCameraView.getState().bearing).toBe(45);
      expect(useCameraView.getState().bounds).toBeUndefined();
      expect(useCameraView.getState().zoom).toBe(0);
    });
  });

  describe('onRegionDidChange', () => {
    it('updates bearing, bounds, and zoom', () => {
      const bounds = [-122.5, 37.7, -122.3, 37.9] as [number, number, number, number];
      onRegionDidChange(90, bounds, 12);
      expect(useCameraView.getState().bearing).toBe(90);
      expect(useCameraView.getState().bounds).toEqual(bounds);
      expect(useCameraView.getState().zoom).toBe(12);
    });
  });
});
