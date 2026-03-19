import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from "zustand/middleware";
import mapStyles from '../styles';

interface State {
  mapStyleId?: (typeof mapStyles[number])["id"];
}

interface Actions {
  set: (options: Partial<State>) => void;
}

export { mapStyles };

export const useViewOptions = create<State & Actions>()(
  persist(
    (set) => ({
      mapStyleId: mapStyles[0].id,
      set(options: Partial<State>) {
        set(options)
      },
    }),
    {
      name: "view-options",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
