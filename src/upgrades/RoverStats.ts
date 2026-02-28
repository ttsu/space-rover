import {
  ROVER_BASE_HEALTH,
  ROVER_BASE_SPEED,
  ROVER_MAX_CAPACITY,
  BLASTER_BASE_DAMAGE,
  BLASTER_BASE_FIRE_RATE,
  BLASTER_BASE_RANGE,
  ROVER_BASE_ACCELERATION,
  ROVER_BASE_TURN_SPEED,
} from "../config/gameConfig";
import { getUpgradeById } from "./UpgradeDefs";
import type { UpgradeEffectKind } from "./UpgradeDefs";

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
};

export function computeEffectiveRoverStats(
  appliedUpgradeIds: string[]
): RoverStats {
  const stats: RoverStats = { ...BASE_STATS };
  for (const id of appliedUpgradeIds) {
    const def = getUpgradeById(id);
    if (!def) continue;
    const { kind, value } = def.effect;
    switch (kind as UpgradeEffectKind) {
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
      default:
        break;
    }
  }
  return stats;
}
