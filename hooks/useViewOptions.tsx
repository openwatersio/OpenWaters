import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface State {
  mapStyleId?: number;
}

export const useViewOptions = create<State>()(
  persist(
    (): State => ({}),
    {
      name: "view-options",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function setViewOptions(options: Partial<State>) {
  useViewOptions.setState(options);
}
