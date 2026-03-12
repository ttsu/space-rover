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

export interface MinimapOptions {
  revealAllResources: boolean;
  showHazards: boolean;
  noFog: boolean;
}

export interface MinimapResourceDot {
  gx: number;
  gy: number;
  resourceId: string;
}

export interface MinimapHazardRegion {
  x: number;
  y: number;
  radius: number;
  kind: "storm" | "wind" | "sandstorm";
}

export interface MinimapHazardTile {
  gx: number;
  gy: number;
  hazard: "lava" | "ice";
}

export interface MinimapContextEvent {
  roverWorldPos: { x: number; y: number };
  baseWorldPos: { x: number; y: number };
  exploredTileKeys: Set<string>;
  visibilityRadiusTiles: number;
  options: MinimapOptions;
  /** Discovered tiles with resources (from loaded chunks or tile query). */
  resourceDots: MinimapResourceDot[];
  /** Storm/wind/sandstorm regions (when showHazards). */
  hazardRegions: MinimapHazardRegion[];
  /** Lava/ice tiles from tile query (when showHazards). */
  hazardTiles: MinimapHazardTile[];
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
