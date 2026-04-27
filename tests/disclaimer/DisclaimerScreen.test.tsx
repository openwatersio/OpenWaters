import DisclaimerScreen from "@/disclaimer/components/DisclaimerScreen";
import {
  disclaimerState,
  resetDisclaimer,
} from "@/disclaimer/hooks/useDisclaimer";
import { fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.4.2" } },
}));

beforeEach(() => {
  resetDisclaimer();
});

describe("DisclaimerScreen", () => {
  it("renders the safety title and acknowledge button", () => {
    render(<DisclaimerScreen />);
    expect(screen.getByText("Important Safety Notice")).toBeTruthy();
    expect(screen.getByText("I Understand and Agree")).toBeTruthy();
  });

  it("acknowledges the disclaimer with the current app version", () => {
    render(<DisclaimerScreen />);
    fireEvent.press(screen.getByText("I Understand and Agree"));
    expect(disclaimerState.acknowledgedVersion).toBe("1.4.2");
  });
});
