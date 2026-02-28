import { Actor, Color, Engine, Scene } from "excalibur";
import {
  BASE_SAFE_RADIUS_TILES,
  LAVA_DENSITY,
  PLANET_HEIGHT_TILES,
  PLANET_WIDTH_TILES,
  RESOURCE_DENSITY,
  ROCK_DENSITY,
  STORM_ZONE_DENSITY,
  TILE_SIZE,
} from "../config/gameConfig";
import { Tile } from "./Tile";
import { BaseLander } from "../entities/BaseLander";
import { RESOURCE_TYPES, type ResourceId } from "../resources/ResourceTypes";
import { ResourceNode } from "../entities/ResourceNode";
import { ResourceDeposit } from "../entities/ResourceDeposit";
import {
  LavaPool,
  RockObstacle,
  WindZone,
  LightningZone,
} from "../hazards/Hazards";
import type { Rover } from "../entities/Rover";
import { random } from "../utils/seedRandom";
import type { Difficulty } from "../state/Saves";
import { DIFFICULTY_MULTIPLIERS } from "../config/difficulty";

export interface PlanetGenerationResult {
  base: BaseLander;
  actors: Actor[];
}

export interface GeneratePlanetOptions {
  difficulty?: Difficulty;
}

export function generatePlanet(
  scene: Scene,
  _engine: Engine,
  rover: Rover,
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
      scene.add(tile);
      actors.push(tile);
    }
  }

  const baseX = centerTileX * TILE_SIZE + TILE_SIZE / 2;
  const baseY = centerTileY * TILE_SIZE + TILE_SIZE / 2;
  const base = new BaseLander(baseX, baseY);
  scene.add(base);
  actors.push(base);

  rover.pos.x = baseX;
  rover.pos.y = baseY - TILE_SIZE;

  const totalTiles = PLANET_WIDTH_TILES * PLANET_HEIGHT_TILES;

  const resourceCount = Math.floor(
    totalTiles * RESOURCE_DENSITY * mult.resourceDensity
  );
  const lavaCount = Math.floor(totalTiles * LAVA_DENSITY * mult.lavaDensity);
  const rockCount = Math.floor(totalTiles * ROCK_DENSITY * mult.rockDensity);
  const stormCount = Math.floor(
    totalTiles * STORM_ZONE_DENSITY * mult.stormZoneDensity
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
      scene.add(node);
      actors.push(node);
    } else {
      const deposit = new ResourceDeposit(nodeX, nodeY, type, 4);
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
      rover,
      "lava"
    );
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
      rover,
      "rock"
    );
    scene.add(rock);
    actors.push(rock);
  });

  placeHazard(stormCount, (gridX, gridY) => {
    const x = gridX * TILE_SIZE + TILE_SIZE / 2;
    const y = gridY * TILE_SIZE + TILE_SIZE / 2;
    const angle = random() * Math.PI * 2;
    const wind = new WindZone(x, y, TILE_SIZE * 2, TILE_SIZE * 2, rover, angle);
    scene.add(wind);
    actors.push(wind);

    const lightning = new LightningZone(x, y, rover);
    scene.add(lightning);
    actors.push(lightning);
  });

  return { base, actors };
}
