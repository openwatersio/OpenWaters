import { useMapView } from '@/hooks/useMapView';

const initialState = useMapView.getState();

beforeEach(() => {
  useMapView.setState(initialState, true);
});

describe('useMapView', () => {
  it('has correct initial state', () => {
    const { bearing, bounds, zoom } = useMapView.getState();
    expect(bearing).toBe(0);
    expect(bounds).toBeUndefined();
    expect(zoom).toBe(0);
  });

  describe('onRegionIsChanging', () => {
    it('updates bearing only', () => {
      useMapView.getState().onRegionIsChanging(45);
      expect(useMapView.getState().bearing).toBe(45);
      expect(useMapView.getState().bounds).toBeUndefined();
      expect(useMapView.getState().zoom).toBe(0);
    });
  });

  describe('onRegionDidChange', () => {
    it('updates bearing, bounds, and zoom', () => {
      const bounds = [-122.5, 37.7, -122.3, 37.9] as [number, number, number, number];
      useMapView.getState().onRegionDidChange(90, bounds, 12);
      expect(useMapView.getState().bearing).toBe(90);
      expect(useMapView.getState().bounds).toEqual(bounds);
      expect(useMapView.getState().zoom).toBe(12);
    });
  });
});
