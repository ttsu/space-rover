import {
  Color,
  Scene,
  vec,
  ParticleEmitter,
  EmitterType,
  ParticleTransform,
  CollisionType,
} from "excalibur";
import { FogAffectedComponent } from "../world/FogOfWar";

export interface BurstOptions {
  color?: Color;
  count?: number;
  speedMin?: number;
  speedMax?: number;
  lifetimeMs?: number;
  sizeMin?: number;
  sizeMax?: number;
  /** Full angle spread in radians; 2*PI = full circle. */
  spread?: number;
  fade?: boolean;
}

const defaultBurst: Required<BurstOptions> = {
  color: Color.White,
  count: 8,
  speedMin: 30,
  speedMax: 120,
  lifetimeMs: 400,
  sizeMin: 3,
  sizeMax: 8,
  spread: Math.PI * 2,
  fade: true,
};

/**
 * Spawn a one-shot burst of particles (e.g. impact, explosion).
 * Uses Excalibur's ParticleEmitter; the emitter is removed after particles expire.
 */
export function burst(
  scene: Scene,
  x: number,
  y: number,
  options: BurstOptions = {}
): void {
  const opts: Required<BurstOptions> = { ...defaultBurst, ...options };
  const endColor = opts.fade
    ? Color.fromRGB(255, 255, 255, 0)
    : opts.color.clone();

  const emitter = new ParticleEmitter({
    x,
    y,
    pos: vec(x, y),
    radius: 1,
    emitterType: EmitterType.Circle,
    isEmitting: false,
    emitRate: 0,
    particle: {
      transform: ParticleTransform.Global,
      beginColor: opts.color,
      endColor,
      life: opts.lifetimeMs,
      minSpeed: opts.speedMin,
      maxSpeed: opts.speedMax,
      minSize: opts.sizeMin,
      maxSize: opts.sizeMax,
      minAngle: -opts.spread / 2,
      maxAngle: opts.spread / 2,
      fade: opts.fade,
    },
  });
  emitter.body.collisionType = CollisionType.PreventCollision;
  emitter.addComponent(new FogAffectedComponent());
  scene.add(emitter);
  emitter.emitParticles(opts.count);
  emitter.actions.delay(opts.lifetimeMs + 100).callMethod(() => {
    emitter.kill();
  });
}

export interface RisingBurstOptions {
  color?: Color;
  count?: number;
  speedMin?: number;
  speedMax?: number;
  lifetimeMs?: number;
  sizeMin?: number;
  sizeMax?: number;
  /** Upward bias: 0 = full circle, 1 = only upward. */
  upwardBias?: number;
}

/**
 * Spawn particles that rise and drift (e.g. pickup, dust).
 * Uses Excalibur's ParticleEmitter with upward-biased angles.
 */
export function risingBurst(
  scene: Scene,
  x: number,
  y: number,
  options: RisingBurstOptions = {}
): void {
  const count = options.count ?? 10;
  const lifetimeMs = options.lifetimeMs ?? 500;
  const sizeMin = options.sizeMin ?? 2;
  const sizeMax = options.sizeMax ?? 6;
  const speedMin = options.speedMin ?? 20;
  const speedMax = options.speedMax ?? 60;
  const upwardBias = options.upwardBias ?? 0.7;
  const color = options.color ?? Color.White;
  const spread = Math.PI * (1 - upwardBias);
  const upAngle = -Math.PI / 2;

  const emitter = new ParticleEmitter({
    x,
    y,
    pos: vec(x, y),
    radius: 1,
    emitterType: EmitterType.Circle,
    isEmitting: false,
    emitRate: 0,
    particle: {
      transform: ParticleTransform.Global,
      beginColor: color,
      endColor: Color.fromRGB(255, 255, 255, 0),
      life: lifetimeMs,
      minSpeed: speedMin,
      maxSpeed: speedMax,
      minSize: sizeMin,
      maxSize: sizeMax,
      minAngle: upAngle - spread / 2,
      maxAngle: upAngle + spread / 2,
      fade: true,
    },
  });
  emitter.body.collisionType = CollisionType.PreventCollision;
  emitter.addComponent(new FogAffectedComponent());
  scene.add(emitter);
  emitter.emitParticles(count);
  emitter.actions.delay(lifetimeMs + 100).callMethod(() => {
    emitter.kill();
  });
}

/**
 * Create a continuously emitting particle emitter for ambient effects (e.g. lava, wind).
 * Add the returned emitter to the scene or as a child of a hazard actor.
 * Call emitter.kill() when the hazard is removed if it's not a child.
 */
export function createAmbientEmitter(config: {
  color: Color;
  emitRate: number;
  lifetimeMs: number;
  minSpeed: number;
  maxSpeed: number;
  minSize: number;
  maxSize: number;
  /** Velocity angle range in radians; e.g. -PI/2 to -PI/2+0.5 for upward. */
  minAngle: number;
  maxAngle: number;
  /** Optional acceleration (e.g. vec(0, -30) for upward drift). */
  acc?: { x: number; y: number };
  /** Emitter radius (for circle) or width/height (for rectangle). */
  radius?: number;
  width?: number;
  height?: number;
}): ParticleEmitter {
  const useRect = config.width != null && config.height != null;
  const emitter = new ParticleEmitter({
    x: 0,
    y: 0,
    pos: vec(0, 0),
    radius: useRect ? 0 : (config.radius ?? 8),
    width: config.width,
    height: config.height,
    emitterType: useRect ? EmitterType.Rectangle : EmitterType.Circle,
    isEmitting: true,
    emitRate: config.emitRate,
    particle: {
      transform: ParticleTransform.Global,
      beginColor: config.color,
      endColor: Color.fromRGB(255, 255, 255, 0),
      life: config.lifetimeMs,
      minSpeed: config.minSpeed,
      maxSpeed: config.maxSpeed,
      minSize: config.minSize,
      maxSize: config.maxSize,
      minAngle: config.minAngle,
      maxAngle: config.maxAngle,
      acc: config.acc ? vec(config.acc.x, config.acc.y) : undefined,
      fade: true,
    },
  });
  // So the emitter does not steal collisions from the parent (e.g. LavaPool).
  emitter.body.collisionType = CollisionType.PreventCollision;
  emitter.addComponent(new FogAffectedComponent());
  return emitter;
}

/**
 * Dust particles that move in the wind direction, speed proportional to wind strength.
 * Use as child of WindRegion or StormRegion so it moves with the region.
 */
export function createWindDustEmitter(config: {
  directionAngle: number;
  pushStrength: number;
  radius: number;
}): ParticleEmitter {
  const angleSpread = 0.2;
  const speedScale = 0.04;
  const minSpeed = config.pushStrength * speedScale;
  const maxSpeed = config.pushStrength * speedScale * 2.5;
  return createAmbientEmitter({
    color: Color.fromRGB(148, 163, 184, 0.7),
    emitRate: 6,
    lifetimeMs: 500,
    minSpeed: Math.min(120, minSpeed),
    maxSpeed: Math.min(280, maxSpeed),
    minSize: 1.5,
    maxSize: 4,
    minAngle: config.directionAngle - angleSpread,
    maxAngle: config.directionAngle + angleSpread,
    radius: config.radius,
  });
}
