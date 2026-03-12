import {
  Component,
  System,
  SystemType,
  World,
  type Scene,
  TransformComponent,
  GraphicsComponent,
  Color,
  SystemPriority,
  vec,
  ParticleEmitter,
} from "excalibur";
import { TILE_SIZE } from "../config/gameConfig";
import { GameState } from "../state/GameState";
import type { ExcaliburGraphicsContext } from "excalibur";
import type { Camera } from "excalibur";
import {
  FogViewerComponent,
  PlayerTagComponent,
} from "./components/PlayerComponents";

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

export interface FogViewerData {
  pos: { x: number; y: number };
  visibilityRadiusTiles: number;
}

export function getPrimaryFogViewerData(world: World): FogViewerData | null {
  const query = world.query([
    PlayerTagComponent,
    FogViewerComponent,
    TransformComponent,
  ]);
  const entity = query.entities[0];
  if (!entity) return null;
  const transform = entity.get(TransformComponent);
  const fog = entity.get(FogViewerComponent);
  if (!transform || !fog) return null;
  return {
    pos: transform.pos,
    visibilityRadiusTiles: fog.baseRadiusTiles * fog.multiplier,
  };
}

export class FogVisibilitySystem extends System {
  static priority = SystemPriority.Lower;
  get systemType(): SystemType {
    return SystemType.Update;
  }
  query;
  private viewerQuery;
  private scene: Scene;
  world: World;

  constructor(world: World, scene: Scene) {
    super();
    this.world = world;
    this.scene = scene;
    this.query = this.world.query([
      FogAffectedComponent,
      TransformComponent,
      GraphicsComponent,
    ]);
    this.viewerQuery = this.world.query([
      PlayerTagComponent,
      FogViewerComponent,
      TransformComponent,
    ]);
  }

  update(_elapsed: number): void {
    const viewerEntity = this.viewerQuery.entities[0];
    if (!viewerEntity) return;
    const viewerTransform = viewerEntity.get(TransformComponent);
    const viewerFog = viewerEntity.get(FogViewerComponent);
    if (!viewerTransform || !viewerFog) return;
    const roverPos = viewerTransform.pos;
    const roverGx = Math.floor(roverPos.x / TILE_SIZE);
    const roverGy = Math.floor(roverPos.y / TILE_SIZE);
    const radius = viewerFog.baseRadiusTiles * viewerFog.multiplier;
    const radiusSq = radius * radius;
    const explored = GameState.exploredTileKeys;
    const cam = this.scene.camera;
    const screen = this.scene.engine.screen;
    const halfW = screen ? screen.resolution.width / 2 : 0;
    const halfH = screen ? screen.resolution.height / 2 : 0;
    const minGx = cam
      ? Math.floor((cam.pos.x - halfW) / TILE_SIZE) - 2
      : -Infinity;
    const maxGx = cam
      ? Math.ceil((cam.pos.x + halfW) / TILE_SIZE) + 2
      : Infinity;
    const minGy = cam
      ? Math.floor((cam.pos.y - halfH) / TILE_SIZE) - 2
      : -Infinity;
    const maxGy = cam
      ? Math.ceil((cam.pos.y + halfH) / TILE_SIZE) + 2
      : Infinity;

    for (const entity of this.query.entities) {
      const fog = entity.get(FogAffectedComponent);
      const transform = entity.get(TransformComponent);
      const graphics = entity.get(GraphicsComponent);
      if (!fog || !transform || !graphics) continue;

      if (fog.alwaysVisible) {
        graphics.isVisible = true;
        graphics.opacity = 1;
        applyFogToParticleEmitter(entity as ParticleEmitter, false);
        continue;
      }

      // Use world position for entities without grid coords (e.g. child emitters, hazards)
      const pos =
        fog.gridX !== undefined && fog.gridY !== undefined
          ? transform.pos
          : transform.globalPos;
      const { gx, gy } = entityTilePosition(fog, pos);
      const inViewport =
        gx >= minGx && gx <= maxGx && gy >= minGy && gy <= maxGy;
      if (!inViewport) {
        const key = tileKey(gx, gy);
        if (
          fog.gridX !== undefined &&
          fog.gridY !== undefined &&
          explored.has(key)
        ) {
          graphics.isVisible = true;
          graphics.opacity = EXPLORED_OPACITY;
          applyFogToParticleEmitter(entity as ParticleEmitter, true);
        } else {
          graphics.isVisible = false;
          applyFogToParticleEmitter(entity as ParticleEmitter, true);
        }
        continue;
      }
      const dx = gx - roverGx;
      const dy = gy - roverGy;
      const distTilesSq = dx * dx + dy * dy;

      if (distTilesSq <= radiusSq) {
        graphics.isVisible = true;
        graphics.opacity = 1;
        // Mark tile as explored when in view (use computed gx,gy so resources/lava without grid coords still count)
        explored.add(tileKey(gx, gy));
        applyFogToParticleEmitter(entity as ParticleEmitter, false);
        continue;
      }

      const key = tileKey(gx, gy);
      if (
        fog.gridX !== undefined &&
        fog.gridY !== undefined &&
        explored.has(key)
      ) {
        graphics.isVisible = true;
        graphics.opacity = EXPLORED_OPACITY;
        applyFogToParticleEmitter(entity as ParticleEmitter, true);
      } else {
        graphics.isVisible = false;
        applyFogToParticleEmitter(entity as ParticleEmitter, true);
      }
    }
  }
}

const FOG_RESTORE_EMITTING = "_fogRestoreEmitting" as const;
const FOG_STATE_KEY = "_fogInFogState" as const;

function isParticleEmitter(e: unknown): e is ParticleEmitter {
  return (
    e != null &&
    typeof (e as ParticleEmitter).clearParticles === "function" &&
    typeof (e as ParticleEmitter).emitParticles === "function"
  );
}

/**
 * When an emitter is in fog: stop emitting and clear existing particles (no per-particle work).
 * When it becomes visible again: restore isEmitting so ambient emitters resume.
 */
function applyFogToParticleEmitter(
  emitter: ParticleEmitter,
  inFog: boolean
): void {
  if (!isParticleEmitter(emitter)) return;
  const bag = emitter as unknown as Record<string, boolean | undefined>;
  const prevState = bag[FOG_STATE_KEY];
  if (prevState === inFog) return;
  bag[FOG_STATE_KEY] = inFog;

  if (inFog) {
    if (bag[FOG_RESTORE_EMITTING] === undefined) {
      bag[FOG_RESTORE_EMITTING] = emitter.isEmitting;
    }
    emitter.clearParticles();
    emitter.isEmitting = false;
  } else {
    const rest = bag[FOG_RESTORE_EMITTING];
    if (rest !== undefined) {
      emitter.isEmitting = rest;
      delete bag[FOG_RESTORE_EMITTING];
    }
  }
}

/**
 * Draws the soft-edged fog overlay in screen space so the visible circle stays
 * centered on the rover. Call from Scene.onPostDraw.
 */
export function drawFogOverlay(
  ctx: ExcaliburGraphicsContext,
  viewerPos: { x: number; y: number },
  visibilityRadiusTiles: number,
  camera: Camera,
  drawWidth: number,
  drawHeight: number
): void {
  const roverPos = viewerPos;
  const camPos = camera.pos;
  const radiusTiles = visibilityRadiusTiles;
  const radiusPx = radiusTiles * TILE_SIZE;
  const halfW = drawWidth / 2;
  const halfH = drawHeight / 2;

  ctx.save();
  ctx.z = 50;

  const minGx = Math.floor((camPos.x - halfW) / TILE_SIZE) - 1;
  const maxGx = Math.ceil((camPos.x + halfW) / TILE_SIZE) + 1;
  const minGy = Math.floor((camPos.y - halfH) / TILE_SIZE) - 1;
  const maxGy = Math.ceil((camPos.y + halfH) / TILE_SIZE) + 1;

  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const worldX = gx * TILE_SIZE + TILE_SIZE / 2;
      const worldY = gy * TILE_SIZE + TILE_SIZE / 2;
      const dx = worldX - roverPos.x;
      const dy = worldY - roverPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const screenX = gx * TILE_SIZE - camPos.x + halfW;
      const screenY = gy * TILE_SIZE - camPos.y + halfH;

      if (dist >= radiusPx + FOG_SOFT_TILES * TILE_SIZE) {
        ctx.drawRectangle(
          vec(screenX, screenY),
          TILE_SIZE,
          TILE_SIZE,
          FOG_COLOR
        );
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
