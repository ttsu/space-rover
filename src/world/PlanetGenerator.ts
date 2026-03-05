import { Actor, Color, Engine, Scene } from "excalibur";
import {
  BASE_SAFE_RADIUS_TILES,
  LAVA_DENSITY,
  PLANET_HEIGHT_TILES,
  PLANET_WIDTH_TILES,
  RESOURCE_DENSITY,
  ROCK_DENSITY,
  STORM_REGION_COUNT,
  STORM_REGION_RADIUS_PX,
  WIND_REGION_COUNT,
  WIND_REGION_RADIUS_PX,
  TILE_SIZE,
} from "../config/gameConfig";
import { Tile } from "./Tile";
import { FogAffectedComponent } from "./FogOfWar";
import { BaseLander } from "../entities/BaseLander";
import { RESOURCE_TYPES, type ResourceId } from "../resources/ResourceTypes";
import { ResourceNode } from "../entities/ResourceNode";
import { ResourceDeposit } from "../entities/ResourceDeposit";
import { LavaPool, RockObstacle } from "../hazards/Hazards";
import { WindRegion } from "../hazards/WindRegion";
import { StormRegion } from "../hazards/StormRegion";
import type { IHazardTarget } from "../entities/Rover";
import { random } from "../utils/seedRandom";
import type { Difficulty } from "../state/Saves";
import { DIFFICULTY_MULTIPLIERS } from "../config/difficulty";

/**
 * @deprecated Runtime generation uses ChunkManager for infinite streaming worlds.
 * Keep this file for legacy reference only until removed in a follow-up cleanup.
 */

export interface PlanetGenerationResult {
  base: BaseLander;
  actors: Actor[];
  stormRegions: StormRegion[];
  windRegions: WindRegion[];
}

export interface GeneratePlanetOptions {
  difficulty?: Difficulty;
}

export function generatePlanet(
  scene: Scene,
  _engine: Engine,
  hazardTarget: IHazardTarget,
  options?: GeneratePlanetOptions
): PlanetGenerationResult {
  const difficulty = options?.difficulty ?? "normal";
  const mult = DIFFICULTY_MULTIPLIERS[difficulty];

  const actors: Actor[] = [];
  const centerTileX = Math.floor(PLANET_WIDTH_TILES / 2);
  const centerTileY = Math.floor(PLANET_HEIGHT_TILES / 2);

  for (let y = 0; y < PLANET_HEIGHT_TILES; y++) {
    for (let x = 0; x < PLANET_WIDTH_TILES; x++) {
      const isCenter = x === centerTileX && y === centerTileY;
      const tile = new Tile(x, y, isCenter ? "base" : "ground");
      tile.addComponent(new FogAffectedComponent({ gridX: x, gridY: y }));
      scene.add(tile);
      actors.push(tile);
    }
  }

  const baseX = centerTileX * TILE_SIZE + TILE_SIZE / 2;
  const baseY = centerTileY * TILE_SIZE + TILE_SIZE / 2;
  const base = new BaseLander(baseX, baseY);
  base.addComponent(
    new FogAffectedComponent({
      gridX: centerTileX,
      gridY: centerTileY,
      alwaysVisible: true,
    })
  );
  scene.add(base);
  actors.push(base);

  const roverActor = hazardTarget.getActor();
  roverActor.pos.x = baseX;
  roverActor.pos.y = baseY - TILE_SIZE;

  const totalTiles = PLANET_WIDTH_TILES * PLANET_HEIGHT_TILES;

  const resourceCount = Math.floor(
    totalTiles * RESOURCE_DENSITY * mult.resourceDensity
  );
  const lavaCount = Math.floor(totalTiles * LAVA_DENSITY * mult.lavaDensity);
  const rockCount = Math.floor(totalTiles * ROCK_DENSITY * mult.rockDensity);
  const stormRegionCount = Math.max(
    0,
    Math.floor(STORM_REGION_COUNT * mult.stormRegionCount)
  );
  const windRegionCount = Math.max(
    0,
    Math.floor(WIND_REGION_COUNT * mult.windRegionCount)
  );

  const occupied = new Set<string>();
  occupied.add(`${centerTileX},${centerTileY}`);

  function isInBaseVicinity(gridX: number, gridY: number): boolean {
    const dx = Math.abs(gridX - centerTileX);
    const dy = Math.abs(gridY - centerTileY);
    return Math.max(dx, dy) <= BASE_SAFE_RADIUS_TILES;
  }

  function randomTile(): { x: number; y: number } {
    return {
      x: Math.floor(random() * PLANET_WIDTH_TILES),
      y: Math.floor(random() * PLANET_HEIGHT_TILES),
    };
  }

  function place(count: number, cb: (x: number, y: number) => void) {
    let placed = 0;
    let safety = totalTiles * 4;
    while (placed < count && safety-- > 0) {
      const { x, y } = randomTile();
      const key = `${x},${y}`;
      if (occupied.has(key)) continue;
      occupied.add(key);
      cb(x, y);
      placed++;
    }
  }

  function placeHazard(count: number, cb: (x: number, y: number) => void) {
    let placed = 0;
    let safety = totalTiles * 4;
    while (placed < count && safety-- > 0) {
      const { x, y } = randomTile();
      const key = `${x},${y}`;
      if (occupied.has(key)) continue;
      if (isInBaseVicinity(x, y)) continue;
      occupied.add(key);
      cb(x, y);
      placed++;
    }
  }

  const resourceIds: ResourceId[] = ["iron", "crystal", "gas"];
  place(resourceCount, (gridX, gridY) => {
    const resourceId = resourceIds[Math.floor(random() * resourceIds.length)];
    const type = RESOURCE_TYPES.find((r) => r.id === resourceId)!;
    const nodeX = gridX * TILE_SIZE + TILE_SIZE / 2;
    const nodeY = gridY * TILE_SIZE + TILE_SIZE / 2;
    if (resourceId === "gas") {
      const node = new ResourceNode(nodeX, nodeY, type);
      node.addComponent(new FogAffectedComponent());
      scene.add(node);
      actors.push(node);
    } else {
      const deposit = new ResourceDeposit(nodeX, nodeY, type, 4);
      deposit.addComponent(new FogAffectedComponent());
      scene.add(deposit);
      actors.push(deposit);
    }
  });

  placeHazard(lavaCount, (gridX, gridY) => {
    const x = gridX * TILE_SIZE + TILE_SIZE / 2;
    const y = gridY * TILE_SIZE + TILE_SIZE / 2;
    const lava = new LavaPool(
      x,
      y,
      TILE_SIZE,
      TILE_SIZE,
      Color.fromHex("#b91c1c"),
      hazardTarget,
      "lava"
    );
    lava.addComponent(new FogAffectedComponent());
    scene.add(lava);
    actors.push(lava);
  });

  placeHazard(rockCount, (gridX, gridY) => {
    const x = gridX * TILE_SIZE + TILE_SIZE / 2;
    const y = gridY * TILE_SIZE + TILE_SIZE / 2;
    const rock = new RockObstacle(
      x,
      y,
      TILE_SIZE,
      TILE_SIZE,
      Color.fromHex("#4b5563"),
      hazardTarget,
      "rock"
    );
    rock.addComponent(new FogAffectedComponent());
    scene.add(rock);
    actors.push(rock);
  });

  const stormRegions: StormRegion[] = [];
  const windRegions: WindRegion[] = [];
  const worldWidth = PLANET_WIDTH_TILES * TILE_SIZE;
  const worldHeight = PLANET_HEIGHT_TILES * TILE_SIZE;

  function randomCenterAvoidingBase(): { x: number; y: number } {
    let x: number, y: number;
    let tries = 0;
    do {
      x = random() * worldWidth;
      y = random() * worldHeight;
      tries++;
      if (tries > 200) break;
    } while (
      isInBaseVicinity(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE))
    );
    return { x, y };
  }

  for (let i = 0; i < stormRegionCount; i++) {
    const { x, y } = randomCenterAvoidingBase();
    const storm = new StormRegion({
      x,
      y,
      radius: STORM_REGION_RADIUS_PX,
      windDirectionAngle: random() * Math.PI * 2,
    });
    scene.add(storm);
    actors.push(storm);
    stormRegions.push(storm);
  }

  for (let i = 0; i < windRegionCount; i++) {
    const { x, y } = randomCenterAvoidingBase();
    const wind = new WindRegion({
      x,
      y,
      radius: WIND_REGION_RADIUS_PX,
      directionAngle: random() * Math.PI * 2,
    });
    scene.add(wind);
    actors.push(wind);
    windRegions.push(wind);
  }

  return { base, actors, stormRegions, windRegions };
}
