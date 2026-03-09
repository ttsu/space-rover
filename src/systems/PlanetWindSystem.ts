import { System, SystemPriority, SystemType } from "excalibur";
import type { Rover } from "../entities/Rover";
import type { WindRegion } from "../hazards/WindRegion";
import type { StormRegion } from "../hazards/StormRegion";
import type { SandstormRegion } from "../hazards/SandstormRegion";
import { getWindVelocityDelta } from "../hazards/WindSystem";
import { recordHazardHit } from "../state/GameState";

export interface PlanetWindSystemParams {
  rover: Rover;
  windRegions: WindRegion[];
  stormRegions: StormRegion[];
  sandstormRegions: SandstormRegion[];
}

export class PlanetWindSystem extends System {
  static priority = SystemPriority.Higher;
  get systemType(): SystemType {
    return SystemType.Update;
  }

  private rover: Rover;
  private windRegions: WindRegion[];
  private stormRegions: StormRegion[];
  private sandstormRegions: SandstormRegion[];
  private windHitTimer = 0;
  private sandstormHitTimer = 0;

  constructor(params: PlanetWindSystemParams) {
    super();
    this.rover = params.rover;
    this.windRegions = params.windRegions;
    this.stormRegions = params.stormRegions;
    this.sandstormRegions = params.sandstormRegions;
  }

  reset(): void {
    this.windHitTimer = 0;
    this.sandstormHitTimer = 0;
  }

  update(elapsed: number): void {
    this.rover.windEffectThisFrame = getWindVelocityDelta(
      this.rover,
      this.windRegions,
      this.stormRegions,
      this.sandstormRegions,
      elapsed
    );

    const wind = this.rover.windEffectThisFrame;
    if (wind && (wind.x !== 0 || wind.y !== 0)) {
      this.windHitTimer += elapsed;
      if (this.windHitTimer >= 800) {
        this.windHitTimer = 0;
        recordHazardHit("wind");
      }
    } else {
      this.windHitTimer = 0;
    }

    let inSandstorm = false;
    for (const sandstorm of this.sandstormRegions) {
      if (sandstorm.isKilled()) continue;
      if (sandstorm.containsWorldPoint(this.rover.pos.x, this.rover.pos.y)) {
        inSandstorm = true;
        break;
      }
    }
    if (inSandstorm) {
      this.sandstormHitTimer += elapsed;
      if (this.sandstormHitTimer >= 800) {
        this.sandstormHitTimer = 0;
        recordHazardHit("sandstorm");
      }
    } else {
      this.sandstormHitTimer = 0;
    }
  }
}
