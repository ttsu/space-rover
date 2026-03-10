import {
  MotionComponent,
  System,
  SystemPriority,
  SystemType,
  TransformComponent,
  World,
  type Entity,
  type Vector,
} from "excalibur";
import { SPACE_GRAVITY_G } from "../config/solarSystemConfig";
import {
  GravityReceiverComponent,
  GravitySourceComponent,
} from "../world/components/GravityComponents";

/** A body that attracts others (star, planet, moon). */
export interface GravitySource {
  pos: Vector;
  mass: number;
  radiusPx: number;
}

/** A body whose velocity is affected by gravity (ship, asteroid). */
export interface GravityReceiver {
  pos: Vector;
  vel: Vector;
}

const DEFAULT_MIN_DIST = 10;

/**
 * Applies gravitational acceleration from all sources to all receivers.
 * Mutates each receiver's vel. Call once per frame before receivers apply thrust or integrate position.
 */
export function applyGravity(
  sources: GravitySource[],
  receivers: GravityReceiver[],
  dt: number,
  G: number = SPACE_GRAVITY_G
): void {
  for (const recv of receivers) {
    for (const src of sources) {
      const dx = src.pos.x - recv.pos.x;
      const dy = src.pos.y - recv.pos.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = Math.max(src.radiusPx, DEFAULT_MIN_DIST);
      if (dist < minDist) dist = minDist;
      const accelMag = (G * src.mass) / (dist * dist);
      if (dist > 0) {
        recv.vel.x += (dx / dist) * accelMag * dt;
        recv.vel.y += (dy / dist) * accelMag * dt;
      }
    }
  }
}

export class GravitySystem extends System {
  static priority = SystemPriority.Higher;
  get systemType(): SystemType {
    return SystemType.Update;
  }

  sourceQuery;
  receiverQuery;

  constructor(world: World) {
    super();
    this.sourceQuery = world.query([
      GravitySourceComponent,
      TransformComponent,
    ]);
    this.receiverQuery = world.query([
      GravityReceiverComponent,
      TransformComponent,
      MotionComponent,
    ]);
  }

  update(elapsed: number): void {
    const dt = elapsed / 1000;
    if (dt <= 0) return;

    const sources = this.sourceQuery.entities;
    const receivers = this.receiverQuery.entities;
    for (const receiver of receivers) {
      this.applyGravityToReceiver(receiver, sources, dt);
    }
  }

  private applyGravityToReceiver(
    receiverEntity: Entity,
    sources: Entity[],
    dt: number
  ): void {
    const receiverTransform = receiverEntity.get(TransformComponent);
    const receiverMotion = receiverEntity.get(MotionComponent);
    if (!receiverTransform || !receiverMotion) return;
    const recvPos = receiverTransform.pos;
    const recvVel = receiverMotion.vel;

    for (const sourceEntity of sources) {
      if (sourceEntity === receiverEntity) continue;
      const sourceTransform = sourceEntity.get(TransformComponent);
      const sourceComp = sourceEntity.get(GravitySourceComponent);
      if (!sourceTransform || !sourceComp) continue;

      const dx = sourceTransform.pos.x - recvPos.x;
      const dy = sourceTransform.pos.y - recvPos.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = Math.max(sourceComp.radiusPx, DEFAULT_MIN_DIST);
      if (dist < minDist) dist = minDist;
      if (dist <= 0) continue;

      const accelMag = (SPACE_GRAVITY_G * sourceComp.mass) / (dist * dist);
      recvVel.x += (dx / dist) * accelMag * dt;
      recvVel.y += (dy / dist) * accelMag * dt;
    }
  }
}
