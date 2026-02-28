import type { Difficulty } from "../state/Saves";

export interface DifficultyMultipliers {
  resourceDensity: number;
  lavaDensity: number;
  rockDensity: number;
  stormZoneDensity: number;
}

export const DIFFICULTY_MULTIPLIERS: Record<Difficulty, DifficultyMultipliers> =
  {
    easy: {
      resourceDensity: 1.4,
      lavaDensity: 0.6,
      rockDensity: 0.6,
      stormZoneDensity: 0.6,
    },
    normal: {
      resourceDensity: 1,
      lavaDensity: 1,
      rockDensity: 1,
      stormZoneDensity: 1,
    },
    hard: {
      resourceDensity: 0.7,
      lavaDensity: 1.3,
      rockDensity: 1.3,
      stormZoneDensity: 1.3,
    },
  };
