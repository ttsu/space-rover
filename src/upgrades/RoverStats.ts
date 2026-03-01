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
  maxBattery: number;
  batteryDrainPerSecond: number;
  visibilityRadius: number;
  /** 0 = default, 1 = AoE, 2 = seeking (for future use). */
  blasterBehavior: number;
}

const BASE_STATS: RoverStats = {
  maxHealth: ROVER_BASE_HEALTH,
  maxCapacity: ROVER_MAX_CAPACITY,
  maxSpeed: ROVER_BASE_SPEED,
  acceleration: ROVER_BASE_ACCELERATION,
  turnSpeed: ROVER_BASE_TURN_SPEED,
  blasterDamage: BLASTER_BASE_DAMAGE,
  blasterFireRate: BLASTER_BASE_FIRE_RATE,
  blasterRange: BLASTER_BASE_RANGE,
  lavaDamageReduction: 0,
  lavaSlowResist: 0,
  windResist: 0,
  flatDamageReduction: 0,
  lightningWarningTime: 0,
  maxBattery: ROVER_BASE_BATTERY,
  batteryDrainPerSecond: ROVER_BASE_BATTERY_DRAIN,
  visibilityRadius: ROVER_BASE_VISIBILITY_RADIUS_TILES,
  blasterBehavior: 0,
};

function applyEffect(stats: RoverStats, kind: UpgradeEffectKind, value: number): void {
  switch (kind) {
    case "maxHealth":
      stats.maxHealth += value;
      break;
    case "maxCapacity":
      stats.maxCapacity += value;
      break;
    case "maxSpeed":
      stats.maxSpeed += value;
      break;
    case "turnSpeed":
      stats.turnSpeed += value;
      break;
    case "acceleration":
      stats.acceleration += value;
      break;
    case "blasterDamage":
      stats.blasterDamage += value;
      break;
    case "blasterFireRate":
      stats.blasterFireRate += value;
      break;
    case "blasterRange":
      stats.blasterRange += value;
      break;
    case "lavaDamageReduction":
      stats.lavaDamageReduction += value;
      break;
    case "lavaSlowResist":
      stats.lavaSlowResist += value;
      break;
    case "windResist":
      stats.windResist += value;
      break;
    case "flatDamageReduction":
      stats.flatDamageReduction += value;
      break;
    case "lightningWarningTime":
      stats.lightningWarningTime += value;
      break;
    case "visibilityRadius":
      stats.visibilityRadius += value;
      break;
    case "maxBattery":
      stats.maxBattery += value;
      break;
    case "batteryDrainPerSecond":
      stats.batteryDrainPerSecond += value;
      break;
    case "blasterBehavior":
      stats.blasterBehavior = value;
      break;
    default:
      break;
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
    if (!itemId || itemId === "base") continue;
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

/** @deprecated Use computeEffectiveRoverStatsFromEquipped with getEquipped/getOwnedItems. */
export function computeEffectiveRoverStats(
  appliedUpgradeIds: string[]
): RoverStats {
  const stats: RoverStats = { ...BASE_STATS };
  for (const id of appliedUpgradeIds) {
    const def = getUpgradeById(id);
    if (!def) continue;
    applyEffect(stats, def.effect.kind as UpgradeEffectKind, def.effect.value);
  }
  return stats;
}
