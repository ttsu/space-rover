import { Actor, Color, CollisionType, Engine, vec } from "excalibur";

export interface IBlasterTarget {
  takeBlasterDamage(amount: number): void;
}

export class BlasterProjectile extends Actor {
  private direction = vec(1, 0);
  private speed = 400;
  private damage = 1;
  private maxDistance = 150;
  private traveled = 0;

  constructor(
    x: number,
    y: number,
    angleRad: number,
    damage: number,
    speed: number,
    maxDistance: number
  ) {
    super({
      x,
      y,
      width: 8,
      height: 4,
      color: Color.fromHex("#60a5fa"),
    });
    this.body.collisionType = CollisionType.Active;
    this.direction = vec(Math.cos(angleRad), Math.sin(angleRad));
    this.rotation = angleRad;
    this.damage = damage;
    this.speed = speed;
    this.maxDistance = maxDistance;
  }

  onInitialize(_engine: Engine): void {
    this.on("collisionstart", (evt) => {
      const other = evt.other.owner;
      const target = other as unknown as IBlasterTarget;
      if (typeof target?.takeBlasterDamage === "function") {
        target.takeBlasterDamage(this.damage);
        this.kill();
      }
    });
  }

  onPreUpdate(_e: Engine, delta: number): void {
    const move = this.direction.scale((this.speed * delta) / 1000);
    this.pos = this.pos.add(move);
    this.traveled += move.size;
    if (this.traveled >= this.maxDistance) {
      this.kill();
    }
  }
}
