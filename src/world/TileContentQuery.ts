import type { BiomeId, BiomePreset } from "../config/biomeConfig";
import { BIOME_CONFIGS } from "../config/biomeConfig";
import type { Difficulty } from "../state/Saves";
import { DIFFICULTY_MULTIPLIERS } from "../config/difficulty";
import { RESOURCE_TYPES } from "../resources/ResourceTypes";
import type { WorldState } from "./WorldState";
import { getDepositAtTile, tileKey } from "./WorldState";
import type { IndestructibleSize } from "../resources/terrainAssets";
import {
  BASE_SAFE_RADIUS_TILES,
  DESTRUCTIBLE_OBSTACLE_DENSITY,
  ICE_PATCH_CLUSTER_SCALE,
  ICE_PATCH_DENSITY,
  ICE_PATCH_DETAIL_SCALE,
  INDESTRUCTIBLE_OBSTACLE_DENSITY,
  INDESTRUCTIBLE_SIZE_WEIGHTS,
  LAVA_DENSITY,
  RESOURCE_DENSITY,
} from "../config/gameConfig";
import { getNoise2D } from "../utils/worldNoise";
import { hashToUnit } from "../utils/worldHash";

export type TileContentResource = "iron" | "crystal" | "gas";
export type TileContentHazard = "lava" | "ice";

export interface TileContentResult {
  resource?: TileContentResource;
  hazard?: TileContentHazard;
}

export type TileKind = "base" | "ground";

export interface OverlayResource {
  resourceId: TileContentResource;
  /**
   * Deposit resources only (iron/crystal). gas nodes don't use hp.
   * Kept optional to match current chunk spawning behavior.
   */
  hp?: number;
  depositSpriteIndex?: number;
}

export interface OverlayDestructible {
  biomeId: BiomeId;
  spriteIndex: number;
}

export interface OverlayIndestructibleOrigin {
  originGx: number;
  originGy: number;
  size: IndestructibleSize;
  biomeId: BiomeId;
  spriteIndex: number;
}

export interface OverlayCell {
  kind: TileKind;
  biomeId: BiomeId;
  groundSpriteIndex?: number;

  // Overlays placed by ChunkManager (hazards and obstacles).
  ice: boolean;
  lava: boolean;
  resource?: OverlayResource;
  destructible?: OverlayDestructible;

  // Indestructible:
  // - `indestructibleCovered` allows blob neighbor masks to connect 1x1 blobs
  //   to 2x2/3x3 blocks.
  // - `indestructibleOrigin` marks the cell that should spawn an actor.
  indestructibleCovered: boolean;
  indestructibleOrigin?: OverlayIndestructibleOrigin;
}

export class TileContentQuery {
  private readonly seed: number;
  private readonly worldState: WorldState;
  private readonly difficulty: Difficulty;
  private readonly biomePreset: BiomePreset;

  private readonly noise2D: (x: number, y: number) => number;
  private readonly biomeNoise2D: (x: number, y: number) => number;

  constructor(params: {
    seed: number;
    worldState: WorldState;
    difficulty: Difficulty;
    biomePreset: BiomePreset;
  }) {
    this.seed = params.seed;
    this.worldState = params.worldState;
    this.difficulty = params.difficulty;
    this.biomePreset = params.biomePreset;
    this.noise2D = getNoise2D(params.seed);
    this.biomeNoise2D = getNoise2D((params.seed ^ 0x9e3779b1) >>> 0);
  }

  /**
   * Fast deterministic tile summary for minimap:
   * - Matches the existing MinimapTileQuery behavior (no indestructible
   *   greedy/occupied simulation).
   */
  getTileContent(gx: number, gy: number): TileContentResult {
    const result: TileContentResult = {};

    if (gx === 0 && gy === 0) return result; // base tile

    const key = tileKey(gx, gy);
    if (this.worldState.clearedTileKeys.has(key)) return result;

    const deposit = getDepositAtTile(this.worldState, gx, gy);
    if (deposit) {
      result.resource = deposit.resourceId as TileContentResource;
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

  /**
   * Chunk rendering-grade overlay grid.
   *
   * This simulates ChunkManager's per-chunk occupied/overlap behavior for
   * indestructible blocks so blob neighbor masks match what will actually be
   * spawned in that region.
   *
   * Note: actor spawning in ChunkManager will usually use an inner bounds and
   * ignore `indestructibleOrigin` cells outside those inner bounds, but the
   * `indestructibleCovered` flag is computed for the full grid so blob masks
   * at chunk edges have continuity.
   */
  getOverlayGrid(
    minGx: number,
    minGy: number,
    maxGx: number,
    maxGy: number
  ): {
    minGx: number;
    minGy: number;
    width: number;
    height: number;
    getCell: (gx: number, gy: number) => OverlayCell | null;
    grid: OverlayCell[][];
  } {
    const width = maxGx - minGx;
    const height = maxGy - minGy;

    const grid: OverlayCell[][] = Array.from(
      { length: height },
      () => new Array<OverlayCell>(width)
    );

    // 1) Initialize tile kinds + base biome info.
    for (let gy = minGy; gy < maxGy; gy++) {
      for (let gx = minGx; gx < maxGx; gx++) {
        const isBaseTile = gx === 0 && gy === 0;
        const iceTile = !isBaseTile && this.isIcePatchTile(gx, gy);
        const biomeId = this.biomeAtTile(gx, gy);
        const kind: TileKind = isBaseTile ? "base" : "ground";
        const groundSpriteIndex =
          kind !== "base"
            ? Math.floor(hashToUnit(this.seed, "ground-sprite", gx, gy) * 16)
            : undefined;
        grid[gy - minGy]![gx - minGx] = {
          kind,
          biomeId,
          groundSpriteIndex,
          ice: iceTile,
          lava: false,
          indestructibleCovered: false,
        };
      }
    }

    // 2) Simulate ChunkManager occupied/overlap for indestructible blocks.
    const mult = DIFFICULTY_MULTIPLIERS[this.difficulty];
    const occupied = new Set<string>();

    for (let gy = minGy; gy < maxGy; gy++) {
      for (let gx = minGx; gx < maxGx; gx++) {
        const cell = grid[gy - minGy]![gx - minGx]!;
        const isBaseTile = cell.kind === "base";
        if (isBaseTile) continue;

        const key = tileKey(gx, gy);
        if (this.worldState.clearedTileKeys.has(key)) continue;
        if (occupied.has(key)) continue;

        // Saved deposit overrides probabilities.
        const savedDeposit = getDepositAtTile(this.worldState, gx, gy);
        if (savedDeposit) {
          const type = RESOURCE_TYPES.find(
            (r) => r.id === savedDeposit.resourceId
          );
          if (!type) continue;
          const depositSpriteIndex = Math.floor(
            hashToUnit(this.seed, "deposit-sprite", gx, gy) * 4
          );
          cell.resource = {
            resourceId: savedDeposit.resourceId as TileContentResource,
            hp: savedDeposit.hp,
            depositSpriteIndex,
          };
          continue;
        }

        const content = normalize(this.noise2D(gx / 8, gy / 8));
        const inBaseSafeZone = isInBaseVicinity(gx, gy);
        const biomeCfg = BIOME_CONFIGS[cell.biomeId]!;

        const resourceProb = clamp01(
          RESOURCE_DENSITY *
            mult.resourceDensity *
            biomeCfg.hazard.resourceDensityMultiplier
        );
        const lavaProb = clamp01(
          LAVA_DENSITY *
            mult.lavaDensity *
            biomeCfg.hazard.lavaDensityMultiplier
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

        if (content < resourceProb) {
          const t = hashToUnit(this.seed, "res-type", gx, gy);
          const resourceId: TileContentResource =
            t < 0.34 ? "iron" : t < 0.67 ? "crystal" : "gas";
          if (resourceId === "gas") {
            cell.resource = { resourceId };
          } else {
            const depositSpriteIndex = Math.floor(
              hashToUnit(this.seed, "deposit-sprite", gx, gy) * 4
            );
            cell.resource = {
              resourceId,
              hp: 4,
              depositSpriteIndex,
            };
          }
          continue;
        }

        if (!inBaseSafeZone && content < resourceProb + destructibleProb) {
          const spriteIndex = Math.floor(
            hashToUnit(this.seed, "destructible-sprite", gx, gy) * 8
          );
          cell.destructible = {
            biomeId: cell.biomeId,
            spriteIndex,
          };
          continue;
        }

        if (
          !inBaseSafeZone &&
          content < resourceProb + destructibleProb + lavaProb
        ) {
          cell.lava = true;
          continue;
        }

        if (
          !inBaseSafeZone &&
          content <
            resourceProb + destructibleProb + lavaProb + indestructibleProb
        ) {
          const sizeRoll = hashToUnit(this.seed, "indestructible-size", gx, gy);
          const size: IndestructibleSize =
            sizeRoll < INDESTRUCTIBLE_SIZE_WEIGHTS[1]
              ? 1
              : sizeRoll <
                  INDESTRUCTIBLE_SIZE_WEIGHTS[1] +
                    INDESTRUCTIBLE_SIZE_WEIGHTS[2]
                ? 2
                : 3;

          // Overlap check and placement (mirrors ChunkManager).
          const blockKeys: string[] = [];
          for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
              const bx = gx + dx;
              const by = gy + dy;
              blockKeys.push(tileKey(bx, by));
            }
          }

          const overlaps =
            blockKeys.some((k) => occupied.has(k)) ||
            blockKeys.some((k) => this.worldState.clearedTileKeys.has(k)) ||
            blockKeys.some((k) => k === "0,0");
          if (overlaps) continue;

          for (const k of blockKeys) {
            occupied.add(k);
          }

          // Mark coverage inside our grid bounds.
          for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
              const bx = gx + dx;
              const by = gy + dy;
              if (bx < minGx || bx >= maxGx || by < minGy || by >= maxGy) {
                continue;
              }
              const c = grid[by - minGy]![bx - minGx]!;
              c.indestructibleCovered = true;
            }
          }

          const spriteIndex = Math.floor(
            hashToUnit(this.seed, "indestructible-sprite", gx, gy) * 16
          );
          cell.indestructibleOrigin = {
            originGx: gx,
            originGy: gy,
            size,
            biomeId: cell.biomeId,
            spriteIndex,
          };
          continue;
        }
      }
    }

    return {
      minGx,
      minGy,
      width,
      height,
      grid,
      getCell: (gx: number, gy: number) => {
        if (gx < minGx || gx >= maxGx || gy < minGy || gy >= maxGy) return null;
        return grid[gy - minGy]![gx - minGx]!;
      },
    };
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalize(value: number): number {
  return (value + 1) / 2;
}

function isInBaseVicinity(gridX: number, gridY: number): boolean {
  return Math.max(Math.abs(gridX), Math.abs(gridY)) <= BASE_SAFE_RADIUS_TILES;
}
