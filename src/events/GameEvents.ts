import type { Scene } from "excalibur";
import type { CargoCounts } from "../entities/Rover";
import type { HazardKind } from "../state/GameState";
import type { EdgeIndicator } from "../utils/edgeIndicator";

export interface RoverDamageEvent {
  amount: number;
}

export interface RoverFireBlasterEvent {
  x: number;
  y: number;
  angle: number;
  damage: number;
  speed: number;
  range: number;
}

export interface RoverStateChangedEvent {
  health: number;
  maxHealth: number;
  battery: number;
  maxBattery: number;
  usedCapacity: number;
  maxCapacity: number;
  cargo: CargoCounts;
}

export interface HudContextEvent {
  biomeName: string;
  isNearBase: boolean;
  baseIndicator: EdgeIndicator | null;
  hazardHits: Record<HazardKind, number>;
}

export interface ProjectileSpawnRequestedEvent extends RoverFireBlasterEvent {
  seeking: boolean;
}

export interface RunEndedEvent {
  reason: "return" | "death";
}

export function emitSceneEvent<T>(
  scene: Scene,
  eventName: string,
  payload: T
): void {
  scene.events.emit(eventName, payload);
}

export function onSceneEvent<T>(
  scene: Scene,
  eventName: string,
  handler: (payload: T) => void
): void {
  scene.events.on(eventName, (evt) => handler(evt as T));
}
