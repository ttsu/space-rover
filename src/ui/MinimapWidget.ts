import {
  Color,
  Graphic,
  ScreenElement,
  vec,
  type ExcaliburGraphicsContext,
} from "excalibur";
import { TILE_SIZE } from "../config/gameConfig";
import { onSceneEvent, type MinimapContextEvent } from "../events/GameEvents";
import { getResourceById, type ResourceId } from "../resources/ResourceTypes";
import { tileKey } from "../world/WorldState";

const MINIMAP_SIZE = 256;
const MINIMAP_PX_PER_TILE = 2;
const VIEW_TILES_HALF = MINIMAP_SIZE / MINIMAP_PX_PER_TILE / 2;

const BG_COLOR = Color.fromHex("#0f172a");
const FOG_COLOR = Color.fromHex("#020617");
const DISCOVERED_DIM = Color.fromHex("#1e293b");
const BASE_COLOR = Color.fromHex("#22c55e");
const ROVER_COLOR = Color.fromHex("#3b82f6");
const VISIBILITY_RING_COLOR = Color.fromHex("#3b82f680");
const HAZARD_REGION_COLORS: Record<string, Color> = {
  storm: Color.fromHex("#7c3aed"),
  wind: Color.fromHex("#0ea5e9"),
  sandstorm: Color.fromHex("#d97706"),
};
const HAZARD_TILE_COLORS: Record<string, Color> = {
  lava: Color.fromHex("#b91c1c"),
  ice: Color.fromHex("#7dd3fc"),
};

function getContext(): MinimapContextEvent | null {
  return (MinimapGraphic as { _context: MinimapContextEvent | null })._context;
}

function setContext(ctx: MinimapContextEvent | null): void {
  (MinimapGraphic as { _context: MinimapContextEvent | null })._context = ctx;
}

/**
 * Custom Graphic that draws the minimap. Context is set by MinimapWidget each frame via event.
 */
class MinimapGraphic extends Graphic {
  static _context: MinimapContextEvent | null = null;

  constructor() {
    super({ width: MINIMAP_SIZE, height: MINIMAP_SIZE });
  }

  protected _drawImage(
    ex: ExcaliburGraphicsContext,
    x: number,
    y: number
  ): void {
    const ctx = getContext();
    if (!ctx) return;

    const roverGx = Math.floor(ctx.roverWorldPos.x / TILE_SIZE);
    const roverGy = Math.floor(ctx.roverWorldPos.y / TILE_SIZE);
    const baseGx = Math.floor(ctx.baseWorldPos.x / TILE_SIZE);
    const baseGy = Math.floor(ctx.baseWorldPos.y / TILE_SIZE);
    const explored = ctx.exploredTileKeys;
    const noFog = ctx.options.noFog;

    // 1. Background
    ex.drawRectangle(vec(x, y), MINIMAP_SIZE, MINIMAP_SIZE, BG_COLOR);

    // 2. Per-tile fog/terrain
    const minGx = Math.floor(roverGx - VIEW_TILES_HALF);
    const maxGx = Math.ceil(roverGx + VIEW_TILES_HALF);
    const minGy = Math.floor(roverGy - VIEW_TILES_HALF);
    const maxGy = Math.ceil(roverGy + VIEW_TILES_HALF);

    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const mx = (gx - roverGx) * MINIMAP_PX_PER_TILE + MINIMAP_SIZE / 2;
        const my = (gy - roverGy) * MINIMAP_PX_PER_TILE + MINIMAP_SIZE / 2;
        if (mx < -MINIMAP_PX_PER_TILE || my < -MINIMAP_PX_PER_TILE) continue;
        if (mx >= MINIMAP_SIZE || my >= MINIMAP_SIZE) continue;

        const key = tileKey(gx, gy);
        const discovered = noFog || explored.has(key);
        const color = discovered ? DISCOVERED_DIM : FOG_COLOR;
        ex.drawRectangle(
          vec(x + mx, y + my),
          MINIMAP_PX_PER_TILE,
          MINIMAP_PX_PER_TILE,
          color
        );
      }
    }

    // 3. Resource dots (discovered only; list is pre-filtered by scene) — full tile in resource color
    for (const dot of ctx.resourceDots) {
      const mx = (dot.gx - roverGx) * MINIMAP_PX_PER_TILE + MINIMAP_SIZE / 2;
      const my = (dot.gy - roverGy) * MINIMAP_PX_PER_TILE + MINIMAP_SIZE / 2;
      if (mx >= 0 && mx < MINIMAP_SIZE && my >= 0 && my < MINIMAP_SIZE) {
        const color =
          dot.resourceId === "iron" ||
          dot.resourceId === "crystal" ||
          dot.resourceId === "gas"
            ? getResourceById(dot.resourceId as ResourceId).color
            : DISCOVERED_DIM;
        ex.drawRectangle(
          vec(x + mx, y + my),
          MINIMAP_PX_PER_TILE,
          MINIMAP_PX_PER_TILE,
          color
        );
      }
    }

    // 4. Hazard regions (storm/wind/sandstorm circles) and hazard tiles (lava/ice)
    if (ctx.options.showHazards) {
      for (const region of ctx.hazardRegions) {
        const mx =
          ((region.x - ctx.roverWorldPos.x) / TILE_SIZE) * MINIMAP_PX_PER_TILE;
        const my =
          ((region.y - ctx.roverWorldPos.y) / TILE_SIZE) * MINIMAP_PX_PER_TILE;
        const radiusMinimap = (region.radius / TILE_SIZE) * MINIMAP_PX_PER_TILE;
        const cx = x + MINIMAP_SIZE / 2 + mx;
        const cy = y + MINIMAP_SIZE / 2 + my;
        if (
          cx + radiusMinimap >= x &&
          cx - radiusMinimap < x + MINIMAP_SIZE &&
          cy + radiusMinimap >= y &&
          cy - radiusMinimap < y + MINIMAP_SIZE
        ) {
          const color = HAZARD_REGION_COLORS[region.kind] ?? DISCOVERED_DIM;
          ex.drawCircle(vec(cx, cy), Math.max(0.5, radiusMinimap), color);
        }
      }
      for (const ht of ctx.hazardTiles) {
        const mx = (ht.gx - roverGx) * MINIMAP_PX_PER_TILE + MINIMAP_SIZE / 2;
        const my = (ht.gy - roverGy) * MINIMAP_PX_PER_TILE + MINIMAP_SIZE / 2;
        if (mx >= 0 && mx < MINIMAP_SIZE && my >= 0 && my < MINIMAP_SIZE) {
          const color = HAZARD_TILE_COLORS[ht.hazard] ?? DISCOVERED_DIM;
          ex.drawRectangle(
            vec(x + mx, y + my),
            MINIMAP_PX_PER_TILE,
            MINIMAP_PX_PER_TILE,
            color
          );
        }
      }
    }

    // 5. Base icon
    const baseMx = (baseGx - roverGx) * MINIMAP_PX_PER_TILE + MINIMAP_SIZE / 2;
    const baseMy = (baseGy - roverGy) * MINIMAP_PX_PER_TILE + MINIMAP_SIZE / 2;
    if (
      baseMx >= 0 &&
      baseMx < MINIMAP_SIZE &&
      baseMy >= 0 &&
      baseMy < MINIMAP_SIZE
    ) {
      ex.drawRectangle(
        vec(x + baseMx, y + baseMy),
        MINIMAP_PX_PER_TILE,
        MINIMAP_PX_PER_TILE,
        BASE_COLOR
      );
    }

    // 6. Visibility radius ring (faint circle)
    const ringRadiusPx = ctx.visibilityRadiusTiles * MINIMAP_PX_PER_TILE;
    if (ringRadiusPx > 0 && ringRadiusPx < MINIMAP_SIZE / 2) {
      ex.drawCircle(
        vec(x + MINIMAP_SIZE / 2, y + MINIMAP_SIZE / 2),
        ringRadiusPx,
        VISIBILITY_RING_COLOR
      );
    }

    // 7. Rover at center
    const roverPx = MINIMAP_SIZE / 2 - MINIMAP_PX_PER_TILE / 2;
    ex.drawRectangle(
      vec(x + roverPx, y + roverPx),
      MINIMAP_PX_PER_TILE,
      MINIMAP_PX_PER_TILE,
      ROVER_COLOR
    );
  }

  clone(): Graphic {
    return new MinimapGraphic();
  }
}

export const MINIMAP_WIDGET_SIZE = MINIMAP_SIZE;
export const MINIMAP_MARGIN = 16;

/**
 * ScreenElement that shows the planet minimap. Subscribes to "minimap:context" and draws via MinimapGraphic.
 */
export class MinimapWidget extends ScreenElement {
  private graphic: MinimapGraphic;

  constructor(engineRef: { drawWidth: number; drawHeight: number }) {
    const margin = MINIMAP_MARGIN;
    const x = engineRef.drawWidth - MINIMAP_SIZE - margin;
    const y = engineRef.drawHeight - MINIMAP_SIZE - margin;
    super({ x, y });
    this.graphic = new MinimapGraphic();
  }

  onInitialize(): void {
    this.graphics.use(this.graphic);
    if (this.scene) {
      onSceneEvent<MinimapContextEvent>(
        this.scene,
        "minimap:context",
        (payload) => {
          setContext(payload);
        }
      );
    }
  }
}
