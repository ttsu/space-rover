import type { CargoCounts } from "../entities/Rover";
import type { ResourceId } from "../resources/ResourceTypes";
import type { UpgradeDef } from "../upgrades/UpgradeDefs";
import { getUpgradeCost } from "../upgrades/UpgradeDefs";

const STORAGE_KEY = "starship-rover-progress";

export interface PersistedProgress {
  bank: CargoCounts;
  appliedUpgrades: string[];
}

const defaultBank: CargoCounts = {
  iron: 0,
  crystal: 0,
  gas: 0,
};

function defaultProgress(): PersistedProgress {
  return {
    bank: { ...defaultBank },
    appliedUpgrades: [],
  };
}

let current: PersistedProgress = defaultProgress();

function parseProgress(raw: string | null): PersistedProgress {
  if (!raw) return defaultProgress();
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return defaultProgress();
    const obj = data as Record<string, unknown>;
    const bank = obj.bank as Record<string, number> | undefined;
    const appliedUpgrades = Array.isArray(obj.appliedUpgrades)
      ? (obj.appliedUpgrades as string[])
      : [];
    const parsed: PersistedProgress = {
      bank: {
        iron: typeof bank?.iron === "number" ? bank.iron : 0,
        crystal: typeof bank?.crystal === "number" ? bank.crystal : 0,
        gas: typeof bank?.gas === "number" ? bank.gas : 0,
      },
      appliedUpgrades,
    };
    return parsed;
  } catch {
    return defaultProgress();
  }
}

export function loadProgress(): PersistedProgress {
  if (typeof window === "undefined" || !window.localStorage)
    return defaultProgress();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  current = parseProgress(raw);
  return current;
}

export function saveProgress(progress: PersistedProgress): void {
  current = progress;
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function getProgress(): PersistedProgress {
  return {
    ...current,
    bank: { ...current.bank },
    appliedUpgrades: [...current.appliedUpgrades],
  };
}

export function addToBank(cargo: CargoCounts): void {
  const next: CargoCounts = {
    iron: current.bank.iron + cargo.iron,
    crystal: current.bank.crystal + cargo.crystal,
    gas: current.bank.gas + cargo.gas,
  };
  saveProgress({ ...current, bank: next });
}

export function getBank(): CargoCounts {
  return { ...current.bank };
}

export function getAppliedUpgrades(): string[] {
  return [...current.appliedUpgrades];
}

export function spendFromBank(
  costs: Partial<Record<ResourceId, number>>
): boolean {
  const bank = { ...current.bank };
  for (const id of ["iron", "crystal", "gas"] as const) {
    const cost = costs[id] ?? 0;
    if (cost > 0 && bank[id] < cost) return false;
    bank[id] -= cost;
  }
  saveProgress({ ...current, bank });
  return true;
}

export function addAppliedUpgrade(upgradeId: string): void {
  current.appliedUpgrades.push(upgradeId);
  saveProgress(current);
}

export function applyUpgrade(def: UpgradeDef): boolean {
  const cost = getUpgradeCost(def);
  if (!spendFromBank(cost)) return false;
  addAppliedUpgrade(def.id);
  return true;
}
