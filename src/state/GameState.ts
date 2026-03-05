import type { CargoCounts } from "../entities/Rover";
import { addToBank } from "./Progress";
import { evaluateGoals, getGoalResults } from "./RunGoals";

export type HazardKind =
  | "lava"
  | "lightning"
  | "rock"
  | "wind"
  | "quake"
  | "sandstorm";

export interface RunStats {
  cargo: CargoCounts;
  usedCapacity: number;
  maxCapacity: number;
  healthRemaining: number;
  hazardsHit: Record<HazardKind, number>;
}

const emptyHazards: Record<HazardKind, number> = {
  lava: 0,
  lightning: 0,
  rock: 0,
  wind: 0,
  quake: 0,
  sandstorm: 0,
};

/** Tile keys "gx,gy" for tiles that have been seen this run (fog explored). */
export const GameState = {
  currentHazardsHit: { ...emptyHazards },
  lastRun: null as RunStats | null,
  bestTotalCargo: 0,
  exploredTileKeys: new Set<string>(),
};

export function resetRunTracking() {
  GameState.currentHazardsHit = { ...emptyHazards };
  GameState.exploredTileKeys.clear();
}

export function recordHazardHit(kind: HazardKind) {
  GameState.currentHazardsHit[kind] += 1;
}

export function finishRun(
  cargo: CargoCounts,
  usedCapacity: number,
  maxCapacity: number,
  healthRemaining: number
) {
  const hazardsCopy: Record<HazardKind, number> = {
    ...GameState.currentHazardsHit,
  };

  const totalCargoPieces = Object.values(cargo).reduce((sum, v) => sum + v, 0);

  GameState.lastRun = {
    cargo: { ...cargo },
    usedCapacity,
    maxCapacity,
    healthRemaining,
    hazardsHit: hazardsCopy,
  };

  const survived = healthRemaining > 0;

  evaluateGoals(GameState.lastRun, survived);

  if (survived) {
    addToBank(cargo);

    for (const res of getGoalResults()) {
      if (res.met && res.bonusAmount > 0) {
        const bonus: CargoCounts = { iron: 0, crystal: 0, gas: 0 };
        bonus[res.bonusResource] = res.bonusAmount;
        addToBank(bonus);
      }
    }

    if (totalCargoPieces > GameState.bestTotalCargo) {
      GameState.bestTotalCargo = totalCargoPieces;
    }
  }
}
