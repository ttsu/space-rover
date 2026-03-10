import {
  System,
  SystemPriority,
  SystemType,
  TransformComponent,
  World,
} from "excalibur";
import type { WindRegion } from "../hazards/WindRegion";
import type { StormRegion } from "../hazards/StormRegion";
import type { SandstormRegion } from "../hazards/SandstormRegion";
import { getWindVelocityDelta } from "../hazards/WindSystem";
import { recordHazardHit } from "../state/GameState";
import {
  PlayerTagComponent,
  WindReceiverComponent,
} from "../world/components/PlayerComponents";

export interface PlanetWindSystemParams {
  world: World;
  windRegions: WindRegion[];
  stormRegions: StormRegion[];
  sandstormRegions: SandstormRegion[];
}

export class PlanetWindSystem extends System {
  static priority = SystemPriority.Higher;
  get systemType(): SystemType {
    return SystemType.Update;
  }

  private playerQuery;
  private windRegions: WindRegion[];
  private stormRegions: StormRegion[];
  private sandstormRegions: SandstormRegion[];
  private windHitTimer = 0;
  private sandstormHitTimer = 0;

  constructor(params: PlanetWindSystemParams) {
    super();
    this.playerQuery = params.world.query([
      PlayerTagComponent,
      WindReceiverComponent,
      TransformComponent,
    ]);
    this.windRegions = params.windRegions;
    this.stormRegions = params.stormRegions;
    this.sandstormRegions = params.sandstormRegions;
  }

  reset(): void {
    this.windHitTimer = 0;
    this.sandstormHitTimer = 0;
  }

  update(elapsed: number): void {
    const player = this.playerQuery.entities[0];
    if (!player) return;
    const transform = player.get(TransformComponent);
    const windReceiver = player.get(WindReceiverComponent);
    if (!transform || !windReceiver) return;
    windReceiver.velocityDelta = getWindVelocityDelta(
      transform.pos.x,
      transform.pos.y,
      windReceiver.resistance,
      this.windRegions,
      this.stormRegions,
      this.sandstormRegions,
      elapsed
    );

    const wind = windReceiver.velocityDelta;
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
      if (sandstorm.containsWorldPoint(transform.pos.x, transform.pos.y)) {
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
