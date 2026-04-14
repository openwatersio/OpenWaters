import { render, screen, fireEvent } from '@testing-library/react-native';
import { ZoomButtons } from '@/map/components/ZoomButtons';

describe('ZoomButtons', () => {
  it('renders zoom in and zoom out buttons', () => {
    render(<ZoomButtons />);
    expect(screen.getByTestId('button-Zoom in')).toBeTruthy();
    expect(screen.getByTestId('button-Zoom out')).toBeTruthy();
  });

  it('zoom in button is pressable', () => {
    render(<ZoomButtons />);
    // Should not throw when pressed (camera ref may be null in test)
    fireEvent.press(screen.getByTestId('button-Zoom in'));
  });

  it('zoom out button is pressable', () => {
    render(<ZoomButtons />);
    fireEvent.press(screen.getByTestId('button-Zoom out'));
  });
});
