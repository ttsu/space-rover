import { Actor, Color, Engine, vec, Circle, CollisionType } from "excalibur";
import {
  WIND_REGION_RADIUS_PX,
  WIND_MOVE_SPEED,
  WIND_PUSH_STRENGTH,
} from "../config/gameConfig";
import { random } from "../utils/seedRandom";
import { createWindDustEmitter } from "../effects/Particles";
import type { IHazardTarget } from "../entities/contracts";

/** Wind strength variance per region (0.8–1.2). */
function windStrengthMultiplier(): number {
  return 0.8 + random() * 0.4;
}

export interface WindRegionParams {
  x: number;
  y: number;
  radius?: number;
  directionAngle: number;
  pushStrength?: number;
  moveSpeed?: number;
  moveDirectionAngle?: number;
  hazardTarget?: IHazardTarget;
}

/**
 * Circular wind-only region. Pushes rover when inside (handled by WindSystem).
 * Subtle tint + dust particles; no lightning.
 */
export class WindRegion extends Actor {
  readonly radius: number;
  readonly directionAngle: number;
  readonly pushStrength: number;
  private velocity = vec(0, 0);

  constructor(params: WindRegionParams) {
    const radius = params.radius ?? WIND_REGION_RADIUS_PX;
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
    const moveSpeed = params.moveSpeed ?? WIND_MOVE_SPEED;
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
      color: Color.fromRGB(148, 163, 184, 0.08),
    });
    tint.origin = vec(this.radius, this.radius);
    this.graphics.use(tint);

    const emitter = createWindDustEmitter({
      directionAngle: this.directionAngle,
      pushStrength: this.pushStrength,
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
