import { Actor, Circle, Color, Engine, vec, type Vector } from "excalibur";
import { GravitySourceComponent } from "../world/components/GravityComponents";

export type SpaceBodyKind = "star" | "planet" | "moon";

export interface SpaceBodyParams {
  x: number;
  y: number;
  mass: number;
  radiusPx: number;
  color: Color;
  kind: SpaceBodyKind;
  /** Optional id (e.g. planet id for landing). */
  bodyId?: string;
  /** For planets: orbit around origin. For moons: orbit around parent. */
  orbitRadius?: number;
  orbitPeriod?: number;
  /** Initial orbit phase in radians. */
  orbitPhase?: number;
  /** For moons: the planet to orbit. */
  orbitParent?: Actor;
}

/**
 * Celestial body: star (fixed), planet (orbits star), or moon (orbits planet).
 * Orbits are circular; phase advances each frame.
 */
export class SpaceBody extends Actor {
  readonly mass: number;
  readonly radiusPx: number;
  readonly kind: SpaceBodyKind;
  readonly bodyId: string | undefined;
  readonly orbitRadius: number;
  readonly orbitPeriod: number;
  private orbitPhase: number;
  private orbitParent: Actor | null = null;

  constructor(params: SpaceBodyParams) {
    super({
      x: params.x,
      y: params.y,
      width: params.radiusPx * 2,
      height: params.radiusPx * 2,
      anchor: vec(0.5, 0.5),
    });
    this.mass = params.mass;
    this.radiusPx = params.radiusPx;
    this.kind = params.kind;
    this.bodyId = params.bodyId;
    this.orbitRadius = params.orbitRadius ?? 0;
    this.orbitPeriod = Math.max(0.001, params.orbitPeriod ?? 1);
    this.orbitPhase = params.orbitPhase ?? 0;
    this.orbitParent = params.orbitParent ?? null;
    this.addComponent(new GravitySourceComponent(this.mass, this.radiusPx));

    const circle = new Circle({
      radius: this.radiusPx,
      color: params.color,
    });
    circle.origin = vec(this.radiusPx, this.radiusPx);
    this.graphics.use(circle);
  }

  onPreUpdate(_engine: Engine, delta: number): void {
    if (this.kind === "star") return;
    const dt = delta / 1000;
    this.orbitPhase += (dt * 2 * Math.PI) / this.orbitPeriod;
    const center = this.getOrbitCenter();
    this.pos.x = center.x + this.orbitRadius * Math.cos(this.orbitPhase);
    this.pos.y = center.y + this.orbitRadius * Math.sin(this.orbitPhase);
  }

  /** Center of orbit (star at 0,0 for planets; parent planet pos for moons). */
  getOrbitCenter(): Vector {
    if (this.orbitParent) return this.orbitParent.pos.clone();
    return vec(0, 0);
  }

  /** Current world position (alias for collision/gravity). */
  get position(): Vector {
    return this.pos;
  }
}
