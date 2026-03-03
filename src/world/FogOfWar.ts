import {
  Component,
  System,
  SystemType,
  World,
  TransformComponent,
  GraphicsComponent,
  Color,
  SystemPriority,
  vec,
} from "excalibur";
import {
  TILE_SIZE,
  PLANET_WIDTH_TILES,
  PLANET_HEIGHT_TILES,
} from "../config/gameConfig";
import { GameState } from "../state/GameState";
import type { Rover } from "../entities/Rover";
import type { ExcaliburGraphicsContext } from "excalibur";
import type { Camera } from "excalibur";

const EXPLORED_OPACITY = 0.4;
const FOG_COLOR = Color.fromHex("#0a0a0f");
const FOG_SOFT_TILES = 1.5;

export interface FogAffectedOptions {
  gridX?: number;
  gridY?: number;
  alwaysVisible?: boolean;
}

export class FogAffectedComponent extends Component {
  gridX?: number;
  gridY?: number;
  alwaysVisible: boolean;

  constructor(options: FogAffectedOptions = {}) {
    super();
    this.gridX = options.gridX;
    this.gridY = options.gridY;
    this.alwaysVisible = options.alwaysVisible ?? false;
  }

  clone(): FogAffectedComponent {
    return new FogAffectedComponent({
      gridX: this.gridX,
      gridY: this.gridY,
      alwaysVisible: this.alwaysVisible,
    });
  }
}

function tileKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

function entityTilePosition(
  fog: FogAffectedComponent,
  pos: { x: number; y: number }
): { gx: number; gy: number } {
  if (fog.gridX !== undefined && fog.gridY !== undefined) {
    return { gx: fog.gridX, gy: fog.gridY };
  }
  const gx = Math.floor(pos.x / TILE_SIZE);
  const gy = Math.floor(pos.y / TILE_SIZE);
  return { gx, gy };
}

export class FogVisibilitySystem extends System {
  static priority = SystemPriority.Lower;
  get systemType(): SystemType {
    return SystemType.Update;
  }
  query;
  private rover: Rover;
  world: World;

  constructor(world: World, rover: Rover) {
    super();
    this.world = world;
    this.rover = rover;
    this.query = this.world.query([
      FogAffectedComponent,
      TransformComponent,
      GraphicsComponent,
    ]);
  }

  update(_elapsed: number): void {
    const roverPos = this.rover.pos;
    const roverGx = Math.floor(roverPos.x / TILE_SIZE);
    const roverGy = Math.floor(roverPos.y / TILE_SIZE);
    const radius = this.rover.roverStats.visibilityRadius;
    const explored = GameState.exploredTileKeys;

    for (const entity of this.query.entities) {
      const fog = entity.get(FogAffectedComponent);
      const transform = entity.get(TransformComponent);
      const graphics = entity.get(GraphicsComponent);
      if (!fog || !transform || !graphics) continue;

      if (fog.alwaysVisible) {
        graphics.isVisible = true;
        graphics.opacity = 1;
        continue;
      }

      const pos = transform.pos;
      const { gx, gy } = entityTilePosition(fog, pos);
      const dx = gx - roverGx;
      const dy = gy - roverGy;
      const distTiles = Math.sqrt(dx * dx + dy * dy);

      if (distTiles <= radius) {
        graphics.isVisible = true;
        graphics.opacity = 1;
        if (fog.gridX !== undefined && fog.gridY !== undefined) {
          explored.add(tileKey(fog.gridX, fog.gridY));
        }
        continue;
      }

      const key = tileKey(gx, gy);
      if (fog.gridX !== undefined && fog.gridY !== undefined && explored.has(key)) {
        graphics.isVisible = true;
        graphics.opacity = EXPLORED_OPACITY;
      } else {
        graphics.isVisible = false;
      }
    }
  }
}

/**
 * Draws the soft-edged fog overlay in screen space so the visible circle stays
 * centered on the rover. Call from Scene.onPostDraw.
 */
export function drawFogOverlay(
  ctx: ExcaliburGraphicsContext,
  rover: Rover,
  camera: Camera,
  drawWidth: number,
  drawHeight: number,
  widthTiles: number = PLANET_WIDTH_TILES,
  heightTiles: number = PLANET_HEIGHT_TILES
): void {
  const roverPos = rover.pos;
  const camPos = camera.pos;
  const radiusTiles = rover.roverStats.visibilityRadius;
  const radiusPx = radiusTiles * TILE_SIZE;
  const halfW = drawWidth / 2;
  const halfH = drawHeight / 2;

  ctx.save();
  ctx.z = 50;

  for (let gy = 0; gy < heightTiles; gy++) {
    for (let gx = 0; gx < widthTiles; gx++) {
      const worldX = gx * TILE_SIZE + TILE_SIZE / 2;
      const worldY = gy * TILE_SIZE + TILE_SIZE / 2;
      const dx = worldX - roverPos.x;
      const dy = worldY - roverPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const screenX = gx * TILE_SIZE - camPos.x + halfW;
      const screenY = gy * TILE_SIZE - camPos.y + halfH;

      if (dist >= radiusPx + FOG_SOFT_TILES * TILE_SIZE) {
        ctx.drawRectangle(vec(screenX, screenY), TILE_SIZE, TILE_SIZE, FOG_COLOR);
      } else if (dist > radiusPx) {
        const t = (dist - radiusPx) / (FOG_SOFT_TILES * TILE_SIZE);
        const opacity = Math.min(1, t);
        const c = FOG_COLOR.clone();
        c.a = opacity;
        ctx.opacity = opacity;
        ctx.drawRectangle(vec(screenX, screenY), TILE_SIZE, TILE_SIZE, c);
        ctx.opacity = 1;
      }
    }
  }

  ctx.restore();
}

export class FogOverlaySystem extends System {
  static priority = SystemPriority.Lower;
  get systemType(): SystemType {
    return SystemType.Draw;
  }
  query;
  world: World;

  constructor(world: World, _rover: Rover) {
    super();
    this.world = world;
    this.query = this.world.query([FogAffectedComponent]);
  }

  update(_elapsed: number): void {
    // Overlay is drawn by Scene.onPostDraw calling drawFogOverlay(ctx, rover)
  }
}
