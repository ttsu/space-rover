import type { CargoCounts } from "../entities/Rover";
import type { ResourceId } from "../resources/ResourceTypes";
import type { UpgradeDef } from "../upgrades/UpgradeDefs";
import { getUpgradeCost } from "../upgrades/UpgradeDefs";
import {
  getCurrentSave,
  saveCurrentSave,
  type CargoCountsSave,
  type CargoSlotContentSave,
  type WorldStateSave,
} from "./Saves";
import { SHIP_REPAIR_COST } from "../config/shipConfig";
import type { SlotId } from "../types/roverConfig";
import {
  getDefaultEquipped,
  getDefaultCargoLayout,
  DEFAULT_CARGO_ROWS,
  CARGO_MAX_ROWS,
  DEFAULT_EQUIPPED_IDS,
} from "../types/roverConfig";
import { CARGO_CAPACITY_PER_SLOT } from "../config/gameConfig";

export interface PersistedProgress {
  bank: CargoCounts;
  equipped: Record<SlotId, string>;
  ownedItems: Record<string, number>;
  cargoLayout: CargoSlotContentSave[];
  cargoRows: number;
}

const defaultBank: CargoCounts = {
  iron: 0,
  crystal: 0,
  gas: 0,
};

/** New save: each base equipment starts at level 1. */
function getDefaultOwnedItems(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of Object.values(DEFAULT_EQUIPPED_IDS)) {
    out[id] = 1;
  }
  return out;
}

function cargoFromSave(c: CargoCountsSave): CargoCounts {
  return { iron: c.iron, crystal: c.crystal, gas: c.gas };
}

export function getProgress(): PersistedProgress {
  const save = getCurrentSave();
  if (!save)
    return {
      bank: { ...defaultBank },
      equipped: getDefaultEquipped(),
      ownedItems: getDefaultOwnedItems(),
      cargoLayout: getDefaultCargoLayout(
        DEFAULT_CARGO_ROWS
      ) as CargoSlotContentSave[],
      cargoRows: DEFAULT_CARGO_ROWS,
    };
  const cargoRows = save.cargoRows ?? DEFAULT_CARGO_ROWS;
  const layout =
    save.cargoLayout ??
    (getDefaultCargoLayout(cargoRows) as CargoSlotContentSave[]);
  return {
    bank: cargoFromSave(save.bank),
    equipped: { ...(save.equipped ?? getDefaultEquipped()) },
    ownedItems: { ...(save.ownedItems ?? getDefaultOwnedItems()) },
    cargoLayout:
      layout.length === 4 * cargoRows
        ? [...layout]
        : (getDefaultCargoLayout(cargoRows) as CargoSlotContentSave[]),
    cargoRows,
  };
}

export function getEquipped(): Record<SlotId, string> {
  return getProgress().equipped;
}

export function getOwnedItems(): Record<string, number> {
  return getProgress().ownedItems;
}

export function getCargoLayout(): CargoSlotContentSave[] {
  return getProgress().cargoLayout;
}

export function getCargoRows(): number {
  return getProgress().cargoRows;
}

export function setEquipped(slot: SlotId, itemId: string): void {
  const save = getCurrentSave();
  if (!save) return;
  if (!save.equipped) save.equipped = getDefaultEquipped();
  save.equipped[slot] = itemId;
  saveCurrentSave();
}

export function setOwnedItems(items: Record<string, number>): void {
  const save = getCurrentSave();
  if (!save) return;
  save.ownedItems = { ...items };
  saveCurrentSave();
}

export function addOwnedItem(itemId: string, levelDelta = 1): void {
  const save = getCurrentSave();
  if (!save) return;
  if (!save.ownedItems) save.ownedItems = {};
  save.ownedItems[itemId] = (save.ownedItems[itemId] ?? 0) + levelDelta;
  saveCurrentSave();
}

export function setCargoLayout(layout: CargoSlotContentSave[]): void {
  const save = getCurrentSave();
  if (!save) return;
  save.cargoLayout = [...layout];
  saveCurrentSave();
}

export function setCargoRows(rows: number): void {
  const save = getCurrentSave();
  if (!save) return;
  const clamped = Math.min(
    CARGO_MAX_ROWS,
    Math.max(DEFAULT_CARGO_ROWS, Math.floor(rows))
  );
  const oldRows = save.cargoRows ?? DEFAULT_CARGO_ROWS;
  const oldLayout =
    save.cargoLayout ??
    (getDefaultCargoLayout(oldRows) as CargoSlotContentSave[]);
  save.cargoRows = clamped;
  const newLen = 4 * clamped;
  const defaultLayout = getDefaultCargoLayout(
    clamped
  ) as CargoSlotContentSave[];
  if (clamped > oldRows) {
    save.cargoLayout = [...oldLayout];
    for (let i = oldLayout.length; i < newLen; i++) {
      save.cargoLayout.push(defaultLayout[i % defaultLayout.length] ?? "empty");
    }
  } else if (clamped < oldRows) {
    save.cargoLayout = oldLayout.slice(0, newLen);
  } else {
    save.cargoLayout =
      oldLayout.length === newLen ? [...oldLayout] : defaultLayout;
  }
  saveCurrentSave();
}

/** Derive per-resource max capacity from cargo layout (for Rover). */
export function getMaxCargoFromLayout(
  layout: CargoSlotContentSave[]
): Record<ResourceId, number> {
  const out: Record<ResourceId, number> = {
    iron: 0,
    crystal: 0,
    gas: 0,
  };
  for (const slot of layout) {
    if (slot !== "empty") {
      out[slot] += CARGO_CAPACITY_PER_SLOT;
    }
  }
  return out;
}

export function addToBank(cargo: CargoCounts): void {
  const save = getCurrentSave();
  if (!save) return;
  save.bank.iron += cargo.iron;
  save.bank.crystal += cargo.crystal;
  save.bank.gas += cargo.gas;
  save.totalResourcesCollected.iron += cargo.iron;
  save.totalResourcesCollected.crystal += cargo.crystal;
  save.totalResourcesCollected.gas += cargo.gas;
  saveCurrentSave();
}

export function getBank(): CargoCounts {
  const save = getCurrentSave();
  if (!save) return { ...defaultBank };
  return cargoFromSave(save.bank);
}

export function spendFromBank(
  costs: Partial<Record<ResourceId, number>>
): boolean {
  const save = getCurrentSave();
  if (!save) return false;
  const bank = save.bank;
  for (const id of ["iron", "crystal", "gas"] as const) {
    const cost = costs[id] ?? 0;
    if (cost > 0 && bank[id] < cost) return false;
  }
  for (const id of ["iron", "crystal", "gas"] as const) {
    const cost = costs[id] ?? 0;
    if (cost > 0) bank[id] -= cost;
  }
  saveCurrentSave();
  return true;
}

/** Spend resources and add to owned items (Configure Rover shop). */
export function purchaseEquipment(def: UpgradeDef): boolean {
  const cost = getUpgradeCost(def);
  if (!spendFromBank(cost)) return false;
  addOwnedItem(def.id);
  return true;
}

// --- Ship and space progression ---

export function isShipRepaired(): boolean {
  const save = getCurrentSave();
  return save?.shipRepaired === true;
}

export function setShipRepaired(value: boolean): void {
  const save = getCurrentSave();
  if (!save) return;
  save.shipRepaired = value;
  saveCurrentSave();
}

export function getCurrentPlanetId(): string {
  const save = getCurrentSave();
  return save?.currentPlanetId ?? "home";
}

export function setCurrentPlanetId(planetId: string): void {
  const save = getCurrentSave();
  if (!save) return;
  save.currentPlanetId = planetId;
  saveCurrentSave();
}

export function getCurrentLocation(): "planet" | "orbit" {
  const save = getCurrentSave();
  return save?.currentLocation ?? "planet";
}

export function setCurrentLocation(loc: "planet" | "orbit"): void {
  const save = getCurrentSave();
  if (!save) return;
  save.currentLocation = loc;
  saveCurrentSave();
}

export function getShipUpgrades(): Record<string, number> {
  const save = getCurrentSave();
  return save?.shipUpgrades ? { ...save.shipUpgrades } : {};
}

export function setShipUpgrade(upgradeId: string, level: number): void {
  const save = getCurrentSave();
  if (!save) return;
  save.shipUpgrades = save.shipUpgrades ?? {};
  save.shipUpgrades[upgradeId] = Math.max(0, Math.floor(level));
  saveCurrentSave();
}

/** Returns true if bank meets ship repair cost and ship was not yet repaired. */
export function canRepairShip(): boolean {
  if (isShipRepaired()) return false;
  const bank = getBank();
  return (
    bank.iron >= SHIP_REPAIR_COST.iron &&
    bank.crystal >= SHIP_REPAIR_COST.crystal &&
    bank.gas >= SHIP_REPAIR_COST.gas
  );
}

/** Spend bank for ship repair and set shipRepaired. Returns true if successful. */
export function spendForShipRepair(): boolean {
  if (isShipRepaired()) return false;
  if (!spendFromBank(SHIP_REPAIR_COST)) return false;
  setShipRepaired(true);
  return true;
}

const emptyWorldStateSave: WorldStateSave = {
  clearedTileKeys: [],
  depositState: {},
  droppedCargo: [],
};

export function getWorldStateSaveForPlanet(planetId: string): WorldStateSave {
  const save = getCurrentSave();
  if (!save) return { ...emptyWorldStateSave };
  const byPlanet = save.worldStateByPlanet;
  if (!byPlanet || !byPlanet[planetId]) return { ...emptyWorldStateSave };
  return byPlanet[planetId];
}

export function setWorldStateSaveForPlanet(
  planetId: string,
  state: WorldStateSave
): void {
  const save = getCurrentSave();
  if (!save) return;
  save.worldStateByPlanet = save.worldStateByPlanet ?? {};
  save.worldStateByPlanet[planetId] = state;
  saveCurrentSave();
}
