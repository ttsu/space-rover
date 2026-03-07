import type { CargoCounts } from "../entities/Rover";

/** One-time cost to repair the ship and unlock the Spaceship screen. */
export const SHIP_REPAIR_COST: CargoCounts = {
  iron: 5,
  crystal: 3,
  gas: 2,
};

/** Base ship stats (before upgrades). */
export const SHIP_BASE_THRUST = 800;
export const SHIP_BASE_TURN_SPEED = Math.PI * 0.8;
export const SHIP_BASE_MAX_SPEED = 800;
export const SHIP_BASE_HULL = 20;
export const SHIP_BASE_HEAT_SHIELDING = 0; // 0 = no reduction, 1 = full immunity

/** Ship upgrade IDs and max levels (for shipUpgrades record). */
export const SHIP_UPGRADE_IDS = [
  "thrust",
  "turnSpeed",
  "maxSpeed",
  "hull",
  "heatShielding",
] as const;

export type ShipUpgradeId = (typeof SHIP_UPGRADE_IDS)[number];

export interface ShipStats {
  thrust: number;
  turnSpeed: number;
  maxSpeed: number;
  hull: number;
  heatShielding: number; // 0..1, reduces heat damage
}

const UPGRADE_MULTIPLIERS: Record<ShipUpgradeId, number> = {
  thrust: 1.15,
  turnSpeed: 1.1,
  maxSpeed: 1.1,
  hull: 1.2,
  heatShielding: 0.2, // each level adds 0.2 (so 5 levels = 1)
};

export function getShipStats(upgrades: Record<string, number>): ShipStats {
  const level = (id: ShipUpgradeId) => Math.max(0, upgrades[id] ?? 0);
  const mult = (id: ShipUpgradeId) => {
    const m = UPGRADE_MULTIPLIERS[id];
    return id === "heatShielding"
      ? Math.min(1, level(id) * m)
      : Math.pow(m, level(id));
  };
  return {
    thrust: SHIP_BASE_THRUST * mult("thrust"),
    turnSpeed: SHIP_BASE_TURN_SPEED * mult("turnSpeed"),
    maxSpeed: SHIP_BASE_MAX_SPEED * mult("maxSpeed"),
    hull: SHIP_BASE_HULL * mult("hull"),
    heatShielding: mult("heatShielding"),
  };
}

/** Cost to purchase one level of a ship upgrade. */
export function getShipUpgradeCost(
  _upgradeId: ShipUpgradeId,
  currentLevel: number
): CargoCounts {
  const base = { iron: 2, crystal: 1, gas: 1 };
  const scale = 1 + currentLevel * 0.5;
  return {
    iron: Math.max(1, Math.floor(base.iron * scale)),
    crystal: Math.max(1, Math.floor(base.crystal * scale)),
    gas: Math.max(1, Math.floor(base.gas * scale)),
  };
}
