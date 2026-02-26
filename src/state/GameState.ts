import type { CargoCounts } from '../entities/Rover'

export type HazardKind = 'lava' | 'lightning' | 'rock' | 'wind' | 'quake'

export interface RunStats {
  cargo: CargoCounts
  usedCapacity: number
  maxCapacity: number
  healthRemaining: number
  hazardsHit: Record<HazardKind, number>
}

const emptyHazards: Record<HazardKind, number> = {
  lava: 0,
  lightning: 0,
  rock: 0,
  wind: 0,
  quake: 0,
}

export const GameState = {
  currentHazardsHit: { ...emptyHazards },
  lastRun: null as RunStats | null,
  bestTotalCargo: 0,
}

export function resetRunTracking() {
  GameState.currentHazardsHit = { ...emptyHazards }
}

export function recordHazardHit(kind: HazardKind) {
  GameState.currentHazardsHit[kind] += 1
}

export function finishRun(
  cargo: CargoCounts,
  usedCapacity: number,
  maxCapacity: number,
  healthRemaining: number,
) {
  const hazardsCopy: Record<HazardKind, number> = { ...GameState.currentHazardsHit }

  const totalCargoPieces = Object.values(cargo).reduce((sum, v) => sum + v, 0)

  GameState.lastRun = {
    cargo: { ...cargo },
    usedCapacity,
    maxCapacity,
    healthRemaining,
    hazardsHit: hazardsCopy,
  }

  if (healthRemaining > 0 && totalCargoPieces > GameState.bestTotalCargo) {
    GameState.bestTotalCargo = totalCargoPieces
  }
}



