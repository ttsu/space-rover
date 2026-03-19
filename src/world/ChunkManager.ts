import { Actor, Color, type Scene } from "excalibur";
import {
  BIOME_CONFIGS,
  type BiomeId,
  type BiomePreset,
} from "../config/biomeConfig";
import {
  CHUNK_LOAD_RADIUS,
  CHUNK_TILES,
  CHUNK_UNLOAD_RADIUS,
  PLANET_HEIGHT_TILES,
  PLANET_WIDTH_TILES,
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
import { IcePatch, LavaPool } from "../hazards/Hazards";
import { StormRegion } from "../hazards/StormRegion";
import { WindRegion } from "../hazards/WindRegion";
import { SandstormRegion } from "../hazards/SandstormRegion";
import { RESOURCE_TYPES } from "../resources/ResourceTypes";
import type { Difficulty } from "../state/Saves";
import { getNoise2D } from "../utils/worldNoise";
import { hashToUnit } from "../utils/worldHash";
import { FogAffectedComponent } from "./FogOfWar";
import { Tile } from "./Tile";
import { TileContentQuery } from "./TileContentQuery";
import { blobMask8 } from "./autotiling/WangBlob";
import type { WorldState } from "./WorldState";
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
  private readonly biomeNoise2D: (x: number, y: number) => number;
  private readonly tileContentQuery: TileContentQuery;

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
    this.biomeNoise2D = getNoise2D((this.seed ^ 0x9e3779b1) >>> 0);
    this.tileContentQuery = new TileContentQuery({
      seed: this.seed,
      worldState: this.worldState,
      difficulty: this.difficulty,
      biomePreset: this.biomePreset,
    });
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
    return this.tileContentQuery.getTileContent(gx, gy).hazard === "ice";
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
    const [minGx, minGy, maxGx, maxGy] = chunkBounds(cx, cy);
    const mult = DIFFICULTY_MULTIPLIERS[this.difficulty];
    const biome = this.biomeAtChunk(cx, cy);
    const biomeCfg = BIOME_CONFIGS[biome];

    const border = 2;
    const content = this.tileContentQuery.getOverlayGrid(
      minGx - border,
      minGy - border,
      maxGx + border,
      maxGy + border
    );
    const cellAt = (gx: number, gy: number) => content.getCell(gx, gy);

    const isIceAt = (gx: number, gy: number) => cellAt(gx, gy)?.ice ?? false;
    const isLavaAt = (gx: number, gy: number) => cellAt(gx, gy)?.lava ?? false;
    const isDestructibleAt = (gx: number, gy: number) =>
      !!cellAt(gx, gy)?.destructible;
    const isIndestructibleCoveredAt = (gx: number, gy: number) =>
      cellAt(gx, gy)?.indestructibleCovered ?? false;

    const hazardTarget = this.hazardTargetRegistry.getPrimary();

    for (let gy = minGy; gy < maxGy; gy++) {
      for (let gx = minGx; gx < maxGx; gx++) {
        const tileCell = cellAt(gx, gy);
        if (!tileCell) continue;

        const isBaseTile = tileCell.kind === "base";
        const tile = new Tile(gx, gy, {
          kind: tileCell.kind,
          ...(tileCell.kind === "ground"
            ? {
                biomeId: tileCell.biomeId,
                groundSpriteIndex: tileCell.groundSpriteIndex,
              }
            : {}),
        });

        this.scene.add(tile);
        actors.push(tile);
        this.worldActors.push(tile);

        if (tileCell.ice) {
          const ice = new IcePatch(
            gx * TILE_SIZE + TILE_SIZE / 2,
            gy * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE
          );
          ice.blobMask = blobMask8(gx, gy, isIceAt);
          ice.addComponent(new FogAffectedComponent());
          this.scene.add(ice);
          actors.push(ice);
          this.worldActors.push(ice);
        }

        if (isBaseTile) continue;

        if (tileCell.resource) {
          const type = RESOURCE_TYPES.find(
            (r) => r.id === tileCell.resource!.resourceId
          );
          if (type) {
            const x = gx * TILE_SIZE + TILE_SIZE / 2;
            const y = gy * TILE_SIZE + TILE_SIZE / 2;
            if (tileCell.resource.resourceId === "gas") {
              const node = new ResourceNode(x, y, type);
              node.addComponent(new FogAffectedComponent());
              this.scene.add(node);
              actors.push(node);
              this.worldActors.push(node);
            } else {
              const hp = tileCell.resource.hp ?? 4;
              const spriteIndex = tileCell.resource.depositSpriteIndex ?? 0;
              const deposit = new ResourceDeposit(x, y, type, hp, spriteIndex);
              deposit.addComponent(new FogAffectedComponent());
              this.scene.add(deposit);
              this.blasterTargetRegistry?.register(deposit);
              actors.push(deposit);
              this.worldActors.push(deposit);
            }
          }
          continue;
        }

        if (tileCell.destructible) {
          const x = gx * TILE_SIZE + TILE_SIZE / 2;
          const y = gy * TILE_SIZE + TILE_SIZE / 2;
          const obstacle = new DestructibleObstacle(
            x,
            y,
            tileCell.destructible.biomeId,
            tileCell.destructible.spriteIndex
          );
          obstacle.blobMask = blobMask8(gx, gy, isDestructibleAt);
          obstacle.addComponent(new FogAffectedComponent());
          this.scene.add(obstacle);
          this.blasterTargetRegistry?.register(obstacle);
          actors.push(obstacle);
          this.worldActors.push(obstacle);
          continue;
        }

        if (tileCell.lava) {
          if (!hazardTarget) continue;
          const lava = new LavaPool(
            gx * TILE_SIZE + TILE_SIZE / 2,
            gy * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
            Color.fromHex("#b91c1c"),
            hazardTarget,
            "lava"
          );
          lava.blobMask = blobMask8(gx, gy, isLavaAt);
          lava.addComponent(new FogAffectedComponent());
          this.scene.add(lava);
          actors.push(lava);
          this.worldActors.push(lava);
          continue;
        }

        const origin = tileCell.indestructibleOrigin;
        if (origin) {
          const obstacle = new IndestructibleObstacle(
            origin.originGx,
            origin.originGy,
            origin.size,
            origin.biomeId,
            origin.spriteIndex
          );
          if (origin.size === 1) {
            obstacle.blobMask = blobMask8(gx, gy, isIndestructibleCoveredAt);
          }
          obstacle.addComponent(new FogAffectedComponent());
          this.scene.add(obstacle);
          actors.push(obstacle);
          this.worldActors.push(obstacle);
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
}

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function tileToChunk(grid: number): number {
  return Math.floor(grid / CHUNK_TILES);
}

function chunkBounds(cx: number, cy: number): [number, number, number, number] {
  const minGx = cx * CHUNK_TILES;
  const minGy = cy * CHUNK_TILES;
  return [minGx, minGy, minGx + CHUNK_TILES, minGy + CHUNK_TILES];
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
