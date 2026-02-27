import type { ResourceId } from '../resources/ResourceTypes'

export type UpgradeEffectKind =
  | 'maxHealth'
  | 'maxCapacity'
  | 'maxSpeed'
  | 'turnSpeed'
  | 'acceleration'
  | 'blasterDamage'
  | 'blasterFireRate'
  | 'blasterRange'
  | 'lavaDamageReduction'
  | 'lavaSlowResist'
  | 'windResist'
  | 'flatDamageReduction'
  | 'lightningWarningTime'

export interface UpgradeEffect {
  kind: UpgradeEffectKind
  value: number
}

export interface UpgradeDef {
  id: string
  resourceId: ResourceId
  cost: number
  name: string
  description: string
  effect: UpgradeEffect
  maxStack?: number
}

const IRON_UPGRADES: UpgradeDef[] = [
  { id: 'iron-health-1', resourceId: 'iron', cost: 3, name: 'Reinforced Hull', description: '+1 max health', effect: { kind: 'maxHealth', value: 1 }, maxStack: 5 },
  { id: 'iron-lava-dmg-1', resourceId: 'iron', cost: 4, name: 'Lava Plating', description: 'Take 1 less damage from lava', effect: { kind: 'lavaDamageReduction', value: 1 }, maxStack: 3 },
  { id: 'iron-lava-slow-1', resourceId: 'iron', cost: 3, name: 'Heat Resistant Treads', description: '10% less slow in lava', effect: { kind: 'lavaSlowResist', value: 0.1 }, maxStack: 3 },
  { id: 'iron-wind-1', resourceId: 'iron', cost: 4, name: 'Wind Baffles', description: '15% less push from wind', effect: { kind: 'windResist', value: 0.15 }, maxStack: 2 },
  { id: 'iron-flat-dmg-1', resourceId: 'iron', cost: 5, name: 'Heavy Armor', description: 'Take 1 less damage from all hazards', effect: { kind: 'flatDamageReduction', value: 1 }, maxStack: 2 },
]

const CRYSTAL_UPGRADES: UpgradeDef[] = [
  { id: 'crystal-capacity-1', resourceId: 'crystal', cost: 5, name: 'Cargo Bay +4', description: '+4 cargo capacity', effect: { kind: 'maxCapacity', value: 4 }, maxStack: 3 },
  { id: 'crystal-speed-1', resourceId: 'crystal', cost: 4, name: 'Turbo Engine', description: '+20 max speed', effect: { kind: 'maxSpeed', value: 20 }, maxStack: 2 },
  { id: 'crystal-turn-1', resourceId: 'crystal', cost: 3, name: 'Agile Steering', description: '+0.2 rad/s turn speed', effect: { kind: 'turnSpeed', value: 0.2 }, maxStack: 2 },
  { id: 'crystal-accel-1', resourceId: 'crystal', cost: 4, name: 'Quick Accelerator', description: '+50 acceleration', effect: { kind: 'acceleration', value: 50 }, maxStack: 2 },
  { id: 'crystal-lightning-1', resourceId: 'crystal', cost: 3, name: 'Storm Sensor', description: '+5 lightning warning time (ms)', effect: { kind: 'lightningWarningTime', value: 5 }, maxStack: 2 },
  { id: 'crystal-blaster-dmg-1', resourceId: 'crystal', cost: 4, name: 'Blaster Power +1', description: '+1 damage per shot to deposits', effect: { kind: 'blasterDamage', value: 1 }, maxStack: 3 },
  { id: 'crystal-blaster-rate-1', resourceId: 'crystal', cost: 4, name: 'Rapid Blaster', description: '+0.5 shots per second', effect: { kind: 'blasterFireRate', value: 0.5 }, maxStack: 2 },
  { id: 'crystal-blaster-range-1', resourceId: 'crystal', cost: 3, name: 'Long Range Lens', description: 'Longer blaster range', effect: { kind: 'blasterRange', value: 50 }, maxStack: 2 },
  { id: 'crystal-blaster-eff-1', resourceId: 'crystal', cost: 5, name: 'Mining Amplifier', description: '+1 damage to deposits only', effect: { kind: 'blasterDamage', value: 1 }, maxStack: 2 },
]

const GAS_UPGRADES: UpgradeDef[] = [
  { id: 'gas-speed-1', resourceId: 'gas', cost: 4, name: 'Thruster Boost', description: '+15 max speed', effect: { kind: 'maxSpeed', value: 15 }, maxStack: 2 },
  { id: 'gas-accel-1', resourceId: 'gas', cost: 3, name: 'Nitrous Injector', description: '+30 acceleration', effect: { kind: 'acceleration', value: 30 }, maxStack: 2 },
  { id: 'gas-turn-1', resourceId: 'gas', cost: 3, name: 'Maneuvering Jets', description: '+0.15 rad/s turn speed', effect: { kind: 'turnSpeed', value: 0.15 }, maxStack: 2 },
  { id: 'gas-lava-slow-1', resourceId: 'gas', cost: 4, name: 'Cooling Vents', description: '10% less slow in lava', effect: { kind: 'lavaSlowResist', value: 0.1 }, maxStack: 2 },
  { id: 'gas-wind-1', resourceId: 'gas', cost: 3, name: 'Stabilizer', description: '10% less push from wind', effect: { kind: 'windResist', value: 0.1 }, maxStack: 2 },
]

const POOLS: Record<ResourceId, UpgradeDef[]> = {
  iron: IRON_UPGRADES,
  crystal: CRYSTAL_UPGRADES,
  gas: GAS_UPGRADES,
}

const ALL_UPGRADES = [...IRON_UPGRADES, ...CRYSTAL_UPGRADES, ...GAS_UPGRADES]
const UPGRADE_BY_ID = new Map<string, UpgradeDef>(ALL_UPGRADES.map((u) => [u.id, u]))

export function getPool(resourceId: ResourceId): UpgradeDef[] {
  return POOLS[resourceId]
}

export function getUpgradeById(id: string): UpgradeDef | undefined {
  return UPGRADE_BY_ID.get(id)
}

function countApplied(upgradeId: string, appliedUpgradeIds: string[]): number {
  return appliedUpgradeIds.filter((id) => id === upgradeId).length
}

export function getAffordableUpgrades(
  bank: Record<ResourceId, number>,
  resourceId: ResourceId,
  appliedUpgradeIds: string[],
): UpgradeDef[] {
  const pool = POOLS[resourceId]
  const available: UpgradeDef[] = []
  for (const def of pool) {
    if (bank[resourceId] < def.cost) continue
    const stack = countApplied(def.id, appliedUpgradeIds)
    const maxStack = def.maxStack ?? 1
    if (stack >= maxStack) continue
    available.push(def)
  }
  return available
}

export function get3RandomAffordable(
  bank: Record<ResourceId, number>,
  resourceId: ResourceId,
  appliedUpgradeIds: string[],
): UpgradeDef[] {
  const available = getAffordableUpgrades(bank, resourceId, appliedUpgradeIds)
  if (available.length <= 3) return [...available]
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

export function canAffordAnyUpgrade(bank: Record<ResourceId, number>, appliedUpgradeIds: string[]): Record<ResourceId, boolean> {
  return {
    iron: getAffordableUpgrades(bank, 'iron', appliedUpgradeIds).length > 0,
    crystal: getAffordableUpgrades(bank, 'crystal', appliedUpgradeIds).length > 0,
    gas: getAffordableUpgrades(bank, 'gas', appliedUpgradeIds).length > 0,
  }
}

export function getUpgradeCost(def: UpgradeDef): Record<ResourceId, number> {
  return { iron: 0, crystal: 0, gas: 0, [def.resourceId]: def.cost }
}
