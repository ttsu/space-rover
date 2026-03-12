import {
  BASE_SAFE_RADIUS_TILES,
  DESTRUCTIBLE_OBSTACLE_DENSITY,
  ICE_PATCH_CLUSTER_SCALE,
  ICE_PATCH_DENSITY,
  ICE_PATCH_DETAIL_SCALE,
  INDESTRUCTIBLE_OBSTACLE_DENSITY,
  LAVA_DENSITY,
  RESOURCE_DENSITY,
} from "../config/gameConfig";
import {
  BIOME_CONFIGS,
  type BiomeId,
  type BiomePreset,
} from "../config/biomeConfig";
import { DIFFICULTY_MULTIPLIERS } from "../config/difficulty";
import type { Difficulty } from "../state/Saves";
import { getNoise2D } from "../utils/worldNoise";
import { hashToUnit } from "../utils/worldHash";
import { getDepositAtTile, tileKey, type WorldState } from "./WorldState";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalize(value: number): number {
  return (value + 1) / 2;
}

function isInBaseVicinity(gridX: number, gridY: number): boolean {
  return Math.max(Math.abs(gridX), Math.abs(gridY)) <= BASE_SAFE_RADIUS_TILES;
}

export interface TileContentResult {
  resource?: "iron" | "crystal" | "gas";
  hazard?: "lava" | "ice";
}

export interface MinimapTileQueryParams {
  seed: number;
  worldState: WorldState;
  difficulty: Difficulty;
  biomePreset: BiomePreset;
}

/**
 * Deterministic tile-content query for minimap: returns resource and/or hazard
 * for any (gx, gy) without loading chunks. Uses same logic as ChunkManager generation.
 */
export class MinimapTileQuery {
  private readonly seed: number;
  private readonly noise2D: (x: number, y: number) => number;
  private readonly biomeNoise2D: (x: number, y: number) => number;
  private readonly worldState: WorldState;
  private readonly difficulty: Difficulty;
  private readonly biomePreset: BiomePreset;

  constructor(params: MinimapTileQueryParams) {
    this.seed = params.seed;
    this.worldState = params.worldState;
    this.difficulty = params.difficulty;
    this.biomePreset = params.biomePreset;
    this.noise2D = getNoise2D(params.seed);
    this.biomeNoise2D = getNoise2D((params.seed ^ 0x9e3779b1) >>> 0);
  }

  getTileContent(gx: number, gy: number): TileContentResult {
    const result: TileContentResult = {};

    if (gx === 0 && gy === 0) return result; // base tile

    const key = tileKey(gx, gy);
    if (this.worldState.clearedTileKeys.has(key)) return result;

    const deposit = getDepositAtTile(this.worldState, gx, gy);
    if (deposit) {
      result.resource = deposit.resourceId;
      return result;
    }

    const mult = DIFFICULTY_MULTIPLIERS[this.difficulty];
    const biome = this.biomeAtTile(gx, gy);
    const biomeCfg = BIOME_CONFIGS[biome];
    const resourceProb = clamp01(
      RESOURCE_DENSITY *
        mult.resourceDensity *
        biomeCfg.hazard.resourceDensityMultiplier
    );
    const lavaProb = clamp01(
      LAVA_DENSITY * mult.lavaDensity * biomeCfg.hazard.lavaDensityMultiplier
    );
    const destructibleProb = clamp01(
      DESTRUCTIBLE_OBSTACLE_DENSITY *
        mult.rockDensity *
        biomeCfg.hazard.rockDensityMultiplier
    );
    const indestructibleProb = clamp01(
      INDESTRUCTIBLE_OBSTACLE_DENSITY *
        mult.rockDensity *
        biomeCfg.hazard.rockDensityMultiplier
    );

    const content = normalize(this.noise2D(gx / 8, gy / 8));
    const inBaseSafeZone = isInBaseVicinity(gx, gy);

    if (content < resourceProb) {
      const resRoll = hashToUnit(this.seed, "res-type", gx, gy);
      result.resource =
        resRoll < 0.34 ? "iron" : resRoll < 0.67 ? "crystal" : "gas";
      return result;
    }
    if (!inBaseSafeZone && content < resourceProb + destructibleProb) {
      return result;
    }
    if (
      !inBaseSafeZone &&
      content < resourceProb + destructibleProb + lavaProb
    ) {
      result.hazard = "lava";
      return result;
    }
    if (
      !inBaseSafeZone &&
      content < resourceProb + destructibleProb + lavaProb + indestructibleProb
    ) {
      return result;
    }

    if (this.isIcePatchTile(gx, gy)) {
      result.hazard = "ice";
    }
    return result;
  }

  private biomeAtTile(gx: number, gy: number): BiomeId {
    if (this.biomePreset !== "mixed") return this.biomePreset;
    const primary = normalize(this.biomeNoise2D(gx / 80, gy / 80));
    const secondary = normalize(this.biomeNoise2D((gx + 4096) / 120, gy / 120));
    const blend = primary * 0.7 + secondary * 0.3;
    if (blend < 0.16) return "volcanic";
    if (blend < 0.34) return "barren";
    if (blend < 0.5) return "desert";
    if (blend < 0.66) return "toxic";
    if (blend < 0.83) return "ice";
    return "storm";
  }

  private isIcePatchTile(gx: number, gy: number): boolean {
    if (this.biomeAtTile(gx, gy) !== "ice") return false;
    const cluster = normalize(
      this.noise2D(gx / ICE_PATCH_CLUSTER_SCALE, gy / ICE_PATCH_CLUSTER_SCALE)
    );
    const detail = normalize(
      this.noise2D(
        (gx + 2048) / ICE_PATCH_DETAIL_SCALE,
        gy / ICE_PATCH_DETAIL_SCALE
      )
    );
    return cluster > 1 - ICE_PATCH_DENSITY && detail > 0.35;
  }
}
