import { Actor, Circle, CollisionType, Color, Engine, vec } from "excalibur";
import {
  SANDSTORM_MOVE_SPEED,
  SANDSTORM_REGION_RADIUS_PX,
  SANDSTORM_VISIBILITY_MULTIPLIER,
  WIND_PUSH_STRENGTH,
} from "../config/gameConfig";
import { createAmbientEmitter } from "../effects/Particles";
import { random } from "../utils/seedRandom";
import type { IHazardTarget } from "../entities/Rover";

function windStrengthMultiplier(): number {
  return 0.85 + random() * 0.45;
}

export interface SandstormRegionParams {
  x: number;
  y: number;
  radius?: number;
  directionAngle: number;
  pushStrength?: number;
  moveSpeed?: number;
  moveDirectionAngle?: number;
  visibilityMultiplier?: number;
  hazardTarget?: IHazardTarget;
}

export class SandstormRegion extends Actor {
  readonly radius: number;
  readonly directionAngle: number;
  readonly pushStrength: number;
  readonly visibilityMultiplier: number;
  private velocity = vec(0, 0);

  constructor(params: SandstormRegionParams) {
    const radius = params.radius ?? SANDSTORM_REGION_RADIUS_PX;
    const pushStrength =
      params.pushStrength ?? WIND_PUSH_STRENGTH * windStrengthMultiplier();
    super({
      x: params.x,
      y: params.y,
      width: radius * 2,
      height: radius * 2,
      anchor: vec(0.5, 0.5),
    });
    this.radius = radius;
    this.directionAngle = params.directionAngle;
    this.pushStrength = pushStrength;
    this.visibilityMultiplier =
      params.visibilityMultiplier ?? SANDSTORM_VISIBILITY_MULTIPLIER;
    const moveSpeed = params.moveSpeed ?? SANDSTORM_MOVE_SPEED;
    const angle = params.moveDirectionAngle ?? random() * Math.PI * 2;
    this.velocity = vec(
      Math.cos(angle) * moveSpeed,
      Math.sin(angle) * moveSpeed
    );
    this.body.collisionType = CollisionType.PreventCollision;
  }

  onInitialize(): void {
    const tint = new Circle({
      radius: this.radius,
      color: Color.fromRGB(180, 120, 45, 0.18),
    });
    tint.origin = vec(this.radius, this.radius);
    this.graphics.use(tint);

    const emitter = createAmbientEmitter({
      color: Color.fromRGB(210, 170, 110, 0.75),
      emitRate: 8,
      lifetimeMs: 450,
      minSpeed: Math.min(140, this.pushStrength * 0.05),
      maxSpeed: Math.min(320, this.pushStrength * 0.1),
      minSize: 1.5,
      maxSize: 4.5,
      minAngle: this.directionAngle - 0.28,
      maxAngle: this.directionAngle + 0.28,
      radius: this.radius,
    });
    emitter.pos = vec(0, 0);
    this.addChild(emitter);
  }

  onPreUpdate(_engine: Engine, delta: number): void {
    this.pos = this.pos.add(this.velocity.scale(delta / 1000));
  }

  containsWorldPoint(wx: number, wy: number): boolean {
    const dx = wx - this.pos.x;
    const dy = wy - this.pos.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  getWindDirection(): { x: number; y: number } {
    return {
      x: Math.cos(this.directionAngle),
      y: Math.sin(this.directionAngle),
    };
  }
}
