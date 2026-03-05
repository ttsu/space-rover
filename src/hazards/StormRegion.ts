import { Actor, Color, Engine, vec, Circle, CollisionType } from "excalibur";
import {
  STORM_REGION_RADIUS_PX,
  STORM_MOVE_SPEED,
  WIND_PUSH_STRENGTH,
} from "../config/gameConfig";
import { random } from "../utils/seedRandom";
import { createWindDustEmitter } from "../effects/Particles";

function windStrengthMultiplier(): number {
  return 0.8 + random() * 0.4;
}

export interface StormRegionParams {
  x: number;
  y: number;
  radius?: number;
  windDirectionAngle: number;
  windPushStrength?: number;
  moveSpeed?: number;
  moveDirectionAngle?: number;
}

/**
 * Circular storm region: dark overlay + wind + lightning (strikes scheduled by LightningSystem).
 * Wind is applied when rover is inside (same formula as WindRegion); lightning strikes use getRandomPointInside.
 */
export class StormRegion extends Actor {
  readonly radius: number;
  readonly windDirectionAngle: number;
  readonly windPushStrength: number;
  private velocity = vec(0, 0);

  constructor(params: StormRegionParams) {
    const radius = params.radius ?? STORM_REGION_RADIUS_PX;
    const windPushStrength =
      params.windPushStrength ?? WIND_PUSH_STRENGTH * windStrengthMultiplier();
    super({
      x: params.x,
      y: params.y,
      width: radius * 2,
      height: radius * 2,
      anchor: vec(0.5, 0.5),
    });
    this.radius = radius;
    this.windDirectionAngle = params.windDirectionAngle;
    this.windPushStrength = windPushStrength;
    const moveSpeed = params.moveSpeed ?? STORM_MOVE_SPEED;
    const angle = params.moveDirectionAngle ?? random() * Math.PI * 2;
    this.velocity = vec(
      Math.cos(angle) * moveSpeed,
      Math.sin(angle) * moveSpeed
    );
    this.body.collisionType = CollisionType.PreventCollision;
  }

  onInitialize(): void {
    const overlay = new Circle({
      radius: this.radius,
      color: Color.fromRGB(30, 58, 95, 0.25),
    });
    overlay.origin = vec(this.radius, this.radius);
    this.graphics.use(overlay);

    const emitter = createWindDustEmitter({
      directionAngle: this.windDirectionAngle,
      pushStrength: this.windPushStrength,
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

  getRandomPointInside(): { x: number; y: number } {
    const r = this.radius * Math.sqrt(random());
    const theta = random() * Math.PI * 2;
    return {
      x: this.pos.x + r * Math.cos(theta),
      y: this.pos.y + r * Math.sin(theta),
    };
  }

  getCenter(): { x: number; y: number } {
    return { x: this.pos.x, y: this.pos.y };
  }

  getRadius(): number {
    return this.radius;
  }

  getWindDirection(): { x: number; y: number } {
    return {
      x: Math.cos(this.windDirectionAngle),
      y: Math.sin(this.windDirectionAngle),
    };
  }
}
