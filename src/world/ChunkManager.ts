import { Actor, Color, type Scene } from "excalibur";
import {
  BASE_SAFE_RADIUS_TILES,
  CHUNK_LOAD_RADIUS,
  CHUNK_TILES,
  CHUNK_UNLOAD_RADIUS,
  LAVA_DENSITY,
  PLANET_HEIGHT_TILES,
  PLANET_WIDTH_TILES,
  RESOURCE_DENSITY,
  ROCK_DENSITY,
  STORM_REGION_COUNT,
  STORM_REGION_RADIUS_PX,
  TILE_SIZE,
  WIND_REGION_COUNT,
  WIND_REGION_RADIUS_PX,
} from "../config/gameConfig";
import { DIFFICULTY_MULTIPLIERS } from "../config/difficulty";
import type { IHazardTarget } from "../entities/Rover";
import { ResourceDeposit } from "../entities/ResourceDeposit";
import { ResourceNode } from "../entities/ResourceNode";
import { LavaPool, RockObstacle } from "../hazards/Hazards";
import { StormRegion } from "../hazards/StormRegion";
import { WindRegion } from "../hazards/WindRegion";
import { RESOURCE_TYPES, type ResourceId } from "../resources/ResourceTypes";
import type { Difficulty } from "../state/Saves";
import { getNoise2D } from "../utils/worldNoise";
import { hashToUnit } from "../utils/worldHash";
import { FogAffectedComponent } from "./FogOfWar";
import { Tile } from "./Tile";
import { getDepositAtTile, tileKey, type WorldState } from "./WorldState";

interface ChunkRecord {
  key: string;
  cx: number;
  cy: number;
  actors: Actor[];
  storms: StormRegion[];
  winds: WindRegion[];
}

export interface ChunkManagerParams {
  scene: Scene;
  hazardTarget: IHazardTarget;
  difficulty: Difficulty;
  seed: number;
  worldActors: Actor[];
  stormRegions: StormRegion[];
  windRegions: WindRegion[];
  worldState: WorldState;
}

export class ChunkManager {
  private scene: Scene;
  private hazardTarget: IHazardTarget;
  private difficulty: Difficulty;
  private seed: number;
  private worldActors: Actor[];
  private stormRegions: StormRegion[];
  private windRegions: WindRegion[];
  private worldState: WorldState;
  private loaded = new Map<string, ChunkRecord>();
  private readonly noise2D: (x: number, y: number) => number;

  constructor(params: ChunkManagerParams) {
    this.scene = params.scene;
    this.hazardTarget = params.hazardTarget;
    this.difficulty = params.difficulty;
    this.seed = params.seed;
    this.worldActors = params.worldActors;
    this.stormRegions = params.stormRegions;
    this.windRegions = params.windRegions;
    this.worldState = params.worldState;
    this.noise2D = getNoise2D(this.seed);
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
  }

  private generateChunk(
    cx: number,
    cy: number
  ): { actors: Actor[]; storms: StormRegion[]; winds: WindRegion[] } {
    const actors: Actor[] = [];
    const storms: StormRegion[] = [];
    const winds: WindRegion[] = [];
    const mult = DIFFICULTY_MULTIPLIERS[this.difficulty];
    const resourceProb = clamp01(RESOURCE_DENSITY * mult.resourceDensity);
    const lavaProb = clamp01(LAVA_DENSITY * mult.lavaDensity);
    const rockProb = clamp01(ROCK_DENSITY * mult.rockDensity);
    const [minGx, minGy, maxGx, maxGy] = chunkBounds(cx, cy);

    for (let gy = minGy; gy < maxGy; gy++) {
      for (let gx = minGx; gx < maxGx; gx++) {
        const isBaseTile = gx === 0 && gy === 0;
        const tile = new Tile(gx, gy, isBaseTile ? "base" : "ground");
        this.scene.add(tile);
        actors.push(tile);
        this.worldActors.push(tile);

        if (isBaseTile) continue;
        const key = tileKey(gx, gy);
        if (this.worldState.clearedTileKeys.has(key)) continue;

        const savedDeposit = getDepositAtTile(this.worldState, gx, gy);
        if (savedDeposit) {
          const type = RESOURCE_TYPES.find(
            (r) => r.id === savedDeposit.resourceId
          );
          if (!type) continue;
          const deposit = new ResourceDeposit(
            gx * TILE_SIZE + TILE_SIZE / 2,
            gy * TILE_SIZE + TILE_SIZE / 2,
            type,
            savedDeposit.hp
          );
          deposit.addComponent(new FogAffectedComponent());
          this.scene.add(deposit);
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
        if (!inBaseSafeZone && content < resourceProb + lavaProb) {
          const lava = new LavaPool(
            gx * TILE_SIZE + TILE_SIZE / 2,
            gy * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
            Color.fromHex("#b91c1c"),
            this.hazardTarget,
            "lava"
          );
          lava.addComponent(new FogAffectedComponent());
          this.scene.add(lava);
          actors.push(lava);
          this.worldActors.push(lava);
          continue;
        }
        if (!inBaseSafeZone && content < resourceProb + lavaProb + rockProb) {
          const rock = new RockObstacle(
            gx * TILE_SIZE + TILE_SIZE / 2,
            gy * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
            Color.fromHex("#4b5563"),
            this.hazardTarget,
            "rock"
          );
          rock.addComponent(new FogAffectedComponent());
          this.scene.add(rock);
          actors.push(rock);
          this.worldActors.push(rock);
        }
      }
    }

    const initialChunkArea =
      Math.ceil(PLANET_WIDTH_TILES / CHUNK_TILES) *
      Math.ceil(PLANET_HEIGHT_TILES / CHUNK_TILES);
    const stormChance = Math.min(
      1,
      (STORM_REGION_COUNT * mult.stormRegionCount) / initialChunkArea
    );
    const windChance = Math.min(
      1,
      (WIND_REGION_COUNT * mult.windRegionCount) / initialChunkArea
    );

    if (hashToUnit(this.seed, "storm-chance", cx, cy) < stormChance) {
      const storm = this.createStorm(cx, cy);
      this.scene.add(storm);
      actors.push(storm);
      storms.push(storm);
      this.worldActors.push(storm);
      this.stormRegions.push(storm);
    }

    if (hashToUnit(this.seed, "wind-chance", cx, cy) < windChance) {
      const wind = this.createWind(cx, cy);
      this.scene.add(wind);
      actors.push(wind);
      winds.push(wind);
      this.worldActors.push(wind);
      this.windRegions.push(wind);
    }

    return { actors, storms, winds };
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
    const deposit = new ResourceDeposit(x, y, type, 4);
    deposit.addComponent(new FogAffectedComponent());
    this.scene.add(deposit);
    actors.push(deposit);
    this.worldActors.push(deposit);
  }

  private createStorm(cx: number, cy: number): StormRegion {
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
    });
  }

  private createWind(cx: number, cy: number): WindRegion {
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
    });
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
