import {
  Canvas,
  Component,
  System,
  SystemType,
  World,
  type Scene,
  TransformComponent,
  GraphicsComponent,
  SystemPriority,
  ParticleEmitter,
} from "excalibur";
import { TILE_SIZE } from "../config/gameConfig";
import { GameState } from "../state/GameState";
import {
  FogViewerComponent,
  PlayerTagComponent,
} from "./components/PlayerComponents";

const EXPLORED_OPACITY = 0.4;
const FOG_SOFT_TILES = 2.5;
const FOG_COLOR_CSS = "rgba(10, 10, 15, 1)";

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

export interface FogOverlayState {
  viewerPos: { x: number; y: number } | null;
  visibilityRadiusTiles: number;
  cameraPos: { x: number; y: number };
  drawWidth: number;
  drawHeight: number;
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
 * Canvas-backed full-screen fog overlay with an inverted visibility circle.
 * Screen-space rendering avoids the old per-tile rectangle loop.
 */
export class FogOverlayGraphic extends Canvas {
  private state: FogOverlayState = {
    viewerPos: null,
    visibilityRadiusTiles: 0,
    cameraPos: { x: 0, y: 0 },
    drawWidth: 1,
    drawHeight: 1,
  };

  constructor() {
    super({
      width: 1,
      height: 1,
      cache: false,
      draw: (ctx) => this.drawOverlay(ctx),
    });
  }

  updateState(state: FogOverlayState): void {
    this.state = state;
    if (this.width !== state.drawWidth) {
      this.width = Math.max(1, state.drawWidth);
    }
    if (this.height !== state.drawHeight) {
      this.height = Math.max(1, state.drawHeight);
    }
    this.flagDirty();
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    const width = Math.max(1, this.state.drawWidth);
    const height = Math.max(1, this.state.drawHeight);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = FOG_COLOR_CSS;
    ctx.fillRect(0, 0, width, height);

    const { viewerPos, visibilityRadiusTiles, cameraPos } = this.state;
    if (!viewerPos || visibilityRadiusTiles <= 0) {
      return;
    }

    const roverScreenX = viewerPos.x - cameraPos.x + width / 2;
    const roverScreenY = viewerPos.y - cameraPos.y + height / 2;
    const radiusPx = (visibilityRadiusTiles - 3) * TILE_SIZE;
    const outerRadius = radiusPx + FOG_SOFT_TILES * TILE_SIZE;
    const gradient = ctx.createRadialGradient(
      roverScreenX,
      roverScreenY,
      radiusPx,
      roverScreenX,
      roverScreenY,
      outerRadius
    );

    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(roverScreenX, roverScreenY, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }
}
