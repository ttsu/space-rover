import { vec, type Vector } from "excalibur";
import type { WindRegion } from "./WindRegion";
import type { StormRegion } from "./StormRegion";
import type { SandstormRegion } from "./SandstormRegion";
import { WIND_MAX_ACCEL_PER_FRAME } from "../config/gameConfig";

/**
 * Compute wind velocity delta for this frame (to be added to rover.vel).
 * Called by the scene; the rover must add the returned vector to its velocity
 * after it has set velocity from input (so wind is not overwritten).
 */
export function getWindVelocityDelta(
  x: number,
  y: number,
  windResist: number,
  windRegions: WindRegion[],
  stormRegions: StormRegion[],
  sandstormRegions: SandstormRegion[],
  deltaMs: number
): Vector {
  const rx = x;
  const ry = y;
  const factor = (1 - windResist) * (deltaMs / 1000);
  let ax = 0;
  let ay = 0;

  for (const region of windRegions) {
    if (region.isKilled()) continue;
    if (!region.containsWorldPoint(rx, ry)) continue;
    const dir = region.getWindDirection();
    const push = region.pushStrength * factor;
    ax += dir.x * push;
    ay += dir.y * push;
  }

  for (const storm of stormRegions) {
    if (storm.isKilled()) continue;
    if (!storm.containsWorldPoint(rx, ry)) continue;
    const dir = storm.getWindDirection();
    const push = storm.windPushStrength * factor;
    ax += dir.x * push;
    ay += dir.y * push;
  }

  for (const sandstorm of sandstormRegions) {
    if (sandstorm.isKilled()) continue;
    if (!sandstorm.containsWorldPoint(rx, ry)) continue;
    const dir = sandstorm.getWindDirection();
    const push = sandstorm.pushStrength * factor;
    ax += dir.x * push;
    ay += dir.y * push;
  }

  const magnitude = Math.sqrt(ax * ax + ay * ay);
  if (magnitude <= 0) return vec(0, 0);
  const cap = WIND_MAX_ACCEL_PER_FRAME * (deltaMs / 1000);
  if (magnitude > cap) {
    const scale = cap / magnitude;
    ax *= scale;
    ay *= scale;
  }
  return vec(ax, ay);
}
