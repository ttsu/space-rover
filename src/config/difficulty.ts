import type { Difficulty } from "../state/Saves";

export interface DifficultyMultipliers {
  resourceDensity: number;
  lavaDensity: number;
  rockDensity: number;
  stormZoneDensity: number;
  /** Multiplier on storm region count. */
  stormRegionCount: number;
  /** Multiplier on wind-only region count. */
  windRegionCount: number;
  /** Multiplier on lightning strike rate (higher = more frequent). Capped so hard doesn't exceed max. */
  lightningStrikeRate: number;
  /** Optional: multiply base warning time (e.g. 0.8 = less warning on hard). */
  lightningWarningTimeMultiplier: number;
}

export const DIFFICULTY_MULTIPLIERS: Record<Difficulty, DifficultyMultipliers> =
  {
    easy: {
      resourceDensity: 1.4,
      lavaDensity: 0.6,
      rockDensity: 0.6,
      stormZoneDensity: 0.6,
      stormRegionCount: 0.6,
      windRegionCount: 0.7,
      lightningStrikeRate: 0.6,
      lightningWarningTimeMultiplier: 1.2,
    },
    normal: {
      resourceDensity: 1,
      lavaDensity: 1,
      rockDensity: 1,
      stormZoneDensity: 1,
      stormRegionCount: 1,
      windRegionCount: 1,
      lightningStrikeRate: 1,
      lightningWarningTimeMultiplier: 1,
    },
    hard: {
      resourceDensity: 0.7,
      lavaDensity: 1.3,
      rockDensity: 1.3,
      stormZoneDensity: 1.3,
      stormRegionCount: 1.3,
      windRegionCount: 1.2,
      lightningStrikeRate: 1.4,
      lightningWarningTimeMultiplier: 0.85,
    },
  };
