import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from "zustand/middleware";
import mapStyles from '../styles';

interface State {
  mapStyleId?: (typeof mapStyles[number])["id"];
}

export { mapStyles };

export const useViewOptions = create<State>()(
  persist(
    (): State => ({
      mapStyleId: mapStyles[0].id,
    }),
    {
      name: "view-options",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export function setViewOptions(options: Partial<State>) {
  useViewOptions.setState(options);
}
