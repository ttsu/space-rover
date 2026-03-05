import {
  ROVER_BASE_HEALTH,
  ROVER_BASE_SPEED,
  ROVER_MAX_CAPACITY,
  BLASTER_BASE_DAMAGE,
  BLASTER_BASE_FIRE_RATE,
  BLASTER_BASE_RANGE,
  ROVER_BASE_ACCELERATION,
  ROVER_BASE_TURN_SPEED,
  ROVER_BASE_BATTERY,
  ROVER_BASE_BATTERY_DRAIN,
  ROVER_BASE_VISIBILITY_RADIUS_TILES,
} from "../config/gameConfig";
import { getUpgradeById } from "./UpgradeDefs";
import type { UpgradeEffectKind } from "./UpgradeDefs";
import type { SlotId } from "../types/roverConfig";
import { ALL_SLOT_IDS } from "../types/roverConfig";
import type { DamageType } from "../types/DamageTypes";

export interface RoverStats {
  maxHealth: number;
  maxCapacity: number;
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
  blasterDamage: number;
  blasterFireRate: number;
  blasterRange: number;
  lavaDamageReduction: number;
  lavaSlowResist: number;
  windResist: number;
  flatDamageReduction: number;
  lightningWarningTime: number;
  lightningDamageReduction: number;
  maxBattery: number;
  batteryDrainPerSecond: number;
  visibilityRadius: number;
  /** 0 = default, 1 = AoE, 2 = seeking (for future use). */
  blasterBehavior: number;
  /** Distance (pixels) at which resources are attracted to the rover. */
  magnetism: number;
}

/** Returns total damage reduction (flat + type-specific) for given damage type. */
export function getDamageReductionForType(
  stats: RoverStats,
  damageType: DamageType
): number {
  let reduction = stats.flatDamageReduction;
  switch (damageType) {
    case "lava":
      reduction += stats.lavaDamageReduction;
      break;
    case "lightning":
      reduction += stats.lightningDamageReduction;
      break;
    case "generic":
      break;
  }
  return reduction;
}

type EffectApply = "additive" | "override";

/** Single source of truth for effect kinds: default value and how to apply (additive vs override). */
const EFFECT_REGISTRY: Record<
  UpgradeEffectKind,
  { default: number; apply: EffectApply }
> = {
  maxHealth: { default: ROVER_BASE_HEALTH, apply: "additive" },
  maxCapacity: { default: ROVER_MAX_CAPACITY, apply: "additive" },
  maxSpeed: { default: ROVER_BASE_SPEED, apply: "additive" },
  turnSpeed: { default: ROVER_BASE_TURN_SPEED, apply: "additive" },
  acceleration: { default: ROVER_BASE_ACCELERATION, apply: "additive" },
  blasterDamage: { default: BLASTER_BASE_DAMAGE, apply: "additive" },
  blasterFireRate: { default: BLASTER_BASE_FIRE_RATE, apply: "additive" },
  blasterRange: { default: BLASTER_BASE_RANGE, apply: "additive" },
  lavaDamageReduction: { default: 0, apply: "additive" },
  lavaSlowResist: { default: 0, apply: "additive" },
  windResist: { default: 0, apply: "additive" },
  flatDamageReduction: { default: 0, apply: "additive" },
  lightningWarningTime: { default: 0, apply: "additive" },
  lightningDamageReduction: { default: 0, apply: "additive" },
  visibilityRadius: {
    default: ROVER_BASE_VISIBILITY_RADIUS_TILES,
    apply: "additive",
  },
  maxBattery: { default: ROVER_BASE_BATTERY, apply: "additive" },
  batteryDrainPerSecond: {
    default: ROVER_BASE_BATTERY_DRAIN,
    apply: "additive",
  },
  blasterBehavior: { default: 0, apply: "override" },
  magnetism: { default: 0, apply: "additive" },
};

const BASE_STATS: RoverStats = Object.fromEntries(
  Object.entries(EFFECT_REGISTRY).map(([k, v]) => [k, v.default])
) as unknown as RoverStats;

function applyEffect(
  stats: RoverStats,
  kind: UpgradeEffectKind,
  value: number
): void {
  const entry = EFFECT_REGISTRY[kind];
  if (!entry) return;
  const key = kind as keyof RoverStats;
  if (entry.apply === "additive") {
    (stats[key] as number) += value;
  } else {
    (stats[key] as number) = value;
  }
}

/** Computes rover stats from equipped items and owned levels (Configure Rover model). */
export function computeEffectiveRoverStatsFromEquipped(
  equipped: Record<SlotId, string>,
  ownedItems: Record<string, number>
): RoverStats {
  const stats: RoverStats = { ...BASE_STATS };
  for (const slot of ALL_SLOT_IDS) {
    const itemId = equipped[slot];
    if (!itemId) continue;
    const level = ownedItems[itemId] ?? 0;
    const def = getUpgradeById(itemId);
    if (!def) continue;
    const { kind, value } = def.effect;
    for (let i = 0; i < level; i++) {
      applyEffect(stats, kind as UpgradeEffectKind, value);
    }
  }
  return stats;
}
