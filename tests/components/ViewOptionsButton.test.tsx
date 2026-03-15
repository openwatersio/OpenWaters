import { render, screen } from '@testing-library/react-native';
import ViewOptionsButton from '@/components/ViewOptionsButton';

describe('ViewOptionsButton', () => {
  it('renders a link to /charts', () => {
    render(<ViewOptionsButton />);
    expect(screen.getByTestId('link-/charts')).toBeTruthy();
  });
});
