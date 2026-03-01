import type { ResourceId } from "../resources/ResourceTypes";

export type SlotId =
  | "battery"
  | "engine"
  | "control"
  | "shielding"
  | "radar"
  | "blaster";

export const ALL_SLOT_IDS: SlotId[] = [
  "battery",
  "engine",
  "control",
  "shielding",
  "radar",
  "blaster",
];

export type CargoSlotContent = ResourceId | "empty";

export type EquippedState = Record<SlotId, string>;

export type OwnedItems = Record<string, number>;

export type CargoLayout = CargoSlotContent[];

export const CARGO_COLS = 4;
export const CARGO_MIN_ROWS = 2;
export const CARGO_MAX_ROWS = 6;

export const DEFAULT_CARGO_ROWS = 2;

/** Default layout: 2 gas, 2 crystal, 2 iron, 2 empty (row-major). */
export function getDefaultCargoLayout(rows: number): CargoLayout {
  const slots = CARGO_COLS * rows;
  const base: CargoLayout = [
    "gas",
    "gas",
    "crystal",
    "crystal",
    "iron",
    "iron",
    "empty",
    "empty",
  ];
  const result: CargoLayout = [];
  for (let i = 0; i < slots; i++) {
    result.push(base[i % base.length] ?? "empty");
  }
  return result;
}

export function getDefaultEquipped(): EquippedState {
  return {
    battery: "base",
    engine: "base",
    control: "base",
    shielding: "base",
    radar: "base",
    blaster: "base",
  };
}
