import type { CargoCounts } from "../entities/Rover";
import type { ResourceId } from "../resources/ResourceTypes";
import type { UpgradeDef } from "../upgrades/UpgradeDefs";
import { getUpgradeCost } from "../upgrades/UpgradeDefs";
import {
  getCurrentSave,
  saveCurrentSave,
  type CargoCountsSave,
} from "./Saves";

export interface PersistedProgress {
  bank: CargoCounts;
  appliedUpgrades: string[];
}

const defaultBank: CargoCounts = {
  iron: 0,
  crystal: 0,
  gas: 0,
};

function cargoFromSave(c: CargoCountsSave): CargoCounts {
  return { iron: c.iron, crystal: c.crystal, gas: c.gas };
}

export function getProgress(): PersistedProgress {
  const save = getCurrentSave();
  if (!save)
    return {
      bank: { ...defaultBank },
      appliedUpgrades: [],
    };
  return {
    bank: cargoFromSave(save.bank),
    appliedUpgrades: [...save.appliedUpgrades],
  };
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

export function getAppliedUpgrades(): string[] {
  const save = getCurrentSave();
  if (!save) return [];
  return [...save.appliedUpgrades];
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

export function addAppliedUpgrade(upgradeId: string): void {
  const save = getCurrentSave();
  if (!save) return;
  save.appliedUpgrades.push(upgradeId);
  saveCurrentSave();
}

export function applyUpgrade(def: UpgradeDef): boolean {
  const cost = getUpgradeCost(def);
  if (!spendFromBank(cost)) return false;
  addAppliedUpgrade(def.id);
  return true;
}
