import { Actor, Color, CollisionType, Engine, vec } from "excalibur";

export interface IBlasterTarget {
  takeBlasterDamage(amount: number): void;
}

/** Max radians per second to turn toward target when seeking. */
const SEEK_TURN_RATE = 4;

export class BlasterProjectile extends Actor {
  private direction = vec(1, 0);
  private speed = 400;
  private damage = 1;
  private maxDistance = 150;
  private traveled = 0;
  private target?: Actor;

  constructor(
    x: number,
    y: number,
    angleRad: number,
    damage: number,
    speed: number,
    maxDistance: number,
    target?: Actor
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
    this.target = target;
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
    if (this.target && !this.target.isKilled()) {
      const toTarget = this.target.pos.sub(this.pos);
      const dist = toTarget.size;
      if (dist > 1) {
        const desiredDir = toTarget.scale(1 / dist);
        const angleDiff = Math.atan2(
          desiredDir.y * this.direction.x - desiredDir.x * this.direction.y,
          desiredDir.x * this.direction.x + desiredDir.y * this.direction.y
        );
        const maxTurn = (SEEK_TURN_RATE * delta) / 1000;
        const turn =
          Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        this.direction = vec(
          this.direction.x * cos - this.direction.y * sin,
          this.direction.x * sin + this.direction.y * cos
        ).normalize();
        this.rotation = Math.atan2(this.direction.y, this.direction.x);
      }
    }

    const move = this.direction.scale((this.speed * delta) / 1000);
    this.pos = this.pos.add(move);
    this.traveled += move.size;
    if (this.traveled >= this.maxDistance) {
      this.kill();
    }
  }
}
