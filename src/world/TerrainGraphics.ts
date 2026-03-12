import { SpriteSheet, type Actor } from "excalibur";
import type { BiomeId } from "../config/biomeConfig";
import { TILE_SIZE } from "../config/gameConfig";
import { TerrainResources } from "../resources/terrainAssets";
import type { IndestructibleSize } from "../resources/terrainAssets";

const GROUND_GRID_COLS = 4;
const GROUND_GRID_ROWS = 4;
const DESTRUCTIBLE_GRID_COLS = 4;
const DESTRUCTIBLE_GRID_ROWS = 2;
const INDESTRUCTIBLE_1X1_COLS = 4;
const INDESTRUCTIBLE_1X1_ROWS = 1;
const INDESTRUCTIBLE_2X2_COLS = 3;
const INDESTRUCTIBLE_2X2_ROWS = 1;
const INDESTRUCTIBLE_3X3_COLS = 2;
const INDESTRUCTIBLE_3X3_ROWS = 1;

export function applyGroundSprite(
  actor: Actor,
  biomeId: BiomeId,
  spriteIndex: number
): void {
  const image = TerrainResources.ground[biomeId];
  if (!image?.isLoaded()) return;
  const cols = GROUND_GRID_COLS;
  const rows = GROUND_GRID_ROWS;
  const sheet = SpriteSheet.fromImageSource({
    image,
    grid: {
      rows,
      columns: cols,
      spriteWidth: TILE_SIZE,
      spriteHeight: TILE_SIZE,
    },
  });
  const index = Math.abs(spriteIndex) % (cols * rows);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const sprite = sheet.getSprite(col, row);
  if (sprite) actor.graphics.use(sprite);
}

export function applyDestructibleSprite(
  actor: Actor,
  biomeId: BiomeId,
  spriteIndex: number
): void {
  const image = TerrainResources.destructible[biomeId];
  if (!image?.isLoaded()) return;
  const cols = DESTRUCTIBLE_GRID_COLS;
  const rows = DESTRUCTIBLE_GRID_ROWS;
  const sheet = SpriteSheet.fromImageSource({
    image,
    grid: {
      rows,
      columns: cols,
      spriteWidth: TILE_SIZE,
      spriteHeight: TILE_SIZE,
    },
  });
  const count = cols * rows;
  const index = Math.abs(spriteIndex) % count;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const sprite = sheet.getSprite(col, row);
  if (sprite) actor.graphics.use(sprite);
}

function indestructiblePixelSize(size: IndestructibleSize): number {
  return size * TILE_SIZE;
}

export function applyIndestructibleSprite(
  actor: Actor,
  biomeId: BiomeId,
  size: IndestructibleSize,
  spriteIndex: number
): void {
  const image = TerrainResources.indestructible[biomeId][size];
  if (!image?.isLoaded()) return;
  const pixelSize = indestructiblePixelSize(size);
  let cols: number;
  let rows: number;
  if (size === 1) {
    cols = INDESTRUCTIBLE_1X1_COLS;
    rows = INDESTRUCTIBLE_1X1_ROWS;
  } else if (size === 2) {
    cols = INDESTRUCTIBLE_2X2_COLS;
    rows = INDESTRUCTIBLE_2X2_ROWS;
  } else {
    cols = INDESTRUCTIBLE_3X3_COLS;
    rows = INDESTRUCTIBLE_3X3_ROWS;
  }
  const sheet = SpriteSheet.fromImageSource({
    image,
    grid: {
      rows,
      columns: cols,
      spriteWidth: pixelSize,
      spriteHeight: pixelSize,
    },
  });
  const count = cols * rows;
  const index = Math.abs(spriteIndex) % count;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const sprite = sheet.getSprite(col, row);
  if (sprite) actor.graphics.use(sprite);
}

export function getIndestructiblePixelSize(size: IndestructibleSize): number {
  return indestructiblePixelSize(size);
}
