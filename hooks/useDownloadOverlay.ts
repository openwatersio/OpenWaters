import { create } from "zustand";

interface DownloadOverlayState {
  visible: boolean;
}

export const useDownloadOverlay = create<DownloadOverlayState>()(() => ({
  visible: false,
}));

export function showDownloadOverlay(): void {
  useDownloadOverlay.setState({ visible: true });
}

export function hideDownloadOverlay(): void {
  useDownloadOverlay.setState({ visible: false });
}
