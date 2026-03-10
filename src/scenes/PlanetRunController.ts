import { type Vector } from "excalibur";
import { biomeLabel, type BiomeId } from "../config/biomeConfig";
import {
  ICE_ACCELERATION_SCALE,
  ICE_TRACTION_SCALE,
} from "../config/gameConfig";
import { recordHazardHit } from "../state/GameState";
import type { ChunkManager } from "../world/ChunkManager";
import type { SandstormRegion } from "../hazards/SandstormRegion";
import { getEdgeIndicator } from "../utils/edgeIndicator";
import type { EdgeIndicator } from "../utils/edgeIndicator";

export interface PlanetRunSnapshot {
  biomeName: string;
  isNearBase: boolean;
  baseIndicator: EdgeIndicator | null;
  accelerationScale: number;
  tractionScale: number;
  visibilityMultiplier: number;
}

export interface PlanetRunControllerParams {
  basePos: Vector;
  sandstormRegions: SandstormRegion[];
  chunkManager: ChunkManager | null;
}

export class PlanetRunController {
  private quakeTimer = 0;
  private basePos: Vector;
  private sandstormRegions: SandstormRegion[];
  private chunkManager: ChunkManager | null;

  constructor(params: PlanetRunControllerParams) {
    this.basePos = params.basePos;
    this.sandstormRegions = params.sandstormRegions;
    this.chunkManager = params.chunkManager;
  }

  reset(params: PlanetRunControllerParams): void {
    this.basePos = params.basePos;
    this.sandstormRegions = params.sandstormRegions;
    this.chunkManager = params.chunkManager;
    this.quakeTimer = 0;
  }

  update(playerPos: Vector, delta: number): boolean {
    this.chunkManager?.update(playerPos.x, playerPos.y);
    this.quakeTimer += delta;
    if (this.quakeTimer > 15000) {
      this.quakeTimer = 0;
      recordHazardHit("quake");
      return true;
    }
    return false;
  }

  getSnapshot(
    playerPos: Vector,
    cameraPos: Vector,
    drawWidth: number,
    drawHeight: number
  ): PlanetRunSnapshot {
    const distanceToBase = playerPos.distance(this.basePos);
    const closeToBase = distanceToBase < 80;
    const biomeId = this.chunkManager
      ? this.chunkManager.getBiomeAtWorldPos(playerPos.x, playerPos.y)
      : ("barren" as BiomeId);
    const onIcePatch = this.chunkManager
      ? this.chunkManager.isIceHazardAtWorldPos(playerPos.x, playerPos.y)
      : false;
    let sandstormVisibilityMultiplier = 1;
    for (const sandstorm of this.sandstormRegions) {
      if (sandstorm.isKilled()) continue;
      if (!sandstorm.containsWorldPoint(playerPos.x, playerPos.y)) continue;
      sandstormVisibilityMultiplier = Math.min(
        sandstormVisibilityMultiplier,
        sandstorm.visibilityMultiplier
      );
    }
    return {
      biomeName: biomeLabel(biomeId),
      isNearBase: closeToBase,
      baseIndicator: getEdgeIndicator(
        this.basePos.x,
        this.basePos.y,
        cameraPos,
        drawWidth,
        drawHeight
      ),
      accelerationScale: onIcePatch ? ICE_ACCELERATION_SCALE : 1,
      tractionScale: onIcePatch ? ICE_TRACTION_SCALE : 1,
      visibilityMultiplier: sandstormVisibilityMultiplier,
    };
  }
}
