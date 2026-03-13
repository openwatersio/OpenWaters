import type { CameraRef } from "@maplibre/maplibre-react-native";
import { createContext, useContext } from "react";

export const CameraRefContext = createContext<React.RefObject<CameraRef | null> | null>(null);

export function useCameraRef(): React.RefObject<CameraRef | null> {
  const ref = useContext(CameraRefContext);
  if (!ref) {
    throw new Error("useCameraRef must be used within a CameraRefContext.Provider");
  }
  return ref;
}
