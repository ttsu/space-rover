import type { ResourceId } from "../resources/ResourceTypes";
import {
  ALL_SLOT_IDS,
  DEFAULT_EQUIPPED_IDS,
  type SlotId,
} from "../types/roverConfig";

export type UpgradeEffectKind =
  | "maxHealth"
  | "maxCapacity"
  | "maxSpeed"
  | "turnSpeed"
  | "acceleration"
  | "blasterDamage"
  | "blasterFireRate"
  | "blasterRange"
  | "lavaDamageReduction"
  | "lavaSlowResist"
  | "windResist"
  | "flatDamageReduction"
  | "lightningWarningTime"
  | "visibilityRadius"
  | "maxBattery"
  | "batteryDrainPerSecond"
  | "blasterBehavior";

export interface UpgradeEffect {
  kind: UpgradeEffectKind;
  value: number;
}

/** Cost as multi-resource; only keys with value > 0. */
export type UpgradeCost = Partial<Record<ResourceId, number>>;

export interface UpgradeDef {
  id: string;
  /** Multi-resource cost (only keys with value > 0). */
  cost: Record<ResourceId, number>;
  name: string;
  description: string;
  effect: UpgradeEffect;
  maxStack?: number;
  slotType: SlotId;
  /** Base equipment (excluded from catalog; leveled only in equipment section). */
  isBase?: boolean;
}

function cost(iron = 0, crystal = 0, gas = 0): Record<ResourceId, number> {
  const c: Record<ResourceId, number> = { iron: 0, crystal: 0, gas: 0 };
  if (iron > 0) c.iron = iron;
  if (crystal > 0) c.crystal = crystal;
  if (gas > 0) c.gas = gas;
  return c;
}

/** Base equipment defs (one per slot). Excluded from catalog; leveled only in equipment section. */
const BASE_DEFS: UpgradeDef[] = [
  {
    id: "base-battery",
    cost: cost(0, 2, 1),
    name: "Base",
    description: "Standard battery. Level up for more capacity.",
    effect: { kind: "maxBattery", value: 15 },
    maxStack: 3,
    slotType: "battery",
    isBase: true,
  },
  {
    id: "base-engine",
    cost: cost(2, 0, 2),
    name: "Base",
    description: "Standard engine. Level up for more speed.",
    effect: { kind: "maxSpeed", value: 10 },
    maxStack: 3,
    slotType: "engine",
    isBase: true,
  },
  {
    id: "base-control",
    cost: cost(1, 1, 1),
    name: "Base",
    description: "Standard control. Level up for better handling.",
    effect: { kind: "turnSpeed", value: 0.1 },
    maxStack: 3,
    slotType: "control",
    isBase: true,
  },
  {
    id: "base-shielding",
    cost: cost(2, 0, 1),
    name: "Base",
    description: "Standard hull. Level up for more health.",
    effect: { kind: "maxHealth", value: 1 },
    maxStack: 3,
    slotType: "shielding",
    isBase: true,
  },
  {
    id: "base-radar",
    cost: cost(0, 2, 0),
    name: "Base",
    description: "Standard radar. Level up for more visibility.",
    effect: { kind: "visibilityRadius", value: 1 },
    maxStack: 3,
    slotType: "radar",
    isBase: true,
  },
  {
    id: "base-blaster",
    cost: cost(1, 1, 0),
    name: "Base",
    description: "Standard blaster. Level up for more damage.",
    effect: { kind: "blasterDamage", value: 1 },
    maxStack: 3,
    slotType: "blaster",
    isBase: true,
  },
];

const IRON_UPGRADES: UpgradeDef[] = [
  {
    id: "iron-health-1",
    cost: cost(3, 0, 0),
    name: "Reinforced Hull",
    description: "+1 max health",
    effect: { kind: "maxHealth", value: 1 },
    maxStack: 5,
    slotType: "shielding",
  },
  {
    id: "iron-lava-dmg-1",
    cost: cost(4, 0, 0),
    name: "Lava Plating",
    description: "Take 1 less damage from lava",
    effect: { kind: "lavaDamageReduction", value: 1 },
    maxStack: 3,
    slotType: "shielding",
  },
  {
    id: "iron-lava-slow-1",
    cost: cost(3, 0, 0),
    name: "Heat Resistant Treads",
    description: "10% less slow in lava",
    effect: { kind: "lavaSlowResist", value: 0.1 },
    maxStack: 3,
    slotType: "shielding",
  },
  {
    id: "iron-wind-1",
    cost: cost(4, 0, 0),
    name: "Wind Baffles",
    description: "15% less push from wind",
    effect: { kind: "windResist", value: 0.15 },
    maxStack: 2,
    slotType: "shielding",
  },
  {
    id: "iron-flat-dmg-1",
    cost: cost(5, 0, 0),
    name: "Heavy Armor",
    description: "Take 1 less damage from all hazards",
    effect: { kind: "flatDamageReduction", value: 1 },
    maxStack: 2,
    slotType: "shielding",
  },
];

const CRYSTAL_UPGRADES: UpgradeDef[] = [
  {
    id: "crystal-capacity-1",
    cost: cost(0, 5, 0),
    name: "Cargo Bay +4",
    description: "+4 cargo capacity",
    effect: { kind: "maxCapacity", value: 4 },
    maxStack: 3,
    slotType: "shielding",
  },
  {
    id: "crystal-speed-1",
    cost: cost(0, 4, 0),
    name: "Turbo Engine",
    description: "+20 max speed",
    effect: { kind: "maxSpeed", value: 20 },
    maxStack: 2,
    slotType: "engine",
  },
  {
    id: "crystal-turn-1",
    cost: cost(0, 3, 0),
    name: "Agile Steering",
    description: "+0.2 rad/s turn speed",
    effect: { kind: "turnSpeed", value: 0.2 },
    maxStack: 2,
    slotType: "control",
  },
  {
    id: "crystal-accel-1",
    cost: cost(0, 4, 0),
    name: "Quick Accelerator",
    description: "+50 acceleration",
    effect: { kind: "acceleration", value: 50 },
    maxStack: 2,
    slotType: "engine",
  },
  {
    id: "crystal-lightning-1",
    cost: cost(0, 3, 0),
    name: "Storm Sensor",
    description: "+5 lightning warning time (ms)",
    effect: { kind: "lightningWarningTime", value: 5 },
    maxStack: 2,
    slotType: "radar",
  },
  {
    id: "crystal-blaster-dmg-1",
    cost: cost(0, 4, 0),
    name: "Blaster Power +1",
    description: "+1 damage per shot to deposits",
    effect: { kind: "blasterDamage", value: 1 },
    maxStack: 3,
    slotType: "blaster",
  },
  {
    id: "crystal-blaster-rate-1",
    cost: cost(0, 4, 0),
    name: "Rapid Blaster",
    description: "+0.5 shots per second",
    effect: { kind: "blasterFireRate", value: 0.5 },
    maxStack: 2,
    slotType: "blaster",
  },
  {
    id: "crystal-blaster-range-1",
    cost: cost(0, 3, 0),
    name: "Long Range Lens",
    description: "Longer blaster range",
    effect: { kind: "blasterRange", value: 50 },
    maxStack: 2,
    slotType: "blaster",
  },
  {
    id: "crystal-blaster-eff-1",
    cost: cost(0, 5, 0),
    name: "Mining Amplifier",
    description: "+1 damage to deposits only",
    effect: { kind: "blasterDamage", value: 1 },
    maxStack: 2,
    slotType: "blaster",
  },
  {
    id: "crystal-blaster-aoe",
    cost: cost(0, 6, 0),
    name: "AoE Blaster",
    description: "Blaster shots explode on impact",
    effect: { kind: "blasterBehavior", value: 1 },
    maxStack: 1,
    slotType: "blaster",
  },
];

const GAS_UPGRADES: UpgradeDef[] = [
  {
    id: "gas-speed-1",
    cost: cost(0, 0, 4),
    name: "Thruster Boost",
    description: "+15 max speed",
    effect: { kind: "maxSpeed", value: 15 },
    maxStack: 2,
    slotType: "engine",
  },
  {
    id: "gas-accel-1",
    cost: cost(0, 0, 3),
    name: "Nitrous Injector",
    description: "+30 acceleration",
    effect: { kind: "acceleration", value: 30 },
    maxStack: 2,
    slotType: "engine",
  },
  {
    id: "gas-turn-1",
    cost: cost(0, 0, 3),
    name: "Maneuvering Jets",
    description: "+0.15 rad/s turn speed",
    effect: { kind: "turnSpeed", value: 0.15 },
    maxStack: 2,
    slotType: "control",
  },
  {
    id: "gas-lava-slow-1",
    cost: cost(0, 0, 4),
    name: "Cooling Vents",
    description: "10% less slow in lava",
    effect: { kind: "lavaSlowResist", value: 0.1 },
    maxStack: 2,
    slotType: "shielding",
  },
  {
    id: "gas-wind-1",
    cost: cost(0, 0, 3),
    name: "Stabilizer",
    description: "10% less push from wind",
    effect: { kind: "windResist", value: 0.1 },
    maxStack: 2,
    slotType: "shielding",
  },
];

const ALL_UPGRADES = [
  ...BASE_DEFS,
  ...IRON_UPGRADES,
  ...CRYSTAL_UPGRADES,
  ...GAS_UPGRADES,
];
const UPGRADE_BY_ID = new Map<string, UpgradeDef>(
  ALL_UPGRADES.map((u) => [u.id, u])
);

export const BASE_DEF_IDS: Record<SlotId, string> = { ...DEFAULT_EQUIPPED_IDS };

export function getUpgradeById(id: string): UpgradeDef | undefined {
  return UPGRADE_BY_ID.get(id);
}

export function getAllUpgradeDefs(): UpgradeDef[] {
  return [...ALL_UPGRADES];
}

/** Defs that can appear in catalog: not owned (level 0) and not base. */
export function getCatalogDefs(
  ownedItems: Record<string, number>
): UpgradeDef[] {
  return ALL_UPGRADES.filter(
    (def) => !def.isBase && (ownedItems[def.id] ?? 0) === 0
  );
}

export function getUpgradeCost(def: UpgradeDef): Record<ResourceId, number> {
  return def.cost;
}

export function canAffordCost(
  bank: Record<ResourceId, number>,
  costObj: Record<ResourceId, number>
): boolean {
  for (const r of ["iron", "crystal", "gas"] as const) {
    const need = costObj[r] ?? 0;
    if (need > 0 && (bank[r] ?? 0) < need) return false;
  }
  return true;
}

export function formatCost(costObj: Record<ResourceId, number>): string {
  const parts: string[] = [];
  if ((costObj.iron ?? 0) > 0) parts.push(`${costObj.iron} iron`);
  if ((costObj.crystal ?? 0) > 0) parts.push(`${costObj.crystal} crystal`);
  if ((costObj.gas ?? 0) > 0) parts.push(`${costObj.gas} gas`);
  return parts.length ? parts.join(", ") : "Free";
}

/** True if any catalog item is affordable or any equipped item can level up. */
export function canAffordAnyEquipment(
  bank: Record<ResourceId, number>,
  ownedItems: Record<string, number>,
  equipped: Record<SlotId, string>
): boolean {
  const catalog = getCatalogDefs(ownedItems);
  for (const def of catalog) {
    if (canAffordCost(bank, def.cost)) return true;
  }
  for (const slotId of ALL_SLOT_IDS) {
    const itemId = equipped[slotId];
    if (!itemId) continue;
    const def = getUpgradeById(itemId);
    if (!def) continue;
    const level = ownedItems[itemId] ?? 0;
    const maxStack = def.maxStack ?? 1;
    if (level >= maxStack) continue;
    if (canAffordCost(bank, def.cost)) return true;
  }
  return false;
}
