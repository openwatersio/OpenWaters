import {
  acknowledgeDisclaimer,
  disclaimerState,
  needsAcknowledgment,
  resetDisclaimer,
} from "@/disclaimer/hooks/useDisclaimer";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.4.2" } },
}));

beforeEach(() => {
  resetDisclaimer();
});

describe("needsAcknowledgment", () => {
  it("requires acknowledgment when nothing is stored", () => {
    expect(needsAcknowledgment("1.0.0", null)).toBe(true);
  });

  it("does not re-prompt within the same major version", () => {
    expect(needsAcknowledgment("1.4.2", "1.0.0")).toBe(false);
    expect(needsAcknowledgment("1.99.0", "1.0.0")).toBe(false);
  });

  it("re-prompts on a major version bump", () => {
    expect(needsAcknowledgment("2.0.0", "1.5.0")).toBe(true);
  });

  it("treats malformed versions as needing acknowledgment", () => {
    expect(needsAcknowledgment("garbage", "1.0.0")).toBe(true);
    expect(needsAcknowledgment("1.0.0", "garbage")).toBe(true);
  });
});

describe("acknowledgeDisclaimer", () => {
  it("stamps the current app version and a timestamp", () => {
    const before = Date.now();
    acknowledgeDisclaimer();
    expect(disclaimerState.acknowledgedVersion).toBe("1.4.2");
    expect(disclaimerState.acknowledgedAt).not.toBeNull();
    expect(disclaimerState.acknowledgedAt!).toBeGreaterThanOrEqual(before);
  });
});
