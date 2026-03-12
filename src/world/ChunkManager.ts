import { Actor, Color, type Scene } from "excalibur";
import {
  BIOME_CONFIGS,
  type BiomeId,
  type BiomePreset,
} from "../config/biomeConfig";
import {
  BASE_SAFE_RADIUS_TILES,
  CHUNK_LOAD_RADIUS,
  CHUNK_TILES,
  CHUNK_UNLOAD_RADIUS,
  DESTRUCTIBLE_OBSTACLE_DENSITY,
  ICE_PATCH_CLUSTER_SCALE,
  ICE_PATCH_DENSITY,
  ICE_PATCH_DETAIL_SCALE,
  INDESTRUCTIBLE_OBSTACLE_DENSITY,
  INDESTRUCTIBLE_SIZE_WEIGHTS,
  LAVA_DENSITY,
  PLANET_HEIGHT_TILES,
  PLANET_WIDTH_TILES,
  RESOURCE_DENSITY,
  SANDSTORM_REGION_COUNT,
  SANDSTORM_REGION_RADIUS_PX,
  SANDSTORM_VISIBILITY_MULTIPLIER,
  STORM_REGION_COUNT,
  STORM_REGION_RADIUS_PX,
  TILE_SIZE,
  WIND_REGION_COUNT,
  WIND_REGION_RADIUS_PX,
} from "../config/gameConfig";
import { DIFFICULTY_MULTIPLIERS } from "../config/difficulty";
import { DestructibleObstacle } from "../entities/DestructibleObstacle";
import { IndestructibleObstacle } from "../entities/IndestructibleObstacle";
import { ResourceDeposit } from "../entities/ResourceDeposit";
import { ResourceNode } from "../entities/ResourceNode";
import type { IndestructibleSize } from "../resources/terrainAssets";
import { LavaPool } from "../hazards/Hazards";
import { StormRegion } from "../hazards/StormRegion";
import { WindRegion } from "../hazards/WindRegion";
import { SandstormRegion } from "../hazards/SandstormRegion";
import { RESOURCE_TYPES, type ResourceId } from "../resources/ResourceTypes";
import type { Difficulty } from "../state/Saves";
import { getNoise2D } from "../utils/worldNoise";
import { hashToUnit } from "../utils/worldHash";
import { FogAffectedComponent } from "./FogOfWar";
import { Tile } from "./Tile";
import { getDepositAtTile, tileKey, type WorldState } from "./WorldState";
import { HazardTargetRegistry } from "../hazards/HazardTargetRegistry";
import type { BlasterTargetRegistry } from "../hazards/BlasterTargetRegistry";

interface ChunkRecord {
  key: string;
  cx: number;
  cy: number;
  actors: Actor[];
  storms: StormRegion[];
  winds: WindRegion[];
  sandstorms: SandstormRegion[];
}

export interface ChunkManagerParams {
  scene: Scene;
  hazardTargetRegistry: HazardTargetRegistry;
  difficulty: Difficulty;
  seed: number;
  biomePreset: BiomePreset;
  worldActors: Actor[];
  stormRegions: StormRegion[];
  windRegions: WindRegion[];
  sandstormRegions: SandstormRegion[];
  worldState: WorldState;
  blasterTargetRegistry?: BlasterTargetRegistry;
}

export class ChunkManager {
  private scene: Scene;
  private hazardTargetRegistry: HazardTargetRegistry;
  private difficulty: Difficulty;
  private seed: number;
  private biomePreset: BiomePreset;
  private worldActors: Actor[];
  private stormRegions: StormRegion[];
  private windRegions: WindRegion[];
  private sandstormRegions: SandstormRegion[];
  private worldState: WorldState;
  private blasterTargetRegistry?: BlasterTargetRegistry;
  private loaded = new Map<string, ChunkRecord>();
  private readonly noise2D: (x: number, y: number) => number;
  private readonly biomeNoise2D: (x: number, y: number) => number;

  constructor(params: ChunkManagerParams) {
    this.scene = params.scene;
    this.hazardTargetRegistry = params.hazardTargetRegistry;
    this.difficulty = params.difficulty;
    this.seed = params.seed;
    this.biomePreset = params.biomePreset;
    this.worldActors = params.worldActors;
    this.stormRegions = params.stormRegions;
    this.windRegions = params.windRegions;
    this.sandstormRegions = params.sandstormRegions;
    this.worldState = params.worldState;
    this.blasterTargetRegistry = params.blasterTargetRegistry;
    this.noise2D = getNoise2D(this.seed);
    this.biomeNoise2D = getNoise2D((this.seed ^ 0x9e3779b1) >>> 0);
  }

  update(roverX: number, roverY: number): void {
    const roverTileX = Math.floor(roverX / TILE_SIZE);
    const roverTileY = Math.floor(roverY / TILE_SIZE);
    const roverCx = tileToChunk(roverTileX);
    const roverCy = tileToChunk(roverTileY);

    for (
      let cy = roverCy - CHUNK_LOAD_RADIUS;
      cy <= roverCy + CHUNK_LOAD_RADIUS;
      cy++
    ) {
      for (
        let cx = roverCx - CHUNK_LOAD_RADIUS;
        cx <= roverCx + CHUNK_LOAD_RADIUS;
        cx++
      ) {
        this.loadChunk(cx, cy);
      }
    }

    const removeKeys: string[] = [];
    for (const [key, chunk] of this.loaded.entries()) {
      const dx = Math.abs(chunk.cx - roverCx);
      const dy = Math.abs(chunk.cy - roverCy);
      if (Math.max(dx, dy) > CHUNK_UNLOAD_RADIUS) {
        removeKeys.push(key);
      }
    }
    for (const key of removeKeys) {
      this.unloadChunk(key);
    }
  }

  destroy(): void {
    for (const key of [...this.loaded.keys()]) {
      this.unloadChunk(key);
    }
  }

  getBiomeAtWorldPos(x: number, y: number): BiomeId {
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    return this.biomeAtTile(gx, gy);
  }

  isIceHazardAtWorldPos(x: number, y: number): boolean {
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    return this.isIcePatchTile(gx, gy);
  }

  private loadChunk(cx: number, cy: number): void {
    const key = chunkKey(cx, cy);
    if (this.loaded.has(key)) return;
    const generated = this.generateChunk(cx, cy);
    this.loaded.set(key, {
      key,
      cx,
      cy,
      actors: generated.actors,
      storms: generated.storms,
      winds: generated.winds,
      sandstorms: generated.sandstorms,
    });
  }

  private unloadChunk(key: string): void {
    const chunk = this.loaded.get(key);
    if (!chunk) return;
    this.loaded.delete(key);
    for (const actor of chunk.actors) {
      actor.kill();
    }
    removeFromArray(this.worldActors, chunk.actors);
    removeFromArray(this.stormRegions, chunk.storms);
    removeFromArray(this.windRegions, chunk.winds);
    removeFromArray(this.sandstormRegions, chunk.sandstorms);
  }

  private generateChunk(
    cx: number,
    cy: number
  ): {
    actors: Actor[];
    storms: StormRegion[];
    winds: WindRegion[];
    sandstorms: SandstormRegion[];
  } {
    const actors: Actor[] = [];
    const storms: StormRegion[] = [];
    const winds: WindRegion[] = [];
    const sandstorms: SandstormRegion[] = [];
    const mult = DIFFICULTY_MULTIPLIERS[this.difficulty];
    const biome = this.biomeAtChunk(cx, cy);
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
    const [minGx, minGy, maxGx, maxGy] = chunkBounds(cx, cy);
    const occupied = new Set<string>();

    for (let gy = minGy; gy < maxGy; gy++) {
      for (let gx = minGx; gx < maxGx; gx++) {
        const isBaseTile = gx === 0 && gy === 0;
        const isIceTile = !isBaseTile && this.isIcePatchTile(gx, gy);
        const tileBiome = this.biomeAtTile(gx, gy);
        const groundSpriteIndex = Math.floor(
          hashToUnit(this.seed, "ground-sprite", gx, gy) * 16
        );
        const tile = new Tile(gx, gy, {
          kind: isBaseTile ? "base" : isIceTile ? "ice" : "ground",
          ...(isBaseTile || isIceTile
            ? {}
            : { biomeId: tileBiome, groundSpriteIndex }),
        });
        this.scene.add(tile);
        actors.push(tile);
        this.worldActors.push(tile);

        if (isBaseTile) continue;
        const key = tileKey(gx, gy);
        if (this.worldState.clearedTileKeys.has(key)) continue;
        if (occupied.has(key)) continue;

        const savedDeposit = getDepositAtTile(this.worldState, gx, gy);
        if (savedDeposit) {
          const type = RESOURCE_TYPES.find(
            (r) => r.id === savedDeposit.resourceId
          );
          if (!type) continue;
          const spriteIndex = Math.floor(
            hashToUnit(this.seed, "deposit-sprite", gx, gy) * 4
          );
          const deposit = new ResourceDeposit(
            gx * TILE_SIZE + TILE_SIZE / 2,
            gy * TILE_SIZE + TILE_SIZE / 2,
            type,
            savedDeposit.hp,
            spriteIndex
          );
          deposit.addComponent(new FogAffectedComponent());
          this.scene.add(deposit);
          this.blasterTargetRegistry?.register(deposit);
          actors.push(deposit);
          this.worldActors.push(deposit);
          continue;
        }

        const content = normalize(this.noise2D(gx / 8, gy / 8));
        const inBaseSafeZone = isInBaseVicinity(gx, gy);
        if (content < resourceProb) {
          this.spawnResource(actors, gx, gy);
          continue;
        }
        if (!inBaseSafeZone && content < resourceProb + destructibleProb) {
          const spriteIndex = Math.floor(
            hashToUnit(this.seed, "destructible-sprite", gx, gy) * 8
          );
          const obstacle = new DestructibleObstacle(
            gx * TILE_SIZE + TILE_SIZE / 2,
            gy * TILE_SIZE + TILE_SIZE / 2,
            tileBiome,
            spriteIndex
          );
          obstacle.addComponent(new FogAffectedComponent());
          this.scene.add(obstacle);
          this.blasterTargetRegistry?.register(obstacle);
          actors.push(obstacle);
          this.worldActors.push(obstacle);
          continue;
        }
        if (
          !inBaseSafeZone &&
          content < resourceProb + destructibleProb + lavaProb
        ) {
          const target = this.hazardTargetRegistry.getPrimary();
          if (!target) continue;
          const lava = new LavaPool(
            gx * TILE_SIZE + TILE_SIZE / 2,
            gy * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
            Color.fromHex("#b91c1c"),
            target,
            "lava"
          );
          lava.addComponent(new FogAffectedComponent());
          this.scene.add(lava);
          actors.push(lava);
          this.worldActors.push(lava);
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
          const blockKeys = tileKeysForBlock(gx, gy, size);
          const overlaps =
            blockKeys.some((k) => occupied.has(k)) ||
            blockKeys.some((k) => this.worldState.clearedTileKeys.has(k)) ||
            blockKeys.some((k) => k === "0,0");
          if (overlaps) continue;
          const spriteIndex = Math.floor(
            hashToUnit(this.seed, "indestructible-sprite", gx, gy) * 16
          );
          const obstacle = new IndestructibleObstacle(
            gx,
            gy,
            size,
            tileBiome,
            spriteIndex
          );
          obstacle.addComponent(new FogAffectedComponent());
          this.scene.add(obstacle);
          actors.push(obstacle);
          this.worldActors.push(obstacle);
          for (const k of blockKeys) {
            occupied.add(k);
          }
        }
      }
    }

    const initialChunkArea =
      Math.ceil(PLANET_WIDTH_TILES / CHUNK_TILES) *
      Math.ceil(PLANET_HEIGHT_TILES / CHUNK_TILES);
    const stormChance = Math.min(
      1,
      (STORM_REGION_COUNT *
        mult.stormRegionCount *
        biomeCfg.hazard.stormRegionMultiplier) /
        initialChunkArea
    );
    const windChance = Math.min(
      1,
      (WIND_REGION_COUNT *
        mult.windRegionCount *
        biomeCfg.hazard.windRegionMultiplier) /
        initialChunkArea
    );
    const sandstormChance =
      biome === "desert"
        ? Math.min(
            1,
            (SANDSTORM_REGION_COUNT *
              mult.sandstormRegionCount *
              biomeCfg.hazard.sandstormRegionMultiplier) /
              initialChunkArea
          )
        : 0;

    if (hashToUnit(this.seed, "storm-chance", cx, cy) < stormChance) {
      const storm = this.createStorm(cx, cy);
      if (storm) {
        this.scene.add(storm);
        actors.push(storm);
        storms.push(storm);
        this.worldActors.push(storm);
        this.stormRegions.push(storm);
      }
    }

    if (hashToUnit(this.seed, "wind-chance", cx, cy) < windChance) {
      const wind = this.createWind(cx, cy);
      if (wind) {
        this.scene.add(wind);
        actors.push(wind);
        winds.push(wind);
        this.worldActors.push(wind);
        this.windRegions.push(wind);
      }
    }

    if (hashToUnit(this.seed, "sandstorm-chance", cx, cy) < sandstormChance) {
      const sandstorm = this.createSandstorm(cx, cy);
      if (sandstorm) {
        this.scene.add(sandstorm);
        actors.push(sandstorm);
        sandstorms.push(sandstorm);
        this.worldActors.push(sandstorm);
        this.sandstormRegions.push(sandstorm);
      }
    }

    return { actors, storms, winds, sandstorms };
  }

  private spawnResource(actors: Actor[], gx: number, gy: number): void {
    const t = hashToUnit(this.seed, "res-type", gx, gy);
    const resourceId: ResourceId =
      t < 0.34 ? "iron" : t < 0.67 ? "crystal" : "gas";
    const type = RESOURCE_TYPES.find((r) => r.id === resourceId);
    if (!type) return;
    const x = gx * TILE_SIZE + TILE_SIZE / 2;
    const y = gy * TILE_SIZE + TILE_SIZE / 2;
    if (resourceId === "gas") {
      const node = new ResourceNode(x, y, type);
      node.addComponent(new FogAffectedComponent());
      this.scene.add(node);
      actors.push(node);
      this.worldActors.push(node);
      return;
    }
    const spriteIndex = Math.floor(
      hashToUnit(this.seed, "deposit-sprite", gx, gy) * 4
    );
    const deposit = new ResourceDeposit(x, y, type, 4, spriteIndex);
    deposit.addComponent(new FogAffectedComponent());
    this.scene.add(deposit);
    this.blasterTargetRegistry?.register(deposit);
    actors.push(deposit);
    this.worldActors.push(deposit);
  }

  private createStorm(cx: number, cy: number): StormRegion | null {
    const target = this.hazardTargetRegistry.getPrimary();
    if (!target) return null;
    const [minGx, minGy, maxGx, maxGy] = chunkBounds(cx, cy);
    const gx = Math.floor(
      minGx + hashToUnit(this.seed, "storm-gx", cx, cy) * (maxGx - minGx)
    );
    const gy = Math.floor(
      minGy + hashToUnit(this.seed, "storm-gy", cx, cy) * (maxGy - minGy)
    );
    const angle = hashToUnit(this.seed, "storm-angle", cx, cy) * Math.PI * 2;
    const moveAngle =
      hashToUnit(this.seed, "storm-move-angle", cx, cy) * Math.PI * 2;
    const strengthMult =
      0.8 + hashToUnit(this.seed, "storm-strength", cx, cy) * 0.4;
    return new StormRegion({
      x: gx * TILE_SIZE + TILE_SIZE / 2,
      y: gy * TILE_SIZE + TILE_SIZE / 2,
      radius: STORM_REGION_RADIUS_PX,
      windDirectionAngle: angle,
      moveDirectionAngle: moveAngle,
      windPushStrength: 1000 * strengthMult,
      hazardTarget: target,
    });
  }

  private createWind(cx: number, cy: number): WindRegion | null {
    const target = this.hazardTargetRegistry.getPrimary();
    if (!target) return null;
    const [minGx, minGy, maxGx, maxGy] = chunkBounds(cx, cy);
    const gx = Math.floor(
      minGx + hashToUnit(this.seed, "wind-gx", cx, cy) * (maxGx - minGx)
    );
    const gy = Math.floor(
      minGy + hashToUnit(this.seed, "wind-gy", cx, cy) * (maxGy - minGy)
    );
    const angle = hashToUnit(this.seed, "wind-angle", cx, cy) * Math.PI * 2;
    const moveAngle =
      hashToUnit(this.seed, "wind-move-angle", cx, cy) * Math.PI * 2;
    const strengthMult =
      0.8 + hashToUnit(this.seed, "wind-strength", cx, cy) * 0.4;
    return new WindRegion({
      x: gx * TILE_SIZE + TILE_SIZE / 2,
      y: gy * TILE_SIZE + TILE_SIZE / 2,
      radius: WIND_REGION_RADIUS_PX,
      directionAngle: angle,
      moveDirectionAngle: moveAngle,
      pushStrength: 1000 * strengthMult,
      hazardTarget: target,
    });
  }

  private createSandstorm(cx: number, cy: number): SandstormRegion | null {
    const target = this.hazardTargetRegistry.getPrimary();
    if (!target) return null;
    const [minGx, minGy, maxGx, maxGy] = chunkBounds(cx, cy);
    const gx = Math.floor(
      minGx + hashToUnit(this.seed, "sandstorm-gx", cx, cy) * (maxGx - minGx)
    );
    const gy = Math.floor(
      minGy + hashToUnit(this.seed, "sandstorm-gy", cx, cy) * (maxGy - minGy)
    );
    const angle =
      hashToUnit(this.seed, "sandstorm-angle", cx, cy) * Math.PI * 2;
    const moveAngle =
      hashToUnit(this.seed, "sandstorm-move-angle", cx, cy) * Math.PI * 2;
    const strengthMult =
      0.8 + hashToUnit(this.seed, "sandstorm-strength", cx, cy) * 0.4;
    return new SandstormRegion({
      x: gx * TILE_SIZE + TILE_SIZE / 2,
      y: gy * TILE_SIZE + TILE_SIZE / 2,
      radius: SANDSTORM_REGION_RADIUS_PX,
      directionAngle: angle,
      moveDirectionAngle: moveAngle,
      pushStrength: 1000 * strengthMult,
      visibilityMultiplier: SANDSTORM_VISIBILITY_MULTIPLIER,
      hazardTarget: target,
    });
  }

  private biomeAtChunk(cx: number, cy: number): BiomeId {
    const centerGx = cx * CHUNK_TILES + Math.floor(CHUNK_TILES / 2);
    const centerGy = cy * CHUNK_TILES + Math.floor(CHUNK_TILES / 2);
    return this.biomeAtTile(centerGx, centerGy);
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

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function tileKeysForBlock(
  originGx: number,
  originGy: number,
  size: IndestructibleSize
): string[] {
  const keys: string[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      keys.push(tileKey(originGx + dx, originGy + dy));
    }
  }
  return keys;
}

function tileToChunk(grid: number): number {
  return Math.floor(grid / CHUNK_TILES);
}

function chunkBounds(cx: number, cy: number): [number, number, number, number] {
  const minGx = cx * CHUNK_TILES;
  const minGy = cy * CHUNK_TILES;
  return [minGx, minGy, minGx + CHUNK_TILES, minGy + CHUNK_TILES];
}

function isInBaseVicinity(gridX: number, gridY: number): boolean {
  return Math.max(Math.abs(gridX), Math.abs(gridY)) <= BASE_SAFE_RADIUS_TILES;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalize(value: number): number {
  return (value + 1) / 2;
}

function removeFromArray<T>(arr: T[], toRemove: T[]): void {
  const removeSet = new Set(toRemove);
  for (let i = arr.length - 1; i >= 0; i--) {
    if (removeSet.has(arr[i]!)) {
      arr.splice(i, 1);
    }
  }
}
