import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from "zustand/middleware";

export type SpeedUnit = 'knot' | 'mph' | 'km/h';
export type DistanceUnit = 'nm' | 'mi' | 'km';

interface UnitInfo {
  abbr: string;
  singular: string;
  plural: string;
}

const speedUnits: Record<SpeedUnit, UnitInfo & { fromMps: number }> = {
  'knot': { abbr: 'kn', singular: 'Knot', plural: 'Knots', fromMps: 1.9438444924406 },
  'mph': { abbr: 'mph', singular: 'Mile per hour', plural: 'Miles per hour', fromMps: 2.2369362920544 },
  'km/h': { abbr: 'km/h', singular: 'Kilometer per hour', plural: 'Kilometers per hour', fromMps: 3.6 },
};

const distanceUnitDefs: Record<DistanceUnit, UnitInfo & { fromMeters: number }> = {
  'nm': { abbr: 'nm', singular: 'Nautical Mile', plural: 'Nautical Miles', fromMeters: 1 / 1852 },
  'mi': { abbr: 'mi', singular: 'Mile', plural: 'Miles', fromMeters: 1 / 1609.344 },
  'km': { abbr: 'km', singular: 'Kilometer', plural: 'Kilometers', fromMeters: 0.001 },
};

interface State {
  speed: SpeedUnit;
  distance: DistanceUnit;
}

interface Actions {
  speedUnits(): SpeedUnit[];
  distanceUnits(): DistanceUnit[];
  toSpeed(value: number | undefined, options?: { decimals?: number }): { value: string } & UnitInfo;
  toDistance(meters: number | undefined, options?: { decimals?: number }): { value: string } & UnitInfo;
  set(state: Partial<State>): void;
  describe(unit: SpeedUnit | DistanceUnit): UnitInfo;
}

export const usePreferredUnits = create<State & Actions>()(
  persist(
    (set, get) => ({
      speed: 'knot',
      distance: 'nm',
      set,

      speedUnits() {
        return Object.keys(speedUnits) as SpeedUnit[];
      },

      distanceUnits() {
        return Object.keys(distanceUnitDefs) as DistanceUnit[];
      },

      describe(unit) {
        const def = speedUnits[unit as SpeedUnit] ?? distanceUnitDefs[unit as DistanceUnit];
        return { abbr: def.abbr, singular: def.singular, plural: def.plural };
      },

      toSpeed(measure, { decimals = 1 } = {}) {
        const def = speedUnits[get().speed];
        const value = ((measure ?? 0) * def.fromMps).toFixed(decimals);
        return { value, abbr: def.abbr, singular: def.singular, plural: def.plural };
      },

      toDistance(meters, { decimals = 1 } = {}) {
        const def = distanceUnitDefs[get().distance];
        const value = ((meters ?? 0) * def.fromMeters).toFixed(decimals);
        return { value, abbr: def.abbr, singular: def.singular, plural: def.plural };
      },
    }),
    {
      name: "preferred-units",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      migrate(persisted, version) {
        const state = persisted as Record<string, unknown>;
        if (version === 0) {
          // Map old convert-units keys to new keys
          if (state.distance === 'nMi') state.distance = 'nm';
          if (state.speed === 'm/s') state.speed = 'knot';
        }
        return state as unknown as State & Actions;
      },
    }
  )
)
