import type { Vector } from "excalibur";
import { SPACE_GRAVITY_G } from "../config/solarSystemConfig";

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
      const r = src.pos.clone().sub(recv.pos);
      let dist = r.distance();
      const minDist = Math.max(src.radiusPx, DEFAULT_MIN_DIST);
      if (dist < minDist) dist = minDist;
      const accelMag = (G * src.mass) / (dist * dist);
      const accel = r.normalize().scale(accelMag * dt);
      recv.vel.add(accel, recv.vel);
    }
  }
}
