import { proxy, useSnapshot } from "valtio";

interface DownloadOverlayState {
  visible: boolean;
}

export const downloadOverlayState = proxy<DownloadOverlayState>({
  visible: false,
});

export function useDownloadOverlay() {
  return useSnapshot(downloadOverlayState);
}

export function showDownloadOverlay(): void {
  downloadOverlayState.visible = true;
}

export function hideDownloadOverlay(): void {
  downloadOverlayState.visible = false;
}
