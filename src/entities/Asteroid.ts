import { Actor, Circle, Color, Engine, vec } from "excalibur";

export interface AsteroidParams {
  x: number;
  y: number;
  radius: number;
  vx?: number;
  vy?: number;
  /** Optional mass for gravity (usually 0 for asteroids). */
  mass?: number;
}

/**
 * Asteroid: moves under gravity (via GravitySystem), damages ship on collision.
 * Integrates position from velocity each frame.
 */
export class Asteroid extends Actor {
  readonly radius: number;

  constructor(params: AsteroidParams) {
    const r = params.radius;
    super({
      x: params.x,
      y: params.y,
      width: r * 2,
      height: r * 2,
      anchor: vec(0.5, 0.5),
    });
    this.radius = r;
    this.vel = vec(params.vx ?? 0, params.vy ?? 0);

    const circle = new Circle({
      radius: r,
      color: Color.fromHex("#78716c"),
    });
    circle.origin = vec(r, r);
    this.graphics.use(circle);
  }

  onPreUpdate(_engine: Engine, delta: number): void {
    const dt = delta / 1000;
    // Gravity is applied by GravitySystem in SpaceNavScene before this runs.
    this.pos = this.pos.add(this.vel.scale(dt));
  }
}
